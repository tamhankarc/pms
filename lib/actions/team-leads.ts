"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAssignTeamLeads } from "@/lib/permissions";
import {
  assertEmployeeHasAtLeastOneSupervisor,
  assertUniqueIds,
} from "@/lib/domain/rules";

async function requireSupervisorAssignmentAccess() {
  const currentUser = await requireUser();

  if (!canAssignTeamLeads(currentUser)) {
    throw new Error("You are not allowed to manage supervisor assignments.");
  }

  return currentUser;
}

async function validateSupervisorIds(
  supervisorIds: string[],
  employeeFunctionalRole:
    | "DEVELOPER"
    | "QA"
    | "DESIGNER"
    | "LOCALIZATION"
    | "DEVOPS"
    | "PROJECT_MANAGER"
    | "DIRECTOR"
    | "BILLING"
    | "OTHER"
    | null,
) {
  if (supervisorIds.length === 0) return false;

  const supervisors = await db.user.findMany({
    where: {
      id: { in: supervisorIds },
      isActive: true,
    },
    select: {
      id: true,
      userType: true,
      functionalRole: true,
    },
  });

  if (supervisors.length !== supervisorIds.length) {
    return false;
  }

  return supervisors.every((person) => {
    if (person.userType === "TEAM_LEAD") return true;
    if (
      person.userType === "MANAGER" &&
      person.functionalRole === employeeFunctionalRole
    ) {
      return true;
    }
    return false;
  });
}

export async function replaceEmployeeSupervisors(
  employeeId: string,
  supervisorIds: string[],
) {
  const actor = await requireSupervisorAssignmentAccess();

  const cleanedSupervisorIds = supervisorIds.filter(Boolean);
  assertEmployeeHasAtLeastOneSupervisor(cleanedSupervisorIds);
  assertUniqueIds(cleanedSupervisorIds, "supervisor");

  const employee = await db.user.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      userType: true,
      functionalRole: true,
    },
  });

  if (!employee || employee.userType !== "EMPLOYEE") {
    throw new Error("Selected user is not an employee.");
  }

  const valid = await validateSupervisorIds(
    cleanedSupervisorIds,
    employee.functionalRole,
  );

  if (!valid) {
    throw new Error(
      "Supervisors must be Team Leads or Managers with the same functional role as the employee.",
    );
  }

  await db.$transaction(async (tx) => {
    await tx.employeeTeamLead.deleteMany({
      where: { employeeId },
    });

    await tx.employeeTeamLead.createMany({
      data: cleanedSupervisorIds.map((teamLeadId) => ({
        employeeId,
        teamLeadId,
        assignedById: actor.id,
      })),
      skipDuplicates: true,
    });
  });

  revalidatePath("/team-lead-assignments");
  revalidatePath("/users");
  revalidatePath(`/users/${employeeId}`);
}

export async function addEmployeeSupervisor(
  employeeId: string,
  supervisorId: string,
) {
  const actor = await requireSupervisorAssignmentAccess();

  const employee = await db.user.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      userType: true,
      functionalRole: true,
    },
  });

  if (!employee || employee.userType !== "EMPLOYEE") {
    throw new Error("Selected user is not an employee.");
  }

  const valid = await validateSupervisorIds(
    [supervisorId],
    employee.functionalRole,
  );

  if (!valid) {
    throw new Error(
      "Selected supervisor must be a Team Lead or a Manager with the same functional role as the employee.",
    );
  }

  await db.employeeTeamLead.upsert({
    where: {
      employeeId_teamLeadId: {
        employeeId,
        teamLeadId: supervisorId,
      },
    },
    create: {
      employeeId,
      teamLeadId: supervisorId,
      assignedById: actor.id,
    },
    update: {
      assignedById: actor.id,
    },
  });

  revalidatePath("/team-lead-assignments");
  revalidatePath("/users");
  revalidatePath(`/users/${employeeId}`);
}

export async function removeEmployeeSupervisor(
  employeeId: string,
  supervisorId: string,
) {
  await requireSupervisorAssignmentAccess();

  const remainingAssignments = await db.employeeTeamLead.findMany({
    where: { employeeId },
    select: { teamLeadId: true },
  });

  const remainingSupervisorIds = remainingAssignments
    .map((row) => row.teamLeadId)
    .filter((id) => id !== supervisorId);

  assertEmployeeHasAtLeastOneSupervisor(remainingSupervisorIds);

  await db.employeeTeamLead.delete({
    where: {
      employeeId_teamLeadId: {
        employeeId,
        teamLeadId: supervisorId,
      },
    },
  });

  revalidatePath("/team-lead-assignments");
  revalidatePath("/users");
  revalidatePath(`/users/${employeeId}`);
}