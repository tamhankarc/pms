"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import {
  canFullyModerateProject,
  canLogOwnTimeWithoutProjectAssignment,
  isManager,
  isRoleScopedManager,
} from "@/lib/permissions";
import { recordAuditLog } from "@/lib/audit";

export type TimeEntryFormState = {
  success?: boolean;
  error?: string;
};

const timeSchema = z.object({
  employeeId: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  projectId: z.string().min(1, "Project is required."),
  subProjectId: z.string().optional(),
  countryId: z.string().optional(),
  movieId: z.string().optional(),
  assetTypeId: z.string().optional(),
  lensTypeId: z.string().optional(),
  assetNameId: z.string().optional(),
  newsletterId: z.string().optional(),
  languageId: z.string().optional(),
  workDate: z.string().min(1),
  taskName: z.string().trim().min(2, "Task name is required.").max(200),
  minutesSpent: z.coerce.number().int().positive(),
  isBillable: z.coerce.boolean().default(true),
  notes: z.string().optional(),
});

const timeUpdateSchema = timeSchema.extend({
  entryId: z.string().min(1, "Time entry is required."),
});

function getTodayInIndiaDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseAllowedIds(value?: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [] as string[];
  }
}

function isAllowedByProjectRestriction(value: string | undefined, allowedIds: string[]) {
  return !value || allowedIds.length === 0 || allowedIds.includes(value);
}

function requireSingleAllowedValue(value: string | undefined, allowedIds: string[], label: string) {
  if (allowedIds.length === 1 && !value) {
    return `${label} is required because the selected project allows only one ${label.toLowerCase()} value.`;
  }
  return null;
}

function isFutureWorkDate(workDate: string) {
  return workDate > getTodayInIndiaDateString();
}

function getWorkDateBounds(workDate: string) {
  return {
    start: new Date(`${workDate}T00:00:00.000`),
    end: new Date(`${workDate}T23:59:59.999`),
  };
}

async function validateDailyTimeLimit({
  employeeId,
  workDate,
  minutesSpent,
  excludeEntryId,
}: {
  employeeId: string;
  workDate: string;
  minutesSpent: number;
  excludeEntryId?: string;
}) {
  const employee = await db.user.findUnique({
    where: { id: employeeId },
    select: { userType: true },
  });
  if (
    !employee ||
    !["MANAGER", "TEAM_LEAD", "EMPLOYEE"].includes(employee.userType)
  )
    return { valid: true as const };

  const bounds = getWorkDateBounds(workDate);
  const existing = await db.timeEntry.aggregate({
    where: {
      employeeId,
      workDate: { gte: bounds.start, lte: bounds.end },
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
    _sum: { minutesSpent: true },
  });

  const total =
    Number(existing._sum.minutesSpent ?? 0) + Number(minutesSpent || 0);
  if (total > 900) {
    return {
      valid: false as const,
      error: `Total time entries for this employee on this date cannot exceed 900 minutes (15 hours). Current total would be ${total} minutes.`,
    };
  }
  return { valid: true as const };
}

async function getProjectForClient(projectId: string, clientId: string) {
  return db.project.findFirst({
    where: { id: projectId, clientId, isActive: true, status: "ACTIVE" },
    include: {
      client: true,
      subProjects: {
        select: {
          id: true,
          hideCountriesInEntries: true,
          hideMoviesInEntries: true,
          hideAssetTypesInEntries: true,
          hideLensTypesInEntries: true,
          hideAssetNamesInEntries: true,
          hideNewslettersInEntries: true,
        },
      },
    },
  });
}

async function userCanLogAgainstProject(
  user: Awaited<ReturnType<typeof requireUserForAction>>,
  projectId: string,
) {
  const count = await db.project.count({
    where: {
      id: projectId,
      isActive: true,
      status: "ACTIVE",
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
    },
  });

  return count > 0;
}

async function canActForEmployee(
  user: Awaited<ReturnType<typeof requireUserForAction>>,
  employeeId: string,
) {
  if (employeeId === user.id) return true;

  if (isRoleScopedManager(user)) {
    const target = await db.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        userType: true,
        functionalRole: true,
        isActive: true,
      },
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
      select: {
        id: true,
        userType: true,
        functionalRole: true,
        isActive: true,
      },
    });

    if (!employee?.isActive) return false;

    if (user.userType === "ADMIN") {
      return ["MANAGER", "TEAM_LEAD", "EMPLOYEE"].includes(employee.userType);
    }

    if (user.userType === "MANAGER" && !isRoleScopedManager(user)) {
      return (
        employee.userType === "EMPLOYEE" ||
        employee.userType === "TEAM_LEAD" ||
        (employee.userType === "MANAGER" &&
          employee.functionalRole !== "PROJECT_MANAGER")
      );
    }

    return employee.userType === "EMPLOYEE";
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

