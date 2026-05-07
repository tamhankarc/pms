"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageAssetTypes } from "@/lib/permissions";
import { FILMIK_CLIENT_ID } from "@/lib/billing-reports/config";

export type FilmikResourceFormState = { success?: boolean; error?: string };

const filmikResourceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Resource type name is required."),
  cost: z.coerce.number().min(0, "Per resource cost cannot be negative."),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

async function requireCanManageFilmikResources() {
  const user = await requireUserForAction();
  if (!canManageAssetTypes(user)) throw new Error("You are not allowed to manage Filmik resources.");
  return user;
}

export async function createFilmikResourceAction(_prevState: FilmikResourceFormState, formData: FormData): Promise<FilmikResourceFormState> {
  try {
    await requireCanManageFilmikResources();
    const parsed = filmikResourceSchema.safeParse({
      name: formData.get("name"),
      cost: formData.get("cost") ?? "0",
      isActive: formData.get("isActive") ?? "on",
    });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid resource payload." };

    await db.filmikResourceType.create({
      data: {
        clientId: FILMIK_CLIENT_ID,
        name: parsed.data.name.trim(),
        cost: parsed.data.cost,
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/filmik-resource");
    revalidatePath("/projects/new");
    revalidatePath("/billing-reports/cmne6ed2o0000jo04t3363pqz");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateFilmikResourceAction(_prevState: FilmikResourceFormState, formData: FormData): Promise<FilmikResourceFormState> {
  try {
    await requireCanManageFilmikResources();
    const parsed = filmikResourceSchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      cost: formData.get("cost") ?? "0",
      isActive: formData.get("isActive") ?? undefined,
    });
    if (!parsed.success || !parsed.data.id) return { success: false, error: parsed.success ? "Resource type is required." : parsed.error.issues[0]?.message };

    const existing = await db.filmikResourceType.findFirst({ where: { id: parsed.data.id, clientId: FILMIK_CLIENT_ID } });
    if (!existing) return { success: false, error: "Filmik resource type not found." };

    await db.filmikResourceType.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name.trim(),
        cost: parsed.data.cost,
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/filmik-resource");
    revalidatePath(`/filmik-resource/${parsed.data.id}`);
    revalidatePath("/projects/new");
    revalidatePath("/billing-reports/cmne6ed2o0000jo04t3363pqz");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function toggleFilmikResourceStatusAction(formData: FormData) {
  await requireCanManageFilmikResources();
  const resourceId = String(formData.get("resourceId") || "");
  if (!resourceId) throw new Error("Resource type is required.");
  const resource = await db.filmikResourceType.findFirst({ where: { id: resourceId, clientId: FILMIK_CLIENT_ID } });
  if (!resource) throw new Error("Filmik resource type not found.");
  await db.filmikResourceType.update({ where: { id: resourceId }, data: { isActive: !resource.isActive } });
  revalidatePath("/filmik-resource");
  revalidatePath(`/filmik-resource/${resourceId}`);
  revalidatePath("/projects/new");
  revalidatePath("/billing-reports/cmne6ed2o0000jo04t3363pqz");
}
