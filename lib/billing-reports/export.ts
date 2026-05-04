import {
  type AmazonBillingReportData,
  type WarnerDomesticDeliverableData,
  formatUsd,
  getExportTimestamp,
  sanitizeFileSegment,
} from "@/lib/billing-reports/amazon";

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function excelCell(value: string | number, type: "String" | "Number" = "String") {
  return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function excelRow(values: Array<string | number>, numberIndexes: number[] = []) {
  return `<Row>${values.map((value, index) => excelCell(value, numberIndexes.includes(index) ? "Number" : "String")).join("")}</Row>`;
}

function worksheet(name: string, rows: string[]) {
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${rows.join("")}</Table></Worksheet>`;
}

export function buildAmazonReportExcel(data: AmazonBillingReportData) {
  const detailHeaders = data.reportType === "localization"
    ? ["Date", "Title Name", "Asset Name", "Territory/Variant", "Asset Type", "Cost (USD)", "Contact Person"]
    : ["Date", "Title Name", "Asset Name", "Asset Type", "Cost (USD)", "Contact Person"];

  const detailRows = [
    excelRow([data.reportTitle]),
    excelRow(["Client", data.client.name]),
    excelRow(["Date Range", `${data.filters.fromDate} to ${data.filters.toDate}`]),
    excelRow([]),
    excelRow(detailHeaders),
    ...data.rows.map((row) => data.reportType === "localization"
      ? excelRow([row.date, row.titleName, row.assetName, row.territoryVariant ?? "-", row.assetType, row.cost, row.contactPerson], [5])
      : excelRow([row.date, row.titleName, row.assetName, row.assetType, row.cost, row.contactPerson], [4]),
    ),
  ];

  const summaryRows = [
    excelRow([`${data.reportTitle} Summary`]),
    excelRow(["Asset Type", "Total Assets", "Total Cost (USD)"]),
    ...data.summaryRows.map((row) => excelRow([row.assetType, row.totalAssets, row.totalCost], [1, 2])),
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${worksheet("Details", detailRows)}
 ${worksheet("Summary", summaryRows)}
</Workbook>`;
}

function escapePdfText(value: string | number) {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function sanitizePdfText(value: string | number) {
  return String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[â¹]/g, "Rs.")
    .replace(/[ââ]/g, "-")
    .trim();
}

function estimateMaxChars(width: number, fontSize: number) {
  return Math.max(6, Math.floor(width / (fontSize * 0.48)));
}

function wrapText(value: string | number, width: number, fontSize: number, maxLines = 2) {
  const text = sanitizePdfText(value) || "-";
  const maxChars = estimateMaxChars(width - 8, fontSize);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const remainingSlots = maxLines - lines.length;
    if (remainingSlots <= 0) break;

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxChars));
      current = word.slice(maxChars);
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (!lines.length) lines.push("-");

  if (lines.length === maxLines) {
    const lastIndex = maxLines - 1;
    const usedText = lines.join(" ");
    if (usedText.length < text.length) {
      lines[lastIndex] = `${lines[lastIndex].slice(0, Math.max(0, maxChars - 3))}...`;
    }
  }

  return lines;
}

type PdfTableColumn = {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
};

type PdfTableRow = Array<string | number>;

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN_X = 35;
const TOP_Y = 560;
const DETAIL_ROW_HEIGHT = 38;
const SUMMARY_ROW_HEIGHT = 30;
const HEADER_HEIGHT = 28;

function textCommand(text: string | number, x: number, y: number, fontSize = 8, bold = false) {
  return [
    "BT",
    `/${bold ? "F2" : "F1"} ${fontSize} Tf`,
    `${x.toFixed(2)} ${y.toFixed(2)} Td`,
    `(${escapePdfText(sanitizePdfText(text))}) Tj`,
    "ET",
  ].join("\n");
}

function rectCommand(x: number, y: number, width: number, height: number) {
  return `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`;
}

function fillRectCommand(x: number, y: number, width: number, height: number, gray = 0.93) {
  return `q\n${gray} g\n${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f\nQ`;
}

function tableWidth(columns: PdfTableColumn[]) {
  return columns.reduce((total, column) => total + column.width, 0);
}

function cellTextX(cellX: number, cellWidth: number, text: string | number, fontSize: number, align: PdfTableColumn["align"] = "left") {
  if (align === "right") {
    const approxTextWidth = sanitizePdfText(text).length * fontSize * 0.48;
    return Math.max(cellX + 4, cellX + cellWidth - approxTextWidth - 5);
  }
  if (align === "center") {
    const approxTextWidth = sanitizePdfText(text).length * fontSize * 0.48;
    return Math.max(cellX + 4, cellX + (cellWidth - approxTextWidth) / 2);
  }
  return cellX + 5;
}

