"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canFullyModerateProject, isRoleScopedManager } from "@/lib/permissions";

const timeSchema = z.object({
  projectId: z.string().min(1),
  countryId: z.string().optional(),
  workDate: z.string().min(1),
  taskName: z.string().trim().min(2, "Task name is required.").max(200),
  minutesSpent: z.coerce.number().int().positive(),
  isBillable: z.coerce.boolean().default(true),
  notes: z.string().optional(),
});

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

export async function createTimeEntryAction(formData: FormData) {
  const user = await requireUser();

  const parsed = timeSchema.safeParse({
    projectId: formData.get("projectId"),
    countryId: formData.get("countryId") || undefined,
    workDate: formData.get("workDate"),
    taskName: formData.get("taskName"),
    minutesSpent: formData.get("minutesSpent"),
    isBillable: formData.get("isBillable") === "true",
    notes: formData.get("notes") || "",
  });

  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid time entry payload");

  if (!["EMPLOYEE", "TEAM_LEAD"].includes(user.userType) && !isRoleScopedManager(user)) {
    throw new Error("You are not allowed to submit time entries.");
  }

  const canUseProject = await userCanLogAgainstProject(user, parsed.data.projectId);
  if (!canUseProject) {
    throw new Error("You can only add time entries to your assigned projects.");
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
}

const updateTimeSchema = z.object({
  entryId: z.string().min(1),
  countryId: z.string().optional(),
  workDate: z.string().min(1),
  taskName: z.string().trim().min(2, "Task name is required.").max(200),
  minutesSpent: z.coerce.number().int().positive(),
  isBillable: z.coerce.boolean().default(true),
  notes: z.string().optional(),
});

export async function updateTimeEntryAction(formData: FormData) {
  const user = await requireUser();

  const parsed = updateTimeSchema.safeParse({
    entryId: formData.get("entryId"),
    countryId: formData.get("countryId") || undefined,
    workDate: formData.get("workDate"),
    taskName: formData.get("taskName"),
    minutesSpent: formData.get("minutesSpent"),
    isBillable: formData.get("isBillable") === "true",
    notes: formData.get("notes") || "",
  });

  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid time entry update payload");

  const entry = await db.timeEntry.findUnique({
    where: { id: parsed.data.entryId },
  });

  if (!entry) throw new Error("Time entry not found");

  const assignment = await db.employeeTeamLead.findFirst({
    where: {
      teamLeadId: user.id,
      employeeId: entry.employeeId,
    },
  });

  const canEdit =
    canFullyModerateProject(user) ||
    (user.userType === "TEAM_LEAD" && Boolean(assignment));

  if (!canEdit) {
    throw new Error("You do not have edit access for this time entry.");
  }

  await db.timeEntry.update({
    where: { id: entry.id },
    data: {
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
}
