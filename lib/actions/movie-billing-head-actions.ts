"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserTypesForAction } from "@/lib/auth";

export type MovieBillingHeadFormState = { success?: boolean; error?: string };

const schema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  name: z.string().trim().min(2, "Billing head name is required."),
  compulsionType: z.enum(["FIXED_COMPULSORY", "FIXED_OPTIONAL"]),
  costType: z.enum(["WHOLE_COST", "PER_UNIT_COST"]),
  domesticCost: z.coerce.number().min(0, "Domestic cost cannot be negative."),
  intlCost: z.coerce.number().min(0, "INTL cost cannot be negative."),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

export async function createMovieBillingHeadAction(_prevState: MovieBillingHeadFormState, formData: FormData): Promise<MovieBillingHeadFormState> {
  try {
    await requireUserTypesForAction(["ADMIN"]);
    const parsed = schema.safeParse({
      clientId: formData.get("clientId"),
      name: formData.get("name"),
      compulsionType: formData.get("compulsionType"),
      costType: formData.get("costType"),
      domesticCost: formData.get("domesticCost") ?? "0",
      intlCost: formData.get("intlCost") ?? "0",
      isActive: formData.get("isActive") ?? "on",
    });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid billing head payload." };
    await db.movieBillingHead.create({
      data: {
        clientId: parsed.data.clientId,
        name: parsed.data.name,
        compulsionType: parsed.data.compulsionType,
        costType: parsed.data.costType,
        domesticCost: parsed.data.domesticCost,
        intlCost: parsed.data.intlCost,
        isActive: Boolean(parsed.data.isActive),
      },
    });
    revalidatePath("/movie-billing-heads");
    revalidatePath("/movies");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateMovieBillingHeadAction(_prevState: MovieBillingHeadFormState, formData: FormData): Promise<MovieBillingHeadFormState> {
  try {
    await requireUserTypesForAction(["ADMIN"]);
    const parsed = schema.safeParse({
      id: formData.get("id"),
      clientId: formData.get("clientId"),
      name: formData.get("name"),
      compulsionType: formData.get("compulsionType"),
      costType: formData.get("costType"),
      domesticCost: formData.get("domesticCost") ?? "0",
      intlCost: formData.get("intlCost") ?? "0",
      isActive: formData.get("isActive") ?? undefined,
    });
    if (!parsed.success || !parsed.data.id) return { success: false, error: parsed.success ? "Billing head is required." : parsed.error.issues[0]?.message };
    await db.movieBillingHead.update({
      where: { id: parsed.data.id },
      data: {
        clientId: parsed.data.clientId,
        name: parsed.data.name,
        compulsionType: parsed.data.compulsionType,
        costType: parsed.data.costType,
        domesticCost: parsed.data.domesticCost,
        intlCost: parsed.data.intlCost,
        isActive: Boolean(parsed.data.isActive),
      },
    });
    revalidatePath("/movie-billing-heads");
    revalidatePath(`/movie-billing-heads/${parsed.data.id}`);
    revalidatePath("/movies");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function toggleMovieBillingHeadStatusAction(formData: FormData) {
  await requireUserTypesForAction(["ADMIN"]);
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Billing head is required.");
  const head = await db.movieBillingHead.findUnique({ where: { id } });
  if (!head) throw new Error("Billing head not found.");
  await db.movieBillingHead.update({ where: { id }, data: { isActive: !head.isActive } });
  revalidatePath("/movie-billing-heads");
  revalidatePath(`/movie-billing-heads/${id}`);
}