function addTitleBlock(commands: string[], data: AmazonBillingReportData) {
  commands.push(textCommand(data.reportTitle, MARGIN_X, TOP_Y, 15, true));
  commands.push(textCommand(`Client: ${data.client.name}`, MARGIN_X, TOP_Y - 22, 9, true));
  commands.push(textCommand(`Date Range: ${data.filters.fromDate} to ${data.filters.toDate}`, MARGIN_X, TOP_Y - 38, 9));
  commands.push(textCommand(`Generated: ${new Date().toLocaleString("en-IN")}`, MARGIN_X, TOP_Y - 54, 9));
}

function drawTableHeader(commands: string[], columns: PdfTableColumn[], x: number, y: number) {
  const width = tableWidth(columns);
  commands.push(fillRectCommand(x, y - HEADER_HEIGHT, width, HEADER_HEIGHT));
  commands.push(rectCommand(x, y - HEADER_HEIGHT, width, HEADER_HEIGHT));

  let currentX = x;
  for (const column of columns) {
    commands.push(rectCommand(currentX, y - HEADER_HEIGHT, column.width, HEADER_HEIGHT));
    wrapText(column.header, column.width, 8, 2).forEach((line, index) => {
      commands.push(textCommand(line, currentX + 5, y - 12 - (index * 10), 8, true));
    });
    currentX += column.width;
  }
}

function drawTableRow(commands: string[], columns: PdfTableColumn[], values: PdfTableRow, x: number, y: number, rowHeight: number, fontSize = 7) {
  let currentX = x;
  columns.forEach((column, index) => {
    const value = values[index] ?? "-";
    commands.push(rectCommand(currentX, y - rowHeight, column.width, rowHeight));
    const lines = wrapText(value, column.width, fontSize, rowHeight > 32 ? 3 : 2);
    lines.forEach((line, lineIndex) => {
      const textX = cellTextX(currentX, column.width, line, fontSize, column.align ?? "left");
      commands.push(textCommand(line, textX, y - 12 - (lineIndex * 9), fontSize));
    });
    currentX += column.width;
  });
}

