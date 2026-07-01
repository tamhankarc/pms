"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { generateProjectCode } from "@/lib/project-code";
import { canCreateOrEditProject, canDeleteProjects } from "@/lib/permissions";

export type ProjectFormState = { success?: boolean; error?: string };

const baseSchema = z.object({
  clientId: z.string().optional(),
  projectTypeId: z.string().optional().nullable(),
  contactPersonId: z.string().optional().nullable(),
  contactPersonIds: z.array(z.string()).optional(),
  name: z.string().min(2, "Project name is required."),
  billingModel: z.enum([
    "HOURLY",
    "FIXED_FULL",
    "FIXED_MONTHLY",
    "FIXED_PER_COUNTRY",
    "FIXED_COST",
  ]),
  billingCycle: z.enum(["ONE_TIME", "MONTHLY"]).default("ONE_TIME"),
  warnerProjectType: z.enum(["OTHER", "PORTAL", "DVD", "TICKETING", "SOCIAL"]).default("OTHER"),
  sonyProjectType: z.enum(["OTHER", "NEWSLETTERS"]).default("OTHER"),
  fixedContractHours: z.coerce.number().nonnegative().optional(),
  fixedMonthlyHours: z.coerce.number().nonnegative().optional(),
  additionalCharges: z.coerce
    .number()
    .nonnegative("Additional Charges cannot be negative.")
    .optional(),
  partialBillingCost: z.coerce
    .number()
    .nonnegative("Partial Billing cost cannot be negative.")
    .optional(),
  projectCost: z.coerce
    .number()
    .nonnegative("Project Cost cannot be negative.")
    .optional(),
  projectCostOtherMovieBillingRegion: z.coerce
    .number()
    .nonnegative(
      "Project Cost - Other Movie Billing Region cannot be negative.",
    )
    .optional(),
  perCountryCharges: z.coerce
    .number()
    .nonnegative("Per Country Charges cannot be negative.")
    .optional(),
  universalSmallCost: z.coerce
    .number()
    .nonnegative("Universal Small cost cannot be negative.")
    .optional(),
  universalMediumCost: z.coerce
    .number()
    .nonnegative("Universal Medium cost cannot be negative.")
    .optional(),
  universalLargeCost: z.coerce
    .number()
    .nonnegative("Universal Large cost cannot be negative.")
    .optional(),
  universalExtraLargeCost: z.coerce
    .number()
    .nonnegative("Universal Extra Large cost cannot be negative.")
    .optional(),
  developerCount: z.coerce
    .number()
    .int()
    .nonnegative("Developer count cannot be negative.")
    .optional(),
  perDeveloperCost: z.coerce
    .number()
    .nonnegative("Per Developer Cost cannot be negative.")
    .optional(),
  status: z.enum([
    "DRAFT",
    "ACTIVE",
    "ON_HOLD",
    "COMPLETED",
    "COMPLETED_BILLED",
    "ARCHIVED",
  ]),
  description: z.string().optional(),
  hideCountriesInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  hideMoviesInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  hideAssetTypesInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  hideLensTypesInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  hideAssetNamesInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  hideNewslettersInEntries: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  addToBilling: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
});

async function requireMasterDataActionUser() {
  const user = await requireUserForAction();
  if (!canCreateOrEditProject(user)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return user;
}

async function validateProjectType(
  clientId: string,
  projectTypeId?: string | null,
) {
  if (!projectTypeId) return null;
  return db.projectType.findFirst({
    where: { id: projectTypeId, clientId, isActive: true },
    select: { id: true, name: true },
  });
}

const FILMIK_CLIENT_ID = "cmne6ed2o0000jo04t3363pqz";
const SONY_PICTURES_CLIENT_ID = "cmn66d3q40002l104n6wvefvl";
const UNIVERSAL_PICTURES_CLIENT_ID = "cmnh2xr1s0004l204ia5u5zj3";
const WARNER_BROS_CLIENT_ID = "cmn66av4j0001l104077m5vxz";

function parseMonthStart(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseFilmikResourceRows(formData: FormData) {
  const rows: Array<{
    resourceTypeId: string;
    count: number;
    effectiveMonth: Date;
  }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("filmikResourceCount__")) continue;
    const resourceTypeId = key.replace("filmikResourceCount__", "");
    const count = Math.max(0, Math.trunc(Number(value || 0)));
    const monthValue = String(
      formData.get(`filmikResourceMonth__${resourceTypeId}`) || "",
    );
    const effectiveMonth = parseMonthStart(monthValue);
    if (!resourceTypeId || !effectiveMonth) continue;
    rows.push({ resourceTypeId, count, effectiveMonth });
  }
  return rows;
}

