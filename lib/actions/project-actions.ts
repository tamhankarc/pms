"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";
import { generateProjectCode } from "@/lib/project-code";

export type ProjectFormState = {
  success?: boolean;
  error?: string;
};

const projectSchema = z.object({
  clientId: z.string().min(1, "Client is required."),
  movieId: z.string().optional().nullable(),
  name: z.string().min(2, "Project name is required."),
  billingModel: z.enum(["HOURLY", "FIXED_FULL", "FIXED_MONTHLY"]),
  fixedContractHours: z.coerce.number().nonnegative().optional(),
  fixedMonthlyHours: z.coerce.number().nonnegative().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]),
  description: z.string().optional(),
  countryIds: z.array(z.string()).min(1, "At least one country is required."),
  employeeGroupIds: z.array(z.string()).min(1, "At least one employee group is required."),
});

async function validateMovieForClient(clientId: string, movieId?: string | null) {
  if (!movieId) return true;
  const movie = await db.movie.findUnique({
    where: { id: movieId },
    select: { id: true, clientId: true, isActive: true },
  });
  return Boolean(movie && movie.clientId === clientId && movie.isActive);
}

export async function createProjectAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  try {
    const user = await requireUserTypes(["ADMIN", "MANAGER"]);

    const parsed = projectSchema.safeParse({
      clientId: formData.get("clientId"),
      movieId: formData.get("movieId") || null,
      name: formData.get("name"),
      billingModel: formData.get("billingModel"),
      fixedContractHours: formData.get("fixedContractHours") || 0,
      fixedMonthlyHours: formData.get("fixedMonthlyHours") || 0,
      status: formData.get("status"),
      description: formData.get("description") || "",
      countryIds: formData.getAll("countryIds"),
      employeeGroupIds: formData.getAll("employeeGroupIds"),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid project payload.",
      };
    }

    const data = parsed.data;
    const movieValid = await validateMovieForClient(data.clientId, data.movieId);
    if (!movieValid) {
      return { success: false, error: "Selected movie does not belong to the selected client." };
    }

    const projectCode = await generateProjectCode(data.clientId);

    await db.project.create({
      data: {
        clientId: data.clientId,
        movieId: data.movieId || null,
        name: data.name,
        code: projectCode,
        billingModel: data.billingModel,
        fixedContractHours:
          data.billingModel === "FIXED_FULL" ? (data.fixedContractHours ?? 0) : null,
        fixedMonthlyHours:
          data.billingModel === "FIXED_MONTHLY" ? (data.fixedMonthlyHours ?? 0) : null,
        status: data.status,
        description: data.description || null,
        createdById: user.id,
        updatedById: user.id,
        countries: {
          create: data.countryIds.map((countryId) => ({ countryId })),
        },
        employeeGroups: {
          create: data.employeeGroupIds.map((employeeGroupId) => ({ employeeGroupId })),
        },
      },
    });

    revalidatePath("/projects");
    revalidatePath("/projects/new");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

const projectUpdateSchema = z.object({
  name: z.string().min(2, "Project name is required."),
  billingModel: z.enum(["HOURLY", "FIXED_FULL", "FIXED_MONTHLY"]),
  fixedContractHours: z.coerce.number().nonnegative().optional(),
  fixedMonthlyHours: z.coerce.number().nonnegative().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]),
  description: z.string().optional(),
  countryIds: z.array(z.string()).min(1, "At least one country is required."),
  employeeGroupIds: z.array(z.string()).min(1, "At least one employee group is required."),
});

export async function updateProjectAction(
  projectId: string,
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  try {
    const user = await requireUserTypes(["ADMIN", "MANAGER"]);

    const parsed = projectUpdateSchema.safeParse({
      name: formData.get("name"),
      billingModel: formData.get("billingModel"),
      fixedContractHours: formData.get("fixedContractHours") || 0,
      fixedMonthlyHours: formData.get("fixedMonthlyHours") || 0,
      status: formData.get("status"),
      description: formData.get("description") || "",
      countryIds: formData.getAll("countryIds"),
      employeeGroupIds: formData.getAll("employeeGroupIds"),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid project payload.",
      };
    }

    const data = parsed.data;

    await db.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: {
          name: data.name,
          billingModel: data.billingModel,
          fixedContractHours: data.billingModel === "FIXED_FULL" ? (data.fixedContractHours ?? 0) : null,
          fixedMonthlyHours: data.billingModel === "FIXED_MONTHLY" ? (data.fixedMonthlyHours ?? 0) : null,
          status: data.status,
          description: data.description || null,
          updatedById: user.id,
        },
      });

      await tx.projectCountry.deleteMany({ where: { projectId } });
      await tx.projectCountry.createMany({
        data: data.countryIds.map((countryId) => ({ projectId, countryId })),
        skipDuplicates: true,
      });

      await tx.projectEmployeeGroup.deleteMany({ where: { projectId } });
      await tx.projectEmployeeGroup.createMany({
        data: data.employeeGroupIds.map((employeeGroupId) => ({
          projectId,
          employeeGroupId,
        })),
        skipDuplicates: true,
      });
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/edit`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

const billingTransactionSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum([
    "PARTIAL_BILLING",
    "UPGRADE_PRE_COMPLETION",
    "UPGRADE_POST_COMPLETION",
    "ADJUSTMENT",
  ]),
  amount: z.coerce.number().nonnegative(),
  note: z.string().min(2, "Note is required."),
});

export async function createBillingTransactionAction(formData: FormData) {
  await requireUserTypes(["ADMIN", "MANAGER"]);

  const parsed = billingTransactionSchema.safeParse({
    projectId: formData.get("projectId"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid billing transaction payload");
  }

  await db.billingTransaction.create({
    data: {
      projectId: parsed.data.projectId,
      transactionType: parsed.data.type,
      amountMoney: parsed.data.amount,
      amountHours: null,
      description: parsed.data.note,
      effectiveDate: new Date(),
    },
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath("/projects");
}

export async function toggleProjectStatusAction(formData: FormData) {
  await requireUserTypes(["ADMIN", "MANAGER"]);

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
