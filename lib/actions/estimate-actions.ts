"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canFullyModerateProject, isManager, isRoleScopedManager } from "@/lib/permissions";
import { recordAuditLog } from "@/lib/audit";

export type EstimateFormState = {
  success?: boolean;
  error?: string;
};

const estimateSchema = z.object({
  employeeId: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  projectId: z.string().min(1, "Project is required."),
  subProjectId: z.string().optional(),
  countryId: z.string().optional(),
  movieId: z.string().optional(),
  assetTypeId: z.string().optional(),
  languageId: z.string().optional(),
  workDate: z.string().min(1),
  estimatedMinutes: z.coerce.number().int().positive(),
  notes: z.string().optional(),
});

const estimateUpdateSchema = estimateSchema.extend({
  estimateId: z.string().min(1, "Estimate is required."),
});

function getTodayInIndiaDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isFutureWorkDate(workDate: string) {
  return workDate > getTodayInIndiaDateString();
}

const reviewEstimateSchema = z.object({
  estimateId: z.string().min(1, "Estimate is required."),
  action: z.enum(["APPROVED", "REJECTED", "REVISED"]),
  comment: z.string().optional(),
});

async function validateSubProject(
  projectId: string,
  subProjectId: string | undefined,
  employeeId: string,
) {
  if (!subProjectId) return { valid: true as const };

  const employee = await db.user.findUnique({
    where: { id: employeeId },
    select: { userType: true },
  });

  const requiresAssignment = employee?.userType === "EMPLOYEE";

  const hasProjectAssignment = requiresAssignment
    ? Boolean(
        await db.project.findFirst({
          where: {
            id: projectId,
            isActive: true,
            status: { in: ["ACTIVE", "ON_HOLD"] },
            assignedUsers: { some: { userId: employeeId } },
          },
          select: { id: true },
        }),
      )
    : false;

  const subProject = await db.subProject.findFirst({
    where: {
      id: subProjectId,
      projectId,
      isActive: true,
      ...(requiresAssignment && !hasProjectAssignment
        ? { assignments: { some: { userId: employeeId } } }
        : {}),
    },
    select: { id: true },
  });

  return subProject
    ? { valid: true as const }
    : {
        valid: false as const,
        error: requiresAssignment
          ? "Selected Sub Project is invalid or you do not have project/sub-project assignment."
          : "Selected Sub Project is invalid for the selected project.",
      };
}

async function validateClientFieldRequirements(
  projectId: string,
  {
    clientId,
    countryId,
    movieId,
    assetTypeId,
    languageId,
    subProjectId,
  }: {
    clientId: string;
    countryId?: string;
    movieId?: string;
    assetTypeId?: string;
    languageId?: string;
    subProjectId?: string;
  },
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { client: true, subProjects: { select: { id: true, hideCountriesInEntries: true, hideMoviesInEntries: true, hideAssetTypesInEntries: true } } },
  });

  if (!project) {
    return { valid: false as const, error: "Project not found." };
  }

  if (project.clientId !== clientId) {
    return { valid: false as const, error: "Selected project does not belong to the selected client." };
  }

  if (!project.isActive || !["ACTIVE", "ON_HOLD"].includes(project.status)) {
    return { valid: false as const, error: "Estimates can only use active or on-hold projects." };
  }

  const subProject = subProjectId ? project.subProjects.find((row) => row.id === subProjectId) : null;
  const countryEnabled =
    project.client.showCountriesInTimeEntries &&
    !project.hideCountriesInEntries &&
    !subProject?.hideCountriesInEntries;
  const movieEnabled =
    project.client.showMoviesInEntries &&
    !project.hideMoviesInEntries &&
    !subProject?.hideMoviesInEntries;
  const assetTypeEnabled =
    project.client.showAssetTypesInEntries &&
    !project.hideAssetTypesInEntries &&
    !subProject?.hideAssetTypesInEntries;

  if (countryEnabled && !countryId) {
    return { valid: false as const, error: "Country is required for the selected client." };
  }

  if (project.client.showLanguagesInEntries && !languageId) {
    return { valid: false as const, error: "Language is required for the selected client." };
  }

  if (!countryEnabled && countryId) {
    return { valid: false as const, error: "Country is not enabled for the selected project/sub-project." };
  }

  if (!movieEnabled && movieId) {
    return { valid: false as const, error: "Movie is not enabled for the selected project/sub-project." };
  }

  if (!assetTypeEnabled && assetTypeId) {
    return { valid: false as const, error: "Asset Type is not enabled for the selected project/sub-project." };
  }

  if (!project.client.showLanguagesInEntries && languageId) {
    return { valid: false as const, error: "Language is not enabled for the selected client." };
  }

  if (movieId) {
    const movie = await db.movie.findFirst({
      where: {
        id: movieId,
        clientId: project.clientId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!movie) {
      return { valid: false as const, error: "Selected movie does not belong to the selected client." };
    }
  }

  if (assetTypeId) {
    const assetType = await db.assetType.findFirst({
      where: { id: assetTypeId, clientId: project.clientId, isActive: true },
      select: { id: true },
    });

    if (!assetType) {
      return { valid: false as const, error: "Selected asset type does not belong to the selected client." };
    }
  }

  if (languageId) {
    const language = await db.language.findFirst({
      where: { id: languageId, isActive: true },
      select: { id: true },
    });

    if (!language) {
      return { valid: false as const, error: "Selected language is invalid." };
    }
  }

  return { valid: true as const };
}


async function validateFixedFullProject(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { billingModel: true } });
  if (!project) return { valid: false as const, error: "Project not found." };
  if (project.billingModel !== "FIXED_FULL") return { valid: false as const, error: "Estimates can only be added to projects with Billing model Fixed Full." };
  return { valid: true as const };
}

