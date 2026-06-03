"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageClients, canViewCostData } from "@/lib/permissions";
import { generateClientCode } from "@/lib/project-code";

const SONY_PICTURES_CLIENT_ID = "cmn66d3q40002l104n6wvefvl";
const SONY_PICTURES_CLIENT_NAME = "sony pictures entertainment";

export type ClientFormState = {
  success?: boolean;
  error?: string;
};

const clientSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Client name is required."),
  showCountriesInTimeEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  showMoviesInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  showAssetTypesInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  showLensTypesInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  lensFirstPlatformCost: z.coerce
    .number()
    .min(0, "1st Platform Charges cannot be negative.")
    .optional(),
  lensSubsequentPlatformCost: z.coerce
    .number()
    .min(0, "Subsequent Platform Charges cannot be negative.")
    .optional(),
  showAssetNamesInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  showLanguagesInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  showNewslettersInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  enableProjectTypes: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  hourlyCost: z.coerce
    .number()
    .min(0, "Per hour cost cannot be negative.")
    .optional(),
  sonyCoppaSiteCost: z.coerce
    .number()
    .min(0, "COPPA Site cost cannot be negative.")
    .optional(),
  sonyUsEpkSiteCost: z.coerce
    .number()
    .min(0, "US EPK Site cost cannot be negative.")
    .optional(),
  sonyGlobalEpkSiteCost: z.coerce
    .number()
    .min(0, "Global EPK Site cost cannot be negative.")
    .optional(),
  poAssignmentMode: z.enum(["NOT_REQUIRED", "TITLE", "TITLE_BILLING_REPORT", "TITLE_PROJECT", "PROJECT"]).default("NOT_REQUIRED"),
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
});

