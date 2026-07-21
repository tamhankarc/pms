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
          assignments: {
            include: {
              user: { select: { fullName: true } },
            },
          },
        },
      });
      if (!subProject || subProject.projectId !== parsed.data.projectId) {
        return { success: false, error: "Invalid Sub Project selected." };
      }

      const removedAssignments = subProject.assignments.filter(
        (assignment) => !userIds.includes(assignment.userId),
      );
      if (removedAssignments.length > 0) {
        const timeEntryCounts = await db.timeEntry.groupBy({
          by: ["employeeId"],
          where: {
            subProjectId: subProject.id,
            employeeId: {
              in: removedAssignments.map((assignment) => assignment.userId),
            },
          },
          _count: { _all: true },
        });
        const countByUserId = new Map(
          timeEntryCounts.map((row) => [row.employeeId, row._count._all]),
        );
        const blockedAssignments = removedAssignments.filter(
          (assignment) => (countByUserId.get(assignment.userId) ?? 0) > 0,
        );

        if (blockedAssignments.length > 0) {
          const blockedUsers = blockedAssignments
            .map((assignment) => {
              const count = countByUserId.get(assignment.userId) ?? 0;
              return `${assignment.user.fullName} (${count})`;
            })
            .join(", ");
          return {
            success: false,
            error: `The following user assignment(s) cannot be removed because time entries exist for this Sub Project: ${blockedUsers}.`,
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
          assignedUsers: {
            include: {
              user: { select: { fullName: true } },
            },
          },
        },
      });
      if (!project) return { success: false, error: "Project not found." };

      const removedAssignments = project.assignedUsers.filter(
        (assignment) => !userIds.includes(assignment.userId),
      );
      if (removedAssignments.length > 0) {
        const timeEntryCounts = await db.timeEntry.groupBy({
          by: ["employeeId"],
          where: {
            projectId: project.id,
            employeeId: {
              in: removedAssignments.map((assignment) => assignment.userId),
            },
          },
          _count: { _all: true },
        });
        const countByUserId = new Map(
          timeEntryCounts.map((row) => [row.employeeId, row._count._all]),
        );
        const blockedAssignments = removedAssignments.filter(
          (assignment) => (countByUserId.get(assignment.userId) ?? 0) > 0,
        );

        if (blockedAssignments.length > 0) {
          const blockedUsers = blockedAssignments
            .map((assignment) => {
              const count = countByUserId.get(assignment.userId) ?? 0;
              return `${assignment.user.fullName} (${count})`;
            })
            .join(", ");
          return {
            success: false,
            error: `The following user assignment(s) cannot be removed because time entries exist for this Project: ${blockedUsers}.`,
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
