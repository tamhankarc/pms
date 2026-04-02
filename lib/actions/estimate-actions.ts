"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canFullyModerateProject, isRoleScopedManager } from "@/lib/permissions";

export type EstimateFormState = {
  success?: boolean;
  error?: string;
};

const estimateSchema = z.object({
  clientId: z.string().min(1, "Client is required."),
  projectId: z.string().min(1, "Project is required."),
  subProjectId: z.string().optional(),
  countryId: z.string().optional(),
  movieId: z.string().optional(),
  languageId: z.string().optional(),
  workDate: z.string().min(1),
  estimatedMinutes: z.coerce.number().int().positive(),
  notes: z.string().optional(),
});

const estimateUpdateSchema = estimateSchema.extend({
  estimateId: z.string().min(1, "Estimate is required."),
});

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
  if (!subProjectId) return true;

  const subProject = await db.subProject.findFirst({
    where: {
      id: subProjectId,
      projectId,
      isActive: true,
      assignments: { some: { userId: employeeId } },
    },
    select: { id: true },
  });

  return Boolean(subProject);
}

async function validateClientFieldRequirements(
  projectId: string,
  {
    clientId,
    countryId,
    movieId,
    languageId,
  }: {
    clientId: string;
    countryId?: string;
    movieId?: string;
    languageId?: string;
  },
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { client: true },
  });

  if (!project) {
    return { valid: false as const, error: "Project not found." };
  }

  if (project.clientId !== clientId) {
    return { valid: false as const, error: "Selected project does not belong to the selected client." };
  }

  if (project.client.showCountriesInTimeEntries && !countryId) {
    return { valid: false as const, error: "Country is required for the selected client." };
  }

  if (project.client.showLanguagesInEntries && !languageId) {
    return { valid: false as const, error: "Language is required for the selected client." };
  }

  if (!project.client.showCountriesInTimeEntries && countryId) {
    return { valid: false as const, error: "Country is not enabled for the selected client." };
  }

  if (!project.client.showMoviesInEntries && movieId) {
    return { valid: false as const, error: "Movie is not enabled for the selected client." };
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

async function userCanUseProject(
  user: Awaited<ReturnType<typeof requireUserForAction>>,
  projectId: string,
) {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
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
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId"),
      subProjectId: formData.get("subProjectId") || undefined,
      countryId: formData.get("countryId") || undefined,
      movieId: formData.get("movieId") || undefined,
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

    const canUseProject = await userCanUseProject(user, parsed.data.projectId);
    if (!canUseProject) {
      return { success: false, error: "You cannot submit estimates to this project." };
    }

    const fieldCheck = await validateClientFieldRequirements(parsed.data.projectId, {
      clientId: parsed.data.clientId,
      countryId: parsed.data.countryId,
      movieId: parsed.data.movieId,
      languageId: parsed.data.languageId,
    });
    if (!fieldCheck.valid) {
      return { success: false, error: fieldCheck.error };
    }

    if (!(await validateSubProject(parsed.data.projectId, parsed.data.subProjectId, user.id))) {
      return { success: false, error: "Selected Sub Project is invalid or not assigned to you." };
    }

    await db.estimate.create({
      data: {
        projectId: parsed.data.projectId,
        subProjectId: parsed.data.subProjectId || null,
        employeeId: user.id,
        countryId: parsed.data.countryId || null,
        movieId: parsed.data.movieId || null,
        languageId: parsed.data.languageId || null,
        workDate: new Date(parsed.data.workDate),
        estimatedMinutes: parsed.data.estimatedMinutes,
        notes: parsed.data.notes || null,
        status: "SUBMITTED",
      },
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
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId"),
      subProjectId: formData.get("subProjectId") || undefined,
      countryId: formData.get("countryId") || undefined,
      movieId: formData.get("movieId") || undefined,
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

    const estimate = await db.estimate.findUnique({
      where: { id: parsed.data.estimateId },
    });

    if (!estimate) {
      return { success: false, error: "Estimate not found." };
    }

    if (estimate.employeeId !== user.id && !canFullyModerateProject(user)) {
      return { success: false, error: "You do not have edit access for this estimate." };
    }

    if (!["DRAFT", "REVISED"].includes(estimate.status)) {
      return { success: false, error: "Only draft or revised estimates can be edited." };
    }

    const canUseProject = await userCanUseProject(user, parsed.data.projectId);
    if (!canUseProject && !canFullyModerateProject(user)) {
      return { success: false, error: "You cannot use this project for the estimate." };
    }

    const fieldCheck = await validateClientFieldRequirements(parsed.data.projectId, {
      clientId: parsed.data.clientId,
      countryId: parsed.data.countryId,
      movieId: parsed.data.movieId,
      languageId: parsed.data.languageId,
    });
    if (!fieldCheck.valid) {
      return { success: false, error: fieldCheck.error };
    }

    if (!(await validateSubProject(parsed.data.projectId, parsed.data.subProjectId, estimate.employeeId))) {
      return { success: false, error: "Selected Sub Project is invalid or not assigned to you." };
    }

    await db.estimate.update({
      where: { id: estimate.id },
      data: {
        projectId: parsed.data.projectId,
        subProjectId: parsed.data.subProjectId || null,
        countryId: parsed.data.countryId || null,
        movieId: parsed.data.movieId || null,
        languageId: parsed.data.languageId || null,
        workDate: new Date(parsed.data.workDate),
        estimatedMinutes: parsed.data.estimatedMinutes,
        notes: parsed.data.notes || null,
        status: "SUBMITTED",
      },
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