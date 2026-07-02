"use server";

import { createHash, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, type CopyDeckTranslationSource } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import {
  canAccessCopyDecks,
  canAssignCopyDeckAccess,
  canManageCopyDeckMaster,
} from "@/lib/permissions";
import { normalizeMenuKeys, parseMenuKeysJson } from "@/lib/menu-access";
import {
  getCellText,
  getHeaderMap,
  loadCopyDeckWorksheet,
  MAX_COPY_DECK_ROWS,
  parseCorrectedCopyDeck,
  parseNewCopyDeck,
} from "@/lib/copy-decks/excel";
import {
  ensureCopyDeckMarketsFromHeaders,
  ensureDefaultCopyDeckMarkets,
  normalizeMarketCode,
} from "@/lib/copy-decks/markets";
import { getCopyDeckTranslationProvider } from "@/lib/copy-decks/translation-provider";

export type CopyDeckActionState = {
  success?: boolean;
  error?: string;
  message?: string;
  copyDeckId?: string;
};

const BULK_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 300_000,
} as const;

function chunks<T>(values: T[], size = 500) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Copy deck name is required.").max(160),
  clientId: z.string().min(1, "Client is required."),
  movieId: z.string().optional(),
  projectId: z.string().optional(),
  subProjectId: z.string().optional(),
  marketId: z.string().min(1, "Country/Market is required."),
});

function normalizedEnglish(value: string) {
  return value.trim().replace(/[ \t]+/g, " ");
}

function englishHash(value: string) {
  return createHash("sha256")
    .update(normalizedEnglish(value).toLocaleLowerCase())
    .digest("hex");
}

async function requireCopyDeckAccess() {
  const user = await requireUserForAction();
  if (!canAccessCopyDecks(user))
    throw new Error("You are not allowed to access Copy Decks.");
  return user;
}

async function validateScope(data: z.infer<typeof createSchema>) {
  const [client, market, movie, project, subProject] = await Promise.all([
    db.client.findFirst({
      where: { id: data.clientId, isActive: true },
      select: { id: true },
    }),
    db.copyDeckMarket.findFirst({
      where: { id: data.marketId, isActive: true },
      include: { country: { select: { id: true, name: true, isoCode: true } } },
    }),
    data.movieId
      ? db.movie.findFirst({
          where: { id: data.movieId, clientId: data.clientId },
          select: { id: true },
        })
      : null,
    data.projectId
      ? db.project.findFirst({
          where: { id: data.projectId, clientId: data.clientId },
          select: { id: true },
        })
      : null,
    data.subProjectId
      ? db.subProject.findFirst({
          where: {
            id: data.subProjectId,
            project: { clientId: data.clientId },
          },
          select: { id: true, projectId: true },
        })
      : null,
  ]);
  if (!client) throw new Error("Selected client is invalid.");
  if (!market) throw new Error("Selected country/market is invalid.");
  if (data.movieId && !movie)
    throw new Error("Selected title does not belong to the client.");
  if (data.projectId && !project)
    throw new Error("Selected project does not belong to the client.");
  if (data.subProjectId && !subProject)
    throw new Error("Selected sub-project does not belong to the client.");
  if (subProject && data.projectId && subProject.projectId !== data.projectId)
    throw new Error("Selected sub-project does not belong to the project.");
  return market;
}

async function translateMissing(
  englishText: string,
  market: {
    code: string;
    name: string;
    language: string | null;
    country: { name: string; isoCode: string | null } | null;
  },
) {
  try {
    const result = await getCopyDeckTranslationProvider().translate({
      englishText,
      marketCode: market.code,
      marketName: market.name,
      language: market.language,
      countryCode: market.country?.isoCode ?? undefined,
      countryName: market.country?.name,
    });
    return {
      translatedText: result.text,
      source: (result.fallback
        ? "ENGLISH_FALLBACK"
        : "AUTO_TRANSLATED") as CopyDeckTranslationSource,
    };
  } catch {
    return {
      translatedText: englishText,
      source: "ENGLISH_FALLBACK" as CopyDeckTranslationSource,
    };
  }
}