async function validateSubProjectUsage({
  projectId,
  subProjectId,
  employeeId,
  requireAssignment,
}: {
  projectId: string;
  subProjectId?: string;
  employeeId: string;
  requireAssignment?: boolean;
}) {
  if (!subProjectId) return { valid: true as const };

  const requiresAssignment = requireAssignment ?? true;

  const hasProjectAssignment = requiresAssignment
    ? Boolean(
        await db.project.findFirst({
          where: {
            id: projectId,
            isActive: true,
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
          ? "Selected Sub Project is invalid or the chosen employee does not have project/sub-project assignment."
          : "Selected Sub Project is invalid for the chosen project.",
      };
}

async function userIsAssignedToProjectOrSubProject(
  projectId: string,
  userId: string,
) {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      isActive: true,
      status: "ACTIVE",
      OR: [
        { assignedUsers: { some: { userId } } },
        {
          subProjects: {
            some: { assignments: { some: { userId } } },
          },
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(project);
}

async function employeeCanUseProject(projectId: string, employeeId: string) {
  return userIsAssignedToProjectOrSubProject(projectId, employeeId);
}

async function validateClientFieldRequirements(
  projectId: string,
  {
    countryId,
    movieId,
    assetTypeId,
    lensTypeId,
    assetNameId,
    newsletterId,
    languageId,
    clientId,
    subProjectId,
  }: {
    countryId?: string;
    movieId?: string;
    assetTypeId?: string;
    lensTypeId?: string;
    assetNameId?: string;
    newsletterId?: string;
    languageId?: string;
    clientId: string;
    subProjectId?: string;
  },
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      subProjects: {
        select: {
          id: true,
          hideCountriesInEntries: true,
          hideMoviesInEntries: true,
          hideAssetTypesInEntries: true,
          hideLensTypesInEntries: true,
          hideAssetNamesInEntries: true,
          hideNewslettersInEntries: true,
        },
      },
    },
  });

  if (!project) {
    return { valid: false as const, error: "Project not found." };
  }

  if (project.clientId !== clientId) {
    return {
      valid: false as const,
      error: "Selected project does not belong to the selected client.",
    };
  }

  if (!project.isActive || project.status !== "ACTIVE") {
    return {
      valid: false as const,
      error: "Time entries can only use active projects.",
    };
  }

  const subProject = subProjectId
    ? project.subProjects.find((row) => row.id === subProjectId)
    : null;
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
  const lensTypeEnabled =
    project.client.showLensTypesInEntries &&
    !project.hideLensTypesInEntries &&
    !subProject?.hideLensTypesInEntries;
  const assetNameEnabled =
    project.client.showAssetNamesInEntries &&
    !project.hideAssetNamesInEntries &&
    !subProject?.hideAssetNamesInEntries;
  const newsletterEnabled =
    project.client.showNewslettersInEntries &&
    !project.hideNewslettersInEntries &&
    !subProject?.hideNewslettersInEntries;

  const countryRequired = countryEnabled && project.requireCountriesInTimeEntries;
  const assetNameRequired = assetNameEnabled && project.requireAssetNamesInTimeEntries;
  const movieRequired =
    movieEnabled && (project.requireMoviesInTimeEntries || assetNameRequired);
  const assetTypeRequired =
    assetTypeEnabled && project.requireAssetTypesInTimeEntries;
  const lensTypeRequired = lensTypeEnabled && project.requireLensTypesInTimeEntries;
  const newsletterRequired =
    newsletterEnabled && project.requireNewslettersInTimeEntries;

  if (countryRequired && !countryId) {
    return {
      valid: false as const,
      error: "Country is required for the selected project.",
    };
  }

  if (movieRequired && !movieId) {
    return {
      valid: false as const,
      error: assetNameRequired
        ? "Title is required before selecting the required asset name."
        : "Title is required for the selected project.",
    };
  }

  if (assetTypeRequired && !assetTypeId) {
    return {
      valid: false as const,
      error: "Asset Type is required for the selected project.",
    };
  }

  if (lensTypeRequired && !lensTypeId) {
    return {
      valid: false as const,
      error: "Lens Type is required for the selected project.",
    };
  }

  if (assetNameRequired && !assetNameId) {
    return {
      valid: false as const,
      error: "Asset Name is required for the selected project.",
    };
  }

  if (newsletterRequired && !newsletterId) {
    return {
      valid: false as const,
      error: "Newsletter is required for the selected project.",
    };
  }

  if (project.client.showLanguagesInEntries && !languageId) {
    return {
      valid: false as const,
      error: "Language is required for the selected client.",
    };
  }

  if (!countryEnabled && countryId) {
    return {
      valid: false as const,
      error: "Country is not enabled for the selected project/sub-project.",
    };
  }

  if (!movieEnabled && movieId) {
    return {
      valid: false as const,
      error: "Movie is not enabled for the selected project/sub-project.",
    };
  }

  if (!assetTypeEnabled && assetTypeId) {
    return {
      valid: false as const,
      error: "Asset Type is not enabled for the selected project/sub-project.",
    };
  }

  if (!lensTypeEnabled && lensTypeId) {
    return {
      valid: false as const,
      error: "Lens Type is not enabled for the selected project/sub-project.",
    };
  }

  if (!assetNameEnabled && assetNameId) {
    return {
      valid: false as const,
      error: "Asset Name is not enabled for the selected project/sub-project.",
    };
  }

  if (!newsletterEnabled && newsletterId) {
    return {
      valid: false as const,
      error: "Newsletter is not enabled for the selected project/sub-project.",
    };
  }

  if (!project.client.showLanguagesInEntries && languageId) {
    return {
      valid: false as const,
      error: "Language is not enabled for the selected client.",
    };
  }

  const allowedCountryIds = parseAllowedIds(project.allowedCountryIdsJson);
  const allowedMovieIds = parseAllowedIds(project.allowedMovieIdsJson);
  const allowedAssetTypeIds = parseAllowedIds(project.allowedAssetTypeIdsJson);
  const allowedLensTypeIds = parseAllowedIds(project.allowedLensTypeIdsJson);
  const allowedAssetNameIds = parseAllowedIds(project.allowedAssetNameIdsJson);
  const allowedNewsletterIds = parseAllowedIds(project.allowedNewsletterIdsJson);

  const singleRequiredError =
    (countryEnabled ? requireSingleAllowedValue(countryId, allowedCountryIds, "Country") : null) ??
    (movieEnabled ? requireSingleAllowedValue(movieId, allowedMovieIds, "Title") : null) ??
    (assetTypeEnabled ? requireSingleAllowedValue(assetTypeId, allowedAssetTypeIds, "Asset Type") : null) ??
    (lensTypeEnabled ? requireSingleAllowedValue(lensTypeId, allowedLensTypeIds, "Lens Type") : null) ??
    (assetNameEnabled ? requireSingleAllowedValue(assetNameId, allowedAssetNameIds, "Asset Name") : null) ??
    (newsletterEnabled ? requireSingleAllowedValue(newsletterId, allowedNewsletterIds, "Newsletter") : null);
  if (singleRequiredError) {
    return { valid: false as const, error: singleRequiredError };
  }

  if (!isAllowedByProjectRestriction(countryId, allowedCountryIds)) {
    return { valid: false as const, error: "Selected country is not allowed for the selected project." };
  }
  if (!isAllowedByProjectRestriction(movieId, allowedMovieIds)) {
    return { valid: false as const, error: "Selected title is not allowed for the selected project." };
  }
  if (!isAllowedByProjectRestriction(assetTypeId, allowedAssetTypeIds)) {
    return { valid: false as const, error: "Selected asset type is not allowed for the selected project." };
  }
  if (!isAllowedByProjectRestriction(lensTypeId, allowedLensTypeIds)) {
    return { valid: false as const, error: "Selected Lens Type is not allowed for the selected project." };
  }
  if (!isAllowedByProjectRestriction(assetNameId, allowedAssetNameIds)) {
    return { valid: false as const, error: "Selected asset name is not allowed for the selected project." };
  }
  if (!isAllowedByProjectRestriction(newsletterId, allowedNewsletterIds)) {
    return { valid: false as const, error: "Selected newsletter is not allowed for the selected project." };
  }

  if (movieId) {
    const movie = await db.movie.findFirst({
      where: {
        id: movieId,
        clientId: project.clientId,
        isActive: true,
      },
      select: { id: true, status: true },
    });

    if (!movie) {
      return {
        valid: false as const,
        error: "Selected title does not belong to the selected client.",
      };
    }

    if (movie.status === "COMPLETED_BILLED") {
      return {
        valid: false as const,
        error:
          "Selected title has already been billed and cannot be used for time entries.",
      };
    }
  }

  if (newsletterId) {
    const newsletter = await db.newsletter.findFirst({
      where: { id: newsletterId, clientId: project.clientId, isActive: true },
      select: { id: true },
    });

    if (!newsletter) {
      return {
        valid: false as const,
        error: "Selected newsletter does not belong to the selected client.",
      };
    }
  }

  if (assetNameId) {
    if (!movieId) {
      return {
        valid: false as const,
        error: "Select a title before selecting an asset name.",
      };
    }

    const assetName = await db.assetName.findFirst({
      where: {
        id: assetNameId,
        clientId: project.clientId,
        movieId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!assetName) {
      return {
        valid: false as const,
        error: "Selected asset name does not belong to the selected title.",
      };
    }
  }

  if (assetTypeId) {
    const assetType = await db.assetType.findFirst({
      where: { id: assetTypeId, clientId: project.clientId, isActive: true },
      select: { id: true },
    });

    if (!assetType) {
      return {
        valid: false as const,
        error: "Selected asset type does not belong to the selected client.",
      };
    }
  }

  if (lensTypeId) {
    const lensType = await db.lensType.findFirst({
      where: { id: lensTypeId, isActive: true },
      select: { id: true },
    });

    if (!lensType) {
      return {
        valid: false as const,
        error: "Selected Lens Type is invalid or inactive.",
      };
    }
  }

  if (languageId) {
    const language = await db.language.findFirst({
      where: {
        id: languageId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!language) {
      return { valid: false as const, error: "Selected language is invalid." };
    }
  }

  return { valid: true as const };
}

export async function createTimeEntryAction(
  _prevState: TimeEntryFormState,
  formData: FormData,
): Promise<TimeEntryFormState> {
  try {
    const user = await requireUserForAction();

    const parsed = timeSchema.safeParse({
      employeeId: formData.get("employeeId") || user.id,
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId"),
      subProjectId: formData.get("subProjectId") || undefined,
      countryId: formData.get("countryId") || undefined,
      movieId: formData.get("movieId") || undefined,
      assetTypeId: formData.get("assetTypeId") || undefined,
      lensTypeId: formData.get("lensTypeId") || undefined,
      assetNameId: formData.get("assetNameId") || undefined,
      newsletterId: formData.get("newsletterId") || undefined,
      languageId: formData.get("languageId") || undefined,
      workDate: formData.get("workDate"),
      taskName: formData.get("taskName"),
      minutesSpent: formData.get("minutesSpent"),
      isBillable: formData.getAll("isBillable").includes("true"),
      notes: formData.get("notes") || "",
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid time entry payload",
      };
    }

    if (isFutureWorkDate(parsed.data.workDate)) {
      return {
        success: false,
        error: "Future date is not allowed for time entries.",
      };
    }

    const employeeId = parsed.data.employeeId || user.id;

    const canAct = await canActForEmployee(user, employeeId);
    if (!canAct) {
      return {
        success: false,
        error: "You cannot add time for the selected employee.",
      };
    }

    const project = await getProjectForClient(
      parsed.data.projectId,
      parsed.data.clientId,
    );
    if (!project) {
      return {
        success: false,
        error: "Selected project does not belong to the selected client.",
      };
    }

    const isOwnTimeEntry = employeeId === user.id;
    const canBypassOwnProjectAssignment =
      isOwnTimeEntry && canLogOwnTimeWithoutProjectAssignment(user);

    if (!canBypassOwnProjectAssignment) {
      const employeeCanUseSelectedProject = await employeeCanUseProject(
        parsed.data.projectId,
        employeeId,
      );
      if (!employeeCanUseSelectedProject) {
        return {
          success: false,
          error: isOwnTimeEntry
            ? "You can only use projects assigned to you for this time entry."
            : "Selected employee cannot use the chosen project. Please select a project assigned to that person.",
        };
      }
    }

    const fieldCheck = await validateClientFieldRequirements(
      parsed.data.projectId,
      {
        clientId: parsed.data.clientId,
        countryId: parsed.data.countryId,
        movieId: parsed.data.movieId,
        assetTypeId: parsed.data.assetTypeId,
        lensTypeId: parsed.data.lensTypeId,
        assetNameId: parsed.data.assetNameId,
        newsletterId: parsed.data.newsletterId,
        languageId: parsed.data.languageId,
        subProjectId: parsed.data.subProjectId,
      },
    );
    if (!fieldCheck.valid) {
      return { success: false, error: fieldCheck.error };
    }

    if (isOwnTimeEntry && !canBypassOwnProjectAssignment) {
      const canUseProject = await userCanLogAgainstProject(
        user,
        parsed.data.projectId,
      );
      if (!canUseProject && !canFullyModerateProject(user)) {
        return {
          success: false,
          error:
            "You can only use projects assigned to you for this time entry.",
        };
      }
    }

    const subProjectCheck = await validateSubProjectUsage({
      projectId: parsed.data.projectId,
      subProjectId: parsed.data.subProjectId,
      employeeId,
      requireAssignment: !canBypassOwnProjectAssignment,
    });
    if (!subProjectCheck.valid) {
      return { success: false, error: subProjectCheck.error };
    }

    const dailyLimitCheck = await validateDailyTimeLimit({
      employeeId,
      workDate: parsed.data.workDate,
      minutesSpent: parsed.data.minutesSpent,
    });
    if (!dailyLimitCheck.valid) {
      return { success: false, error: dailyLimitCheck.error };
    }

    const createdEntry = await db.timeEntry.create({
      data: {
        employeeId,
        projectId: parsed.data.projectId,
        subProjectId: parsed.data.subProjectId || null,
        countryId: parsed.data.countryId || null,
        movieId: parsed.data.movieId || null,
        assetTypeId: parsed.data.assetTypeId || null,
        lensTypeId: parsed.data.lensTypeId || null,
        assetNameId: parsed.data.assetNameId || null,
        newsletterId: parsed.data.newsletterId || null,
        languageId: parsed.data.languageId || null,
        workDate: new Date(parsed.data.workDate),
        taskName: parsed.data.taskName,
        minutesSpent: parsed.data.minutesSpent,
        isBillable: parsed.data.isBillable,
        notes: parsed.data.notes || null,
        status: "SUBMITTED",
      },
    });

    await recordAuditLog({
      actorId: user.id,
      entityType: "TimeEntry",
      entityId: createdEntry.id,
      action: "CREATE",
      after: createdEntry,
      description: "Created time entry",
    });

    revalidatePath("/time-entries");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function updateTimeEntryAction(
  _prevState: TimeEntryFormState,
  formData: FormData,
): Promise<TimeEntryFormState> {
  try {
    const user = await requireUserForAction();

    const parsed = timeUpdateSchema.safeParse({
      entryId: formData.get("entryId"),
      employeeId: formData.get("employeeId"),
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId"),
      subProjectId: formData.get("subProjectId") || undefined,
      countryId: formData.get("countryId") || undefined,
      movieId: formData.get("movieId") || undefined,
      assetTypeId: formData.get("assetTypeId") || undefined,
      lensTypeId: formData.get("lensTypeId") || undefined,
      assetNameId: formData.get("assetNameId") || undefined,
      newsletterId: formData.get("newsletterId") || undefined,
      languageId: formData.get("languageId") || undefined,
      workDate: formData.get("workDate"),
      taskName: formData.get("taskName"),
      minutesSpent: formData.get("minutesSpent"),
      isBillable: formData.getAll("isBillable").includes("true"),
      notes: formData.get("notes") || "",
    });

    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message ||
          "Invalid time entry update payload",
      };
    }

    if (isFutureWorkDate(parsed.data.workDate)) {
      return {
        success: false,
        error: "Future date is not allowed for time entries.",
      };
    }

    const entry = await db.timeEntry.findUnique({
      where: { id: parsed.data.entryId },
      include: { movie: { select: { status: true, title: true } } },
    });

    if (!entry) return { success: false, error: "Time entry not found" };

    if (entry.movie?.status === "COMPLETED_BILLED") {
      return {
        success: false,
        error:
          "This time entry belongs to a title that has already been billed and cannot be edited.",
      };
    }

    if (parsed.data.employeeId && parsed.data.employeeId !== entry.employeeId) {
      return {
        success: false,
        error: "Employee cannot be changed for an existing time entry.",
      };
    }

    const assignment = await db.employeeTeamLead.findFirst({
      where: {
        teamLeadId: user.id,
        employeeId: entry.employeeId,
      },
    });

    const canEdit =
      canFullyModerateProject(user) ||
      entry.employeeId === user.id ||
      ((user.userType === "TEAM_LEAD" || isManager(user)) &&
        Boolean(assignment));

    if (!canEdit) {
      return {
        success: false,
        error: "You do not have edit access for this time entry.",
      };
    }

    const project = await getProjectForClient(
      parsed.data.projectId,
      parsed.data.clientId,
    );
    if (!project) {
      return {
        success: false,
        error: "Selected project does not belong to the selected client.",
      };
    }

    const isOwnTimeEntry = entry.employeeId === user.id;
    const canBypassOwnProjectAssignment =
      isOwnTimeEntry && canLogOwnTimeWithoutProjectAssignment(user);

    if (!canBypassOwnProjectAssignment) {
      const employeeCanUseSelectedProject = await employeeCanUseProject(
        parsed.data.projectId,
        entry.employeeId,
      );
      if (!employeeCanUseSelectedProject) {
        return {
          success: false,
          error: isOwnTimeEntry
            ? "You can only use projects assigned to you for this time entry."
            : "Selected employee cannot use the chosen project. Please select a project assigned to that person.",
        };
      }
    }

    const fieldCheck = await validateClientFieldRequirements(
      parsed.data.projectId,
      {
        clientId: parsed.data.clientId,
        countryId: parsed.data.countryId,
        movieId: parsed.data.movieId,
        assetTypeId: parsed.data.assetTypeId,
        lensTypeId: parsed.data.lensTypeId,
        assetNameId: parsed.data.assetNameId,
        newsletterId: parsed.data.newsletterId,
        languageId: parsed.data.languageId,
        subProjectId: parsed.data.subProjectId,
      },
    );
    if (!fieldCheck.valid) {
      return { success: false, error: fieldCheck.error };
    }

    if (isOwnTimeEntry && !canBypassOwnProjectAssignment) {
      const canUseProject = await userCanLogAgainstProject(
        user,
        parsed.data.projectId,
      );
      if (!canUseProject && !canFullyModerateProject(user)) {
        return {
          success: false,
          error:
            "You can only use projects assigned to you for this time entry.",
        };
      }
    }

    const subProjectCheck = await validateSubProjectUsage({
      projectId: parsed.data.projectId,
      subProjectId: parsed.data.subProjectId,
      employeeId: entry.employeeId,
      requireAssignment: !canBypassOwnProjectAssignment,
    });
    if (!subProjectCheck.valid) {
      return { success: false, error: subProjectCheck.error };
    }

    const dailyLimitCheck = await validateDailyTimeLimit({
      employeeId: entry.employeeId,
      workDate: parsed.data.workDate,
      minutesSpent: parsed.data.minutesSpent,
      excludeEntryId: entry.id,
    });
    if (!dailyLimitCheck.valid) {
      return { success: false, error: dailyLimitCheck.error };
    }

    const existingEntry = await db.timeEntry.findUnique({
      where: { id: entry.id },
    });

    const updatedEntry = await db.timeEntry.update({
      where: { id: entry.id },
      data: {
        projectId: parsed.data.projectId,
        subProjectId: parsed.data.subProjectId || null,
        countryId: parsed.data.countryId || null,
        movieId: parsed.data.movieId || null,
        assetTypeId: parsed.data.assetTypeId || null,
        lensTypeId: parsed.data.lensTypeId || null,
        assetNameId: parsed.data.assetNameId || null,
        newsletterId: parsed.data.newsletterId || null,
        languageId: parsed.data.languageId || null,
        workDate: new Date(parsed.data.workDate),
        taskName: parsed.data.taskName,
        minutesSpent: parsed.data.minutesSpent,
        isBillable: parsed.data.isBillable,
        notes: parsed.data.notes || null,
      },
    });

    await recordAuditLog({
      actorId: user.id,
      entityType: "TimeEntry",
      entityId: updatedEntry.id,
      action: "UPDATE",
      before: existingEntry,
      after: updatedEntry,
      description: "Updated time entry",
    });

    revalidatePath("/time-entries");
    revalidatePath(`/time-entries/${entry.id}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function deleteTimeEntryAction(formData: FormData) {
  const user = await requireUserForAction();
  const entryId = String(formData.get("entryId") || "");

  if (!entryId) {
    throw new Error("Time entry is required.");
  }

  if (!["ADMIN", "MANAGER", "TEAM_LEAD"].includes(user.userType)) {
    throw new Error("You do not have permission to delete time entries.");
  }

  const entry = await db.timeEntry.findUnique({
    where: { id: entryId },
    include: {
      employee: {
        select: {
          id: true,
          functionalRole: true,
        },
      },
      movie: { select: { status: true, title: true } },
    },
  });

  if (!entry) {
    throw new Error("Time entry not found.");
  }

  if (entry.movie?.status === "COMPLETED_BILLED") {
    throw new Error(
      "This time entry belongs to a title that has already been billed and cannot be deleted.",
    );
  }

  if (user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) {
    const assignment = await db.employeeTeamLead.findFirst({
      where: {
        teamLeadId: user.id,
        employeeId: entry.employeeId,
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
      throw new Error(
        "You can delete time entries only for assigned employees.",
      );
    }

    if (assignment.employee.functionalRole !== user.functionalRole) {
      throw new Error(
        "You can delete time entries only for employees with matching functional role.",
      );
    }
  }

  await recordAuditLog({
    actorId: user.id,
    entityType: "TimeEntry",
    entityId: entry.id,
    action: "DELETE",
    before: entry,
    description: "Deleted time entry",
  });

  await db.timeEntry.delete({
    where: { id: entry.id },
  });

  revalidatePath("/time-entries");
}
