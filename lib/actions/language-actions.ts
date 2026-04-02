"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageLanguages } from "@/lib/permissions";

export type LanguageFormState = {
  success?: boolean;
  error?: string;
};

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Language name is required."),
  code: z.string().trim().min(1, "Language code is required.").max(20),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

async function requireLanguageAccess() {
  const user = await requireUserForAction();
  if (!canManageLanguages(user)) {
    throw new Error("You are not allowed to manage languages.");
  }
  return user;
}

export async function createLanguageAction(
  _prev: LanguageFormState,
  formData: FormData,
): Promise<LanguageFormState> {
  try {
    await requireLanguageAccess();

    const parsed = schema.safeParse({
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? ""),
      isActive: formData.get("isActive") ?? "on",
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid language payload.",
      };
    }

    await db.language.create({
      data: {
        name: parsed.data.name.trim(),
        code: parsed.data.code.trim(),
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/languages");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function updateLanguageAction(
  _prev: LanguageFormState,
  formData: FormData,
): Promise<LanguageFormState> {
  try {
    await requireLanguageAccess();

    const parsed = schema.safeParse({
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? ""),
      isActive: formData.get("isActive") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return {
        success: false,
        error: parsed.success ? "Language is required." : parsed.error.issues[0]?.message,
      };
    }

    await db.language.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name.trim(),
        code: parsed.data.code.trim(),
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/languages");
    revalidatePath(`/languages/${parsed.data.id}`);
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function toggleLanguageStatusAction(formData: FormData) {
  await requireLanguageAccess();

  const languageId = String(formData.get("languageId") || "");
  if (!languageId) throw new Error("Language is required.");

  const language = await db.language.findUnique({ where: { id: languageId } });
  if (!language) throw new Error("Language not found.");

  await db.language.update({
    where: { id: languageId },
    data: { isActive: !language.isActive },
  });

  revalidatePath("/languages");
  revalidatePath(`/languages/${languageId}`);
}