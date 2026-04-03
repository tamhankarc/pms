"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canFullyModerateProject, isManager, isRoleScopedManager } from "@/lib/permissions";
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

async function getProjectForClient(projectId: string, clientId: string) {
  return db.project.findFirst({
    where: { id: projectId, clientId, isActive: true, status: "ACTIVE" },
    include: { client: true, subProjects: { select: { id: true, hideCountriesInEntries: true } } },
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

async function validateSubProjectUsage({
  projectId,
  subProjectId,
  employeeId,
}: {
  projectId: string;
  subProjectId?: string;
  employeeId: string;
}) {
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

async function validateClientFieldRequirements(
  projectId: string,
  {
    countryId,
    movieId,
    languageId,
    clientId,
    subProjectId,
  }: {
    countryId?: string;
    movieId?: string;
    languageId?: string;
    clientId: string;
    subProjectId?: string;
  },
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { client: true, subProjects: { select: { id: true, hideCountriesInEntries: true } } },
  });

  if (!project) {
    return { valid: false as const, error: "Project not found." };
  }

  if (project.clientId !== clientId) {
    return { valid: false as const, error: "Selected project does not belong to the selected client." };
  }

  if (!project.isActive || project.status !== "ACTIVE") {
    return { valid: false as const, error: "Time entries can only use active projects." };
  }

  const subProject = subProjectId ? project.subProjects.find((row) => row.id === subProjectId) : null;
  const countryEnabled =
    project.client.showCountriesInTimeEntries &&
    !project.hideCountriesInEntries &&
    !subProject?.hideCountriesInEntries;

  if (countryEnabled && !countryId) {
    return { valid: false as const, error: "Country is required for the selected client." };
  }

  if (project.client.showLanguagesInEntries && !languageId) {
    return { valid: false as const, error: "Language is required for the selected client." };
  }

  if (!countryEnabled && countryId) {
    return { valid: false as const, error: "Country is not enabled for the selected project/sub-project." };
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

    const employeeId = parsed.data.employeeId || user.id;

    const canAct = await canActForEmployee(user, employeeId);
    if (!canAct) {
      return { success: false, error: "You cannot add time for the selected employee." };
    }

    const project = await getProjectForClient(parsed.data.projectId, parsed.data.clientId);
    if (!project) {
      return { success: false, error: "Selected project does not belong to the selected client." };
    }

    const fieldCheck = await validateClientFieldRequirements(parsed.data.projectId, {
      clientId: parsed.data.clientId,
      countryId: parsed.data.countryId,
      movieId: parsed.data.movieId,
      languageId: parsed.data.languageId,
      subProjectId: parsed.data.subProjectId,
    });
    if (!fieldCheck.valid) {
      return { success: false, error: fieldCheck.error };
    }

    const canUseProject = await userCanLogAgainstProject(user, parsed.data.projectId);
    if (!canUseProject && !canFullyModerateProject(user)) {
      return { success: false, error: "You can only use projects assigned to you for this time entry." };
    }

    const subProjectCheck = await validateSubProjectUsage({
      projectId: parsed.data.projectId,
      subProjectId: parsed.data.subProjectId,
      employeeId,
    });
    if (!subProjectCheck.valid) {
      return { success: false, error: subProjectCheck.error };
    }

    const createdEntry = await db.timeEntry.create({
      data: {
        employeeId,
        projectId: parsed.data.projectId,
        subProjectId: parsed.data.subProjectId || null,
        countryId: parsed.data.countryId || null,
        movieId: parsed.data.movieId || null,
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
        error: parsed.error.issues[0]?.message || "Invalid time entry update payload",
      };
    }

    const entry = await db.timeEntry.findUnique({
      where: { id: parsed.data.entryId },
    });

    if (!entry) return { success: false, error: "Time entry not found" };

    if (parsed.data.employeeId && parsed.data.employeeId !== entry.employeeId) {
      return { success: false, error: "Employee cannot be changed for an existing time entry." };
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
      ((user.userType === "TEAM_LEAD" || isManager(user)) && Boolean(assignment));

    if (!canEdit) {
      return { success: false, error: "You do not have edit access for this time entry." };
    }

    const project = await getProjectForClient(parsed.data.projectId, parsed.data.clientId);
    if (!project) {
      return { success: false, error: "Selected project does not belong to the selected client." };
    }

    const fieldCheck = await validateClientFieldRequirements(parsed.data.projectId, {
      clientId: parsed.data.clientId,
      countryId: parsed.data.countryId,
      movieId: parsed.data.movieId,
      languageId: parsed.data.languageId,
      subProjectId: parsed.data.subProjectId,
    });
    if (!fieldCheck.valid) {
      return { success: false, error: fieldCheck.error };
    }

    const canUseProject = await userCanLogAgainstProject(user, parsed.data.projectId);
    if (!canUseProject && !canFullyModerateProject(user)) {
      return { success: false, error: "You can only use projects assigned to you for this time entry." };
    }

    const subProjectCheck = await validateSubProjectUsage({
      projectId: parsed.data.projectId,
      subProjectId: parsed.data.subProjectId,
      employeeId: entry.employeeId,
    });
    if (!subProjectCheck.valid) {
      return { success: false, error: subProjectCheck.error };
    }

    const existingEntry = await db.timeEntry.findUnique({ where: { id: entry.id } });

    const updatedEntry = await db.timeEntry.update({
      where: { id: entry.id },
      data: {
        projectId: parsed.data.projectId,
        subProjectId: parsed.data.subProjectId || null,
        countryId: parsed.data.countryId || null,
        movieId: parsed.data.movieId || null,
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