"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserTypesForAction } from "@/lib/auth";

export type MovieBillingHeadAssignmentFormState = { success?: boolean; error?: string };

const checkboxSchema = z.preprocess((value) => value === "on" || value === "true" || value === "1", z.boolean());

const schema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  countryId: z.string().min(1, "Country is required."),
  movieId: z.string().min(1, "Movie is required."),
  billingHeadId: z.string().min(1, "Billing head is required."),
  units: z.coerce.number().min(0, "Units cannot be negative.").optional(),
  isActive: checkboxSchema,
});

async function validateOptionalHeadForSelection(clientId: string, countryId: string, movieId: string, billingHeadId: string) {
  const [country, movie, head] = await Promise.all([
    db.country.findUnique({ where: { id: countryId }, select: { isoCode: true, name: true } }),
    db.movie.findUnique({ where: { id: movieId }, select: { id: true, clientId: true, status: true, isActive: true, title: true } }),
    db.movieBillingHead.findUnique({
      where: { id: billingHeadId },
      select: {
        id: true,
        clientId: true,
        isActive: true,
        costType: true,
        domesticActive: true,
        intlActive: true,
        domesticCompulsionType: true,
        intlCompulsionType: true,
      },
    }),
  ]);

  if (!country) return { ok: false as const, error: "Country not found." };
  if (!movie || movie.clientId !== clientId || movie.status !== "WORKING" || !movie.isActive) return { ok: false as const, error: "Select a Working movie for the selected client." };
  if (!head || head.clientId !== clientId || !head.isActive) return { ok: false as const, error: "Select a valid Fixed - Optional billing head for the selected client." };

  const isDomestic = (country.isoCode ?? "").toUpperCase() === "US" || country.name.trim().toLowerCase() === "united states" || country.name.trim().toLowerCase() === "usa";
  const isValidHead = isDomestic
    ? head.domesticActive && head.domesticCompulsionType === "FIXED_OPTIONAL"
    : head.intlActive && head.intlCompulsionType === "FIXED_OPTIONAL";

  if (!isValidHead) return { ok: false as const, error: "Selected billing head is not Fixed - Optional for the selected country." };
  return { ok: true as const, costType: head.costType };
}

export async function createMovieBillingHeadAssignmentAction(_prevState: MovieBillingHeadAssignmentFormState, formData: FormData): Promise<MovieBillingHeadAssignmentFormState> {
  try {
    await requireUserTypesForAction(["ADMIN"]);
    const parsed = schema.safeParse({
      clientId: formData.get("clientId"),
      countryId: formData.get("countryId"),
      movieId: formData.get("movieId"),
      billingHeadId: formData.get("billingHeadId"),
      units: formData.get("units") || undefined,
      isActive: formData.get("isActive") ?? "off",
    });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid movie billing head payload." };

    const valid = await validateOptionalHeadForSelection(parsed.data.clientId, parsed.data.countryId, parsed.data.movieId, parsed.data.billingHeadId);
    if (!valid.ok) return { success: false, error: valid.error };

    await db.movieBillingHeadAssignment.create({
      data: {
        clientId: parsed.data.clientId,
        countryId: parsed.data.countryId,
        movieId: parsed.data.movieId,
        billingHeadId: parsed.data.billingHeadId,
        units: valid.costType === "PER_UNIT_COST" ? parsed.data.units ?? 0 : null,
        isActive: parsed.data.isActive,
      },
    });
    revalidatePath("/movie-billing-heads");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateMovieBillingHeadAssignmentAction(_prevState: MovieBillingHeadAssignmentFormState, formData: FormData): Promise<MovieBillingHeadAssignmentFormState> {
  try {
    await requireUserTypesForAction(["ADMIN"]);
    const parsed = schema.safeParse({
      id: formData.get("id"),
      clientId: formData.get("clientId"),
      countryId: formData.get("countryId"),
      movieId: formData.get("movieId"),
      billingHeadId: formData.get("billingHeadId"),
      units: formData.get("units") || undefined,
      isActive: formData.get("isActive") ?? undefined,
    });
    if (!parsed.success || !parsed.data.id) return { success: false, error: parsed.success ? "Movie billing head is required." : parsed.error.issues[0]?.message };

    const valid = await validateOptionalHeadForSelection(parsed.data.clientId, parsed.data.countryId, parsed.data.movieId, parsed.data.billingHeadId);
    if (!valid.ok) return { success: false, error: valid.error };

    await db.movieBillingHeadAssignment.update({
      where: { id: parsed.data.id },
      data: {
        clientId: parsed.data.clientId,
        countryId: parsed.data.countryId,
        movieId: parsed.data.movieId,
        billingHeadId: parsed.data.billingHeadId,
        units: valid.costType === "PER_UNIT_COST" ? parsed.data.units ?? 0 : null,
        isActive: parsed.data.isActive,
      },
    });
    revalidatePath("/movie-billing-heads");
    revalidatePath(`/movie-billing-heads/${parsed.data.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function toggleMovieBillingHeadAssignmentStatusAction(formData: FormData) {
  await requireUserTypesForAction(["ADMIN"]);
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Movie billing head is required.");
  const row = await db.movieBillingHeadAssignment.findUnique({ where: { id } });
  if (!row) throw new Error("Movie billing head not found.");
  await db.movieBillingHeadAssignment.update({ where: { id }, data: { isActive: !row.isActive } });
  revalidatePath("/movie-billing-heads");
  revalidatePath(`/movie-billing-heads/${id}`);
}