function parseMonthlyAdditionalHourRows(formData: FormData) {
  const rows: Array<{ month: Date; hours: number }> = [];
  const months = formData
    .getAll("monthlyAdditionalHourMonth")
    .map((value) => String(value || ""));
  const hours = formData
    .getAll("monthlyAdditionalHourHours")
    .map((value) => Number(value || 0));
  months.forEach((monthValue, index) => {
    const month = parseMonthStart(monthValue);
    const hourValue = Math.max(0, Number(hours[index] || 0));
    if (!month || hourValue <= 0) return;
    rows.push({ month, hours: hourValue });
  });
  return rows;
}

async function saveMonthlyAdditionalHours(
  projectId: string,
  billingModel: string,
  formData: FormData,
) {
  if (billingModel !== "FIXED_MONTHLY") {
    await db.projectMonthlyAdditionalHours.deleteMany({ where: { projectId } });
    return;
  }
  const rows = parseMonthlyAdditionalHourRows(formData);
  await db.projectMonthlyAdditionalHours.deleteMany({ where: { projectId } });
  for (const row of rows) {
    await db.projectMonthlyAdditionalHours.create({
      data: { projectId, month: row.month, hours: row.hours },
    });
  }
}

async function saveFilmikResourceCounts(
  projectId: string,
  clientId: string,
  formData: FormData,
) {
  if (clientId !== FILMIK_CLIENT_ID) return;
  const rows = parseFilmikResourceRows(formData);
  if (!rows.length) return;
  const validResourceIds = new Set(
    (
      await db.filmikResourceType.findMany({
        where: {
          clientId: FILMIK_CLIENT_ID,
          id: { in: rows.map((row) => row.resourceTypeId) },
        },
        select: { id: true },
      })
    ).map((resource: { id: string }) => resource.id),
  );

  for (const row of rows) {
    if (!validResourceIds.has(row.resourceTypeId)) continue;
    await db.projectFilmikResourceCount.upsert({
      where: {
        projectId_resourceTypeId_effectiveMonth: {
          projectId,
          resourceTypeId: row.resourceTypeId,
          effectiveMonth: row.effectiveMonth,
        },
      },
      create: {
        projectId,
        resourceTypeId: row.resourceTypeId,
        effectiveMonth: row.effectiveMonth,
        count: row.count,
      },
      update: { count: row.count },
    });
  }
}

