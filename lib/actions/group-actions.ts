"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";

export type EmployeeGroupFormState = {
  success?: boolean;
  error?: string;
};

const groupSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Group name is required."),
  description: z.string().optional(),
  userIds: z.array(z.string()).optional().default([]),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

async function validateAssignableUsers(userIds: string[]) {
  if (userIds.length === 0) return true;
  const count = await db.user.count({
    where: {
      id: { in: userIds },
      userType: { in: ["EMPLOYEE", "TEAM_LEAD"] },
    },
  });
  return count === userIds.length;
}

export async function createEmployeeGroupAction(
  _prevState: EmployeeGroupFormState,
  formData: FormData,
): Promise<EmployeeGroupFormState> {
  try {
    await requireUserTypes(["ADMIN", "MANAGER", "TEAM_LEAD"]);

    const parsed = groupSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") || "",
      userIds: formData.getAll("userIds").map(String),
      isActive: formData.get("isActive") ?? "on",
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid employee group payload." };
    }

    const validUsers = await validateAssignableUsers(parsed.data.userIds);
    if (!validUsers) {
      return { success: false, error: "Only Employees and Team Leads can be assigned to a group." };
    }

    await db.$transaction(async (tx) => {
      const group = await tx.employeeGroup.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description || null,
          isActive: Boolean(parsed.data.isActive),
        },
      });

      if (parsed.data.userIds.length > 0) {
        await tx.userEmployeeGroup.createMany({
          data: parsed.data.userIds.map((userId) => ({
            userId,
            employeeGroupId: group.id,
          })),
          skipDuplicates: true,
        });
      }
    });

    revalidatePath("/employee-groups");
    revalidatePath("/projects/new");
    revalidatePath("/projects");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateEmployeeGroupAction(
  _prevState: EmployeeGroupFormState,
  formData: FormData,
): Promise<EmployeeGroupFormState> {
  try {
    await requireUserTypes(["ADMIN", "MANAGER", "TEAM_LEAD"]);

    const parsed = groupSchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      description: formData.get("description") || "",
      userIds: formData.getAll("userIds").map(String),
      isActive: formData.get("isActive") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return { success: false, error: parsed.success ? "Employee group is required." : parsed.error.issues[0]?.message };
    }

    const validUsers = await validateAssignableUsers(parsed.data.userIds);
    if (!validUsers) {
      return { success: false, error: "Only Employees and Team Leads can be assigned to a group." };
    }

    await db.$transaction(async (tx) => {
      await tx.employeeGroup.update({
        where: { id: parsed.data.id! },
        data: {
          name: parsed.data.name,
          description: parsed.data.description || null,
          isActive: Boolean(parsed.data.isActive),
        },
      });

      await tx.userEmployeeGroup.deleteMany({
        where: { employeeGroupId: parsed.data.id! },
      });

      if (parsed.data.userIds.length > 0) {
        await tx.userEmployeeGroup.createMany({
          data: parsed.data.userIds.map((userId) => ({
            userId,
            employeeGroupId: parsed.data.id!,
          })),
          skipDuplicates: true,
        });
      }
    });

    revalidatePath("/employee-groups");
    revalidatePath(`/employee-groups/${parsed.data.id}`);
    revalidatePath("/projects/new");
    revalidatePath("/projects");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function toggleEmployeeGroupStatusAction(formData: FormData) {
  await requireUserTypes(["ADMIN", "MANAGER", "TEAM_LEAD"]);
  const groupId = String(formData.get("groupId") || "");
  if (!groupId) throw new Error("Employee group is required.");

  const group = await db.employeeGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new Error("Employee group not found.");

  await db.employeeGroup.update({
    where: { id: groupId },
    data: { isActive: !group.isActive },
  });

  revalidatePath("/employee-groups");
  revalidatePath(`/employee-groups/${groupId}`);
}
