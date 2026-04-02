"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageCountries } from "@/lib/permissions";

export type CountryFormState = {
  success?: boolean;
  error?: string;
};

const countrySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Country name is required."),
  isoCode: z.string().trim().max(10).optional().or(z.literal("")),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

async function requireCountryAccess() {
  const user = await requireUserForAction();
  if (!canManageCountries(user)) {
    throw new Error("You are not allowed to manage countries.");
  }
  return user;
}

export async function createCountryAction(
  _prevState: CountryFormState,
  formData: FormData,
): Promise<CountryFormState> {
  try {
    await requireCountryAccess();

    const parsed = countrySchema.safeParse({
      name: formData.get("name"),
      isoCode: formData.get("isoCode"),
      isActive: formData.get("isActive") ?? "on",
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid country payload." };
    }

    await db.country.create({
      data: {
        name: parsed.data.name.trim(),
        isoCode: parsed.data.isoCode?.trim().toUpperCase() || null,
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/countries");
    revalidatePath("/projects");
    revalidatePath("/projects/new");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateCountryAction(
  _prevState: CountryFormState,
  formData: FormData,
): Promise<CountryFormState> {
  try {
    await requireCountryAccess();

    const parsed = countrySchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      isoCode: formData.get("isoCode"),
      isActive: formData.get("isActive") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return { success: false, error: parsed.success ? "Country is required." : parsed.error.issues[0]?.message };
    }

    await db.country.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name.trim(),
        isoCode: parsed.data.isoCode?.trim().toUpperCase() || null,
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/countries");
    revalidatePath(`/countries/${parsed.data.id}`);
    revalidatePath("/projects");
    revalidatePath("/projects/new");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function toggleCountryStatusAction(formData: FormData) {
  await requireCountryAccess();

  const countryId = String(formData.get("countryId") || "");
  if (!countryId) throw new Error("Country is required.");

  const country = await db.country.findUnique({ where: { id: countryId } });
  if (!country) throw new Error("Country not found.");

  await db.country.update({
    where: { id: countryId },
    data: { isActive: !country.isActive },
  });

  revalidatePath("/countries");
  revalidatePath(`/countries/${countryId}`);
  revalidatePath("/projects");
  revalidatePath("/projects/new");
}
