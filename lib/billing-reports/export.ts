import {
  type AmazonBillingReportData,
  formatUsd,
  getExportTimestamp,
  sanitizeFileSegment,
} from "@/lib/billing-reports/amazon";

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    excelRow(["Project", data.projectName]),
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

function wrapPdfText(value: string, maxLength = 95) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildPdfObjects(pageLines: string[][]) {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("PAGES_PLACEHOLDER");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  for (const lines of pageLines) {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    pageObjectIds.push(pageId);
    contentObjectIds.push(contentId);

    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);

    const commands = ["BT", "/F1 9 Tf", "50 800 Td", "12 TL"];
    for (const line of lines) {
      const font = line.startsWith("# ") ? "/F2 13 Tf" : line.startsWith("## ") ? "/F2 10 Tf" : "/F1 9 Tf";
      const text = line.replace(/^##?\s/, "");
      commands.push(font, `(${escapePdfText(text)}) Tj`, "T*");
    }
    commands.push("ET");
    const stream = commands.join("\n");
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export function buildAmazonReportPdf(data: AmazonBillingReportData) {
  const lines: string[] = [];
  lines.push(`# ${data.reportTitle}`);
  lines.push(`Client: ${data.client.name}`);
  lines.push(`Project: ${data.projectName}`);
  lines.push(`Date Range: ${data.filters.fromDate} to ${data.filters.toDate}`);
  lines.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
  lines.push("");
  lines.push("## Details");

  if (!data.rows.length) {
    lines.push("No records found for the selected filters.");
  } else {
    data.rows.forEach((row, index) => {
      const detail = data.reportType === "localization"
        ? `${index + 1}. ${row.date} | ${row.titleName} | ${row.assetName} | ${row.territoryVariant ?? "-"} | ${row.assetType} | ${formatUsd(row.cost)} | ${row.contactPerson}`
        : `${index + 1}. ${row.date} | ${row.titleName} | ${row.assetName} | ${row.assetType} | ${formatUsd(row.cost)} | ${row.contactPerson}`;
      wrapPdfText(detail, 105).forEach((line) => lines.push(line));
    });
  }

  lines.push("");
  lines.push("## Summary by Asset Type");
  if (!data.summaryRows.length) {
    lines.push("No summary available.");
  } else {
    data.summaryRows.forEach((row) => {
      lines.push(`${row.assetType} | Total Assets: ${row.totalAssets} | Total Cost: ${formatUsd(row.totalCost)}`);
    });
  }

  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 58) {
    pages.push(lines.slice(index, index + 58));
  }

  return buildPdfObjects(pages.length ? pages : [[`# ${data.reportTitle}`, "No data available."]]);
}

export function buildAmazonReportFileName(data: AmazonBillingReportData, extension: "xls" | "pdf") {
  return `${sanitizeFileSegment(data.client.name)}_${sanitizeFileSegment(data.reportTitle)}_${getExportTimestamp()}.${extension}`;
}
