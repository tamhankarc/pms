"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageLensTypes, canViewCostData } from "@/lib/permissions";

export type LensTypeFormState = { success?: boolean; error?: string };

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Lens Type name is required."),
  cost: z.coerce.number().min(0, "Cost cannot be negative."),
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
});

async function requireCanManageLensTypes() {
  const user = await requireUserForAction();
  if (!canManageLensTypes(user))
    throw new Error("You are not allowed to manage lens types.");
  return user;
}

export async function createLensTypeAction(
  _prev: LensTypeFormState,
  formData: FormData,
): Promise<LensTypeFormState> {
  try {
    const user = await requireCanManageLensTypes();
    const parsed = schema.safeParse({
      name: formData.get("name"),
      cost: formData.get("cost") ?? "0",
      isActive: formData.get("isActive") ?? "on",
    });
    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid lens type payload.",
      };
    await db.lensType.create({
      data: {
        name: parsed.data.name,
        cost: canViewCostData(user) ? parsed.data.cost : 0,
        isActive: Boolean(parsed.data.isActive),
      },
    });
    revalidatePath("/lens-type");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    revalidatePath("/billing-reports");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function updateLensTypeAction(
  _prev: LensTypeFormState,
  formData: FormData,
): Promise<LensTypeFormState> {
  try {
    const user = await requireCanManageLensTypes();
    const parsed = schema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      cost: formData.get("cost") ?? "0",
      isActive: formData.get("isActive") ?? undefined,
    });
    if (!parsed.success || !parsed.data.id)
      return {
        success: false,
        error: parsed.success
          ? "Lens Type is required."
          : parsed.error.issues[0]?.message,
      };
    const existing = await db.lensType.findUnique({
      where: { id: parsed.data.id },
      select: { cost: true },
    });
    if (!existing) return { success: false, error: "Lens Type not found." };
    await db.lensType.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        cost: canViewCostData(user) ? parsed.data.cost : existing.cost,
        isActive: Boolean(parsed.data.isActive),
      },
    });
    revalidatePath("/lens-type");
    revalidatePath(`/lens-type/${parsed.data.id}`);
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    revalidatePath("/billing-reports");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function toggleLensTypeStatusAction(formData: FormData) {
  await requireCanManageLensTypes();
  const lensTypeId = String(formData.get("lensTypeId") || "");
  if (!lensTypeId) throw new Error("Lens Type is required.");
  const lensType = await db.lensType.findUnique({ where: { id: lensTypeId } });
  if (!lensType) throw new Error("Lens Type not found.");
  await db.lensType.update({
    where: { id: lensTypeId },
    data: { isActive: !lensType.isActive },
  });
  revalidatePath("/lens-type");
  revalidatePath(`/lens-type/${lensTypeId}`);
  revalidatePath("/time-entries");
  revalidatePath("/estimates");
  revalidatePath("/billing-reports");
}
