import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { styleCopyDeckSheet } from "@/lib/copy-decks/excel";
import {
  ensureDefaultCopyDeckMarkets,
  ensureLegacyCopyDeckCompatibility,
} from "@/lib/copy-decks/markets";

function sourceLabel(source: string) {
  return source === "ENGLISH_FALLBACK"
    ? "ENGLISH FALLBACK — NOT TRANSLATED"
    : source.replaceAll("_", " ");
}

export async function buildCopyDeckWorkbook(copyDeckId: string) {
  const deck = await db.copyDeck.findUnique({
    where: { id: copyDeckId },
    include: {
      market: true,
      country: true,
      rows: { orderBy: { rowOrder: "asc" } },
    },
  });
  if (!deck) throw new Error("Copy deck not found.");
  const marketName = deck.market?.name ?? deck.country?.name ?? "Translation";
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS";
  const sheet = workbook.addWorksheet("Copy Deck");
  sheet.columns = [
    { header: "Row ID", key: "rowId", width: 30, hidden: true },
    { header: "English", key: "englishText", width: 55 },
    { header: marketName, key: "translation", width: 55 },
    { header: "Translation Source", key: "source", width: 24 },
  ];
  for (const row of deck.rows) {
    sheet.addRow({
      rowId: row.id,
      englishText: row.englishText,
      translation: row.translatedText,
      source: sourceLabel(row.source),
    });
  }
  styleCopyDeckSheet(sheet);
  return {
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    fileName: `${deck.name.replace(/[^a-z0-9_-]+/gi, "-") || "copy-deck"}.xlsx`,
  };
}

export async function buildCopyDeckMasterWorkbook() {
  await ensureDefaultCopyDeckMarkets();
  await ensureLegacyCopyDeckCompatibility();
  const [markets, texts] = await Promise.all([
    db.copyDeckMarket.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    db.copyDeckMasterText.findMany({
      include: { translations: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS";
  const sheet = workbook.addWorksheet("Copy Deck Master");
  sheet.columns = [
    { header: "English", key: "english", width: 55 },
    ...markets.map((market) => ({
      header: market.name,
      key: market.id,
      width: 45,
    })),
  ];
  for (const text of texts) {
    const values: Record<string, string> = { english: text.englishText };
    for (const translation of text.translations) {
      values[translation.marketId] = translation.translatedText;
    }
    sheet.addRow(values);
  }
  styleCopyDeckSheet(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
