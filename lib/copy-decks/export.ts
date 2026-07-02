import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { styleCopyDeckSheet } from "@/lib/copy-decks/excel";
import {
  ensureDefaultCopyDeckMarkets,
  ensureLegacyCopyDeckCompatibility,
} from "@/lib/copy-decks/markets";

export async function buildCopyDeckWorkbook(copyDeckId: string) {
  const deck = await db.copyDeck.findUnique({
    where: { id: copyDeckId },
    include: {
      market: true,
      country: true,
      marketSelections: {
        include: { market: true },
        orderBy: { createdAt: "asc" },
      },
      rows: {
        include: { translations: true },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!deck) throw new Error("Copy deck not found.");
  const markets = deck.marketSelections.length
    ? deck.marketSelections.map((selection) => selection.market)
    : deck.market
      ? [deck.market]
      : [];
  const legacyMarketName = deck.country?.name ?? "Translation";
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS";
  const sheet = workbook.addWorksheet("Copy Deck");
  sheet.columns = [
    { header: "Row ID", key: "rowId", width: 30, hidden: true },
    { header: "English", key: "englishText", width: 55 },
    ...(markets.length
      ? markets.map((market) => ({
          header: market.name,
          key: market.id,
          width: 55,
        }))
      : [{ header: legacyMarketName, key: "translation", width: 55 }]),
  ];
  for (const row of deck.rows) {
    const values: Record<string, string> = {
      rowId: row.id,
      englishText: row.englishText,
    };
    if (markets.length) {
      for (const market of markets) {
        const translation = row.translations.find(
          (item) => item.marketId === market.id,
        );
        values[market.id] =
          translation?.translatedText ??
          (market.id === deck.marketId ? row.translatedText : "");
      }
    } else {
      values.translation = row.translatedText;
    }
    sheet.addRow(values);
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
