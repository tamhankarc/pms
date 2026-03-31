"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canFullyModerateProject, isRoleScopedManager } from "@/lib/permissions";

export type TimeEntryFormState = {
  success?: boolean;
  error?: string;
};

const timeSchema = z.object({
  clientId: z.string().min(1, "Client is required."),
  projectId: z.string().min(1, "Project is required."),
  countryId: z.string().optional(),
  workDate: z.string().min(1),
  taskName: z.string().trim().min(2, "Task name is required.").max(200),
  minutesSpent: z.coerce.number().int().positive(),
  isBillable: z.coerce.boolean().default(true),
  notes: z.string().optional(),
});


async function validateProjectClient(projectId: string, clientId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true, isActive: true },
  });

  return Boolean(project && project.clientId === clientId && project.isActive);
}

async function userCanLogAgainstProject(user: Awaited<ReturnType<typeof requireUser>>, projectId: string) {
  const count = await db.project.count({
    where: {
      id: projectId,
      isActive: true,
      ...(isRoleScopedManager(user)
        ? {}
        : {
            OR: [
              {
                employeeGroups: {
                  some: {
                    employeeGroup: {
                      users: {
                        some: { userId: user.id },
                      },
                    },
                  },
                },
              },
              {
                assignedUsers: {
                  some: {
                    userId: user.id,
                  },
                },
              },
            ],
          }),
    },
  });
  return count > 0;
}

export async function createTimeEntryAction(
  _prevState: TimeEntryFormState,
  formData: FormData,
): Promise<TimeEntryFormState> {
  try {
    const user = await requireUser();

    const parsed = timeSchema.safeParse({
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId"),
      countryId: formData.get("countryId") || undefined,
      workDate: formData.get("workDate"),
      taskName: formData.get("taskName"),
      minutesSpent: formData.get("minutesSpent"),
      isBillable: formData.get("isBillable") === "true",
      notes: formData.get("notes") || "",
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid time entry payload" };
    }

    if (![
      "EMPLOYEE",
      "TEAM_LEAD",
    ].includes(user.userType) && !isRoleScopedManager(user)) {
      return { success: false, error: "You are not allowed to submit time entries." };
    }

    const validProjectClient = await validateProjectClient(parsed.data.projectId, parsed.data.clientId);
    if (!validProjectClient) {
      return { success: false, error: "Selected project does not belong to the selected client." };
    }

    const canUseProject = await userCanLogAgainstProject(user, parsed.data.projectId);
    if (!canUseProject) {
      return { success: false, error: "You can only add time entries to your assigned projects." };
    }

    await db.timeEntry.create({
      data: {
        employeeId: user.id,
        projectId: parsed.data.projectId,
        countryId: parsed.data.countryId || null,
        workDate: new Date(parsed.data.workDate),
        taskName: parsed.data.taskName,
        minutesSpent: parsed.data.minutesSpent,
        isBillable: parsed.data.isBillable,
        notes: parsed.data.notes || null,
        status: "SUBMITTED",
      },
    });

    revalidatePath("/time-entries");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

const updateTimeSchema = z.object({
  entryId: z.string().min(1),
  clientId: z.string().min(1, "Client is required."),
  projectId: z.string().min(1, "Project is required."),
  countryId: z.string().optional(),
  workDate: z.string().min(1),
  taskName: z.string().trim().min(2, "Task name is required.").max(200),
  minutesSpent: z.coerce.number().int().positive(),
  isBillable: z.coerce.boolean().default(true),
  notes: z.string().optional(),
});

export async function updateTimeEntryAction(
  _prevState: TimeEntryFormState,
  formData: FormData,
): Promise<TimeEntryFormState> {
  try {
    const user = await requireUser();

    const parsed = updateTimeSchema.safeParse({
      entryId: formData.get("entryId"),
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId"),
      countryId: formData.get("countryId") || undefined,
      workDate: formData.get("workDate"),
      taskName: formData.get("taskName"),
      minutesSpent: formData.get("minutesSpent"),
      isBillable: formData.get("isBillable") === "true",
      notes: formData.get("notes") || "",
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid time entry update payload" };
    }

    const entry = await db.timeEntry.findUnique({
      where: { id: parsed.data.entryId },
    });

    if (!entry) return { success: false, error: "Time entry not found" };

    const assignment = await db.employeeTeamLead.findFirst({
      where: {
        teamLeadId: user.id,
        employeeId: entry.employeeId,
      },
    });

    const canEdit =
      canFullyModerateProject(user) ||
      entry.employeeId === user.id ||
      (user.userType === "TEAM_LEAD" && Boolean(assignment));

    if (!canEdit) {
      return { success: false, error: "You do not have edit access for this time entry." };
    }

    const validProjectClient = await validateProjectClient(parsed.data.projectId, parsed.data.clientId);
    if (!validProjectClient) {
      return { success: false, error: "Selected project does not belong to the selected client." };
    }

    const canUseProject = await userCanLogAgainstProject(user, parsed.data.projectId);
    if (!canUseProject && !canFullyModerateProject(user)) {
      return { success: false, error: "You can only use projects assigned to you for this time entry." };
    }

    await db.timeEntry.update({
      where: { id: entry.id },
      data: {
        projectId: parsed.data.projectId,
        countryId: parsed.data.countryId || null,
        workDate: new Date(parsed.data.workDate),
        taskName: parsed.data.taskName,
        minutesSpent: parsed.data.minutesSpent,
        isBillable: parsed.data.isBillable,
        notes: parsed.data.notes || null,
      },
    });

    revalidatePath("/time-entries");
    revalidatePath(`/time-entries/${entry.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
