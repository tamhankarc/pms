import ExcelJS from "exceljs";
import { normalizeMarketCode } from "@/lib/copy-decks/markets";

export const MAX_COPY_DECK_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_COPY_DECK_ROWS = 5000;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function isDateFormat(numFmt: string) {
  return /[dmy]/i.test(numFmt.replace(/"[^"]*"/g, ""));
}

function valueText(value: ExcelJS.CellValue | null | undefined, numFmt = ""): string {
  if (value == null) return "";
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "number" && isDateFormat(numFmt)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(date.getTime())) return formatDate(date);
  }
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("").trim();
  }
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  if (typeof value === "object" && "result" in value) return valueText(value.result, numFmt);
  if (typeof value === "object" && "error" in value) return "";
  return String(value).trim();
}

export function getCellText(cell: ExcelJS.Cell) {
  return valueText(cell.value, cell.numFmt);
}

export function getHeaderMap(sheet: ExcelJS.Worksheet) {
  const result = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const value = getCellText(cell).toLowerCase();
    if (value) result.set(value, column);
  });
  return result;
}

export async function loadCopyDeckWorksheet(file: File) {
  if (!file.size) throw new Error("Upload an Excel file.");
  if (file.size > MAX_COPY_DECK_FILE_BYTES) throw new Error("Excel file must be 10 MB or smaller.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Only .xlsx files are supported.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The workbook has no worksheet.");
  return sheet;
}

const ENGLISH_HEADERS = ["english", "english text", "source text", "copy"];

function findEnglishColumn(headers: Map<string, number>) {
  return ENGLISH_HEADERS.map((header) => headers.get(header)).find(Boolean);
}

export async function parseNewCopyDeck(file: File) {
  const sheet = await loadCopyDeckWorksheet(file);
  const headers = getHeaderMap(sheet);
  const englishColumn = findEnglishColumn(headers);
  if (!englishColumn) throw new Error('Missing an English, English Text, Source Text, or Copy column.');
  const rows: { englishText: string; rowNumber: number }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const englishText = getCellText(row.getCell(englishColumn));
    if (englishText) rows.push({ englishText, rowNumber });
  });
  if (!rows.length) throw new Error("No English text rows were found.");
  if (rows.length > MAX_COPY_DECK_ROWS) throw new Error(`A copy deck may contain at most ${MAX_COPY_DECK_ROWS} rows.`);
  return rows;
}

export async function parseCorrectedCopyDeck(
  file: File,
  market: { code: string; name: string },
) {
  const sheet = await loadCopyDeckWorksheet(file);
  const headers = getHeaderMap(sheet);
  const rowIdColumn = headers.get("row id");
  const englishColumn = findEnglishColumn(headers);
  const translationColumn =
    headers.get("translation") ??
    [...headers.entries()].find(([header]) => {
      const normalized = header.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toUpperCase();
      return normalized === market.code;
    })?.[1] ??
    headers.get(market.name.toLowerCase());
  if (!englishColumn || !translationColumn) {
    throw new Error(
      `Corrected files require an English column and either "${market.name}" or "Translation" column.`,
    );
  }
  const rows: { rowId: string; englishText: string; translation: string; rowNumber: number }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const englishText = getCellText(row.getCell(englishColumn));
    const translation = getCellText(row.getCell(translationColumn));
    const rowId = rowIdColumn ? getCellText(row.getCell(rowIdColumn)) : "";
    if (rowId || englishText || translation) rows.push({ rowId, englishText, translation, rowNumber });
  });
  if (!rows.length) throw new Error("No corrected rows were found.");
  if (rows.length > MAX_COPY_DECK_ROWS) throw new Error(`A corrected copy deck may contain at most ${MAX_COPY_DECK_ROWS} rows.`);
  return rows;
}

export async function parseCorrectedCopyDeckForMarkets(
  file: File,
  markets: Array<{ id: string; code: string; name: string }>,
) {
  const sheet = await loadCopyDeckWorksheet(file);
  const headers = getHeaderMap(sheet);
  const rowIdColumn = headers.get("row id");
  const englishColumn = findEnglishColumn(headers);
  if (!englishColumn) throw new Error("Corrected files require an English column.");
  const marketColumns = markets.flatMap((market) => {
    const column =
      [...headers.entries()].find(
        ([header]) => normalizeMarketCode(header) === market.code,
      )?.[1] ??
      (markets.length === 1 ? headers.get("translation") : undefined);
    return column ? [{ marketId: market.id, column }] : [];
  });
  if (!marketColumns.length) {
    throw new Error(
      "The corrected file does not contain any selected market columns.",
    );
  }
  const rows: {
    rowId: string;
    englishText: string;
    translations: Record<string, string>;
    rowNumber: number;
  }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const englishText = getCellText(row.getCell(englishColumn));
    const rowId = rowIdColumn ? getCellText(row.getCell(rowIdColumn)) : "";
    const translations = Object.fromEntries(
      marketColumns.map(({ marketId, column }) => [
        marketId,
        getCellText(row.getCell(column)),
      ]),
    );
    if (rowId || englishText || Object.values(translations).some(Boolean)) {
      rows.push({ rowId, englishText, translations, rowNumber });
    }
  });
  if (!rows.length) throw new Error("No corrected rows were found.");
  if (rows.length > MAX_COPY_DECK_ROWS)
    throw new Error(
      `A corrected copy deck may contain at most ${MAX_COPY_DECK_ROWS} rows.`,
    );
  return rows;
}

export function styleCopyDeckSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (sheet.columnCount > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount },
    };
  }
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  sheet.columns.forEach((column) => {
    column.alignment = { vertical: "top", wrapText: true };
  });
}