export async function createCopyDeckAction(
  _state: CopyDeckActionState,
  formData: FormData,
): Promise<CopyDeckActionState> {
  try {
    const user = await requireCopyDeckAccess();
    const parsed = createSchema.safeParse({
      name: formData.get("name"),
      clientId: formData.get("clientId"),
      movieId: String(formData.get("movieId") ?? "") || undefined,
      projectId: String(formData.get("projectId") ?? "") || undefined,
      subProjectId: String(formData.get("subProjectId") ?? "") || undefined,
      marketId: formData.get("marketId"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Upload an Excel .xlsx file.");

    const market = await validateScope(parsed.data);
    const uploadedRows = await parseNewCopyDeck(file);
    const unique = new Map(
      uploadedRows.map((row) => [
        englishHash(row.englishText),
        normalizedEnglish(row.englishText),
      ]),
    );
    const existingTexts = await db.copyDeckMasterText.findMany({
      where: { englishHash: { in: [...unique.keys()] } },
      include: {
        translations: { where: { marketId: market.id }, take: 1 },
      },
    });
    const existingByHash = new Map(
      existingTexts.map((text) => [text.englishHash, text]),
    );
    const resolved = new Map<
      string,
      {
        englishText: string;
        translatedText: string;
        source: CopyDeckTranslationSource;
      }
    >();
    for (const [hash, englishText] of unique) {
      const translation = existingByHash.get(hash)?.translations[0];
      resolved.set(
        hash,
        translation
          ? {
              englishText,
              translatedText: translation.translatedText,
              source: "MASTER",
            }
          : { englishText, ...(await translateMissing(englishText, market)) },
      );
    }

    const deck = await db.$transaction(async (tx) => {
      const masterTextByHash = new Map<string, string>();
      for (const [hash, value] of resolved) {
        const masterText = await tx.copyDeckMasterText.upsert({
          where: { englishHash: hash },
          update: { englishText: value.englishText },
          create: {
            englishHash: hash,
            englishText: value.englishText,
          },
          select: { id: true },
        });
        masterTextByHash.set(hash, masterText.id);
        await tx.copyDeckMasterTranslation.upsert({
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
            translatedText: value.translatedText,
            source: value.source === "MASTER" ? "MASTER" : value.source,
          },
        });
      }
      return tx.copyDeck.create({
        data: {
          name: parsed.data.name,
          clientId: parsed.data.clientId,
          movieId: parsed.data.movieId ?? null,
          projectId: parsed.data.projectId ?? null,
          subProjectId: parsed.data.subProjectId ?? null,
          marketId: market.id,
          countryId: market.countryId,
          originalFileName: file.name,
          createdById: user.id,
          rows: {
            create: uploadedRows.map((row, index) => {
              const hash = englishHash(row.englishText);
              const value = resolved.get(hash)!;
              return {
                rowOrder: index + 1,
                englishText: normalizedEnglish(row.englishText),
                translatedText: value.translatedText,
                source: value.source,
                masterTextId: masterTextByHash.get(hash),
                marketId: market.id,
              };
            }),
          },
        },
      });
    }, BULK_TRANSACTION_OPTIONS);
    revalidatePath("/copy-decks");
    return {
      success: true,
      copyDeckId: deck.id,
      message: `Created ${uploadedRows.length} copy-deck row(s).`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to create copy deck.",
    };
  }
}

export async function uploadCorrectedCopyDeckAction(
  _state: CopyDeckActionState,
  formData: FormData,
): Promise<CopyDeckActionState> {
  try {
    await requireCopyDeckAccess();
    const copyDeckId = String(formData.get("copyDeckId") ?? "");
    const file = formData.get("file");
    if (!copyDeckId) throw new Error("Copy deck is required.");
    if (!(file instanceof File))
      throw new Error("Upload a corrected Excel .xlsx file.");
    const deck = await db.copyDeck.findUnique({
      where: { id: copyDeckId },
      include: {
        market: { include: { country: true } },
        rows: { select: { id: true } },
      },
    });
    if (!deck?.market)
      throw new Error(
        "This legacy copy deck has no market. Select a market before importing corrections.",
      );
    const market = deck.market;
    const uploaded = await parseCorrectedCopyDeck(file, market);
    const validIds = new Set(deck.rows.map((row) => row.id));
    const seenIds = new Set<string>();
    for (const row of uploaded) {
      if (row.rowId && !validIds.has(row.rowId))
        throw new Error(
          `Row ${row.rowNumber}: Row ID does not belong to this copy deck.`,
        );
      if (row.rowId && seenIds.has(row.rowId))
        throw new Error(`Row ${row.rowNumber}: duplicate Row ID.`);
      if (!row.englishText)
        throw new Error(`Row ${row.rowNumber}: English text is required.`);
      if (row.rowId) seenIds.add(row.rowId);
    }

    const uniqueHashes = [
      ...new Set(uploaded.map((row) => englishHash(row.englishText))),
    ];
    const existingTexts = await db.copyDeckMasterText.findMany({
      where: { englishHash: { in: uniqueHashes } },
      include: {
        translations: { where: { marketId: market.id }, take: 1 },
      },
    });
    const existingByHash = new Map(
      existingTexts.map((text) => [text.englishHash, text]),
    );
    const resolved: Array<
      (typeof uploaded)[number] & {
        englishText: string;
        translatedText: string;
        source: CopyDeckTranslationSource;
      }
    > = [];
    for (const row of uploaded) {
      const englishText = normalizedEnglish(row.englishText);
      const existing = existingByHash.get(englishHash(englishText))
        ?.translations[0];
      const generated = row.translation
        ? {
            translatedText: row.translation,
            source: "CLIENT_CORRECTED" as CopyDeckTranslationSource,
          }
        : existing
          ? {
              translatedText: existing.translatedText,
              source: "MASTER" as CopyDeckTranslationSource,
            }
          : await translateMissing(englishText, market);
      resolved.push({ ...row, englishText, ...generated });
    }

    const nextOrder =
      (
        await db.copyDeckRow.aggregate({
          where: { copyDeckId },
          _max: { rowOrder: true },
        })
      )._max.rowOrder ?? 0;
    await db.$transaction(async (tx) => {
      let added = 0;
      for (const row of resolved) {
        const hash = englishHash(row.englishText);
        const masterText = await tx.copyDeckMasterText.upsert({
          where: { englishHash: hash },
          update: { englishText: row.englishText },
          create: { englishHash: hash, englishText: row.englishText },
          select: { id: true },
        });
        await tx.copyDeckMasterTranslation.upsert({
          where: {
            masterTextId_marketId: {
              masterTextId: masterText.id,
              marketId: market.id,
            },
          },
          update: row.translation
            ? {
                translatedText: row.translatedText,
                source: "CLIENT_CORRECTED",
              }
            : {},
          create: {
            masterTextId: masterText.id,
            marketId: market.id,
            translatedText: row.translatedText,
            source: row.source,
          },
        });
        if (row.rowId) {
          await tx.copyDeckRow.update({
            where: { id: row.rowId },
            data: {
              englishText: row.englishText,
              translatedText: row.translatedText,
              source: row.source,
              masterTextId: masterText.id,
              marketId: market.id,
            },
          });
        } else {
          added += 1;
          await tx.copyDeckRow.create({
            data: {
              copyDeckId,
              rowOrder: nextOrder + added,
              englishText: row.englishText,
              translatedText: row.translatedText,
              source: row.source,
              masterTextId: masterText.id,
              marketId: market.id,
            },
          });
        }
      }
    }, BULK_TRANSACTION_OPTIONS);
    revalidatePath("/copy-decks");
    revalidatePath(`/copy-decks/${copyDeckId}`);
    return {
      success: true,
      copyDeckId,
      message: `Processed ${uploaded.length} corrected row(s).`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to upload corrected copy deck.",
    };
  }
}

export async function setCopyDeckAccessAction(formData: FormData) {
  const actor = await requireUserForAction();
  if (!canAssignCopyDeckAccess(actor))
    throw new Error("You cannot assign Copy Deck access.");
  const userId = String(formData.get("userId") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!userId || userId === actor.id) throw new Error("Select another user.");
  const target = await db.user.findFirst({
    where: { id: userId, isActive: true },
    select: { extraMenuItemsJson: true },
  });
  if (!target) throw new Error("User not found.");
  const keys = new Set(parseMenuKeysJson(target.extraMenuItemsJson));
  if (enabled) keys.add("copy-decks");
  else keys.delete("copy-decks");
  await db.user.update({
    where: { id: userId },
    data: { extraMenuItemsJson: JSON.stringify(normalizeMenuKeys([...keys])) },
  });
  revalidatePath("/copy-decks/access");
}

export async function uploadCopyDeckMasterAction(
  _state: CopyDeckActionState,
  formData: FormData,
): Promise<CopyDeckActionState> {
  try {
    const user = await requireUserForAction();
    if (!canManageCopyDeckMaster(user))
      throw new Error(
        "Only Admin + Other can upload the Copy Deck master.",
      );
    const file = formData.get("file");
    if (!(file instanceof File))
      throw new Error("Upload an Excel .xlsx file.");
    const sheet = await loadCopyDeckWorksheet(file);
    const headers = getHeaderMap(sheet);
    const englishColumn = ["english", "english text", "source text", "copy"]
      .map((header) => headers.get(header))
      .find((column) => Boolean(column));
    if (!englishColumn)
      throw new Error(
        "Master requires an English, English Text, Source Text, or Copy column.",
      );
    const marketColumns = [...headers.entries()]
      .filter(([, column]) => column !== englishColumn)
      .map(([, column]) => ({
        header: getCellText(sheet.getRow(1).getCell(column)),
        column,
      }))
      .filter((item) => item.header);
    if (!marketColumns.length)
      throw new Error("Master must contain at least one market column.");
    const codes = marketColumns.map((item) => normalizeMarketCode(item.header));
    if (new Set(codes).size !== codes.length)
      throw new Error(
        "Two or more market headers normalize to the same market code.",
      );

    await ensureDefaultCopyDeckMarkets();
    const markets = await ensureCopyDeckMarketsFromHeaders(
      marketColumns.map((item) => item.header),
    );
    const marketByCode = new Map(markets.map((market) => [market.code, market]));
    const rows: {
      englishText: string;
      translations: { marketId: string; text: string }[];
    }[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const englishText = getCellText(row.getCell(englishColumn)).trim();
      if (!englishText) return;
      rows.push({
        englishText: normalizedEnglish(englishText),
        translations: marketColumns.flatMap((item) => {
          const text = getCellText(row.getCell(item.column)).trim();
          const market = marketByCode.get(normalizeMarketCode(item.header));
          return text && market ? [{ marketId: market.id, text }] : [];
        }),
      });
    });
    if (!rows.length) throw new Error("No English master rows were found.");
    if (rows.length > MAX_COPY_DECK_ROWS)
      throw new Error(
        `Master upload may contain at most ${MAX_COPY_DECK_ROWS} rows.`,
      );

    const rowsWithHashes = rows.map((row) => ({
      ...row,
      englishHash: englishHash(row.englishText),
    }));
    const translationsUpdated = rows.reduce(
      (total, row) => total + row.translations.length,
      0,
    );
    await db.$transaction(async (tx) => {
      for (const batch of chunks(rowsWithHashes)) {
        const now = new Date();
        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO CopyDeckMasterText
              (id, englishHash, englishText, createdAt, updatedAt)
            VALUES ${Prisma.join(
              batch.map(
                (row) =>
                  Prisma.sql`(${randomUUID()}, ${row.englishHash}, ${row.englishText}, ${now}, ${now})`,
              ),
            )}
            ON DUPLICATE KEY UPDATE
              englishText = VALUES(englishText),
              updatedAt = VALUES(updatedAt)
          `,
        );
      }

      const masterTexts = await tx.copyDeckMasterText.findMany({
        where: {
          englishHash: { in: rowsWithHashes.map((row) => row.englishHash) },
        },
        select: { id: true, englishHash: true },
      });
      const masterTextIdByHash = new Map(
        masterTexts.map((text) => [text.englishHash, text.id]),
      );
      const translationRows = rowsWithHashes.flatMap((row) => {
        const masterTextId = masterTextIdByHash.get(row.englishHash);
        if (!masterTextId) return [];
        return row.translations.map((translation) => ({
          masterTextId,
          marketId: translation.marketId,
          translatedText: translation.text,
        }));
      });

      for (const batch of chunks(translationRows)) {
        const now = new Date();
        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO CopyDeckMasterTranslation
              (id, masterTextId, marketId, translatedText, source, createdAt, updatedAt)
            VALUES ${Prisma.join(
              batch.map(
                (row) =>
                  Prisma.sql`(${randomUUID()}, ${row.masterTextId}, ${row.marketId}, ${row.translatedText}, ${"MASTER_UPLOAD"}, ${now}, ${now})`,
              ),
            )}
            ON DUPLICATE KEY UPDATE
              translatedText = VALUES(translatedText),
              source = VALUES(source),
              updatedAt = VALUES(updatedAt)
          `,
        );
      }
    }, BULK_TRANSACTION_OPTIONS);
    revalidatePath("/copy-decks/master");
    revalidatePath("/copy-decks");
    return {
      success: true,
      message: `Imported ${rows.length} English row(s) and ${translationsUpdated} non-blank market translation(s).`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to upload master.",
    };
  }
}