async function requireCanManageClients() {
  const user = await requireUserForAction();
  if (!canManageClients(user))
    throw new Error("You are not allowed to manage clients.");
  return user;
}
export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  try {
    const user = await requireCanManageClients();

    const parsed = clientSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      showCountriesInTimeEntries:
        formData.get("showCountriesInTimeEntries") ?? undefined,
      showMoviesInEntries: formData.get("showMoviesInEntries") ?? undefined,
      showAssetTypesInEntries:
        formData.get("showAssetTypesInEntries") ?? undefined,
      showLensTypesInEntries:
        formData.get("showLensTypesInEntries") ?? undefined,
      lensFirstPlatformCost: formData.get("lensFirstPlatformCost") ?? "0",
      lensSubsequentPlatformCost:
        formData.get("lensSubsequentPlatformCost") ?? "0",
      showAssetNamesInEntries:
        formData.get("showAssetNamesInEntries") ?? undefined,
      showLanguagesInEntries:
        formData.get("showLanguagesInEntries") ?? undefined,
      showNewslettersInEntries:
        formData.get("showNewslettersInEntries") ?? undefined,
      enableProjectTypes: formData.get("enableProjectTypes") ?? undefined,
      hourlyCost: formData.get("hourlyCost") ?? "0",
      sonyCoppaSiteCost: formData.get("sonyCoppaSiteCost") ?? "0",
      sonyUsEpkSiteCost: formData.get("sonyUsEpkSiteCost") ?? "0",
      sonyGlobalEpkSiteCost: formData.get("sonyGlobalEpkSiteCost") ?? "0",
      poAssignmentMode: formData.get("poAssignmentMode") ?? "NOT_REQUIRED",
      isActive: formData.get("isActive") ?? "on",
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid client payload.",
      };
    }

    const generatedCode = await generateClientCode(parsed.data.name.trim());
    const isSonyPicturesClient =
      parsed.data.name.trim().toLowerCase() === SONY_PICTURES_CLIENT_NAME;

    await db.client.create({
      data: {
        name: parsed.data.name.trim(),
        code: generatedCode,
        showCountriesInTimeEntries: Boolean(
          parsed.data.showCountriesInTimeEntries,
        ),
        showMoviesInEntries: Boolean(parsed.data.showMoviesInEntries),
        showAssetTypesInEntries: Boolean(parsed.data.showAssetTypesInEntries),
        showLensTypesInEntries: Boolean(parsed.data.showLensTypesInEntries),
        lensFirstPlatformCost:
          canViewCostData(user) && Boolean(parsed.data.showLensTypesInEntries)
            ? (parsed.data.lensFirstPlatformCost ?? 0)
            : 0,
        lensSubsequentPlatformCost:
          canViewCostData(user) && Boolean(parsed.data.showLensTypesInEntries)
            ? (parsed.data.lensSubsequentPlatformCost ?? 0)
            : 0,
        showAssetNamesInEntries: Boolean(parsed.data.showAssetNamesInEntries),
        showLanguagesInEntries: Boolean(parsed.data.showLanguagesInEntries),
        showNewslettersInEntries: Boolean(parsed.data.showNewslettersInEntries),
        enableProjectTypes: Boolean(parsed.data.enableProjectTypes),
        hourlyCost: canViewCostData(user) ? (parsed.data.hourlyCost ?? 0) : 0,
        sonyCoppaSiteCost:
          canViewCostData(user) && isSonyPicturesClient
            ? (parsed.data.sonyCoppaSiteCost ?? 0)
            : 0,
        sonyUsEpkSiteCost:
          canViewCostData(user) && isSonyPicturesClient
            ? (parsed.data.sonyUsEpkSiteCost ?? 0)
            : 0,
        sonyGlobalEpkSiteCost:
          canViewCostData(user) && isSonyPicturesClient
            ? (parsed.data.sonyGlobalEpkSiteCost ?? 0)
            : 0,
        poAssignmentMode: parsed.data.poAssignmentMode,
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/clients");
    revalidatePath("/clients/new");
    revalidatePath("/projects/new");
    revalidatePath("/movies");
    revalidatePath("/asset-type");
    revalidatePath("/asset-names");
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
    const user = await requireCanManageClients();

    const parsed = clientSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? ""),
      showCountriesInTimeEntries:
        formData.get("showCountriesInTimeEntries") ?? undefined,
      showMoviesInEntries: formData.get("showMoviesInEntries") ?? undefined,
      showAssetTypesInEntries:
        formData.get("showAssetTypesInEntries") ?? undefined,
      showLensTypesInEntries:
        formData.get("showLensTypesInEntries") ?? undefined,
      lensFirstPlatformCost: formData.get("lensFirstPlatformCost") ?? "0",
      lensSubsequentPlatformCost:
        formData.get("lensSubsequentPlatformCost") ?? "0",
      showAssetNamesInEntries:
        formData.get("showAssetNamesInEntries") ?? undefined,
      showLanguagesInEntries:
        formData.get("showLanguagesInEntries") ?? undefined,
      showNewslettersInEntries:
        formData.get("showNewslettersInEntries") ?? undefined,
      enableProjectTypes: formData.get("enableProjectTypes") ?? undefined,
      hourlyCost: formData.get("hourlyCost") ?? "0",
      sonyCoppaSiteCost: formData.get("sonyCoppaSiteCost") ?? "0",
      sonyUsEpkSiteCost: formData.get("sonyUsEpkSiteCost") ?? "0",
      sonyGlobalEpkSiteCost: formData.get("sonyGlobalEpkSiteCost") ?? "0",
      poAssignmentMode: formData.get("poAssignmentMode") ?? "NOT_REQUIRED",
      isActive: formData.get("isActive") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return {
        success: false,
        error: parsed.success
          ? "Client is required."
          : parsed.error.issues[0]?.message,
      };
    }

    const existingClient = await db.client.findUnique({
      where: { id: parsed.data.id },
      select: {
        code: true,
        hourlyCost: true,
        lensFirstPlatformCost: true,
        lensSubsequentPlatformCost: true,
        sonyCoppaSiteCost: true,
        sonyUsEpkSiteCost: true,
        sonyGlobalEpkSiteCost: true,
      },
    });

    if (!existingClient) {
      return { success: false, error: "Client not found." };
    }

    const code =
      existingClient.code?.trim() ||
      (await generateClientCode(parsed.data.name.trim()));
    const isSonyPicturesClient = parsed.data.id === SONY_PICTURES_CLIENT_ID;

    await db.client.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name.trim(),
        code,
        showCountriesInTimeEntries: Boolean(
          parsed.data.showCountriesInTimeEntries,
        ),
        showMoviesInEntries: Boolean(parsed.data.showMoviesInEntries),
        showAssetTypesInEntries: Boolean(parsed.data.showAssetTypesInEntries),
        showLensTypesInEntries: Boolean(parsed.data.showLensTypesInEntries),
        lensFirstPlatformCost: !Boolean(parsed.data.showLensTypesInEntries)
          ? 0
          : canViewCostData(user)
            ? (parsed.data.lensFirstPlatformCost ?? 0)
            : existingClient.lensFirstPlatformCost,
        lensSubsequentPlatformCost: !Boolean(parsed.data.showLensTypesInEntries)
          ? 0
          : canViewCostData(user)
            ? (parsed.data.lensSubsequentPlatformCost ?? 0)
            : existingClient.lensSubsequentPlatformCost,
        showAssetNamesInEntries: Boolean(parsed.data.showAssetNamesInEntries),
        showLanguagesInEntries: Boolean(parsed.data.showLanguagesInEntries),
        showNewslettersInEntries: Boolean(parsed.data.showNewslettersInEntries),
        enableProjectTypes: Boolean(parsed.data.enableProjectTypes),
        hourlyCost: canViewCostData(user)
          ? (parsed.data.hourlyCost ?? 0)
          : existingClient.hourlyCost,
        sonyCoppaSiteCost:
          canViewCostData(user) && isSonyPicturesClient
            ? (parsed.data.sonyCoppaSiteCost ?? 0)
            : existingClient.sonyCoppaSiteCost,
        sonyUsEpkSiteCost:
          canViewCostData(user) && isSonyPicturesClient
            ? (parsed.data.sonyUsEpkSiteCost ?? 0)
            : existingClient.sonyUsEpkSiteCost,
        sonyGlobalEpkSiteCost:
          canViewCostData(user) && isSonyPicturesClient
            ? (parsed.data.sonyGlobalEpkSiteCost ?? 0)
            : existingClient.sonyGlobalEpkSiteCost,
        poAssignmentMode: parsed.data.poAssignmentMode,
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
    revalidatePath("/asset-names");
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
  await requireCanManageClients();

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
