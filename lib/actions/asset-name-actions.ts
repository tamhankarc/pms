"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageAssetNames } from "@/lib/permissions";

export type AssetNameFormState = { success?: boolean; error?: string };

const UNIVERSAL_PICTURES_CLIENT_ID = "cmnh2xr1s0004l204ia5u5zj3";

const schema = z.object({
  id: z.string().optional(),
  movieId: z.string().min(1, "Movie is required."),
  name: z.string().trim().min(2, "Asset name is required."),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

async function requireCanManageAssetNames() {
  const user = await requireUserForAction();
  if (!canManageAssetNames(user)) throw new Error("You are not allowed to manage asset names.");
  return user;
}

async function ensureUniversalMovie(movieId: string) {
  const movie = await db.movie.findFirst({
    where: { id: movieId, clientId: UNIVERSAL_PICTURES_CLIENT_ID, isActive: true },
    select: { id: true },
  });
  if (!movie) throw new Error("Selected title does not belong to Universal Pictures International.");
}

export async function createAssetNameAction(_prevState: AssetNameFormState, formData: FormData): Promise<AssetNameFormState> {
  try {
    await requireCanManageAssetNames();
    const parsed = schema.safeParse({
      movieId: formData.get("movieId"),
      name: formData.get("name"),
      isActive: formData.get("isActive") ?? "on",
    });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid asset name payload." };
    await ensureUniversalMovie(parsed.data.movieId);
    await db.assetName.create({
      data: {
        clientId: UNIVERSAL_PICTURES_CLIENT_ID,
        movieId: parsed.data.movieId,
        name: parsed.data.name.trim(),
        isActive: Boolean(parsed.data.isActive),
      },
    });
    revalidatePath("/asset-names");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateAssetNameAction(_prevState: AssetNameFormState, formData: FormData): Promise<AssetNameFormState> {
  try {
    await requireCanManageAssetNames();
    const parsed = schema.safeParse({
      id: formData.get("id"),
      movieId: formData.get("movieId"),
      name: formData.get("name"),
      isActive: formData.get("isActive") ?? undefined,
    });
    if (!parsed.success || !parsed.data.id) return { success: false, error: parsed.success ? "Asset name is required." : parsed.error.issues[0]?.message };
    const existing = await db.assetName.findFirst({ where: { id: parsed.data.id, clientId: UNIVERSAL_PICTURES_CLIENT_ID }, select: { id: true } });
    if (!existing) return { success: false, error: "Asset name not found." };
    await ensureUniversalMovie(parsed.data.movieId);
    await db.assetName.update({
      where: { id: parsed.data.id },
      data: { movieId: parsed.data.movieId, name: parsed.data.name.trim(), isActive: Boolean(parsed.data.isActive) },
    });
    revalidatePath("/asset-names");
    revalidatePath(`/asset-names/${parsed.data.id}`);
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function toggleAssetNameStatusAction(formData: FormData) {
  await requireCanManageAssetNames();
  const assetNameId = String(formData.get("assetNameId") || "");
  if (!assetNameId) throw new Error("Asset name is required.");
  const assetName = await db.assetName.findFirst({ where: { id: assetNameId, clientId: UNIVERSAL_PICTURES_CLIENT_ID } });
  if (!assetName) throw new Error("Asset name not found.");
  await db.assetName.update({ where: { id: assetNameId }, data: { isActive: !assetName.isActive } });
  revalidatePath("/asset-names");
  revalidatePath(`/asset-names/${assetNameId}`);
}