function buildPdfDocument(pageStreams: string[]) {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("PAGES_PLACEHOLDER");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  for (const stream of pageStreams) {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    pageObjectIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`);
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function buildDetailColumns(reportType: AmazonBillingReportData["reportType"]): PdfTableColumn[] {
  if (reportType === "localization") {
    return [
      { header: "Date", width: 64 },
      { header: "Title Name", width: 128 },
      { header: "Asset Name", width: 150 },
      { header: "Territory / Variant", width: 92 },
      { header: "Asset Type", width: 110 },
      { header: "Cost", width: 66, align: "right" },
      { header: "Contact Person", width: 228 },
    ];
  }

  return [
    { header: "Date", width: 68 },
    { header: "Title Name", width: 150 },
    { header: "Asset Name", width: 190 },
    { header: "Asset Type", width: 130 },
    { header: "Cost", width: 72, align: "right" },
    { header: "Contact Person", width: 228 },
  ];
}

function buildDetailRows(data: AmazonBillingReportData): PdfTableRow[] {
  return data.rows.map((row) => data.reportType === "localization"
    ? [row.date, row.titleName, row.assetName, row.territoryVariant ?? "-", row.assetType, formatUsd(row.cost), row.contactPerson]
    : [row.date, row.titleName, row.assetName, row.assetType, formatUsd(row.cost), row.contactPerson]);
}

function buildDetailPages(data: AmazonBillingReportData) {
  const columns = buildDetailColumns(data.reportType);
  const rows = buildDetailRows(data);
  const pageStreams: string[] = [];
  const x = MARGIN_X;
  const firstPageStartY = TOP_Y - 88;
  const laterPageStartY = TOP_Y - 36;

  if (!rows.length) {
    const commands: string[] = [];
    addTitleBlock(commands, data);
    commands.push(textCommand("Details", x, firstPageStartY + 8, 11, true));
    commands.push(textCommand("No records found for the selected filters.", x, firstPageStartY - 18, 9));
    pageStreams.push(commands.join("\n"));
    return pageStreams;
  }

  let rowIndex = 0;
  let pageNumber = 1;
  while (rowIndex < rows.length) {
    const commands: string[] = [];
    const isFirstPage = pageNumber === 1;
    const startY = isFirstPage ? firstPageStartY : laterPageStartY;
    const maxRows = Math.max(1, Math.floor((startY - 42) / DETAIL_ROW_HEIGHT));

    if (isFirstPage) {
      addTitleBlock(commands, data);
      commands.push(textCommand("Details", x, startY + 16, 11, true));
    } else {
      commands.push(textCommand(`${data.reportTitle} - Details continued`, x, TOP_Y, 13, true));
    }

    drawTableHeader(commands, columns, x, startY);
    let currentY = startY - HEADER_HEIGHT;
    rows.slice(rowIndex, rowIndex + maxRows).forEach((row) => {
      drawTableRow(commands, columns, row, x, currentY, DETAIL_ROW_HEIGHT, 7);
      currentY -= DETAIL_ROW_HEIGHT;
    });

    commands.push(textCommand(`Page ${pageStreams.length + 1}`, PAGE_WIDTH - 82, 18, 8));
    pageStreams.push(commands.join("\n"));
    rowIndex += maxRows;
    pageNumber += 1;
  }

  return pageStreams;
}

function buildSummaryPages(data: AmazonBillingReportData, startingPageNumber: number) {
  const columns: PdfTableColumn[] = [
    { header: "Asset Type", width: 380 },
    { header: "Total Assets", width: 130, align: "right" },
    { header: "Total Cost", width: 150, align: "right" },
  ];
  const rows: PdfTableRow[] = data.summaryRows.map((row) => [row.assetType, row.totalAssets, formatUsd(row.totalCost)]);
  const pageStreams: string[] = [];
  const x = MARGIN_X;
  const startY = TOP_Y - 54;

  const commands: string[] = [];
  commands.push(textCommand(`${data.reportTitle} - Summary by Asset Type`, x, TOP_Y, 13, true));
  commands.push(textCommand(`Client: ${data.client.name}`, x, TOP_Y - 22, 9));
  commands.push(textCommand(`Date Range: ${data.filters.fromDate} to ${data.filters.toDate}`, x, TOP_Y - 38, 9));

  if (!rows.length) {
    commands.push(textCommand("No summary available.", x, startY - 10, 9));
    commands.push(textCommand(`Page ${startingPageNumber}`, PAGE_WIDTH - 82, 18, 8));
    pageStreams.push(commands.join("\n"));
    return pageStreams;
  }

  drawTableHeader(commands, columns, x, startY);
  let currentY = startY - HEADER_HEIGHT;
  const maxRows = Math.max(1, Math.floor((currentY - 42) / SUMMARY_ROW_HEIGHT));
  rows.slice(0, maxRows).forEach((row) => {
    drawTableRow(commands, columns, row, x, currentY, SUMMARY_ROW_HEIGHT, 8);
    currentY -= SUMMARY_ROW_HEIGHT;
  });
  commands.push(textCommand(`Page ${startingPageNumber}`, PAGE_WIDTH - 82, 18, 8));
  pageStreams.push(commands.join("\n"));

  let rowIndex = maxRows;
  while (rowIndex < rows.length) {
    const continuationCommands: string[] = [];
    continuationCommands.push(textCommand(`${data.reportTitle} - Summary continued`, x, TOP_Y, 13, true));
    drawTableHeader(continuationCommands, columns, x, TOP_Y - 30);
    let y = TOP_Y - 30 - HEADER_HEIGHT;
    const rowsPerPage = Math.max(1, Math.floor((y - 42) / SUMMARY_ROW_HEIGHT));
    rows.slice(rowIndex, rowIndex + rowsPerPage).forEach((row) => {
      drawTableRow(continuationCommands, columns, row, x, y, SUMMARY_ROW_HEIGHT, 8);
      y -= SUMMARY_ROW_HEIGHT;
    });
    continuationCommands.push(textCommand(`Page ${startingPageNumber + pageStreams.length}`, PAGE_WIDTH - 82, 18, 8));
    pageStreams.push(continuationCommands.join("\n"));
    rowIndex += rowsPerPage;
  }

  return pageStreams;
}

export function buildAmazonReportPdf(data: AmazonBillingReportData) {
  const detailPages = buildDetailPages(data);
  const summaryPages = buildSummaryPages(data, detailPages.length + 1);
  return buildPdfDocument([...detailPages, ...summaryPages]);
}

export function buildAmazonReportFileName(data: AmazonBillingReportData, extension: "xls" | "pdf") {
  return `${sanitizeFileSegment(data.client.name)}_${sanitizeFileSegment(data.reportTitle)}_${getExportTimestamp()}.${extension}`;
}


export function buildWarnerDomesticReportExcel(data: WarnerDomesticDeliverableData) {
  const detailRows = [
    excelRow([data.reportTitle]),
    excelRow(["Client", data.client.name]),
    excelRow(["Movie", data.selectedMovie?.title ?? "-"]),
    excelRow([]),
    excelRow(["Billing Head / Project", "Cost (USD)"]),
    ...data.rows.flatMap((row, index, rows) => {
      const previous = rows[index - 1];
      const groupHeader = !previous || previous.group !== row.group ? [excelRow([row.group])] : [];
      return [
        ...groupHeader,
        excelRow([row.meta ? `${row.label} - ${row.meta}` : row.label, row.cost], [1]),
      ];
    }),
    excelRow([]),
    excelRow(["Total", data.totalCost], [1]),
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${worksheet("Domestic Deliverable", detailRows)}
</Workbook>`;
}

function buildWarnerDomesticPdfPages(data: WarnerDomesticDeliverableData) {
  const columns: PdfTableColumn[] = [
    { header: "Billing Head / Project", width: 560 },
    { header: "Cost", width: 170, align: "right" },
  ];
  const rows: PdfTableRow[] = [];
  let lastGroup = "";
  for (const row of data.rows) {
    if (row.group !== lastGroup) {
      rows.push([row.group, ""]);
      lastGroup = row.group;
    }
    rows.push([row.meta ? `${row.label} - ${row.meta}` : row.label, formatUsd(row.cost)]);
  }
  rows.push(["Total", formatUsd(data.totalCost)]);

  const pageStreams: string[] = [];
  const x = MARGIN_X;
  const startY = TOP_Y - 88;
  const laterPageStartY = TOP_Y - 38;
  let rowIndex = 0;
  let pageNumber = 1;

  if (!rows.length) {
    const commands: string[] = [];
    commands.push(textCommand(data.reportTitle, MARGIN_X, TOP_Y, 15, true));
    commands.push(textCommand(`Client: ${data.client.name}`, MARGIN_X, TOP_Y - 22, 9, true));
    commands.push(textCommand(`Movie: ${data.selectedMovie?.title ?? "-"}`, MARGIN_X, TOP_Y - 38, 9));
    commands.push(textCommand("No records found.", MARGIN_X, TOP_Y - 70, 9));
    pageStreams.push(commands.join("\n"));
    return pageStreams;
  }

  while (rowIndex < rows.length) {
    const commands: string[] = [];
    const isFirstPage = pageNumber === 1;
    const currentStartY = isFirstPage ? startY : laterPageStartY;
    const maxRows = Math.max(1, Math.floor((currentStartY - 42) / SUMMARY_ROW_HEIGHT));

    if (isFirstPage) {
      commands.push(textCommand(data.reportTitle, MARGIN_X, TOP_Y, 15, true));
      commands.push(textCommand(`Client: ${data.client.name}`, MARGIN_X, TOP_Y - 22, 9, true));
      commands.push(textCommand(`Movie: ${data.selectedMovie?.title ?? "-"}`, MARGIN_X, TOP_Y - 38, 9));
      commands.push(textCommand(`Generated: ${new Date().toLocaleString("en-IN")}`, MARGIN_X, TOP_Y - 54, 9));
    } else {
      commands.push(textCommand(`${data.reportTitle} continued`, MARGIN_X, TOP_Y, 13, true));
    }

    drawTableHeader(commands, columns, x, currentStartY);
    let y = currentStartY - HEADER_HEIGHT;
    rows.slice(rowIndex, rowIndex + maxRows).forEach((row) => {
      const isGroupOrTotal = row[1] === "" || row[0] === "Total";
      if (isGroupOrTotal) commands.push(fillRectCommand(x, y - SUMMARY_ROW_HEIGHT, tableWidth(columns), SUMMARY_ROW_HEIGHT, row[0] === "Total" ? 0.9 : 0.95));
      drawTableRow(commands, columns, row, x, y, SUMMARY_ROW_HEIGHT, 8);
      y -= SUMMARY_ROW_HEIGHT;
    });
    commands.push(textCommand(`Page ${pageStreams.length + 1}`, PAGE_WIDTH - 82, 18, 8));
    pageStreams.push(commands.join("\n"));
    rowIndex += maxRows;
    pageNumber += 1;
  }

  return pageStreams;
}

export function buildWarnerDomesticReportPdf(data: WarnerDomesticDeliverableData) {
  return buildPdfDocument(buildWarnerDomesticPdfPages(data));
}

export function buildWarnerDomesticReportFileName(data: WarnerDomesticDeliverableData, extension: "xls" | "pdf") {
  return `${sanitizeFileSegment(data.client.name)}_${sanitizeFileSegment(data.reportTitle)}_${getExportTimestamp()}.${extension}`;
}
