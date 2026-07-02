"use server";

import ExcelJS from "exceljs";
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import {
  canAccessCopyDecks,
  canAssignCopyDeckAccess,
  canManageCopyDeckMaster,
} from "@/lib/permissions";
import { normalizeMenuKeys, parseMenuKeysJson } from "@/lib/menu-access";
import {
  MAX_COPY_DECK_FILE_BYTES,
  MAX_COPY_DECK_ROWS,
  parseCorrectedCopyDeck,
  parseNewCopyDeck,
} from "@/lib/copy-decks/excel";
import { getCopyDeckTranslationProvider } from "@/lib/copy-decks/translation-provider";
import type { CopyDeckTranslationSource } from "@prisma/client";

export type CopyDeckActionState = {
  success?: boolean;
  error?: string;
  message?: string;
  copyDeckId?: string;
};

const createSchema = z.object({
  name: z.string().trim().min(2, "Copy deck name is required.").max(160),
  clientId: z.string().min(1, "Client is required."),
  movieId: z.string().optional(),
  projectId: z.string().optional(),
  subProjectId: z.string().optional(),
  countryId: z.string().min(1, "Country is required."),
});

function normalizedEnglish(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function englishHash(value: string) {
  return createHash("sha256").update(normalizedEnglish(value).toLocaleLowerCase()).digest("hex");
}

async function requireCopyDeckAccess() {
  const user = await requireUserForAction();
  if (!canAccessCopyDecks(user)) throw new Error("You are not allowed to access Copy Decks.");
  return user;
}

async function validateScope(data: z.infer<typeof createSchema>) {
  const [client, country, movie, project, subProject] = await Promise.all([
    db.client.findFirst({ where: { id: data.clientId, isActive: true }, select: { id: true } }),
    db.country.findFirst({ where: { id: data.countryId, isActive: true }, select: { id: true, name: true, isoCode: true } }),
    data.movieId ? db.movie.findFirst({ where: { id: data.movieId, clientId: data.clientId }, select: { id: true } }) : null,
    data.projectId ? db.project.findFirst({ where: { id: data.projectId, clientId: data.clientId }, select: { id: true } }) : null,
    data.subProjectId ? db.subProject.findFirst({ where: { id: data.subProjectId, project: { clientId: data.clientId } }, select: { id: true, projectId: true } }) : null,
  ]);
  if (!client) throw new Error("Selected client is invalid.");
  if (!country) throw new Error("Selected country is invalid.");
  if (data.movieId && !movie) throw new Error("Selected title does not belong to the client.");
  if (data.projectId && !project) throw new Error("Selected project does not belong to the client.");
  if (data.subProjectId && !subProject) throw new Error("Selected sub-project does not belong to the client.");
  if (subProject && data.projectId && subProject.projectId !== data.projectId) {
    throw new Error("Selected sub-project does not belong to the project.");
  }
  return country;
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
      countryId: formData.get("countryId"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Upload an Excel .xlsx file.");
    const country = await validateScope(parsed.data);
    const uploadedRows = await parseNewCopyDeck(file);
    const unique = new Map(uploadedRows.map((row) => [englishHash(row.englishText), normalizedEnglish(row.englishText)]));
    const hashes = [...unique.keys()];
    const existing = await db.copyDeckMasterEntry.findMany({
      where: { countryId: parsed.data.countryId, englishHash: { in: hashes } },
    });
    const byHash = new Map(existing.map((entry) => [entry.englishHash, entry]));
    const provider = getCopyDeckTranslationProvider();
    const resolved = new Map<string, { englishText: string; translatedText: string; source: CopyDeckTranslationSource }>();
    for (const [hash, englishText] of unique) {
      const master = byHash.get(hash);
      if (master) {
        resolved.set(hash, { englishText, translatedText: master.translatedText, source: "MASTER" });
        continue;
      }
      try {
        const translation = await provider.translate({
          englishText,
          countryCode: country.isoCode ?? "",
          countryName: country.name,
        });
        resolved.set(hash, {
          englishText,
          translatedText: translation.text,
          source: translation.fallback ? "ENGLISH_FALLBACK" : "PROVIDER",
        });
      } catch {
        resolved.set(hash, { englishText, translatedText: englishText, source: "ENGLISH_FALLBACK" });
      }
    }

    const deck = await db.$transaction(async (tx) => {
      const masterByHash = new Map<string, string>();
      for (const [hash, value] of resolved) {
        const master = await tx.copyDeckMasterEntry.upsert({
          where: { countryId_englishHash: { countryId: parsed.data.countryId, englishHash: hash } },
          update: {},
          create: {
            countryId: parsed.data.countryId,
            englishHash: hash,
            englishText: value.englishText,
            translatedText: value.translatedText,
            source: value.source,
          },
          select: { id: true },
        });
        masterByHash.set(hash, master.id);
      }
      return tx.copyDeck.create({
        data: {
          name: parsed.data.name,
          clientId: parsed.data.clientId,
          movieId: parsed.data.movieId ?? null,
          projectId: parsed.data.projectId ?? null,
          subProjectId: parsed.data.subProjectId ?? null,
          countryId: parsed.data.countryId,
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
                masterEntryId: masterByHash.get(hash),
              };
            }),
          },
        },
      });
    });
    revalidatePath("/copy-decks");
    return {
      success: true,
      copyDeckId: deck.id,
      message: `Created ${uploadedRows.length} copy-deck row(s).`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create copy deck." };
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
    if (!(file instanceof File)) throw new Error("Upload a corrected Excel .xlsx file.");
    const deck = await db.copyDeck.findUnique({
      where: { id: copyDeckId },
      include: { country: true, rows: { select: { id: true } } },
    });
    if (!deck) throw new Error("Copy deck not found.");
    const uploaded = await parseCorrectedCopyDeck(file);
    const validIds = new Set(deck.rows.map((row) => row.id));
    const seenIds = new Set<string>();
    for (const row of uploaded) {
      if (row.rowId && !validIds.has(row.rowId)) throw new Error(`Row ${row.rowNumber}: Row ID does not belong to this copy deck.`);
      if (row.rowId && seenIds.has(row.rowId)) throw new Error(`Row ${row.rowNumber}: duplicate Row ID.`);
      if (!row.englishText) throw new Error(`Row ${row.rowNumber}: English Text is required.`);
      if (row.rowId) seenIds.add(row.rowId);
    }
    const nextOrder = (await db.copyDeckRow.aggregate({ where: { copyDeckId }, _max: { rowOrder: true } }))._max.rowOrder ?? 0;
    await db.$transaction(async (tx) => {
      let added = 0;
      for (const row of uploaded) {
        const englishText = normalizedEnglish(row.englishText);
        const hash = englishHash(englishText);
        const translation = row.translation || englishText;
        const source: CopyDeckTranslationSource = row.translation ? "CLIENT_CORRECTED" : "ENGLISH_FALLBACK";
        const master = await tx.copyDeckMasterEntry.upsert({
          where: { countryId_englishHash: { countryId: deck.countryId, englishHash: hash } },
          update: { englishText, translatedText: translation, source },
          create: { countryId: deck.countryId, englishHash: hash, englishText, translatedText: translation, source },
          select: { id: true },
        });
        if (row.rowId) {
          await tx.copyDeckRow.update({
            where: { id: row.rowId },
            data: { englishText, translatedText: translation, source, masterEntryId: master.id },
          });
        } else {
          added += 1;
          await tx.copyDeckRow.create({
            data: { copyDeckId, rowOrder: nextOrder + added, englishText, translatedText: translation, source, masterEntryId: master.id },
          });
        }
      }
    });
    revalidatePath("/copy-decks");
    revalidatePath(`/copy-decks/${copyDeckId}`);
    return { success: true, copyDeckId, message: `Processed ${uploaded.length} corrected row(s).` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to upload corrected copy deck." };
  }
}