async function canActForEstimateEmployee(
  user: Awaited<ReturnType<typeof requireUserForAction>>,
  employeeId: string,
) {
  if (employeeId === user.id) return true;

  if (isRoleScopedManager(user)) {
    const target = await db.user.findUnique({
      where: { id: employeeId },
      select: { id: true, userType: true, functionalRole: true, isActive: true },
    });

    return Boolean(
      target &&
        target.isActive &&
        target.functionalRole === user.functionalRole &&
        ["EMPLOYEE", "TEAM_LEAD"].includes(target.userType),
    );
  }

  if (canFullyModerateProject(user) || isManager(user)) {
    const employee = await db.user.findUnique({
      where: { id: employeeId },
      select: { id: true, userType: true, isActive: true },
    });

    return Boolean(employee && employee.isActive && employee.userType === "EMPLOYEE");
  }

  if (user.userType === "TEAM_LEAD") {
    const assignment = await db.employeeTeamLead.findFirst({
      where: {
        teamLeadId: user.id,
        employeeId,
        employee: {
          isActive: true,
          userType: "EMPLOYEE",
        },
      },
      select: { employeeId: true },
    });

    return Boolean(assignment);
  }

  return false;
}

async function userCanUseProject(
  user: Awaited<ReturnType<typeof requireUserForAction>>,
  projectId: string,
) {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      status: { in: ["ACTIVE", "ON_HOLD"] },
      ...(isRoleScopedManager(user)
        ? {}
        : {
            OR: [
              {
                assignedUsers: {
                  some: {
                    userId: user.id,
                  },
                },
              },
              {
                subProjects: {
                  some: {
                    assignments: {
                      some: {
                        userId: user.id,
                      },
                    },
                  },
                },
              },
            ],
          }),
      isActive: true,
    },
    select: { id: true },
  });

  return Boolean(project);
}


async function employeeCanUseProject(projectId: string, employeeId: string) {
  const employee = await db.user.findUnique({
    where: { id: employeeId },
    select: { userType: true },
  });

  if (!employee) return false;

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      isActive: true,
      status: { in: ["ACTIVE", "ON_HOLD"] },
      ...(employee.userType === "EMPLOYEE"
        ? {
            OR: [
              { assignedUsers: { some: { userId: employeeId } } },
              { subProjects: { some: { assignments: { some: { userId: employeeId } } } } },
            ],
          }
        : {}),
    },
    select: { id: true },
  });

  return Boolean(project);
}

