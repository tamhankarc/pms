"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserTypesForAction } from "@/lib/auth";
import { generateClientCode } from "@/lib/project-code";

export type ClientFormState = {
  success?: boolean;
  error?: string;
};

const clientSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Client name is required."),
  showCountriesInTimeEntries: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  showMoviesInEntries: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  showAssetTypesInEntries: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  showLanguagesInEntries: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  enableProjectTypes: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  hourlyCost: z.coerce.number().min(0, "Per hour cost cannot be negative.").optional(),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  try {
    await requireUserTypesForAction(["ADMIN", "MANAGER", "TEAM_LEAD"]);

    const parsed = clientSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      showCountriesInTimeEntries: formData.get("showCountriesInTimeEntries") ?? undefined,
      showMoviesInEntries: formData.get("showMoviesInEntries") ?? undefined,
      showAssetTypesInEntries: formData.get("showAssetTypesInEntries") ?? undefined,
      showLanguagesInEntries: formData.get("showLanguagesInEntries") ?? undefined,
      enableProjectTypes: formData.get("enableProjectTypes") ?? undefined,
      hourlyCost: formData.get("hourlyCost") ?? "0",
      isActive: formData.get("isActive") ?? "on",
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid client payload.",
      };
    }

    const generatedCode = await generateClientCode(parsed.data.name.trim());

    await db.client.create({
      data: {
        name: parsed.data.name.trim(),
        code: generatedCode,
        showCountriesInTimeEntries: Boolean(parsed.data.showCountriesInTimeEntries),
        showMoviesInEntries: Boolean(parsed.data.showMoviesInEntries),
        showAssetTypesInEntries: Boolean(parsed.data.showAssetTypesInEntries),
        showLanguagesInEntries: Boolean(parsed.data.showLanguagesInEntries),
        enableProjectTypes: Boolean(parsed.data.enableProjectTypes),
        hourlyCost: parsed.data.hourlyCost ?? 0,
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/clients");
    revalidatePath("/clients/new");
    revalidatePath("/projects/new");
    revalidatePath("/movies");
    revalidatePath("/asset-type");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    revalidatePath("/sub-project");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function updateClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  try {
    await requireUserTypesForAction(["ADMIN", "MANAGER", "TEAM_LEAD"]);

    const parsed = clientSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? ""),
      showCountriesInTimeEntries: formData.get("showCountriesInTimeEntries") ?? undefined,
      showMoviesInEntries: formData.get("showMoviesInEntries") ?? undefined,
      showAssetTypesInEntries: formData.get("showAssetTypesInEntries") ?? undefined,
      showLanguagesInEntries: formData.get("showLanguagesInEntries") ?? undefined,
      enableProjectTypes: formData.get("enableProjectTypes") ?? undefined,
      hourlyCost: formData.get("hourlyCost") ?? "0",
      isActive: formData.get("isActive") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return {
        success: false,
        error: parsed.success ? "Client is required." : parsed.error.issues[0]?.message,
      };
    }

    const existingClient = await db.client.findUnique({
      where: { id: parsed.data.id },
      select: { code: true },
    });

    if (!existingClient) {
      return { success: false, error: "Client not found." };
    }

    const code = existingClient.code?.trim() || (await generateClientCode(parsed.data.name.trim()));

    await db.client.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name.trim(),
        code,
        showCountriesInTimeEntries: Boolean(parsed.data.showCountriesInTimeEntries),
        showMoviesInEntries: Boolean(parsed.data.showMoviesInEntries),
        showAssetTypesInEntries: Boolean(parsed.data.showAssetTypesInEntries),
        showLanguagesInEntries: Boolean(parsed.data.showLanguagesInEntries),
        enableProjectTypes: Boolean(parsed.data.enableProjectTypes),
        hourlyCost: parsed.data.hourlyCost ?? 0,
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/clients");
    revalidatePath("/clients/new");
    revalidatePath(`/clients/${parsed.data.id}`);
    revalidatePath(`/clients/${parsed.data.id}/project-types`);
    revalidatePath("/projects/new");
    revalidatePath("/movies");
    revalidatePath("/asset-type");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    revalidatePath("/sub-project");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function toggleClientStatusAction(formData: FormData) {
  await requireUserTypesForAction(["ADMIN", "MANAGER", "TEAM_LEAD"]);

  const clientId = String(formData.get("clientId") || "");
  if (!clientId) throw new Error("Client is required.");

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found.");

  await db.client.update({
    where: { id: clientId },
    data: { isActive: !client.isActive },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}