export async function createProjectAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  try {
    const user = await requireMasterDataActionUser();
    const parsed = baseSchema.safeParse({
      clientId: String(formData.get("clientId") ?? ""),
      projectTypeId: String(formData.get("projectTypeId") ?? "") || null,
      contactPersonId: String(formData.get("contactPersonId") ?? "") || null,
      contactPersonIds: formData
        .getAll("contactPersonIds")
        .map(String)
        .filter(Boolean),
      name: String(formData.get("name") ?? ""),
      billingModel: formData.get("billingModel"),
      billingCycle: formData.get("billingCycle") || "ONE_TIME",
      warnerProjectType: formData.get("warnerProjectType") || "OTHER",
      sonyProjectType: formData.get("sonyProjectType") || "OTHER",
      fixedContractHours: formData.get("fixedContractHours") || 0,
      fixedMonthlyHours: formData.get("fixedMonthlyHours") || 0,
      additionalCharges: formData.get("additionalCharges") || 0,
      partialBillingCost: formData.get("partialBillingCost") || 0,
      projectCost: formData.get("projectCost") || 0,
      projectCostOtherMovieBillingRegion:
        formData.get("projectCostOtherMovieBillingRegion") || 0,
      perCountryCharges: formData.get("perCountryCharges") || 0,
      universalSmallCost: formData.get("universalSmallCost") || 0,
      universalMediumCost: formData.get("universalMediumCost") || 0,
      universalLargeCost: formData.get("universalLargeCost") || 0,
      universalExtraLargeCost: formData.get("universalExtraLargeCost") || 0,
      developerCount: formData.get("developerCount") || 0,
      perDeveloperCost: formData.get("perDeveloperCost") || 0,
      status: formData.get("status"),
      description: String(formData.get("description") ?? ""),
      hideCountriesInEntries:
        formData.get("hideCountriesInEntries") ?? undefined,
      hideMoviesInEntries: formData.get("hideMoviesInEntries") ?? undefined,
      hideAssetTypesInEntries:
        formData.get("hideAssetTypesInEntries") ?? undefined,
      hideLensTypesInEntries:
        formData.get("hideLensTypesInEntries") ?? undefined,
      hideAssetNamesInEntries:
        formData.get("hideAssetNamesInEntries") ?? undefined,
      hideNewslettersInEntries:
        formData.get("hideNewslettersInEntries") ?? undefined,
      addToBilling: formData.get("addToBilling") ?? undefined,
    });

    if (!parsed.success || !parsed.data.clientId) {
      return {
        success: false,
        error: parsed.success
          ? "Client is required."
          : parsed.error.issues[0]?.message,
      };
    }

    const client = await db.client.findUnique({
      where: { id: parsed.data.clientId },
      select: {
        id: true,
        enableProjectTypes: true,
        showCountriesInTimeEntries: true,
        showMoviesInEntries: true,
        showAssetTypesInEntries: true,
        showLensTypesInEntries: true,
        showAssetNamesInEntries: true,
        showNewslettersInEntries: true,
      },
    });
    if (!client) return { success: false, error: "Client not found." };
    if (client.enableProjectTypes && !parsed.data.projectTypeId)
      return {
        success: false,
        error: "Project type is required for the selected client.",
      };
    if (!client.enableProjectTypes && parsed.data.projectTypeId)
      return {
        success: false,
        error: "Selected client does not use project types.",
      };
    if (
      parsed.data.projectTypeId &&
      !(await validateProjectType(client.id, parsed.data.projectTypeId))
    )
      return {
        success: false,
        error: "Selected project type is invalid for the chosen client.",
      };

    const contactPersonIds = Array.from(
      new Set(
        (parsed.data.contactPersonIds?.length
          ? parsed.data.contactPersonIds
          : parsed.data.contactPersonId
            ? [parsed.data.contactPersonId]
            : []
        ).filter(Boolean),
      ),
    );
    if (contactPersonIds.length) {
      const contactPersonCount = await db.contactPerson.count({
        where: { id: { in: contactPersonIds }, clientId: client.id },
      });
      if (contactPersonCount !== contactPersonIds.length)
        return {
          success: false,
          error:
            "One or more selected contact persons do not belong to selected client.",
        };
    }

    const isAdminUser = user.userType === "ADMIN";
    const projectCode = await generateProjectCode(client.id);
    const project = await db.project.create({
      data: {
        clientId: client.id,
        contactPersonId: contactPersonIds[0] || null,
        contactPersons: contactPersonIds.length
          ? { connect: contactPersonIds.map((id) => ({ id })) }
          : undefined,
        projectTypeId: parsed.data.projectTypeId || null,
        name: parsed.data.name.trim(),
        code: projectCode,
        billingModel: parsed.data.billingModel,
        billingCycle: parsed.data.billingCycle,
        fixedContractHours:
          parsed.data.billingModel === "FIXED_FULL" && isAdminUser
            ? (parsed.data.fixedContractHours ?? 0)
            : null,
        fixedMonthlyHours:
          parsed.data.billingModel === "FIXED_MONTHLY" && isAdminUser
            ? (parsed.data.fixedMonthlyHours ?? 0)
            : null,
        additionalCharges:
          parsed.data.billingModel === "FIXED_FULL" && isAdminUser
            ? (parsed.data.additionalCharges ?? 0)
            : 0,
        partialBillingCost:
          parsed.data.billingModel === "FIXED_FULL" && isAdminUser
            ? (parsed.data.partialBillingCost ?? 0)
            : 0,
        projectCost:
          parsed.data.billingModel === "FIXED_COST" && isAdminUser
            ? (parsed.data.projectCost ?? 0)
            : 0,
        projectCostOtherMovieBillingRegion:
          client.id === SONY_PICTURES_CLIENT_ID && isAdminUser
            ? (parsed.data.projectCostOtherMovieBillingRegion ?? 0)
            : 0,
        perCountryCharges:
          parsed.data.billingModel === "FIXED_PER_COUNTRY" && isAdminUser
            ? (parsed.data.perCountryCharges ?? 0)
            : 0,
        universalSmallCost:
          client.id === UNIVERSAL_PICTURES_CLIENT_ID && isAdminUser
            ? (parsed.data.universalSmallCost ?? 0)
            : 0,
        universalMediumCost:
          client.id === UNIVERSAL_PICTURES_CLIENT_ID && isAdminUser
            ? (parsed.data.universalMediumCost ?? 0)
            : 0,
        universalLargeCost:
          client.id === UNIVERSAL_PICTURES_CLIENT_ID && isAdminUser
            ? (parsed.data.universalLargeCost ?? 0)
            : 0,
        universalExtraLargeCost:
          client.id === UNIVERSAL_PICTURES_CLIENT_ID && isAdminUser
            ? (parsed.data.universalExtraLargeCost ?? 0)
            : 0,
        developerCount: 0,
        perDeveloperCost: 0,
        status: parsed.data.status,
        description: parsed.data.description || null,
        createdById: user.id,
        updatedById: user.id,
        hideCountriesInEntries: client.showCountriesInTimeEntries
          ? Boolean(parsed.data.hideCountriesInEntries)
          : false,
        hideMoviesInEntries: client.showMoviesInEntries
          ? Boolean(parsed.data.hideMoviesInEntries)
          : false,
        hideAssetTypesInEntries: client.showAssetTypesInEntries
          ? Boolean(parsed.data.hideAssetTypesInEntries)
          : false,
        hideLensTypesInEntries: client.showLensTypesInEntries
          ? Boolean(parsed.data.hideLensTypesInEntries)
          : false,
        hideAssetNamesInEntries: client.showAssetNamesInEntries
          ? Boolean(parsed.data.hideAssetNamesInEntries)
          : false,
        hideNewslettersInEntries: client.showNewslettersInEntries
          ? Boolean(parsed.data.hideNewslettersInEntries)
          : false,
        addToBilling: Boolean(parsed.data.addToBilling),
      },
    });

    await saveMonthlyAdditionalHours(
      project.id,
      parsed.data.billingModel,
      formData,
    );
    if (client.id === WARNER_BROS_CLIENT_ID) {
      await db.$executeRaw`UPDATE Project SET warnerProjectType = ${parsed.data.warnerProjectType} WHERE id = ${project.id}`;
    }
    if (client.id === SONY_PICTURES_CLIENT_ID) {
      await db.$executeRaw`UPDATE Project SET sonyProjectType = ${parsed.data.sonyProjectType} WHERE id = ${project.id}`;
    }
    await saveFilmikResourceCounts(project.id, client.id, formData);

    revalidatePath("/projects");
    revalidatePath("/projects/new");
    revalidatePath("/user-assignments");
    revalidatePath("/dashboard");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    redirect("/projects");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

const projectUpdateSchema = baseSchema.omit({ clientId: true });

export async function updateProjectAction(
  projectId: string,
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  try {
    const user = await requireMasterDataActionUser();
    const existingProject = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        fixedContractHours: true,
        fixedMonthlyHours: true,
        additionalCharges: true,
        partialBillingCost: true,
        projectCost: true,
        projectCostOtherMovieBillingRegion: true,
        perCountryCharges: true,
        universalSmallCost: true,
        universalMediumCost: true,
        universalLargeCost: true,
        universalExtraLargeCost: true,
      },
    });
    if (!existingProject)
      return { success: false, error: "Project not found." };

    const parsed = projectUpdateSchema.safeParse({
      projectTypeId: String(formData.get("projectTypeId") ?? "") || null,
      contactPersonId: String(formData.get("contactPersonId") ?? "") || null,
      contactPersonIds: formData
        .getAll("contactPersonIds")
        .map(String)
        .filter(Boolean),
      name: String(formData.get("name") ?? ""),
      billingModel: formData.get("billingModel"),
      billingCycle: formData.get("billingCycle") || "ONE_TIME",
      warnerProjectType: formData.get("warnerProjectType") || "OTHER",
      sonyProjectType: formData.get("sonyProjectType") || "OTHER",
      fixedContractHours: formData.get("fixedContractHours") || 0,
      fixedMonthlyHours: formData.get("fixedMonthlyHours") || 0,
      additionalCharges: formData.get("additionalCharges") || 0,
      partialBillingCost: formData.get("partialBillingCost") || 0,
      projectCost: formData.get("projectCost") || 0,
      projectCostOtherMovieBillingRegion:
        formData.get("projectCostOtherMovieBillingRegion") || 0,
      perCountryCharges: formData.get("perCountryCharges") || 0,
      universalSmallCost: formData.get("universalSmallCost") || 0,
      universalMediumCost: formData.get("universalMediumCost") || 0,
      universalLargeCost: formData.get("universalLargeCost") || 0,
      universalExtraLargeCost: formData.get("universalExtraLargeCost") || 0,
      developerCount: formData.get("developerCount") || 0,
      perDeveloperCost: formData.get("perDeveloperCost") || 0,
      status: formData.get("status"),
      description: String(formData.get("description") ?? ""),
      hideCountriesInEntries:
        formData.get("hideCountriesInEntries") ?? undefined,
      hideMoviesInEntries: formData.get("hideMoviesInEntries") ?? undefined,
      hideAssetTypesInEntries:
        formData.get("hideAssetTypesInEntries") ?? undefined,
      hideLensTypesInEntries:
        formData.get("hideLensTypesInEntries") ?? undefined,
      hideAssetNamesInEntries:
        formData.get("hideAssetNamesInEntries") ?? undefined,
      hideNewslettersInEntries:
        formData.get("hideNewslettersInEntries") ?? undefined,
      addToBilling: formData.get("addToBilling") ?? undefined,
    });

    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid project payload.",
      };

    const client = await db.client.findUnique({
      where: { id: existingProject.clientId },
      select: {
        id: true,
        enableProjectTypes: true,
        showCountriesInTimeEntries: true,
        showMoviesInEntries: true,
        showAssetTypesInEntries: true,
        showLensTypesInEntries: true,
        showAssetNamesInEntries: true,
        showNewslettersInEntries: true,
      },
    });
    if (!client) return { success: false, error: "Client not found." };
    if (client.enableProjectTypes && !parsed.data.projectTypeId)
      return {
        success: false,
        error: "Project type is required for the selected client.",
      };
    if (!client.enableProjectTypes && parsed.data.projectTypeId)
      return {
        success: false,
        error: "Selected client does not use project types.",
      };
    if (
      parsed.data.projectTypeId &&
      !(await validateProjectType(client.id, parsed.data.projectTypeId))
    )
      return {
        success: false,
        error: "Selected project type is invalid for the chosen client.",
      };

    const contactPersonIds = Array.from(
      new Set(
        (parsed.data.contactPersonIds?.length
          ? parsed.data.contactPersonIds
          : parsed.data.contactPersonId
            ? [parsed.data.contactPersonId]
            : []
        ).filter(Boolean),
      ),
    );
    if (contactPersonIds.length) {
      const contactPersonCount = await db.contactPerson.count({
        where: { id: { in: contactPersonIds }, clientId: client.id },
      });
      if (contactPersonCount !== contactPersonIds.length)
        return {
          success: false,
          error:
            "One or more selected contact persons do not belong to selected client.",
        };
    }

    const isAdminUser = user.userType === "ADMIN";

    await db.project.update({
      where: { id: projectId },
      data: {
        projectTypeId: parsed.data.projectTypeId || null,
        contactPersonId: contactPersonIds[0] || null,
        contactPersons: { set: contactPersonIds.map((id) => ({ id })) },
        name: parsed.data.name.trim(),
        billingModel: parsed.data.billingModel,
        billingCycle: parsed.data.billingCycle,
        fixedContractHours:
          parsed.data.billingModel === "FIXED_FULL"
            ? isAdminUser
              ? (parsed.data.fixedContractHours ?? 0)
              : existingProject.fixedContractHours
            : null,
        fixedMonthlyHours:
          parsed.data.billingModel === "FIXED_MONTHLY"
            ? isAdminUser
              ? (parsed.data.fixedMonthlyHours ?? 0)
              : existingProject.fixedMonthlyHours
            : null,
        additionalCharges:
          parsed.data.billingModel === "FIXED_FULL"
            ? isAdminUser
              ? (parsed.data.additionalCharges ?? 0)
              : existingProject.additionalCharges
            : 0,
        partialBillingCost:
          parsed.data.billingModel === "FIXED_FULL"
            ? isAdminUser
              ? (parsed.data.partialBillingCost ?? 0)
              : existingProject.partialBillingCost
            : 0,
        projectCost:
          parsed.data.billingModel === "FIXED_COST"
            ? isAdminUser
              ? (parsed.data.projectCost ?? 0)
              : existingProject.projectCost
            : 0,
        projectCostOtherMovieBillingRegion:
          client.id === SONY_PICTURES_CLIENT_ID
            ? isAdminUser
              ? (parsed.data.projectCostOtherMovieBillingRegion ?? 0)
              : existingProject.projectCostOtherMovieBillingRegion
            : 0,
        perCountryCharges:
          parsed.data.billingModel === "FIXED_PER_COUNTRY"
            ? isAdminUser
              ? (parsed.data.perCountryCharges ?? 0)
              : existingProject.perCountryCharges
            : 0,
        universalSmallCost:
          client.id === UNIVERSAL_PICTURES_CLIENT_ID
            ? isAdminUser
              ? (parsed.data.universalSmallCost ?? 0)
              : existingProject.universalSmallCost
            : 0,
        universalMediumCost:
          client.id === UNIVERSAL_PICTURES_CLIENT_ID
            ? isAdminUser
              ? (parsed.data.universalMediumCost ?? 0)
              : existingProject.universalMediumCost
            : 0,
        universalLargeCost:
          client.id === UNIVERSAL_PICTURES_CLIENT_ID
            ? isAdminUser
              ? (parsed.data.universalLargeCost ?? 0)
              : existingProject.universalLargeCost
            : 0,
        universalExtraLargeCost:
          client.id === UNIVERSAL_PICTURES_CLIENT_ID
            ? isAdminUser
              ? (parsed.data.universalExtraLargeCost ?? 0)
              : existingProject.universalExtraLargeCost
            : 0,
        developerCount: 0,
        perDeveloperCost: 0,
        status: parsed.data.status,
        description: parsed.data.description || null,
        updatedById: user.id,
        hideCountriesInEntries: client.showCountriesInTimeEntries
          ? Boolean(parsed.data.hideCountriesInEntries)
          : false,
        hideMoviesInEntries: client.showMoviesInEntries
          ? Boolean(parsed.data.hideMoviesInEntries)
          : false,
        hideAssetTypesInEntries: client.showAssetTypesInEntries
          ? Boolean(parsed.data.hideAssetTypesInEntries)
          : false,
        hideLensTypesInEntries: client.showLensTypesInEntries
          ? Boolean(parsed.data.hideLensTypesInEntries)
          : false,
        hideAssetNamesInEntries: client.showAssetNamesInEntries
          ? Boolean(parsed.data.hideAssetNamesInEntries)
          : false,
        hideNewslettersInEntries: client.showNewslettersInEntries
          ? Boolean(parsed.data.hideNewslettersInEntries)
          : false,
        addToBilling: Boolean(parsed.data.addToBilling),
      },
    });

    if (isAdminUser) {
      await saveMonthlyAdditionalHours(
        projectId,
        parsed.data.billingModel,
        formData,
      );
    }
    if (existingProject.clientId === WARNER_BROS_CLIENT_ID) {
      await db.$executeRaw`UPDATE Project SET warnerProjectType = ${parsed.data.warnerProjectType} WHERE id = ${projectId}`;
    }
    if (existingProject.clientId === SONY_PICTURES_CLIENT_ID) {
      await db.$executeRaw`UPDATE Project SET sonyProjectType = ${parsed.data.sonyProjectType} WHERE id = ${projectId}`;
    }
    await saveFilmikResourceCounts(projectId, client.id, formData);

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/dashboard");
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

