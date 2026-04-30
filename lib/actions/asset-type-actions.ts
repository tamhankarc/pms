"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserTypesForAction } from "@/lib/auth";
import { generateAssetTypeCode } from "@/lib/project-code";

export type AssetTypeFormState = { success?: boolean; error?: string; };

const assetTypeSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  name: z.string().min(2, "Asset Type name is required."),
  cost: z.coerce.number().min(0, "Cost cannot be negative."),
  description: z.string().optional(),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

export async function createAssetTypeAction(_prevState: AssetTypeFormState, formData: FormData): Promise<AssetTypeFormState> {
  try {
    await requireUserTypesForAction(["ADMIN", "OPERATIONS"]);
    const parsed = assetTypeSchema.safeParse({ clientId: formData.get("clientId"), name: formData.get("name"), cost: formData.get("cost") ?? "0", description: formData.get("description") || "", isActive: formData.get("isActive") ?? "on" });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid asset type payload." };
    const generatedCode = await generateAssetTypeCode(parsed.data.clientId, parsed.data.name);
    await db.assetType.create({ data: { clientId: parsed.data.clientId, name: parsed.data.name.trim(), code: generatedCode, cost: parsed.data.cost, description: parsed.data.description?.trim() || null, isActive: Boolean(parsed.data.isActive) } });
    revalidatePath("/asset-type"); revalidatePath("/projects/new"); revalidatePath("/time-entries"); revalidatePath("/estimates");
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Something went wrong." }; }
}

export async function updateAssetTypeAction(_prevState: AssetTypeFormState, formData: FormData): Promise<AssetTypeFormState> {
  try {
    await requireUserTypesForAction(["ADMIN", "OPERATIONS"]);
    const parsed = assetTypeSchema.safeParse({ id: formData.get("id"), clientId: formData.get("clientId"), name: formData.get("name"), cost: formData.get("cost") ?? "0", description: formData.get("description") || "", isActive: formData.get("isActive") ?? undefined });
    if (!parsed.success || !parsed.data.id) return { success: false, error: parsed.success ? "Asset Type is required." : parsed.error.issues[0]?.message };
    const existingAssetType = await db.assetType.findUnique({ where: { id: parsed.data.id }, select: { code: true } });
    if (!existingAssetType) return { success: false, error: "Asset Type not found." };
    const code = existingAssetType.code?.trim() || (await generateAssetTypeCode(parsed.data.clientId, parsed.data.name));
    await db.assetType.update({ where: { id: parsed.data.id }, data: { clientId: parsed.data.clientId, name: parsed.data.name.trim(), code, cost: parsed.data.cost, description: parsed.data.description?.trim() || null, isActive: Boolean(parsed.data.isActive) } });
    revalidatePath("/asset-type"); revalidatePath(`/asset-type/${parsed.data.id}`); revalidatePath("/projects/new"); revalidatePath("/time-entries"); revalidatePath("/estimates");
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Something went wrong." }; }
}

export async function toggleAssetTypeStatusAction(formData: FormData) {
  await requireUserTypesForAction(["ADMIN", "OPERATIONS"]);
  const assetTypeId = String(formData.get("assetTypeId") || "");
  if (!assetTypeId) throw new Error("Asset Type is required.");
  const assetType = await db.assetType.findUnique({ where: { id: assetTypeId } });
  if (!assetType) throw new Error("Asset Type not found.");
  await db.assetType.update({ where: { id: assetTypeId }, data: { isActive: !assetType.isActive } });
  revalidatePath("/asset-type"); revalidatePath(`/asset-type/${assetTypeId}`); revalidatePath("/projects/new"); revalidatePath("/time-entries"); revalidatePath("/estimates");
}
