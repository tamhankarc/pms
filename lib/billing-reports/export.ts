import {
  type AmazonBillingReportData,
  type UniversalBillingSummaryData,
  type WarnerDomesticDeliverableData,
  formatUsd,
  getExportTimestamp,
  sanitizeFileSegment,
} from "@/lib/billing-reports/amazon";
import type { GenericBillingReportData } from "@/lib/billing-reports/generic";
import { getGenericBillingReportFileName } from "@/lib/billing-reports/generic";
import type {
  SonyPicturesReportData,
  SonyNewsletterBillingData,
} from "@/lib/billing-reports/sony";
import type { FilmikBillingReportData } from "@/lib/billing-reports/filmik";
import {
  getSonyPicturesReportFileName,
  getSonyNewsletterBillingFileName,
} from "@/lib/billing-reports/sony";
import { getFilmikBillingReportMonthLabel } from "@/lib/billing-reports/filmik";
import type { RoyalBillingData } from "@/lib/billing-reports/royal";
import { getRoyalBillingReportFileName } from "@/lib/billing-reports/royal";

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function excelCell(
  value: string | number,
  type: "String" | "Number" = "String",
) {
  return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function excelRow(
  values: Array<string | number>,
  numberIndexes: number[] = [],
) {
  return `<Row>${values.map((value, index) => excelCell(value, numberIndexes.includes(index) ? "Number" : "String")).join("")}</Row>`;
}

function worksheet(name: string, rows: string[]) {
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${rows.join("")}</Table></Worksheet>`;
}

export function buildAmazonReportExcel(data: AmazonBillingReportData) {
  const isUniversal = data.client.name === "Universal Pictures International";
  const isUniversalSocial = isUniversal && data.reportType === "social-assets";
  const isUniversalLocalization =
    isUniversal && data.reportType === "localization";
  const showCost = !isUniversal;
  const detailHeaders =
    data.reportType === "localization"
      ? [
          "Date",
          "Title Name",
          "Asset Name",
          "Territory/Variant",
          ...(isUniversalLocalization ? [] : ["Asset Type"]),
          ...(showCost ? ["Cost (USD)"] : []),
          "Contact Person",
        ]
      : [
          "Date",
          "Title Name",
          "Asset Name",
          "Asset Type",
          ...(showCost ? ["Cost (USD)"] : []),
          "Contact Person",
        ];

  const uniqueAssetCount = (rows: typeof data.rows) =>
    new Set(
      rows
        .map((row) => row.assetName)
        .filter((value) => value && value !== "-"),
    ).size;
  const uniqueCountryCount = (rows: typeof data.rows) =>
    new Set(
      rows
        .map((row) => row.territoryVariant ?? "")
        .filter((value) => value && value !== "-"),
    ).size;

  const rowToExcel = (row: (typeof data.rows)[number]) => {
    if (data.reportType === "localization") {
      const values = [
        row.date,
        row.titleName,
        row.assetName,
        row.territoryVariant ?? "-",
        ...(isUniversalLocalization ? [] : [row.assetType]),
        ...(showCost ? [row.cost] : []),
        row.contactPerson,
      ];
      return excelRow(values, showCost ? [values.length - 2] : []);
    }
    const values = [
      row.date,
      row.titleName,
      row.assetName,
      row.assetType,
      ...(showCost ? [row.cost] : []),
      row.contactPerson,
    ];
    return excelRow(values, showCost ? [values.length - 2] : []);
  };

  const detailRows = [
    excelRow([data.reportTitle]),
    excelRow(["Client", data.client.name]),
    excelRow([
      "Date Range",
      data.filters.fromDate || data.filters.toDate
        ? `${data.filters.fromDate || "Start"} to ${data.filters.toDate || "End"}`
        : "All dates",
    ]),
    excelRow([]),
  ];

  detailRows.push(excelRow(detailHeaders), ...data.rows.map(rowToExcel));
  if (isUniversalSocial)
    detailRows.push(
      excelRow(["Total Unique Assets", uniqueAssetCount(data.rows)], [1]),
    );
  if (isUniversalLocalization) {
    detailRows.push(
      excelRow(["Total Unique Assets", uniqueAssetCount(data.rows)], [1]),
    );
    detailRows.push(
      excelRow(
        ["Total Unique Territory/Variant", uniqueCountryCount(data.rows)],
        [1],
      ),
    );
  }

  const titleSummaryRows = isUniversal
    ? [
        excelRow(["Title Summary"]),
        excelRow(
          isUniversalLocalization
            ? [
                "Title Name",
                "Total Unique Assets",
                "Total Unique Territory/Variant",
              ]
            : ["Title Name", "Total Assets"],
        ),
        ...data.titleSummaryRows.map((row) =>
          excelRow(
            isUniversalLocalization
              ? [row.titleName, row.totalAssets, row.totalCountries]
              : [row.titleName, row.totalAssets],
            isUniversalLocalization ? [1, 2] : [1],
          ),
        ),
      ]
    : [];
  const completedSummaryRows = isUniversalLocalization
    ? [
        excelRow(["Completed & Billed Title Summary"]),
        excelRow([
          "Title Name",
          "Total Unique Assets",
          "Total Unique Territory/Variant",
        ]),
        ...data.completedTitleSummaryRows.map((row) =>
          excelRow(
            [row.titleName, row.totalAssets, row.totalCountries],
            [1, 2],
          ),
        ),
      ]
    : [];

  const summaryRows = !isUniversal
    ? [
        excelRow([`${data.reportTitle} Summary`]),
        excelRow(["Asset Type", "Total Assets", "Total Cost (USD)"]),
        ...data.summaryRows.map((row) =>
          excelRow([row.assetType, row.totalAssets, row.totalCost], [1, 2]),
        ),
      ]
    : [];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${titleSummaryRows.length ? worksheet("Title Summary", titleSummaryRows) : ""}
 ${completedSummaryRows.length ? worksheet("Completed Billed", completedSummaryRows) : ""}
 ${worksheet("Details", detailRows)}
 ${summaryRows.length ? worksheet("Summary", summaryRows) : ""}
</Workbook>`;
}

export function buildUniversalBillingSummaryExcel(
  data: UniversalBillingSummaryData,
) {
  const totalAssets = data.rows.reduce((sum, row) => sum + row.totalAssets, 0);
  const totalCountries = data.rows.reduce(
    (sum, row) => sum + row.totalCountries,
    0,
  );
  const completedTotalAssets = data.completedTitleSummaryRows.reduce(
    (sum, row) => sum + row.totalAssets,
    0,
  );
  const completedTotalCountries = data.completedTitleSummaryRows.reduce(
    (sum, row) => sum + row.totalCountries,
    0,
  );
  const rows = [
    excelRow([data.reportTitle]),
    excelRow(["Client", data.client.name]),
    excelRow([
      "Title Filter",
      data.filters.movieId === "all" ? "All titles" : data.filters.movieId,
    ]),
    excelRow([]),
    excelRow([
      "Title Name",
      "Total Unique Assets",
      "Total Unique Territory/Variant",
    ]),
    ...data.rows.map((row) =>
      excelRow([row.titleName, row.totalAssets, row.totalCountries], [1, 2]),
    ),
    excelRow(["Total", totalAssets, totalCountries], [1, 2]),
  ];
  const completedRows = [
    excelRow(["Completed & Billed Title Summary"]),
    excelRow(["Client", data.client.name]),
    excelRow([
      "Title Filter",
      data.filters.movieId === "all" ? "All titles" : data.filters.movieId,
    ]),
    excelRow([]),
    excelRow([
      "Title Name",
      "Total Unique Assets",
      "Total Unique Territory/Variant",
    ]),
    ...data.completedTitleSummaryRows.map((row) =>
      excelRow([row.titleName, row.totalAssets, row.totalCountries], [1, 2]),
    ),
    ...(data.completedTitleSummaryRows.length
      ? [
          excelRow(
            ["Total", completedTotalAssets, completedTotalCountries],
            [1, 2],
          ),
        ]
      : []),
  ];
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${worksheet("Billing Summary", rows)}
 ${worksheet("Completed Billed", completedRows)}
</Workbook>`;
}

function escapePdfText(value: string | number) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function sanitizePdfText(value: string | number) {
  return String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[Ã¢ÂÂ¹]/g, "Rs.")
    .replace(/[Ã¢ÂÂÃ¢ÂÂ]/g, "-")
    .trim();
}

function estimateMaxChars(width: number, fontSize: number) {
  return Math.max(6, Math.floor(width / (fontSize * 0.48)));
}

function wrapText(
  value: string | number,
  width: number,
  fontSize: number,
  maxLines = 2,
) {
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
      lines[lastIndex] =
        `${lines[lastIndex].slice(0, Math.max(0, maxChars - 3))}...`;
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

function textCommand(
  text: string | number,
  x: number,
  y: number,
  fontSize = 8,
  bold = false,
) {
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

function fillRectCommand(
  x: number,
  y: number,
  width: number,
  height: number,
  gray = 0.93,
) {
  return `q\n${gray} g\n${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f\nQ`;
}

function tableWidth(columns: PdfTableColumn[]) {
  return columns.reduce((total, column) => total + column.width, 0);
}

function cellTextX(
  cellX: number,
  cellWidth: number,
  text: string | number,
  fontSize: number,
  align: PdfTableColumn["align"] = "left",
) {
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
  commands.push(
    textCommand(`Client: ${data.client.name}`, MARGIN_X, TOP_Y - 22, 9, true),
  );
  commands.push(
    textCommand(
      `Date Range: ${data.filters.fromDate} to ${data.filters.toDate}`,
      MARGIN_X,
      TOP_Y - 38,
      9,
    ),
  );
  commands.push(
    textCommand(
      `Generated: ${new Date().toLocaleString("en-IN")}`,
      MARGIN_X,
      TOP_Y - 54,
      9,
    ),
  );
}

function drawTableHeader(
  commands: string[],
  columns: PdfTableColumn[],
  x: number,
  y: number,
) {
  const width = tableWidth(columns);
  commands.push(fillRectCommand(x, y - HEADER_HEIGHT, width, HEADER_HEIGHT));
  commands.push(rectCommand(x, y - HEADER_HEIGHT, width, HEADER_HEIGHT));

  let currentX = x;
  for (const column of columns) {
    commands.push(
      rectCommand(currentX, y - HEADER_HEIGHT, column.width, HEADER_HEIGHT),
    );
    wrapText(column.header, column.width, 8, 2).forEach((line, index) => {
      commands.push(
        textCommand(line, currentX + 5, y - 12 - index * 10, 8, true),
      );
    });
    currentX += column.width;
  }
}

function drawTableRow(
  commands: string[],
  columns: PdfTableColumn[],
  values: PdfTableRow,
  x: number,
  y: number,
  rowHeight: number,
  fontSize = 7,
) {
  let currentX = x;
  columns.forEach((column, index) => {
    const value = values[index] ?? "-";
    commands.push(
      rectCommand(currentX, y - rowHeight, column.width, rowHeight),
    );
    const lines = wrapText(
      value,
      column.width,
      fontSize,
      rowHeight > 32 ? 3 : 2,
    );
    lines.forEach((line, lineIndex) => {
      const textX = cellTextX(
        currentX,
        column.width,
        line,
        fontSize,
        column.align ?? "left",
      );
      commands.push(textCommand(line, textX, y - 12 - lineIndex * 9, fontSize));
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
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`,
    );
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

function buildDetailColumns(data: AmazonBillingReportData): PdfTableColumn[] {
  const isUniversal = data.client.name === "Universal Pictures International";
  const isUniversalLocalization =
    isUniversal && data.reportType === "localization";
  const isUniversalSocial = isUniversal && data.reportType === "social-assets";
  if (data.reportType === "localization") {
    return isUniversalLocalization
      ? [
          { header: "Date", width: 72 },
          { header: "Title Name", width: 150 },
          { header: "Asset Name", width: 180 },
          { header: "Territory / Variant", width: 150 },
          { header: "Contact Person", width: 270 },
        ]
      : [
          { header: "Date", width: 64 },
          { header: "Title Name", width: 128 },
          { header: "Asset Name", width: 150 },
          { header: "Territory / Variant", width: 92 },
          { header: "Asset Type", width: 110 },
          { header: "Cost", width: 66, align: "right" },
          { header: "Contact Person", width: 228 },
        ];
  }

  return isUniversalSocial
    ? [
        { header: "Date", width: 70 },
        { header: "Title Name", width: 160 },
        { header: "Asset Name", width: 210 },
        { header: "Asset Type", width: 140 },
        { header: "Contact Person", width: 240 },
      ]
    : [
        { header: "Date", width: 68 },
        { header: "Title Name", width: 150 },
        { header: "Asset Name", width: 190 },
        { header: "Asset Type", width: 130 },
        { header: "Cost", width: 72, align: "right" },
        { header: "Contact Person", width: 228 },
      ];
}

function buildDetailRows(data: AmazonBillingReportData): PdfTableRow[] {
  const isUniversal = data.client.name === "Universal Pictures International";
  const isUniversalLocalization =
    isUniversal && data.reportType === "localization";
  const isUniversalSocial = isUniversal && data.reportType === "social-assets";
  return data.rows.map((row) => {
    if (data.reportType === "localization") {
      return isUniversalLocalization
        ? [
            row.date,
            row.titleName,
            row.assetName,
            row.territoryVariant ?? "-",
            row.contactPerson,
          ]
        : [
            row.date,
            row.titleName,
            row.assetName,
            row.territoryVariant ?? "-",
            row.assetType,
            formatUsd(row.cost),
            row.contactPerson,
          ];
    }

    return isUniversalSocial
      ? [
          row.date,
          row.titleName,
          row.assetName,
          row.assetType,
          row.contactPerson,
        ]
      : [
          row.date,
          row.titleName,
          row.assetName,
          row.assetType,
          formatUsd(row.cost),
          row.contactPerson,
        ];
  });
}

function buildDetailPages(data: AmazonBillingReportData) {
  const columns = buildDetailColumns(data);
  const rows = buildDetailRows(data);
  const pageStreams: string[] = [];
  const x = MARGIN_X;
  const firstPageStartY = TOP_Y - 88;
  const laterPageStartY = TOP_Y - 36;

  if (!rows.length) {
    const commands: string[] = [];
    addTitleBlock(commands, data);
    commands.push(textCommand("Details", x, firstPageStartY + 8, 11, true));
    commands.push(
      textCommand(
        "No records found for the selected filters.",
        x,
        firstPageStartY - 18,
        9,
      ),
    );
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
      commands.push(
        textCommand(
          `${data.reportTitle} - Details continued`,
          x,
          TOP_Y,
          13,
          true,
        ),
      );
    }

    drawTableHeader(commands, columns, x, startY);
    let currentY = startY - HEADER_HEIGHT;
    rows.slice(rowIndex, rowIndex + maxRows).forEach((row) => {
      drawTableRow(commands, columns, row, x, currentY, DETAIL_ROW_HEIGHT, 7);
      currentY -= DETAIL_ROW_HEIGHT;
    });

    commands.push(
      textCommand(`Page ${pageStreams.length + 1}`, PAGE_WIDTH - 82, 18, 8),
    );
    pageStreams.push(commands.join("\n"));
    rowIndex += maxRows;
    pageNumber += 1;
  }

  return pageStreams;
}

function buildSummaryPages(
  data: AmazonBillingReportData,
  startingPageNumber: number,
) {
  const isUniversalLocalization =
    data.client.name === "Universal Pictures International" &&
    data.reportType === "localization";
  const columns: PdfTableColumn[] = isUniversalLocalization
    ? [
        { header: "Total Unique Assets", width: 180, align: "right" },
        { header: "Total Cost", width: 180, align: "right" },
      ]
    : [
        { header: "Asset Type", width: 380 },
        { header: "Total Assets", width: 130, align: "right" },
        { header: "Total Cost", width: 150, align: "right" },
      ];
  const rows: PdfTableRow[] = isUniversalLocalization
    ? [
        [
          data.summaryRows.reduce((sum, row) => sum + row.totalAssets, 0),
          formatUsd(
            data.summaryRows.reduce((sum, row) => sum + row.totalCost, 0),
          ),
        ],
      ]
    : data.summaryRows.map((row) => [
        row.assetType,
        row.totalAssets,
        formatUsd(row.totalCost),
      ]);
  const pageStreams: string[] = [];
  const x = MARGIN_X;
  const startY = TOP_Y - 54;

  const commands: string[] = [];
  commands.push(
    textCommand(
      `${data.reportTitle} - Summary by Asset Type`,
      x,
      TOP_Y,
      13,
      true,
    ),
  );
  commands.push(textCommand(`Client: ${data.client.name}`, x, TOP_Y - 22, 9));
  commands.push(
    textCommand(
      `Date Range: ${data.filters.fromDate} to ${data.filters.toDate}`,
      x,
      TOP_Y - 38,
      9,
    ),
  );

  if (!rows.length) {
    commands.push(textCommand("No summary available.", x, startY - 10, 9));
    commands.push(
      textCommand(`Page ${startingPageNumber}`, PAGE_WIDTH - 82, 18, 8),
    );
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
  commands.push(
    textCommand(`Page ${startingPageNumber}`, PAGE_WIDTH - 82, 18, 8),
  );
  pageStreams.push(commands.join("\n"));

  let rowIndex = maxRows;
  while (rowIndex < rows.length) {
    const continuationCommands: string[] = [];
    continuationCommands.push(
      textCommand(
        `${data.reportTitle} - Summary continued`,
        x,
        TOP_Y,
        13,
        true,
      ),
    );
    drawTableHeader(continuationCommands, columns, x, TOP_Y - 30);
    let y = TOP_Y - 30 - HEADER_HEIGHT;
    const rowsPerPage = Math.max(1, Math.floor((y - 42) / SUMMARY_ROW_HEIGHT));
    rows.slice(rowIndex, rowIndex + rowsPerPage).forEach((row) => {
      drawTableRow(
        continuationCommands,
        columns,
        row,
        x,
        y,
        SUMMARY_ROW_HEIGHT,
        8,
      );
      y -= SUMMARY_ROW_HEIGHT;
    });
    continuationCommands.push(
      textCommand(
        `Page ${startingPageNumber + pageStreams.length}`,
        PAGE_WIDTH - 82,
        18,
        8,
      ),
    );
    pageStreams.push(continuationCommands.join("\n"));
    rowIndex += rowsPerPage;
  }

  return pageStreams;
}

export function buildAmazonReportPdf(data: AmazonBillingReportData) {
  const detailPages = buildDetailPages(data);
  if (data.client.name === "Universal Pictures International")
    return buildPdfDocument(detailPages);
  const summaryPages = buildSummaryPages(data, detailPages.length + 1);
  return buildPdfDocument([...detailPages, ...summaryPages]);
}

export function buildUniversalBillingSummaryPdf(
  data: UniversalBillingSummaryData,
) {
  const columns: PdfTableColumn[] = [
    { header: "Title Name", width: 420 },
    { header: "Total Unique Assets", width: 150, align: "right" },
    { header: "Total Unique Territory/Variant", width: 220, align: "right" },
  ];
  const rows: PdfTableRow[] = data.rows.map((row) => [
    row.titleName,
    row.totalAssets,
    row.totalCountries,
  ]);
  rows.push([
    "Total",
    data.rows.reduce((sum, row) => sum + row.totalAssets, 0),
    data.rows.reduce((sum, row) => sum + row.totalCountries, 0),
  ]);
  const completedRows: PdfTableRow[] = data.completedTitleSummaryRows.map(
    (row) => [row.titleName, row.totalAssets, row.totalCountries],
  );
  if (completedRows.length) {
    completedRows.push([
      "Total",
      data.completedTitleSummaryRows.reduce(
        (sum, row) => sum + row.totalAssets,
        0,
      ),
      data.completedTitleSummaryRows.reduce(
        (sum, row) => sum + row.totalCountries,
        0,
      ),
    ]);
  }
  const commands: string[] = [];
  commands.push(textCommand(data.reportTitle, MARGIN_X, TOP_Y, 15, true));
  commands.push(
    textCommand(`Client: ${data.client.name}`, MARGIN_X, TOP_Y - 22, 9, true),
  );
  commands.push(
    textCommand(
      `Title Filter: ${data.filters.movieId === "all" ? "All titles" : data.filters.movieId}`,
      MARGIN_X,
      TOP_Y - 38,
      9,
    ),
  );
  const startY = TOP_Y - 72;
  drawTableHeader(commands, columns, MARGIN_X, startY);
  let currentY = startY - HEADER_HEIGHT;
  rows.slice(0, 13).forEach((row) => {
    drawTableRow(
      commands,
      columns,
      row,
      MARGIN_X,
      currentY,
      SUMMARY_ROW_HEIGHT,
      8,
    );
    currentY -= SUMMARY_ROW_HEIGHT;
  });
  if (completedRows.length && currentY > 120) {
    currentY -= 24;
    commands.push(
      textCommand(
        "Completed & Billed Title Summary",
        MARGIN_X,
        currentY,
        12,
        true,
      ),
    );
    currentY -= 18;
    drawTableHeader(commands, columns, MARGIN_X, currentY);
    currentY -= HEADER_HEIGHT;
    completedRows.slice(0, 6).forEach((row) => {
      drawTableRow(
        commands,
        columns,
        row,
        MARGIN_X,
        currentY,
        SUMMARY_ROW_HEIGHT,
        8,
      );
      currentY -= SUMMARY_ROW_HEIGHT;
    });
  }
  return buildPdfDocument([commands.join("\n")]);
}

export function buildAmazonReportFileName(
  data: AmazonBillingReportData,
  extension: "xls" | "pdf",
) {
  return `${sanitizeFileSegment(data.client.name)}_${sanitizeFileSegment(data.reportTitle)}_${getExportTimestamp()}.${extension}`;
}

export function buildWarnerDomesticReportExcel(
  data: WarnerDomesticDeliverableData,
) {
  const detailRows = [
    excelRow([data.reportTitle]),
    excelRow(["Client", data.client.name]),
  ];
  if (data.titleBlocks?.length) {
    for (const block of data.titleBlocks) {
      detailRows.push(
        excelRow([]),
        excelRow(["Title", block.selectedMovie.title]),
      );
      if (data.reportType === "other-deliverable")
        detailRows.push(
          excelRow(["Country", block.selectedCountry?.name ?? "-"]),
        );
      detailRows.push(excelRow(["Billing Head / Project", "Cost (USD)"]));
      detailRows.push(
        ...block.rows.map((row) =>
          excelRow([getDeliverableDisplayLabel(row), row.cost], [1]),
        ),
      );
      detailRows.push(excelRow(["Total", block.totalCost], [1]));
    }
  } else {
    detailRows.push(
      excelRow(["Title", data.selectedMovie?.title ?? "-"]),
      ...(data.reportType === "other-deliverable"
        ? [excelRow(["Country", data.selectedCountry?.name ?? "-"])]
        : []),
      excelRow([]),
      excelRow(["Billing Head / Project", "Cost (USD)"]),
      ...data.rows.map((row) =>
        excelRow([getDeliverableDisplayLabel(row), row.cost], [1]),
      ),
      excelRow([]),
      excelRow(["Total", data.totalCost], [1]),
    );
  }

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${worksheet(data.reportTitle, detailRows)}
</Workbook>`;
}

function buildWarnerDomesticPdfPages(data: WarnerDomesticDeliverableData) {
  const columns: PdfTableColumn[] = [
    { header: "Billing Head / Project", width: 560 },
    { header: "Cost", width: 170, align: "right" },
  ];
  const rows: PdfTableRow[] = [];
  if (data.titleBlocks?.length) {
    for (const block of data.titleBlocks) {
      rows.push([
        block.selectedMovie.title +
          (block.selectedCountry ? ` / ${block.selectedCountry.name}` : ""),
        "",
      ]);
      rows.push(
        ...block.rows.map((row) => [
          getDeliverableDisplayLabel(row),
          formatUsd(row.cost),
        ]),
      );
      rows.push(["Total", formatUsd(block.totalCost)]);
    }
  } else {
    rows.push(
      ...data.rows.map((row) => [
        getDeliverableDisplayLabel(row),
        formatUsd(row.cost),
      ]),
    );
    rows.push(["Total", formatUsd(data.totalCost)]);
  }

  const pageStreams: string[] = [];
  const x = MARGIN_X;
  const startY = TOP_Y - 88;
  const laterPageStartY = TOP_Y - 38;
  let rowIndex = 0;
  let pageNumber = 1;

  while (rowIndex < rows.length) {
    const commands: string[] = [];
    const isFirstPage = pageNumber === 1;
    const currentStartY = isFirstPage ? startY : laterPageStartY;
    const maxRows = Math.max(
      1,
      Math.floor((currentStartY - 42) / SUMMARY_ROW_HEIGHT),
    );

    if (isFirstPage) {
      commands.push(textCommand(data.reportTitle, MARGIN_X, TOP_Y, 15, true));
      commands.push(
        textCommand(
          `Client: ${data.client.name}`,
          MARGIN_X,
          TOP_Y - 22,
          9,
          true,
        ),
      );
      commands.push(
        textCommand(
          `Title: ${data.selectedMovie?.title ?? "-"}`,
          MARGIN_X,
          TOP_Y - 38,
          9,
        ),
      );
      if (data.reportType === "other-deliverable")
        commands.push(
          textCommand(
            `Country: ${data.selectedCountry?.name ?? "-"}`,
            MARGIN_X,
            TOP_Y - 54,
            9,
          ),
        );
      commands.push(
        textCommand(
          `Generated: ${new Date().toLocaleString("en-IN")}`,
          MARGIN_X,
          data.reportType === "other-deliverable" ? TOP_Y - 70 : TOP_Y - 54,
          9,
        ),
      );
    } else {
      commands.push(
        textCommand(`${data.reportTitle} continued`, MARGIN_X, TOP_Y, 13, true),
      );
    }

    drawTableHeader(commands, columns, x, currentStartY);
    let y = currentStartY - HEADER_HEIGHT;
    rows.slice(rowIndex, rowIndex + maxRows).forEach((row) => {
      if (row[0] === "Total")
        commands.push(
          fillRectCommand(
            x,
            y - SUMMARY_ROW_HEIGHT,
            tableWidth(columns),
            SUMMARY_ROW_HEIGHT,
            0.9,
          ),
        );
      drawTableRow(commands, columns, row, x, y, SUMMARY_ROW_HEIGHT, 8);
      y -= SUMMARY_ROW_HEIGHT;
    });
    commands.push(
      textCommand(`Page ${pageStreams.length + 1}`, PAGE_WIDTH - 82, 18, 8),
    );
    pageStreams.push(commands.join("\n"));
    rowIndex += maxRows;
    pageNumber += 1;
  }

  return pageStreams;
}

export function buildWarnerDomesticReportPdf(
  data: WarnerDomesticDeliverableData,
) {
  return buildPdfDocument(buildWarnerDomesticPdfPages(data));
}

export function buildWarnerDomesticReportFileName(
  data: WarnerDomesticDeliverableData,
  extension: "xls" | "pdf",
) {
  return `${sanitizeFileSegment(data.client.name)}_${sanitizeFileSegment(data.reportTitle)}_${getExportTimestamp()}.${extension}`;
}

function getDeliverableDisplayLabel(
  row: WarnerDomesticDeliverableData["rows"][number],
) {
  return row.meta?.startsWith("Countries:")
    ? `${row.label} - ${row.meta}`
    : row.label;
}

function formatGenericProjectDisplay(
  row: GenericBillingReportData["blocks"][number]["rows"][number],
) {
  return row.projectName;
}

function formatGenericCountryDisplay(
  row: GenericBillingReportData["blocks"][number]["rows"][number],
) {
  return row.lensDetails?.length
    ? row.lensDetails.join("\n")
    : (row.countryList ?? "-");
}

export function buildGenericBillingReportExcel(data: GenericBillingReportData) {
  if (data.titleBlocks?.length) {
    const usedSheetNames = new Set<string>();
    const makeSheetName = (base: string) => {
      const cleaned = base.replace(/[\\/?*\[\]:]/g, " ").trim() || "Sheet";
      let candidate = cleaned.slice(0, 31);
      let index = 2;
      while (usedSheetNames.has(candidate)) {
        const suffix = ` ${index}`;
        candidate = `${cleaned.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
        index += 1;
      }
      usedSheetNames.add(candidate);
      return candidate;
    };

    const blockWorksheet = (
      title: string,
      block: GenericBillingReportData["blocks"][number],
    ) => {
      const header =
        block.key === "fixedPerCountry"
          ? [
              "Project",
              "Contact Person",
              "Lens Type / Country List",
              ...(block.showDeveloperCost
                ? [
                    "Developer Cost (USD)",
                    "Project Cost (USD)",
                    "Total Cost (USD)",
                  ]
                : ["Cost (USD)"]),
            ]
          : [
              "Project",
              "Contact Person",
              "Status",
              ...(block.showDeveloperCost
                ? [
                    "Developer Cost (USD)",
                    "Project Cost (USD)",
                    "Total Cost (USD)",
                  ]
                : ["Cost (USD)"]),
            ];
      const numericIndexes = block.showDeveloperCost
        ? [header.length - 3, header.length - 2, header.length - 1]
        : [header.length - 1];
      const rows = [
        excelRow(["Client", data.client.name]),
        excelRow(["Title", title]),
        ...(block.key === "hourly"
          ? [
              excelRow([
                "Date Range",
                data.filters.fromDate || data.filters.toDate
                  ? `${data.filters.fromDate || "Start"} to ${data.filters.toDate || "End"}`
                  : "All dates",
              ]),
            ]
          : []),
        excelRow([]),
        excelRow(header),
        ...block.rows.map((row) => {
          const values =
            block.key === "fixedPerCountry"
              ? [
                  formatGenericProjectDisplay(row),
                  row.contactPerson,
                  formatGenericCountryDisplay(row),
                  ...(block.showDeveloperCost
                    ? [
                        Number(row.developerCost ?? 0),
                        row.projectCost,
                        row.cost,
                      ]
                    : [row.cost]),
                ]
              : [
                  formatGenericProjectDisplay(row),
                  row.contactPerson,
                  row.status,
                  ...(block.showDeveloperCost
                    ? [
                        Number(row.developerCost ?? 0),
                        row.projectCost,
                        row.cost,
                      ]
                    : [row.cost]),
                ];
          return excelRow(values, numericIndexes);
        }),
        excelRow([]),
        excelRow(
          [
            "Total",
            "",
            "",
            ...(block.showDeveloperCost
              ? [
                  block.rows.reduce(
                    (sum, row) => sum + Number(row.developerCost ?? 0),
                    0,
                  ),
                  block.rows.reduce((sum, row) => sum + row.projectCost, 0),
                  block.rows.reduce((sum, row) => sum + row.cost, 0),
                ]
              : [block.rows.reduce((sum, row) => sum + row.cost, 0)]),
          ],
          numericIndexes,
        ),
      ];
      return worksheet(makeSheetName(`${title} ${block.title}`), rows);
    };

    const summaryRows = [
      excelRow([`${data.client.name} Billing`]),
      excelRow(["Client", data.client.name]),
      excelRow(["Title", "All Titles"]),
      excelRow([
        "Hourly Date Range",
        data.filters.fromDate || data.filters.toDate
          ? `${data.filters.fromDate || "Start"} to ${data.filters.toDate || "End"}`
          : "All dates",
      ]),
      excelRow([]),
      excelRow(["Title", "Total Cost (USD)"]),
      ...data.titleBlocks.map((titleBlock) =>
        excelRow([titleBlock.movie.title, titleBlock.totalCost], [1]),
      ),
      excelRow([]),
      excelRow(
        [
          "Grand Total",
          data.titleBlocks.reduce(
            (sum, titleBlock) => sum + titleBlock.totalCost,
            0,
          ),
        ],
        [1],
      ),
    ];

    const worksheets = data.titleBlocks.flatMap((titleBlock) =>
      titleBlock.blocks.map((block) =>
        blockWorksheet(titleBlock.movie.title, block),
      ),
    );

    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${worksheet("Summary", summaryRows)}
 ${worksheets.join("\n")}
</Workbook>`;
  }

  const worksheets = data.blocks.map((block) => {
    const header =
      block.key === "fixedPerCountry"
        ? [
            "Project",
            "Contact Person",
            "Lens Type / Country List",
            ...(block.showDeveloperCost
              ? [
                  "Developer Cost (USD)",
                  "Project Cost (USD)",
                  "Total Cost (USD)",
                ]
              : ["Cost (USD)"]),
          ]
        : [
            "Project",
            "Contact Person",
            "Status",
            ...(block.showDeveloperCost
              ? [
                  "Developer Cost (USD)",
                  "Project Cost (USD)",
                  "Total Cost (USD)",
                ]
              : ["Cost (USD)"]),
          ];
    const numericIndexes = block.showDeveloperCost
      ? [header.length - 3, header.length - 2, header.length - 1]
      : [header.length - 1];
    const rows = [
      excelRow(["Client", data.client.name]),
      ...(data.selectedMovie
        ? [excelRow(["Title", data.selectedMovie.title])]
        : []),
      ...(block.key === "hourly"
        ? [
            excelRow([
              "Date Range",
              data.filters.fromDate || data.filters.toDate
                ? `${data.filters.fromDate || "Start"} to ${data.filters.toDate || "End"}`
                : "All dates",
            ]),
          ]
        : []),
      excelRow([]),
      excelRow(header),
      ...block.rows.map((row) => {
        const values =
          block.key === "fixedPerCountry"
            ? [
                formatGenericProjectDisplay(row),
                row.contactPerson,
                formatGenericCountryDisplay(row),
                ...(block.showDeveloperCost
                  ? [Number(row.developerCost ?? 0), row.projectCost, row.cost]
                  : [row.cost]),
              ]
            : [
                formatGenericProjectDisplay(row),
                row.contactPerson,
                row.status,
                ...(block.showDeveloperCost
                  ? [Number(row.developerCost ?? 0), row.projectCost, row.cost]
                  : [row.cost]),
              ];
        return excelRow(values, numericIndexes);
      }),
      excelRow([]),
      excelRow(
        [
          "Total",
          "",
          "",
          ...(block.showDeveloperCost
            ? [
                block.rows.reduce(
                  (sum, row) => sum + Number(row.developerCost ?? 0),
                  0,
                ),
                block.rows.reduce((sum, row) => sum + row.projectCost, 0),
                block.rows.reduce((sum, row) => sum + row.cost, 0),
              ]
            : [block.rows.reduce((sum, row) => sum + row.cost, 0)]),
        ],
        numericIndexes,
      ),
    ];
    return worksheet(block.title.slice(0, 31), rows);
  });

  const hasDeveloperCosts = data.blocks.some(
    (block) => block.showDeveloperCost,
  );
  const summaryHeader = hasDeveloperCosts
    ? [
        "Billing Model",
        "Developer Cost (USD)",
        "Project Cost (USD)",
        "Total Cost (USD)",
      ]
    : ["Billing Model", "Total Cost (USD)"];
  const summaryNumericIndexes = hasDeveloperCosts ? [1, 2, 3] : [1];
  const summaryRows = [
    excelRow([`${data.client.name} Billing`]),
    excelRow(["Client", data.client.name]),
    ...(data.selectedMovie
      ? [excelRow(["Title", data.selectedMovie.title])]
      : []),
    excelRow([
      "Hourly Date Range",
      data.filters.fromDate || data.filters.toDate
        ? `${data.filters.fromDate || "Start"} to ${data.filters.toDate || "End"}`
        : "All dates",
    ]),
    excelRow([]),
    excelRow(summaryHeader),
    ...data.blocks.map((block) =>
      hasDeveloperCosts
        ? excelRow(
            [
              block.title,
              block.rows.reduce(
                (sum, row) => sum + Number(row.developerCost ?? 0),
                0,
              ),
              block.rows.reduce((sum, row) => sum + row.projectCost, 0),
              block.rows.reduce((sum, row) => sum + row.cost, 0),
            ],
            summaryNumericIndexes,
          )
        : excelRow(
            [block.title, block.rows.reduce((sum, row) => sum + row.cost, 0)],
            summaryNumericIndexes,
          ),
    ),
    excelRow([]),
    hasDeveloperCosts
      ? excelRow(
          [
            "Grand Total",
            data.blocks.reduce(
              (sum, block) =>
                sum +
                block.rows.reduce(
                  (blockSum, row) => blockSum + Number(row.developerCost ?? 0),
                  0,
                ),
              0,
            ),
            data.blocks.reduce(
              (sum, block) =>
                sum +
                block.rows.reduce(
                  (blockSum, row) => blockSum + row.projectCost,
                  0,
                ),
              0,
            ),
            data.blocks.reduce(
              (sum, block) =>
                sum +
                block.rows.reduce((blockSum, row) => blockSum + row.cost, 0),
              0,
            ),
          ],
          summaryNumericIndexes,
        )
      : excelRow(
          [
            "Grand Total",
            data.blocks.reduce(
              (sum, block) =>
                sum +
                block.rows.reduce((blockSum, row) => blockSum + row.cost, 0),
              0,
            ),
          ],
          summaryNumericIndexes,
        ),
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${worksheet("Summary", summaryRows)}
 ${worksheets.join("\n")}
</Workbook>`;
}

function buildGenericBillingReportPdfPages(data: GenericBillingReportData) {
  if (data.titleBlocks?.length) {
    return buildGenericBillingReportPdfPages({
      ...data,
      selectedMovie: null,
      blocks: data.titleBlocks.flatMap((titleBlock) =>
        titleBlock.blocks.map((block) => ({
          ...block,
          title: `${titleBlock.movie.title} - ${block.title}`,
        })),
      ),
      titleBlocks: [],
    });
  }

  const pageStreams: string[] = [];
  const summaryCommands: string[] = [];
  const hasDeveloperCosts = data.blocks.some(
    (block) => block.showDeveloperCost,
  );
  summaryCommands.push(
    textCommand(data.reportTitle, MARGIN_X, TOP_Y, 15, true),
  );
  summaryCommands.push(
    textCommand(`Client: ${data.client.name}`, MARGIN_X, TOP_Y - 22, 9, true),
  );
  if (data.selectedMovie)
    summaryCommands.push(
      textCommand(
        `Title: ${data.selectedMovie.title}`,
        MARGIN_X,
        TOP_Y - 38,
        9,
      ),
    );
  summaryCommands.push(
    textCommand(
      `Hourly Date Range: ${data.filters.fromDate || data.filters.toDate ? `${data.filters.fromDate || "Start"} to ${data.filters.toDate || "End"}` : "All dates"}`,
      MARGIN_X,
      data.selectedMovie ? TOP_Y - 54 : TOP_Y - 38,
      9,
    ),
  );
  summaryCommands.push(
    textCommand(
      `Generated: ${new Date().toLocaleString("en-IN")}`,
      MARGIN_X,
      data.selectedMovie ? TOP_Y - 70 : TOP_Y - 54,
      9,
    ),
  );

  const summaryColumns: PdfTableColumn[] = hasDeveloperCosts
    ? [
        { header: "Billing Model", width: 300 },
        { header: "Developer Cost", width: 120, align: "right" },
        { header: "Project Cost", width: 120, align: "right" },
        { header: "Total Cost", width: 120, align: "right" },
      ]
    : [
        { header: "Billing Model", width: 470 },
        { header: "Total Cost", width: 150, align: "right" },
      ];
  const summaryRows: PdfTableRow[] = [
    ...data.blocks.map((block) =>
      hasDeveloperCosts
        ? ([
            block.title,
            formatUsd(
              block.rows.reduce(
                (sum, row) => sum + Number(row.developerCost ?? 0),
                0,
              ),
            ),
            formatUsd(
              block.rows.reduce((sum, row) => sum + row.projectCost, 0),
            ),
            formatUsd(block.rows.reduce((sum, row) => sum + row.cost, 0)),
          ] as PdfTableRow)
        : ([
            block.title,
            formatUsd(block.rows.reduce((sum, row) => sum + row.cost, 0)),
          ] as PdfTableRow),
    ),
    hasDeveloperCosts
      ? [
          "Grand Total",
          formatUsd(
            data.blocks.reduce(
              (sum, block) =>
                sum +
                block.rows.reduce(
                  (blockSum, row) => blockSum + Number(row.developerCost ?? 0),
                  0,
                ),
              0,
            ),
          ),
          formatUsd(
            data.blocks.reduce(
              (sum, block) =>
                sum +
                block.rows.reduce(
                  (blockSum, row) => blockSum + row.projectCost,
                  0,
                ),
              0,
            ),
          ),
          formatUsd(
            data.blocks.reduce(
              (sum, block) =>
                sum +
                block.rows.reduce((blockSum, row) => blockSum + row.cost, 0),
              0,
            ),
          ),
        ]
      : [
          "Grand Total",
          formatUsd(
            data.blocks.reduce(
              (sum, block) =>
                sum +
                block.rows.reduce((blockSum, row) => blockSum + row.cost, 0),
              0,
            ),
          ),
        ],
  ];
  drawTableHeader(summaryCommands, summaryColumns, MARGIN_X, TOP_Y - 102);
  let summaryY = TOP_Y - 102 - HEADER_HEIGHT;
  summaryRows.forEach((row) => {
    if (row[0] === "Grand Total")
      summaryCommands.push(
        fillRectCommand(
          MARGIN_X,
          summaryY - SUMMARY_ROW_HEIGHT,
          tableWidth(summaryColumns),
          SUMMARY_ROW_HEIGHT,
          0.9,
        ),
      );
    drawTableRow(
      summaryCommands,
      summaryColumns,
      row,
      MARGIN_X,
      summaryY,
      SUMMARY_ROW_HEIGHT,
      8,
    );
    summaryY -= SUMMARY_ROW_HEIGHT;
  });
  summaryCommands.push(textCommand("Page 1", PAGE_WIDTH - 82, 18, 8));
  pageStreams.push(summaryCommands.join("\n"));

  for (const block of data.blocks) {
    const isCountryBlock = block.key === "fixedPerCountry";
    const columns: PdfTableColumn[] = isCountryBlock
      ? [
          { header: "Project", width: 145 },
          { header: "Contact Person", width: 150 },
          {
            header: "Lens Type / Country List",
            width: block.showDeveloperCost ? 195 : 300,
          },
          ...(block.showDeveloperCost
            ? [
                {
                  header: "Developer Cost",
                  width: 85,
                  align: "right" as const,
                },
                { header: "Project Cost", width: 85, align: "right" as const },
                { header: "Total Cost", width: 85, align: "right" as const },
              ]
            : [{ header: "Cost", width: 90, align: "right" as const }]),
        ]
      : [
          { header: "Project", width: block.showDeveloperCost ? 180 : 250 },
          {
            header: "Contact Person",
            width: block.showDeveloperCost ? 170 : 210,
          },
          { header: "Status", width: 90 },
          ...(block.showDeveloperCost
            ? [
                {
                  header: "Developer Cost",
                  width: 95,
                  align: "right" as const,
                },
                { header: "Project Cost", width: 95, align: "right" as const },
                { header: "Total Cost", width: 95, align: "right" as const },
              ]
            : [{ header: "Cost", width: 110, align: "right" as const }]),
        ];
    const rows: PdfTableRow[] = block.rows.map((row) =>
      isCountryBlock
        ? [
            formatGenericProjectDisplay(row),
            row.contactPerson,
            formatGenericCountryDisplay(row),
            ...(block.showDeveloperCost
              ? [
                  formatUsd(Number(row.developerCost ?? 0)),
                  formatUsd(row.projectCost),
                  formatUsd(row.cost),
                ]
              : [formatUsd(row.cost)]),
          ]
        : [
            formatGenericProjectDisplay(row),
            row.contactPerson,
            row.status,
            ...(block.showDeveloperCost
              ? [
                  formatUsd(Number(row.developerCost ?? 0)),
                  formatUsd(row.projectCost),
                  formatUsd(row.cost),
                ]
              : [formatUsd(row.cost)]),
          ],
    );
    rows.push([
      "Total",
      "",
      "",
      ...(block.showDeveloperCost
        ? [
            formatUsd(
              block.rows.reduce(
                (sum, row) => sum + Number(row.developerCost ?? 0),
                0,
              ),
            ),
            formatUsd(
              block.rows.reduce((sum, row) => sum + row.projectCost, 0),
            ),
            formatUsd(block.rows.reduce((sum, row) => sum + row.cost, 0)),
          ]
        : [formatUsd(block.rows.reduce((sum, row) => sum + row.cost, 0))]),
    ]);

    let rowIndex = 0;
    let pageNumberForBlock = 1;
    while (rowIndex < rows.length) {
      const commands: string[] = [];
      const startY = pageNumberForBlock === 1 ? TOP_Y - 104 : TOP_Y - 38;
      if (pageNumberForBlock === 1) {
        commands.push(textCommand(data.reportTitle, MARGIN_X, TOP_Y, 15, true));
        commands.push(
          textCommand(
            `Client: ${data.client.name}`,
            MARGIN_X,
            TOP_Y - 22,
            9,
            true,
          ),
        );
        if (data.selectedMovie)
          commands.push(
            textCommand(
              `Title: ${data.selectedMovie.title}`,
              MARGIN_X,
              TOP_Y - 38,
              9,
            ),
          );
        if (block.key === "hourly")
          commands.push(
            textCommand(
              `Date Range: ${data.filters.fromDate} to ${data.filters.toDate}`,
              MARGIN_X,
              data.selectedMovie ? TOP_Y - 54 : TOP_Y - 38,
              9,
            ),
          );
      } else {
        commands.push(
          textCommand(
            `${data.reportTitle} continued`,
            MARGIN_X,
            TOP_Y,
            13,
            true,
          ),
        );
      }
      drawTableHeader(commands, columns, MARGIN_X, startY);
      let y = startY - HEADER_HEIGHT;
      const rowsPerPage = Math.max(
        1,
        Math.floor((y - 42) / SUMMARY_ROW_HEIGHT),
      );
      rows.slice(rowIndex, rowIndex + rowsPerPage).forEach((row) => {
        if (row[0] === "Total")
          commands.push(
            fillRectCommand(
              MARGIN_X,
              y - SUMMARY_ROW_HEIGHT,
              tableWidth(columns),
              SUMMARY_ROW_HEIGHT,
              0.9,
            ),
          );
        drawTableRow(
          commands,
          columns,
          row,
          MARGIN_X,
          y,
          SUMMARY_ROW_HEIGHT,
          7,
        );
        y -= SUMMARY_ROW_HEIGHT;
      });
      commands.push(
        textCommand(`Page ${pageStreams.length + 1}`, PAGE_WIDTH - 82, 18, 8),
      );
      pageStreams.push(commands.join("\n"));
      rowIndex += rowsPerPage;
      pageNumberForBlock += 1;
    }
  }

  return pageStreams;
}

export function buildGenericBillingReportPdf(data: GenericBillingReportData) {
  return buildPdfDocument(buildGenericBillingReportPdfPages(data));
}

export { getGenericBillingReportFileName };

export function buildSonyPicturesReportExcel(data: SonyPicturesReportData) {
  const buildRows = (
    title: string,
    projectRows: typeof data.projectRows,
    chargeRows: typeof data.chargeRows,
    totalCost: number,
  ) => [
    excelRow([data.reportTitle]),
    excelRow(["Client", data.client.name]),
    excelRow(["Title", title]),
    excelRow([]),
    excelRow(
      data.showCountryList
        ? [
            "Billing Header / Project",
            "Countries / Lens Type Countries",
            "Contact Person",
            "Cost (USD)",
          ]
        : ["Billing Header / Project", "Contact Person", "Cost (USD)"],
    ),
    ...projectRows.map((row) =>
      excelRow(
        data.showCountryList
          ? [
              row.projectName,
              row.lensDetails?.length
                ? row.lensDetails.join("\n")
                : row.countryList || "-",
              row.contactPerson,
              row.cost,
            ]
          : [row.projectName, row.contactPerson, row.cost],
        data.showCountryList ? [3] : [2],
      ),
    ),
    ...(chargeRows.length
      ? [
          excelRow([]),
          excelRow(["Title Charges"]),
          ...chargeRows.map((row) =>
            excelRow(
              data.showCountryList
                ? [row.label, "-", "-", row.cost]
                : [row.label, "-", row.cost],
              data.showCountryList ? [3] : [2],
            ),
          ),
        ]
      : []),
    excelRow([]),
    excelRow(
      data.showCountryList
        ? ["Total", "", "", totalCost]
        : ["Total", "", totalCost],
      data.showCountryList ? [3] : [2],
    ),
  ];
  const sheets = data.titleBlocks.length
    ? data.titleBlocks
        .map((block, index) =>
          worksheet(
            `Title ${index + 1}`,
            buildRows(
              block.movie.title,
              block.projectRows,
              block.chargeRows,
              block.totalCost,
            ),
          ),
        )
        .join("\n")
    : worksheet(
        "Sony Billing",
        buildRows(
          data.selectedMovie?.title ?? "-",
          data.projectRows,
          data.chargeRows,
          data.totalCost,
        ),
      );
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${sheets}
</Workbook>`;
}

function buildSonyPicturesReportPdfPages(
  data: SonyPicturesReportData,
): string[] {
  if (data.titleBlocks.length) {
    return data.titleBlocks.flatMap((block) =>
      buildSonyPicturesReportPdfPages({
        ...data,
        selectedMovie: block.movie,
        projectRows: block.projectRows,
        chargeRows: block.chargeRows,
        totalCost: block.totalCost,
        titleBlocks: [],
      }),
    );
  }
  const columns: PdfTableColumn[] = [
    { header: "Billing Header / Project", width: 250 },
    { header: "Countries / Lens Type Countries", width: 230 },
    { header: "Contact Person", width: 195 },
    { header: "Cost", width: 80, align: "right" },
  ];
  const rows: PdfTableRow[] = [
    ...data.projectRows.map(
      (row) =>
        [
          row.projectName,
          row.lensDetails?.length
            ? row.lensDetails.join("; ")
            : row.countryList || "-",
          row.contactPerson,
          formatUsd(row.cost),
        ] as PdfTableRow,
    ),
    ...(data.chargeRows.length
      ? [["Title Charges", "", "", ""] as PdfTableRow]
      : []),
    ...data.chargeRows.map(
      (row) => [row.label, "-", "-", formatUsd(row.cost)] as PdfTableRow,
    ),
    ["Total", "", "", formatUsd(data.totalCost)] as PdfTableRow,
  ];

  const pageStreams: string[] = [];
  const x = MARGIN_X;
  const startY = TOP_Y - 88;
  const laterPageStartY = TOP_Y - 38;
  let rowIndex = 0;
  let pageNumber = 1;

  if (!data.selectedMovie) {
    const commands: string[] = [];
    commands.push(textCommand(data.reportTitle, MARGIN_X, TOP_Y, 15, true));
    commands.push(
      textCommand(`Client: ${data.client.name}`, MARGIN_X, TOP_Y - 22, 9, true),
    );
    commands.push(
      textCommand(
        "Select a title to view billing records.",
        MARGIN_X,
        TOP_Y - 48,
        9,
      ),
    );
    pageStreams.push(commands.join("\n"));
    return pageStreams;
  }

  while (rowIndex < rows.length) {
    const commands: string[] = [];
    const isFirstPage = pageNumber === 1;
    const currentStartY = isFirstPage ? startY : laterPageStartY;
    const maxRows = Math.max(
      1,
      Math.floor((currentStartY - 42) / SUMMARY_ROW_HEIGHT),
    );

    if (isFirstPage) {
      commands.push(textCommand(data.reportTitle, MARGIN_X, TOP_Y, 15, true));
      commands.push(
        textCommand(
          `Client: ${data.client.name}`,
          MARGIN_X,
          TOP_Y - 22,
          9,
          true,
        ),
      );
      commands.push(
        textCommand(
          `Title: ${data.selectedMovie.title}`,
          MARGIN_X,
          TOP_Y - 38,
          9,
        ),
      );
      commands.push(
        textCommand(
          `Generated: ${new Date().toLocaleString("en-IN")}`,
          MARGIN_X,
          TOP_Y - 54,
          9,
        ),
      );
    } else {
      commands.push(
        textCommand(`${data.reportTitle} continued`, MARGIN_X, TOP_Y, 13, true),
      );
    }

    drawTableHeader(commands, columns, x, currentStartY);
    let y = currentStartY - HEADER_HEIGHT;
    rows.slice(rowIndex, rowIndex + maxRows).forEach((row) => {
      if (row[0] === "Title Charges" || row[0] === "Total")
        commands.push(
          fillRectCommand(
            x,
            y - SUMMARY_ROW_HEIGHT,
            tableWidth(columns),
            SUMMARY_ROW_HEIGHT,
            row[0] === "Total" ? 0.9 : 0.95,
          ),
        );
      drawTableRow(commands, columns, row, x, y, SUMMARY_ROW_HEIGHT, 7);
      y -= SUMMARY_ROW_HEIGHT;
    });
    commands.push(
      textCommand(`Page ${pageStreams.length + 1}`, PAGE_WIDTH - 82, 18, 8),
    );
    pageStreams.push(commands.join("\n"));
    rowIndex += maxRows;
    pageNumber += 1;
  }

  return pageStreams;
}

export function buildSonyPicturesReportPdf(data: SonyPicturesReportData) {
  return buildPdfDocument(buildSonyPicturesReportPdfPages(data));
}

export { getSonyPicturesReportFileName };

export function buildFilmikBillingReportExcel(data: FilmikBillingReportData) {
  const resourceRows = [
    excelRow([`${data.client.name} Resource Cost`]),
    excelRow(["Client", data.client.name]),
    excelRow(["Month", getFilmikBillingReportMonthLabel(data)]),
    excelRow([]),
    excelRow([
      "Resource Type",
      "Count",
      "Per Resource Client Cost (USD)",
      "Per Resource Vendor Cost (USD)",
      "Client Cost (USD)",
      "Vendor Cost (USD)",
    ]),
    ...data.resourceRows.map((row) =>
      excelRow(
        [
          row.resourceTypeName,
          row.count,
          row.perResourceClientCost,
          row.perResourceVendorCost,
          row.clientCost,
          row.vendorCost,
        ],
        [1, 2, 3, 4, 5],
      ),
    ),
    excelRow([]),
    excelRow(
      [
        "Total",
        data.resourceTotalCount,
        "",
        "",
        data.resourceTotalClientCost,
        data.resourceTotalVendorCost,
      ],
      [1, 4, 5],
    ),
  ];

  const combinedRows = [
    excelRow([`${data.client.name} Project + Resource Cost`]),
    excelRow(["Client", data.client.name]),
    excelRow(["Month", getFilmikBillingReportMonthLabel(data)]),
    excelRow([]),
    excelRow([
      "Project / Resource",
      "Resources / Hours",
      "Client Cost (USD)",
      "Vendor Cost (USD)",
      "Contact Person",
    ]),
    ...data.combinedRows.map((row) =>
      excelRow(
        [
          row.name,
          row.key === "resource-cost"
            ? row.quantity
            : `${row.quantity.toFixed(2)}h`,
          row.clientCost,
          row.vendorCost,
          row.contactPerson,
        ],
        [2, 3],
      ),
    ),
    excelRow([]),
    excelRow(
      ["Total", "", data.combinedTotalClientCost, data.combinedTotalVendorCost, "-"],
      [2, 3],
    ),
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${worksheet("Resource Cost", resourceRows)}
 ${worksheet("Combined Cost", combinedRows)}
</Workbook>`;
}

function buildFilmikBillingReportPdfPages(data: FilmikBillingReportData) {
  const pageStreams: string[] = [];
  const monthLabel = getFilmikBillingReportMonthLabel(data);

  const resourceCommands: string[] = [];
  resourceCommands.push(
    textCommand(data.reportTitle, MARGIN_X, TOP_Y, 15, true),
  );
  resourceCommands.push(
    textCommand(`Client: ${data.client.name}`, MARGIN_X, TOP_Y - 22, 9, true),
  );
  resourceCommands.push(
    textCommand(`Month: ${monthLabel}`, MARGIN_X, TOP_Y - 38, 9),
  );
  resourceCommands.push(
    textCommand("Resource Cost", MARGIN_X, TOP_Y - 62, 12, true),
  );
  const resourceColumns: PdfTableColumn[] = [
    { header: "Resource Type", width: 210 },
    { header: "Count", width: 70, align: "right" },
    { header: "Client/Res", width: 105, align: "right" },
    { header: "Vendor/Res", width: 105, align: "right" },
    { header: "Client Cost", width: 110, align: "right" },
    { header: "Vendor Cost", width: 110, align: "right" },
  ];
  const resourceRows: PdfTableRow[] = [
    ...data.resourceRows.map(
      (row) =>
        [
          row.resourceTypeName,
          row.count,
          formatUsd(row.perResourceClientCost),
          formatUsd(row.perResourceVendorCost),
          formatUsd(row.clientCost),
          formatUsd(row.vendorCost),
        ] as PdfTableRow,
    ),
    [
      "Total",
      data.resourceTotalCount,
      "-",
      "-",
      formatUsd(data.resourceTotalClientCost),
      formatUsd(data.resourceTotalVendorCost),
    ],
  ];
  drawTableHeader(resourceCommands, resourceColumns, MARGIN_X, TOP_Y - 88);
  let resourceY = TOP_Y - 88 - HEADER_HEIGHT;
  resourceRows.forEach((row) => {
    if (row[0] === "Total")
      resourceCommands.push(
        fillRectCommand(
          MARGIN_X,
          resourceY - SUMMARY_ROW_HEIGHT,
          tableWidth(resourceColumns),
          SUMMARY_ROW_HEIGHT,
          0.9,
        ),
      );
    drawTableRow(
      resourceCommands,
      resourceColumns,
      row,
      MARGIN_X,
      resourceY,
      SUMMARY_ROW_HEIGHT,
      8,
    );
    resourceY -= SUMMARY_ROW_HEIGHT;
  });
  resourceCommands.push(textCommand("Page 1", PAGE_WIDTH - 82, 18, 8));
  pageStreams.push(resourceCommands.join("\n"));

  const combinedColumns: PdfTableColumn[] = [
    { header: "Project / Resource", width: 230 },
    { header: "Resources / Hours", width: 115, align: "right" },
    { header: "Client Cost", width: 115, align: "right" },
    { header: "Vendor Cost", width: 115, align: "right" },
    { header: "Contact Person", width: 185 },
  ];
  const combinedRows: PdfTableRow[] = [
    ...data.combinedRows.map(
      (row) =>
        [
          row.name,
          row.key === "resource-cost"
            ? row.quantity
            : `${row.quantity.toFixed(2)}h`,
          formatUsd(row.clientCost),
          row.vendorCost > 0 ? formatUsd(row.vendorCost) : "-",
          row.contactPerson,
        ] as PdfTableRow,
    ),
    [
      "Total",
      "",
      formatUsd(data.combinedTotalClientCost),
      formatUsd(data.combinedTotalVendorCost),
      "-",
    ],
  ];
  let rowIndex = 0;
  let pageNo = 2;
  while (rowIndex < combinedRows.length) {
    const commands: string[] = [];
    const first = pageNo === 2;
    const startY = first ? TOP_Y - 88 : TOP_Y - 38;
    if (first) {
      commands.push(textCommand(data.reportTitle, MARGIN_X, TOP_Y, 15, true));
      commands.push(
        textCommand(`Month: ${monthLabel}`, MARGIN_X, TOP_Y - 22, 9),
      );
      commands.push(
        textCommand("Project + Resource Cost", MARGIN_X, TOP_Y - 54, 12, true),
      );
    } else {
      commands.push(
        textCommand(`${data.reportTitle} continued`, MARGIN_X, TOP_Y, 13, true),
      );
    }
    drawTableHeader(commands, combinedColumns, MARGIN_X, startY);
    let y = startY - HEADER_HEIGHT;
    const rowsPerPage = Math.max(1, Math.floor((y - 42) / SUMMARY_ROW_HEIGHT));
    combinedRows.slice(rowIndex, rowIndex + rowsPerPage).forEach((row) => {
      if (row[0] === "Total")
        commands.push(
          fillRectCommand(
            MARGIN_X,
            y - SUMMARY_ROW_HEIGHT,
            tableWidth(combinedColumns),
            SUMMARY_ROW_HEIGHT,
            0.9,
          ),
        );
      drawTableRow(
        commands,
        combinedColumns,
        row,
        MARGIN_X,
        y,
        SUMMARY_ROW_HEIGHT,
        8,
      );
      y -= SUMMARY_ROW_HEIGHT;
    });
    commands.push(textCommand(`Page ${pageNo}`, PAGE_WIDTH - 82, 18, 8));
    pageStreams.push(commands.join("\n"));
    rowIndex += rowsPerPage;
    pageNo += 1;
  }

  return pageStreams;
}

export function buildFilmikBillingReportPdf(data: FilmikBillingReportData) {
  return buildPdfDocument(buildFilmikBillingReportPdfPages(data));
}

export function buildSonyNewsletterBillingExcel(
  data: SonyNewsletterBillingData,
) {
  const rows = [
    excelRow([`${data.client.name} Newsletters Billing`]),
    excelRow(["Client", data.client.name]),
    excelRow(["Month", data.filters.month]),
    excelRow(["Project", data.project?.name ?? "Newsletters"]),
    excelRow([]),
    excelRow(["Newsletter Type", "Count", "Cost (USD)"]),
    ...data.rows.map((row) =>
      excelRow([row.newsletterType, row.count, row.cost], [1, 2]),
    ),
    excelRow([]),
    excelRow(["Total", data.totalCount, data.totalCost], [1, 2]),
  ];
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${worksheet("Newsletters", rows)}
</Workbook>`;
}

function buildSonyNewsletterBillingPdfPages(data: SonyNewsletterBillingData) {
  const columns: PdfTableColumn[] = [
    { header: "Newsletter Type", width: 300 },
    { header: "Count", width: 120, align: "right" },
    { header: "Cost", width: 160, align: "right" },
  ];
  const rows: PdfTableRow[] = [
    ...data.rows.map(
      (row) =>
        [row.newsletterType, row.count, formatUsd(row.cost)] as PdfTableRow,
    ),
    ["Total", data.totalCount, formatUsd(data.totalCost)] as PdfTableRow,
  ];
  const commands: string[] = [];
  commands.push(
    textCommand(
      `${data.client.name} Newsletters Billing`,
      MARGIN_X,
      TOP_Y,
      15,
      true,
    ),
  );
  commands.push(
    textCommand(`Month: ${data.filters.month}`, MARGIN_X, TOP_Y - 24, 9),
  );
  commands.push(
    textCommand(
      `Project: ${data.project?.name ?? "Newsletters"}`,
      MARGIN_X,
      TOP_Y - 40,
      9,
    ),
  );
  const x = MARGIN_X;
  let y = TOP_Y - 76;
  drawTableHeader(commands, columns, x, y);
  y -= HEADER_HEIGHT;
  rows.forEach((row) => {
    if (row[0] === "Total")
      commands.push(
        fillRectCommand(
          x,
          y - SUMMARY_ROW_HEIGHT,
          tableWidth(columns),
          SUMMARY_ROW_HEIGHT,
          0.9,
        ),
      );
    drawTableRow(commands, columns, row, x, y, SUMMARY_ROW_HEIGHT, 8);
    y -= SUMMARY_ROW_HEIGHT;
  });
  commands.push(textCommand("Page 1", PAGE_WIDTH - 82, 18, 8));
  return [commands.join("\n")];
}

export function buildSonyNewsletterBillingPdf(data: SonyNewsletterBillingData) {
  return buildPdfDocument(buildSonyNewsletterBillingPdfPages(data));
}

export { getSonyNewsletterBillingFileName };

export function buildRoyalBillingReportExcel(data: RoyalBillingData) {
  const rows = [
    excelRow([`${data.client.name} Billing`]),
    excelRow(["Month", data.filters.month]),
    excelRow([]),
    excelRow([
      "Project",
      "Contact Person",
      "Billing Model",
      "Project Hours",
      "Fixed Monthly Hours",
      "Additional Hours",
      "Project Cost (USD)",
      "Excess Hours",
      "Excess Cost (USD)",
      "Total Cost (USD)",
    ]),
    ...data.rows.map((row) =>
      excelRow(
        [
          row.projectName,
          row.contactPerson,
          row.billingModel,
          row.projectHours,
          row.fixedMonthlyHours ?? "-",
          row.additionalHours ?? "-",
          row.projectCost ?? "-",
          row.excessHours > 0 ? row.excessHours : "-",
          row.excessHours > 0 ? row.excessCost : "-",
          row.totalCost,
        ],
        [3, 4, 5, 6, 7, 8, 9],
      ),
    ),
    excelRow(
      [
        "Total",
        "",
        "",
        "",
        "",
        "",
        data.totals.projectCost,
        data.totals.excessHours,
        data.totals.excessCost,
        data.totals.totalCost,
      ],
      [6, 7, 8, 9],
    ),
  ];
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${worksheet("Royal Billing", rows)}
</Workbook>`;
}

export function buildRoyalBillingReportPdf(data: RoyalBillingData) {
  const columns: PdfTableColumn[] = [
    { header: "Project", width: 150 },
    { header: "Contact Person", width: 150 },
    { header: "Billing Model", width: 78 },
    { header: "Hours", width: 55, align: "right" },
    { header: "Addl Hrs", width: 55, align: "right" },
    { header: "Project Cost", width: 80, align: "right" },
    { header: "Excess Hrs", width: 58, align: "right" },
    { header: "Excess Cost", width: 80, align: "right" },
    { header: "Total", width: 80, align: "right" },
  ];
  const rows: PdfTableRow[] = [
    ...data.rows.map(
      (row) =>
        [
          row.projectName,
          row.contactPerson,
          row.billingModel,
          row.projectHours.toFixed(2),
          row.additionalHours == null ? "-" : row.additionalHours.toFixed(2),
          row.projectCost == null ? "-" : formatUsd(row.projectCost),
          row.excessHours > 0 ? row.excessHours.toFixed(2) : "-",
          row.excessHours > 0 ? formatUsd(row.excessCost) : "-",
          formatUsd(row.totalCost),
        ] as PdfTableRow,
    ),
    [
      "Total",
      "",
      "",
      "",
      "",
      formatUsd(data.totals.projectCost),
      data.totals.excessHours.toFixed(2),
      formatUsd(data.totals.excessCost),
      formatUsd(data.totals.totalCost),
    ] as PdfTableRow,
  ];
  const pageStreams: string[] = [];
  const commands: string[] = [
    textCommand(`${data.client.name} Billing`, MARGIN_X, TOP_Y, 16, true),
    textCommand(`Month: ${data.filters.month}`, MARGIN_X, TOP_Y - 18, 9),
  ];
  drawTableHeader(commands, columns, MARGIN_X, TOP_Y - 52);
  let y = TOP_Y - 52 - HEADER_HEIGHT;
  rows.forEach((row) => {
    drawTableRow(commands, columns, row, MARGIN_X, y, 34, 6.5);
    y -= 34;
  });
  pageStreams.push(commands.join("\n"));
  return buildPdfDocument(pageStreams);
}

export { getRoyalBillingReportFileName };