export async function toggleProjectStatusAction(formData: FormData) {
  await requireMasterDataActionUser();
  const projectId = String(formData.get("projectId") || "");
  if (!projectId) throw new Error("Project is required.");
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found.");
  await db.project.update({
    where: { id: projectId },
    data: { isActive: !project.isActive },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/edit`);
}

export async function completeProjectBillingAction(formData: FormData) {
  await requireMasterDataActionUser();

  const projectId = String(formData.get("projectId") || "");
  const billingDateValue = String(formData.get("billingDate") || "");
  const invoiceNumber = String(formData.get("invoiceNumber") || "").trim();
  const returnTo = String(formData.get("returnTo") || "/billing-reports");

  if (!projectId) throw new Error("Project is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(billingDateValue)) {
    throw new Error("Billing date is required.");
  }
  if (!invoiceNumber) throw new Error("Invoice number is required.");

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { clientId: true, billingModel: true, billingCycle: true },
  });
  if (!project) throw new Error("Project not found.");
  const billingDate = new Date(`${billingDateValue}T00:00:00`);
  const amount = Number(formData.get("amount") || 0);
  const billingMonthValue = String(formData.get("billingMonth") || "");
  const billingYearValue = String(formData.get("billingYear") || "");
  const billingMonth = /^\d{4}-\d{2}$/.test(billingMonthValue)
    ? Number(billingMonthValue.slice(5, 7))
    : Number(billingYearValue) && Number(formData.get("billingMonthNumber"))
      ? Number(formData.get("billingMonthNumber"))
      : billingDate.getMonth() + 1;
  const billingYear = /^\d{4}-\d{2}$/.test(billingMonthValue)
    ? Number(billingMonthValue.slice(0, 4))
    : Number(billingYearValue) || billingDate.getFullYear();

  const matchingPo = await db.purchaseOrder.findFirst({
    where: {
      clientId: project.clientId,
      assignments: {
        some: {
          projectId,
          ...(project.billingCycle === "MONTHLY"
            ? { billingMonth, billingYear }
            : {}),
        },
      },
      status: { not: "CANCELLED" },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (project.billingCycle === "MONTHLY") {
    await db.billingRecord.create({
      data: {
        clientId: project.clientId,
        projectId,
        purchaseOrderId: matchingPo?.id ?? null,
        billingMonth,
        billingYear,
        billingDate,
        invoiceNumber,
        amount: Number.isFinite(amount) ? amount : 0,
      },
    });
  } else {
    if (project.billingModel === "FIXED_MONTHLY") {
      throw new Error(
        "Fixed-Monthly projects are not marked Completed & Billed from this action.",
      );
    }

    await db.project.update({
      where: { id: projectId },
      data: {
        status: "COMPLETED_BILLED",
        billingDate,
        billingInvoiceNumber: invoiceNumber,
      },
    });
  }

  await db.purchaseOrder.updateMany({
    where: {
      clientId: project.clientId,
      assignments: {
        some: {
          projectId,
          ...(project.billingCycle === "MONTHLY"
            ? { billingMonth, billingYear }
            : {}),
        },
      },
    },
    data: { status: "PROCESSED" },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/billing-reports");
  redirect(returnTo.startsWith("/") ? returnTo : "/billing-reports");
}

async function requireCanDeleteProjects() {
  const user = await requireUserForAction();
  if (!canDeleteProjects(user)) {
    throw new Error(
      "Only Admin users with functional role Other can delete projects.",
    );
  }
  return user;
}

export async function deleteProjectAction(formData: FormData) {
  let redirectTo = "/projects";

  try {
    await requireCanDeleteProjects();
    const projectId = String(formData.get("projectId") || "");

    if (!projectId) {
      throw new Error("Project is required.");
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      throw new Error("Project not found.");
    }

    await db.project.delete({
      where: { id: projectId },
    });

    revalidatePath("/projects");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    revalidatePath("/billing-reports");
    redirectTo = "/projects?deleteSuccess=Project%20deleted.";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete project.";
    redirectTo = `/projects?deleteError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}