export async function setCopyDeckAccessAction(formData: FormData) {
  const actor = await requireUserForAction();
  if (!canAssignCopyDeckAccess(actor)) throw new Error("You cannot assign Copy Deck access.");
  const userId = String(formData.get("userId") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!userId || userId === actor.id) throw new Error("Select another user.");
  const target = await db.user.findFirst({ where: { id: userId, isActive: true }, select: { extraMenuItemsJson: true } });
  if (!target) throw new Error("User not found.");
  const keys = new Set(parseMenuKeysJson(target.extraMenuItemsJson));
  if (enabled) keys.add("copy-decks"); else keys.delete("copy-decks");
  await db.user.update({
    where: { id: userId },
    data: { extraMenuItemsJson: JSON.stringify(normalizeMenuKeys([...keys])) },
  });
  revalidatePath("/copy-decks/access");
}

function cellText(value: ExcelJS.CellValue | null | undefined) {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  return String(value).trim();
}

export async function uploadCopyDeckMasterAction(
  _state: CopyDeckActionState,
  formData: FormData,
): Promise<CopyDeckActionState> {
  try {
    const user = await requireUserForAction();
    if (!canManageCopyDeckMaster(user)) throw new Error("Only Admin + Other can upload the Copy Deck master.");
    const file = formData.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Upload an Excel .xlsx file.");
    if (file.size > MAX_COPY_DECK_FILE_BYTES) throw new Error("Excel file must be 10 MB or smaller.");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("The workbook has no worksheet.");
    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => headers.set(cellText(cell.value).toLowerCase(), column));
    const englishCol = headers.get("english text");
    const translationCol = headers.get("translation");
    const idCol = headers.get("master id");
    const isoCol = headers.get("country iso");
    const countryCol = headers.get("country");
    if (!englishCol || !translationCol || (!isoCol && !countryCol)) throw new Error("Master requires Country or Country ISO, English Text, and Translation columns.");
    const raw: { id: string; iso: string; country: string; english: string; translation: string; row: number }[] = [];
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const english = cellText(row.getCell(englishCol).value);
      if (english) raw.push({
        id: idCol ? cellText(row.getCell(idCol).value) : "",
        iso: isoCol ? cellText(row.getCell(isoCol).value) : "",
        country: countryCol ? cellText(row.getCell(countryCol).value) : "",
        english,
        translation: cellText(row.getCell(translationCol).value),
        row: number,
      });
    });
    if (!raw.length) throw new Error("No master rows were found.");
    if (raw.length > MAX_COPY_DECK_ROWS) throw new Error(`Master upload may contain at most ${MAX_COPY_DECK_ROWS} rows.`);
    const countries = await db.country.findMany({ select: { id: true, name: true, isoCode: true } });
    await db.$transaction(async (tx) => {
      for (const row of raw) {
        const country = countries.find((item) =>
          (row.iso && item.isoCode?.toLowerCase() === row.iso.toLowerCase()) ||
          (row.country && item.name.toLowerCase() === row.country.toLowerCase()),
        );
        if (!country) throw new Error(`Row ${row.row}: country was not found.`);
        const englishText = normalizedEnglish(row.english);
        const translatedText = row.translation || englishText;
        const source: CopyDeckTranslationSource = row.translation ? "CLIENT_CORRECTED" : "ENGLISH_FALLBACK";
        if (row.id) {
          const existing = await tx.copyDeckMasterEntry.findUnique({ where: { id: row.id }, select: { id: true } });
          if (!existing) throw new Error(`Row ${row.row}: Master ID was not found.`);
          await tx.copyDeckMasterEntry.update({
            where: { id: row.id },
            data: { countryId: country.id, englishHash: englishHash(englishText), englishText, translatedText, source },
          });
        } else {
          await tx.copyDeckMasterEntry.upsert({
            where: { countryId_englishHash: { countryId: country.id, englishHash: englishHash(englishText) } },
            update: { englishText, translatedText, source },
            create: { countryId: country.id, englishHash: englishHash(englishText), englishText, translatedText, source },
          });
        }
      }
    });
    revalidatePath("/copy-decks/master");
    return { success: true, message: `Updated ${raw.length} master row(s).` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to upload master." };
  }
}
