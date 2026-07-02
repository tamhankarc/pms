import ExcelJS from "exceljs";

export const MAX_COPY_DECK_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_COPY_DECK_ROWS = 5000;

function text(value: ExcelJS.CellValue | null | undefined) {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  return String(value).trim();
}

function headerMap(sheet: ExcelJS.Worksheet) {
  const result = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const value = text(cell.value).toLowerCase();
    if (value) result.set(value, column);
  });
  return result;
}

async function load(file: File) {
  if (!file.size) throw new Error("Upload an Excel file.");
  if (file.size > MAX_COPY_DECK_FILE_BYTES) throw new Error("Excel file must be 10 MB or smaller.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Only .xlsx files are supported.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The workbook has no worksheet.");
  return sheet;
}

export async function parseNewCopyDeck(file: File) {
  const sheet = await load(file);
  const headers = headerMap(sheet);
  const englishColumn = headers.get("english text");
  if (!englishColumn) throw new Error('Missing required "English Text" column.');
  const rows: { englishText: string; rowNumber: number }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const englishText = text(row.getCell(englishColumn).value);
    if (englishText) rows.push({ englishText, rowNumber });
  });
  if (!rows.length) throw new Error("No English text rows were found.");
  if (rows.length > MAX_COPY_DECK_ROWS) throw new Error(`A copy deck may contain at most ${MAX_COPY_DECK_ROWS} rows.`);
  return rows;
}

export async function parseCorrectedCopyDeck(file: File) {
  const sheet = await load(file);
  const headers = headerMap(sheet);
  const rowIdColumn = headers.get("row id");
  const englishColumn = headers.get("english text");
  const translationColumn = headers.get("translation");
  if (!englishColumn || !translationColumn) {
    throw new Error('Corrected files require "English Text" and "Translation" columns.');
  }
  const rows: { rowId: string; englishText: string; translation: string; rowNumber: number }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const englishText = text(row.getCell(englishColumn).value);
    const translation = text(row.getCell(translationColumn).value);
    const rowId = rowIdColumn ? text(row.getCell(rowIdColumn).value) : "";
    if (rowId || englishText || translation) rows.push({ rowId, englishText, translation, rowNumber });
  });
  if (!rows.length) throw new Error("No corrected rows were found.");
  if (rows.length > MAX_COPY_DECK_ROWS) throw new Error(`A corrected copy deck may contain at most ${MAX_COPY_DECK_ROWS} rows.`);
  return rows;
}

export function styleCopyDeckSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "E1" };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  sheet.columns.forEach((column) => {
    column.alignment = { vertical: "top", wrapText: true };
  });
}
