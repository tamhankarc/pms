"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireUserTypes } from "@/lib/auth";
import {
  assertEmployeeHasAtLeastOneTeamLead,
  assertUniqueIds,
} from "@/lib/domain/rules";

const functionalRoles = [
  "DEVELOPER",
  "QA",
  "DESIGNER",
  "LOCALIZATION",
  "DEVOPS",
  "PROJECT_MANAGER",
  "OTHER",
] as const;

const userTypes = [
  "ADMIN",
  "MANAGER",
  "TEAM_LEAD",
  "EMPLOYEE",
  "REPORT_VIEWER",
] as const;

export type UserFormState = {
  success?: boolean;
  error?: string;
};

const baseSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  userType: z.enum(userTypes),
  functionalRole: z.enum(functionalRoles),
  employeeCode: z.string().trim().max(50).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  joiningDate: z.string().optional().or(z.literal("")),
  phoneNumber: z.string().trim().max(30).optional().or(z.literal("")),
  groupIds: z.array(z.string()).optional().default([]),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

function normalizeGroupIds(userType: typeof userTypes[number], groupIds: string[]) {
  if (userType === "EMPLOYEE" || userType === "TEAM_LEAD") return groupIds;
  return [];
}

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  try {
    const actor = await requireUserTypes(["ADMIN", "MANAGER"]);

    const parsed = baseSchema.safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      userType: formData.get("userType"),
      functionalRole: formData.get("functionalRole"),
      employeeCode: formData.get("employeeCode") || "",
      designation: formData.get("designation") || "",
      joiningDate: formData.get("joiningDate") || "",
      phoneNumber: formData.get("phoneNumber"),
      groupIds: formData.getAll("groupIds").map(String),
      isActive: formData.get("isActive") ?? "on",
    });

    if (!parsed.success || !parsed.data.password) {
      return { success: false, error: parsed.success ? "Password is required." : parsed.error.issues[0]?.message };
    }

    if (actor.userType !== "ADMIN" && (parsed.data.userType === "MANAGER" || parsed.data.userType === "ADMIN")) {
      return { success: false, error: "Only Admin can create Manager or Admin users." };
    }

    const teamLeadIds = parsed.data.userType === "EMPLOYEE"
      ? formData.getAll("teamLeadIds").map(String).filter(Boolean)
      : [];

    if (parsed.data.userType === "EMPLOYEE") {
      assertEmployeeHasAtLeastOneTeamLead(teamLeadIds);
      assertUniqueIds(teamLeadIds, "team lead");

      const count = await db.user.count({
        where: {
          id: { in: teamLeadIds },
          userType: "TEAM_LEAD",
          isActive: true,
        },
      });

      if (count !== teamLeadIds.length) {
        return { success: false, error: "One or more selected Team Leads are invalid." };
      }
    }

    const groupIds = normalizeGroupIds(parsed.data.userType, parsed.data.groupIds);
    assertUniqueIds(groupIds, "employee group");

    const passwordHash = await hashPassword(parsed.data.password);

    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: parsed.data.fullName,
          email: parsed.data.email.toLowerCase(),
          passwordHash,
          userType: parsed.data.userType,
          functionalRole: parsed.data.functionalRole,
          employeeCode: parsed.data.employeeCode?.trim() || null,
          designation: parsed.data.designation?.trim() || null,
          joiningDate: parsed.data.joiningDate ? new Date(parsed.data.joiningDate) : null,
          phoneNumber: parsed.data.phoneNumber?.trim() || null,
          isActive: Boolean(parsed.data.isActive),
        },
      });

      if (groupIds.length > 0) {
        await tx.userEmployeeGroup.createMany({
          data: groupIds.map((employeeGroupId) => ({
            userId: user.id,
            employeeGroupId,
          })),
          skipDuplicates: true,
        });
      }

      if (parsed.data.userType === "EMPLOYEE") {
        await tx.employeeTeamLead.createMany({
          data: teamLeadIds.map((teamLeadId) => ({
            employeeId: user.id,
            teamLeadId,
            assignedById: actor.id,
          })),
          skipDuplicates: true,
        });
      }
    });

    revalidatePath("/users");
    revalidatePath("/team-lead-assignments");
    revalidatePath("/employee-groups");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateUserAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  try {
    const actor = await requireUserTypes(["ADMIN", "MANAGER"]);
    const parsed = baseSchema.safeParse({
      id: formData.get("id"),
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      userType: formData.get("userType"),
      functionalRole: formData.get("functionalRole"),
      employeeCode: formData.get("employeeCode") || "",
      designation: formData.get("designation") || "",
      joiningDate: formData.get("joiningDate") || "",
      phoneNumber: formData.get("phoneNumber"),
      groupIds: formData.getAll("groupIds").map(String),
      isActive: formData.get("isActive") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return { success: false, error: parsed.success ? "User is required." : parsed.error.issues[0]?.message };
    }

    if (actor.userType !== "ADMIN" && (parsed.data.userType === "MANAGER" || parsed.data.userType === "ADMIN")) {
      return { success: false, error: "Only Admin can assign Manager or Admin user type." };
    }

    const teamLeadIds = parsed.data.userType === "EMPLOYEE"
      ? formData.getAll("teamLeadIds").map(String).filter(Boolean)
      : [];

    if (parsed.data.userType === "EMPLOYEE") {
      assertEmployeeHasAtLeastOneTeamLead(teamLeadIds);
      assertUniqueIds(teamLeadIds, "team lead");
    }

    const groupIds = normalizeGroupIds(parsed.data.userType, parsed.data.groupIds);
    assertUniqueIds(groupIds, "employee group");

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: parsed.data.id! },
        data: {
          fullName: parsed.data.fullName,
          email: parsed.data.email.toLowerCase(),
          userType: parsed.data.userType,
          functionalRole: parsed.data.functionalRole,
          employeeCode: parsed.data.employeeCode?.trim() || null,
          designation: parsed.data.designation?.trim() || null,
          joiningDate: parsed.data.joiningDate ? new Date(parsed.data.joiningDate) : null,
          phoneNumber: parsed.data.phoneNumber?.trim() || null,
          isActive: Boolean(parsed.data.isActive),
        },
      });

      await tx.userEmployeeGroup.deleteMany({ where: { userId: parsed.data.id! } });
      if (groupIds.length > 0) {
        await tx.userEmployeeGroup.createMany({
          data: groupIds.map((employeeGroupId) => ({
            userId: parsed.data.id!,
            employeeGroupId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.employeeTeamLead.deleteMany({ where: { employeeId: parsed.data.id! } });
      if (parsed.data.userType === "EMPLOYEE" && teamLeadIds.length > 0) {
        await tx.employeeTeamLead.createMany({
          data: teamLeadIds.map((teamLeadId) => ({
            employeeId: parsed.data.id!,
            teamLeadId,
            assignedById: actor.id,
          })),
          skipDuplicates: true,
        });
      }
    });

    revalidatePath("/users");
    revalidatePath(`/users/${parsed.data.id}`);
    revalidatePath("/team-lead-assignments");
    revalidatePath("/employee-groups");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function toggleUserStatusAction(formData: FormData) {
  await requireUserTypes(["ADMIN", "MANAGER"]);
  const userId = String(formData.get("userId") || "");
  if (!userId) throw new Error("User is required.");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found.");

  await db.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
}

const teamLeadAssignmentSchema = z.object({
  teamLeadId: z.string().min(1),
  employeeId: z.string().min(1),
});

export async function assignTeamLeadAction(formData: FormData) {
  const actor = await requireUserTypes(["ADMIN", "MANAGER"]);

  const parsed = teamLeadAssignmentSchema.safeParse({
    teamLeadId: formData.get("teamLeadId"),
    employeeId: formData.get("employeeId"),
  });

  if (!parsed.success) throw new Error("Invalid assignment payload");

  const employee = await db.user.findUnique({
    where: { id: parsed.data.employeeId },
    select: { id: true, userType: true },
  });

  if (!employee || employee.userType !== "EMPLOYEE") {
    throw new Error("Selected user is not an employee.");
  }

  const teamLead = await db.user.findUnique({
    where: { id: parsed.data.teamLeadId },
    select: { id: true, userType: true },
  });

  if (!teamLead || teamLead.userType !== "TEAM_LEAD") {
    throw new Error("Selected user is not a Team Lead.");
  }

  await db.employeeTeamLead.upsert({
    where: {
      employeeId_teamLeadId: {
        employeeId: parsed.data.employeeId,
        teamLeadId: parsed.data.teamLeadId,
      },
    },
    create: {
      employeeId: parsed.data.employeeId,
      teamLeadId: parsed.data.teamLeadId,
      assignedById: actor.id,
    },
    update: {
      assignedById: actor.id,
    },
  });

  revalidatePath("/team-lead-assignments");
  revalidatePath("/users");
  revalidatePath("/dashboard");
}
