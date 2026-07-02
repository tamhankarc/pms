import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { styleCopyDeckSheet } from "@/lib/copy-decks/excel";

export async function buildCopyDeckWorkbook(copyDeckId: string) {
  const deck = await db.copyDeck.findUnique({
    where: { id: copyDeckId },
    include: {
      client: true, movie: true, project: true, subProject: true, country: true,
      rows: { orderBy: { rowOrder: "asc" } },
    },
  });
  if (!deck) throw new Error("Copy deck not found.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS";
  const sheet = workbook.addWorksheet("Copy Deck");
  sheet.columns = [
    { header: "Row ID", key: "rowId", width: 30 },
    { header: "English Text", key: "englishText", width: 55 },
    { header: "Translation", key: "translation", width: 55 },
    { header: "Translation Source", key: "source", width: 24 },
    { header: "Country", key: "country", width: 24 },
  ];
  for (const row of deck.rows) {
    sheet.addRow({
      rowId: row.id,
      englishText: row.englishText,
      translation: row.translatedText,
      source: row.source === "ENGLISH_FALLBACK" ? "ENGLISH FALLBACK — NOT TRANSLATED" : row.source.replaceAll("_", " "),
      country: deck.country.name,
    });
  }
  styleCopyDeckSheet(sheet);
  return {
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    fileName: `${deck.name.replace(/[^a-z0-9_-]+/gi, "-") || "copy-deck"}.xlsx`,
  };
}

export async function buildCopyDeckMasterWorkbook() {
  const entries = await db.copyDeckMasterEntry.findMany({
    include: { country: true },
    orderBy: [{ country: { name: "asc" } }, { englishText: "asc" }],
  });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS";
  const sheet = workbook.addWorksheet("Copy Deck Master");
  sheet.columns = [
    { header: "Master ID", key: "id", width: 30 },
    { header: "Country", key: "country", width: 24 },
    { header: "Country ISO", key: "iso", width: 14 },
    { header: "English Text", key: "english", width: 55 },
    { header: "Translation", key: "translation", width: 55 },
    { header: "Translation Source", key: "source", width: 24 },
  ];
  entries.forEach((entry) => sheet.addRow({
    id: entry.id,
    country: entry.country.name,
    iso: entry.country.isoCode ?? "",
    english: entry.englishText,
    translation: entry.translatedText,
    source: entry.source.replaceAll("_", " "),
  }));
  styleCopyDeckSheet(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
