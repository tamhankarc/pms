import { db } from "@/lib/db";

export const AUSTRALIA_MARKET_CODE = "AUSTRALIA";

export function normalizeMarketCode(header: string) {
  return header
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function displayMarketName(header: string) {
  return header.trim().replace(/\s+/g, " ");
}

function marketCountryName(code: string) {
  const aliases: Record<string, string> = {
    UK: "United Kingdom",
    KOREA: "South Korea",
  };
  const base = code
    .replace(/_(ENGLISH|FRENCH|FLEMISH)$/, "")
    .replaceAll("_", " ");
  return aliases[base] ?? base;
}

function marketLanguage(code: string) {
  return code.match(/_(ENGLISH|FRENCH|FLEMISH)$/)?.[1] ?? null;
}

export async function ensureCopyDeckMarketsFromHeaders(headers: string[]) {
  const countries = await db.country.findMany({
    select: { id: true, name: true, isoCode: true },
  });
  const result = [];
  for (const header of headers) {
    const code = normalizeMarketCode(header);
    if (!code) continue;
    const countryName = marketCountryName(code);
    const country = countries.find(
      (item) =>
        item.name.toUpperCase() === countryName ||
        item.isoCode?.toUpperCase() === code,
    );
    result.push(
      await db.copyDeckMarket.upsert({
        where: { code },
        update: {
          name: displayMarketName(header),
          countryId: country?.id,
          language: marketLanguage(code),
          isActive: true,
        },
        create: {
          code,
          name: displayMarketName(header),
          countryId: country?.id,
          language: marketLanguage(code),
          isDefault: code === AUSTRALIA_MARKET_CODE,
        },
      }),
    );
  }
  return result;
}

export async function ensureDefaultCopyDeckMarkets() {
  const australiaCountry = await db.country.findFirst({
    where: {
      OR: [
        { isoCode: "AU" },
        { name: { equals: "Australia" } },
      ],
    },
    select: { id: true },
  });
  const australia = await db.copyDeckMarket.upsert({
    where: { code: AUSTRALIA_MARKET_CODE },
    update: {
      name: "Australia",
      countryId: australiaCountry?.id,
      isDefault: true,
      isActive: true,
    },
    create: {
      code: AUSTRALIA_MARKET_CODE,
      name: "Australia",
      countryId: australiaCountry?.id,
      isDefault: true,
      isActive: true,
    },
  });
  await db.copyDeckMarket.updateMany({
    where: { id: { not: australia.id }, isDefault: true },
    data: { isDefault: false },
  });
  return australia;
}

/**
 * Preserves records created by the original country-only Copy Deck rollout.
 * Legacy fields and tables remain in place; this only adds their normalized
 * market/master references when those references are missing.
 */
export async function ensureLegacyCopyDeckCompatibility() {
  const legacyEntries = await db.copyDeckMasterEntry.findMany({
    include: { country: { select: { id: true, name: true } } },
  });
  const legacyDeckCountries = await db.copyDeck.findMany({
    where: { marketId: null, countryId: { not: null } },
    select: { country: { select: { id: true, name: true } } },
    distinct: ["countryId"],
  });
  const names = [
    ...new Set([
      ...legacyEntries.map((entry) => entry.country.name),
      ...legacyDeckCountries.flatMap((deck) =>
        deck.country ? [deck.country.name] : [],
      ),
    ]),
  ];
  if (!names.length) return;
  const markets = await ensureCopyDeckMarketsFromHeaders(names);
  const marketByCode = new Map(markets.map((market) => [market.code, market]));

  for (const entry of legacyEntries) {
    const market = marketByCode.get(normalizeMarketCode(entry.country.name));
    if (!market) continue;
    const masterText = await db.copyDeckMasterText.upsert({
      where: { englishHash: entry.englishHash },
      update: {},
      create: {
        englishHash: entry.englishHash,
        englishText: entry.englishText,
      },
    });
    await db.copyDeckMasterTranslation.upsert({
      where: {
        masterTextId_marketId: {
          masterTextId: masterText.id,
          marketId: market.id,
        },
      },
      update: {},
      create: {
        masterTextId: masterText.id,
        marketId: market.id,
        translatedText: entry.translatedText,
        source: entry.source,
      },
    });
    await db.copyDeckRow.updateMany({
      where: { masterEntryId: entry.id, masterTextId: null },
      data: { masterTextId: masterText.id, marketId: market.id },
    });
  }

  for (const market of markets) {
    if (!market.countryId) continue;
    await db.copyDeck.updateMany({
      where: { countryId: market.countryId, marketId: null },
      data: { marketId: market.id },
    });
    await db.copyDeckRow.updateMany({
      where: {
        marketId: null,
        copyDeck: { countryId: market.countryId },
      },
      data: { marketId: market.id },
    });
    const decks = await db.copyDeck.findMany({
      where: { marketId: market.id },
      select: { id: true },
    });
    if (decks.length) {
      await db.copyDeckMarketSelection.createMany({
        data: decks.map((deck) => ({
          copyDeckId: deck.id,
          marketId: market.id,
        })),
        skipDuplicates: true,
      });
      const rows = await db.copyDeckRow.findMany({
        where: {
          copyDeckId: { in: decks.map((deck) => deck.id) },
          marketId: market.id,
        },
        select: {
          id: true,
          translatedText: true,
          source: true,
        },
      });
      if (rows.length) {
        await db.copyDeckRowTranslation.createMany({
          data: rows.map((row) => ({
            copyDeckRowId: row.id,
            marketId: market.id,
            translatedText: row.translatedText,
            source: row.source,
          })),
          skipDuplicates: true,
        });
      }
    }
  }
}