export async function createEstimateAction(
  _prevState: EstimateFormState,
  formData: FormData,
): Promise<EstimateFormState> {
  try {
    const user = await requireUserForAction();

    if (!["EMPLOYEE", "TEAM_LEAD"].includes(user.userType) && !isRoleScopedManager(user)) {
      return { success: false, error: "You are not allowed to submit estimates." };
    }

    const parsed = estimateSchema.safeParse({
      employeeId: formData.get("employeeId") || user.id,
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId"),
      subProjectId: formData.get("subProjectId") || undefined,
      countryId: formData.get("countryId") || undefined,
      movieId: formData.get("movieId") || undefined,
      assetTypeId: formData.get("assetTypeId") || undefined,
      languageId: formData.get("languageId") || undefined,
      workDate: formData.get("workDate"),
      estimatedMinutes: formData.get("estimatedMinutes"),
      notes: formData.get("notes") || "",
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid estimate payload",
      };
    }

    if (isFutureWorkDate(parsed.data.workDate)) {
      return { success: false, error: "Future date is not allowed for estimates." };
    }

    const employeeId = parsed.data.employeeId || user.id;

    const canAct = await canActForEstimateEmployee(user, employeeId);
    if (!canAct) {
      return { success: false, error: "You cannot submit estimates for the selected employee." };
    }

    const canUseProject = await userCanUseProject(user, parsed.data.projectId);
    if (!canUseProject) {
      return { success: false, error: "You cannot submit estimates to this project." };
    }

    const fixedFullCheck = await validateFixedFullProject(parsed.data.projectId);
    if (!fixedFullCheck.valid) {
      return { success: false, error: fixedFullCheck.error };
    }

    const employeeCanUseSelectedProject = await employeeCanUseProject(parsed.data.projectId, employeeId);
    if (!employeeCanUseSelectedProject) {
      return {
        success: false,
        error: "Selected employee cannot use the chosen project. Please select a project assigned to that person.",
      };
    }

    const fieldCheck = await validateClientFieldRequirements(parsed.data.projectId, {
      clientId: parsed.data.clientId,
      countryId: parsed.data.countryId,
      movieId: parsed.data.movieId,
      assetTypeId: parsed.data.assetTypeId,
      languageId: parsed.data.languageId,
      subProjectId: parsed.data.subProjectId,
    });
    if (!fieldCheck.valid) {
      return { success: false, error: fieldCheck.error };
    }

    const subProjectCheck = await validateSubProject(parsed.data.projectId, parsed.data.subProjectId, employeeId);
    if (!subProjectCheck.valid) {
      return { success: false, error: subProjectCheck.error };
    }

    const createdEstimate = await db.estimate.create({
      data: {
        employeeId,
        projectId: parsed.data.projectId,
        subProjectId: parsed.data.subProjectId || null,
        countryId: parsed.data.countryId || null,
        movieId: parsed.data.movieId || null,
        assetTypeId: parsed.data.assetTypeId || null,
        languageId: parsed.data.languageId || null,
        workDate: new Date(parsed.data.workDate),
        estimatedMinutes: parsed.data.estimatedMinutes,
        notes: parsed.data.notes || null,
        status: "SUBMITTED",
      },
    });

    await recordAuditLog({
      actorId: user.id,
      entityType: "Estimate",
      entityId: createdEstimate.id,
      action: "CREATE",
      after: createdEstimate,
      description: "Created estimate",
    });

    revalidatePath("/estimates");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function updateEstimateAction(
  _prevState: EstimateFormState,
  formData: FormData,
): Promise<EstimateFormState> {
  try {
    const user = await requireUserForAction();

    const parsed = estimateUpdateSchema.safeParse({
      estimateId: formData.get("estimateId"),
      employeeId: formData.get("employeeId"),
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId"),
      subProjectId: formData.get("subProjectId") || undefined,
      countryId: formData.get("countryId") || undefined,
      movieId: formData.get("movieId") || undefined,
      assetTypeId: formData.get("assetTypeId") || undefined,
      languageId: formData.get("languageId") || undefined,
      workDate: formData.get("workDate"),
      estimatedMinutes: formData.get("estimatedMinutes"),
      notes: formData.get("notes") || "",
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid estimate payload",
      };
    }

    if (isFutureWorkDate(parsed.data.workDate)) {
      return { success: false, error: "Future date is not allowed for estimates." };
    }

    const estimate = await db.estimate.findUnique({
      where: { id: parsed.data.estimateId },
    });

    if (!estimate) {
      return { success: false, error: "Estimate not found." };
    }

    if (estimate.employeeId !== user.id && !canFullyModerateProject(user)) {
      return { success: false, error: "You do not have edit access for this estimate." };
    }

    const employeeId = parsed.data.employeeId || estimate.employeeId;
    const canAct = await canActForEstimateEmployee(user, employeeId);
    if (!canAct && !canFullyModerateProject(user)) {
      return { success: false, error: "You cannot use the selected employee for this estimate." };
    }

    if (!["DRAFT", "REVISED"].includes(estimate.status)) {
      return { success: false, error: "Only draft or revised estimates can be edited." };
    }

    const canUseProject = await userCanUseProject(user, parsed.data.projectId);
    if (!canUseProject && !canFullyModerateProject(user)) {
      return { success: false, error: "You cannot use this project for the estimate." };
    }

    const fixedFullCheck = await validateFixedFullProject(parsed.data.projectId);
    if (!fixedFullCheck.valid) {
      return { success: false, error: fixedFullCheck.error };
    }

    const employeeCanUseSelectedProject = await employeeCanUseProject(parsed.data.projectId, estimate.employeeId);
    if (!employeeCanUseSelectedProject) {
      return {
        success: false,
        error: "Selected employee cannot use the chosen project. Please select a project assigned to that person.",
      };
    }

    const fieldCheck = await validateClientFieldRequirements(parsed.data.projectId, {
      clientId: parsed.data.clientId,
      countryId: parsed.data.countryId,
      movieId: parsed.data.movieId,
      assetTypeId: parsed.data.assetTypeId,
      languageId: parsed.data.languageId,
      subProjectId: parsed.data.subProjectId,
    });
    if (!fieldCheck.valid) {
      return { success: false, error: fieldCheck.error };
    }

    const subProjectCheck = await validateSubProject(parsed.data.projectId, parsed.data.subProjectId, employeeId);
    if (!subProjectCheck.valid) {
      return { success: false, error: subProjectCheck.error };
    }

    const existingEstimate = await db.estimate.findUnique({ where: { id: estimate.id } });

    const updatedEstimate = await db.estimate.update({
      where: { id: estimate.id },
      data: {
        employeeId,
        projectId: parsed.data.projectId,
        subProjectId: parsed.data.subProjectId || null,
        countryId: parsed.data.countryId || null,
        movieId: parsed.data.movieId || null,
        assetTypeId: parsed.data.assetTypeId || null,
        languageId: parsed.data.languageId || null,
        workDate: new Date(parsed.data.workDate),
        estimatedMinutes: parsed.data.estimatedMinutes,
        notes: parsed.data.notes || null,
        status: "SUBMITTED",
      },
    });

    await recordAuditLog({
      actorId: user.id,
      entityType: "Estimate",
      entityId: updatedEstimate.id,
      action: "UPDATE",
      before: existingEstimate,
      after: updatedEstimate,
      description: "Updated estimate",
    });

    revalidatePath("/estimates");
    revalidatePath(`/estimates/${estimate.id}/edit`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function reviewEstimateAction(formData: FormData) {
  const user = await requireUserForAction();

  const parsed = reviewEstimateSchema.safeParse({
    estimateId: formData.get("estimateId"),
    action: formData.get("action"),
    comment: formData.get("comment") || "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid review payload");
  }

  const estimate = await db.estimate.findUnique({
    where: { id: parsed.data.estimateId },
    include: {
      project: true,
      employee: true,
    },
  });

  if (!estimate) {
    throw new Error("Estimate not found.");
  }

  if (!canFullyModerateProject(user) && !isRoleScopedManager(user) && user.userType !== "TEAM_LEAD") {
    throw new Error("You are not allowed to review estimates.");
  }

  if (!canFullyModerateProject(user)) {
    if (user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) {
      const assignment = await db.employeeTeamLead.findFirst({
        where: {
          teamLeadId: user.id,
          employeeId: estimate.employeeId,
        },
        include: {
          employee: {
            select: {
              id: true,
              functionalRole: true,
            },
          },
        },
      });

      if (!assignment) {
        throw new Error("You can review estimates only for assigned employees.");
      }

      if (assignment.employee.functionalRole !== user.functionalRole) {
        throw new Error("You can review estimates only for employees with matching functional role.");
      }
    }
  }

  if (estimate.status !== "SUBMITTED") {
    throw new Error("Only submitted estimates can be reviewed.");
  }

  await db.$transaction([
    db.estimate.update({
      where: { id: estimate.id },
      data: { status: parsed.data.action },
    }),
    db.estimateReview.create({
      data: {
        estimateId: estimate.id,
        reviewerId: user.id,
        decisionStatus: parsed.data.action,
        remarks: parsed.data.comment?.trim() || null,
      },
    }),
  ]);

  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimate.id}/edit`);
}

export async function deleteEstimateAction(formData: FormData) {
  const user = await requireUserForAction();
  const estimateId = String(formData.get("estimateId") || "");

  if (!estimateId) {
    throw new Error("Estimate is required.");
  }

  if (!["ADMIN", "MANAGER", "TEAM_LEAD"].includes(user.userType)) {
    throw new Error("You do not have permission to delete estimates.");
  }

  const estimate = await db.estimate.findUnique({
    where: { id: estimateId },
    include: {
      employee: {
        select: {
          id: true,
          functionalRole: true,
        },
      },
    },
  });

  if (!estimate) {
    throw new Error("Estimate not found.");
  }

  if (user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) {
    const assignment = await db.employeeTeamLead.findFirst({
      where: {
        teamLeadId: user.id,
        employeeId: estimate.employeeId,
      },
      include: {
        employee: {
          select: {
            functionalRole: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new Error("You can delete estimates only for assigned employees.");
    }

    if (assignment.employee.functionalRole !== user.functionalRole) {
      throw new Error("You can delete estimates only for employees with matching functional role.");
    }
  }

  await recordAuditLog({
    actorId: user.id,
    entityType: "Estimate",
    entityId: estimate.id,
    action: "DELETE",
    before: estimate,
    description: "Deleted estimate",
  });

  await db.estimate.delete({
    where: { id: estimate.id },
  });

  revalidatePath("/estimates");
}
