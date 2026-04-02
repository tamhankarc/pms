"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageAssignments } from "@/lib/permissions";

export type UserAssignmentState = { success?: boolean; error?: string };

const schema = z.object({
  projectId: z.string().min(1, "Project is required."),
  subProjectId: z.string().optional(),
  userIds: z.array(z.string()).default([]),
});

async function requireAccess() {
  const user = await requireUserForAction();
  if (!canManageAssignments(user)) throw new Error("You are not allowed to manage assignments.");
  return user;
}

export async function saveUserAssignmentAction(
  _prev: UserAssignmentState,
  formData: FormData,
): Promise<UserAssignmentState> {
  try {
    await requireAccess();
    const parsed = schema.safeParse({
      projectId: String(formData.get("projectId") ?? ""),
      subProjectId: String(formData.get("subProjectId") ?? "") || undefined,
      userIds: formData.getAll("userIds").map(String).filter(Boolean),
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid assignment payload." };
    }

    const userIds = Array.from(new Set(parsed.data.userIds));

    if (parsed.data.subProjectId) {
      const subProject = await db.subProject.findUnique({
        where: { id: parsed.data.subProjectId },
        include: {
          assignments: true,
          timeEntries: { select: { employeeId: true } },
          estimates: { select: { employeeId: true } },
        },
      });
      if (!subProject || subProject.projectId !== parsed.data.projectId) {
        return { success: false, error: "Invalid Sub Project selected." };
      }
      const lockedUserIds = new Set([
        ...subProject.timeEntries.map((row) => row.employeeId),
        ...subProject.estimates.map((row) => row.employeeId),
      ]);
      for (const row of subProject.assignments) {
        if (lockedUserIds.has(row.userId) && !userIds.includes(row.userId)) {
          return {
            success: false,
            error: "A user with time entries or estimates for this Sub Project cannot be removed.",
          };
        }
      }
      await db.$transaction(async (tx) => {
        await tx.subProjectAssignment.deleteMany({
          where: {
            subProjectId: subProject.id,
            userId: { notIn: userIds.length ? userIds : ["__none__"] },
          },
        });
        if (userIds.length > 0) {
          await tx.subProjectAssignment.createMany({
            data: userIds.map((userId) => ({ subProjectId: subProject.id, userId })),
            skipDuplicates: true,
          });
        }
      });
    } else {
      const project = await db.project.findUnique({
        where: { id: parsed.data.projectId },
        include: {
          assignedUsers: true,
          timeEntries: { select: { employeeId: true } },
          estimates: { select: { employeeId: true } },
        },
      });
      if (!project) return { success: false, error: "Project not found." };
      const lockedUserIds = new Set([
        ...project.timeEntries.map((row) => row.employeeId),
        ...project.estimates.map((row) => row.employeeId),
      ]);
      for (const row of project.assignedUsers) {
        if (lockedUserIds.has(row.userId) && !userIds.includes(row.userId)) {
          return {
            success: false,
            error: "A user with time entries or estimates for this Project cannot be removed.",
          };
        }
      }
      await db.$transaction(async (tx) => {
        await tx.projectUserAssignment.deleteMany({
          where: {
            projectId: project.id,
            userId: { notIn: userIds.length ? userIds : ["__none__"] },
          },
        });
        if (userIds.length > 0) {
          await tx.projectUserAssignment.createMany({
            data: userIds.map((userId) => ({ projectId: project.id, userId })),
            skipDuplicates: true,
          });
        }
      });
    }

    revalidatePath("/user-assignments");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    revalidatePath("/projects");
    revalidatePath("/sub-project");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
