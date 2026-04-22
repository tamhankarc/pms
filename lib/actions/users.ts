"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";
import {
  assertEmployeeHasAtLeastOneSupervisor,
  assertUniqueIds,
} from "@/lib/domain/rules";

type FunctionalRole =
  | "DEVELOPER"
  | "QA"
  | "DESIGNER"
  | "LOCALIZATION"
  | "DEVOPS"
  | "PROJECT_MANAGER"
  | "DIRECTOR"
  | "BILLING"
  | "OTHER";

type CreateEmployeeInput = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  functionalRole: FunctionalRole;
  supervisorIds: string[];
  phoneNumber?: string;
};

async function validateSupervisors(
  supervisorIds: string[],
  employeeFunctionalRole: FunctionalRole,
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

export async function createEmployee(input: CreateEmployeeInput) {
  const currentUser = await requireUserTypes(["ADMIN", "MANAGER"]);

  assertEmployeeHasAtLeastOneSupervisor(input.supervisorIds);
  assertUniqueIds(input.supervisorIds, "supervisor");

  const valid = await validateSupervisors(
    input.supervisorIds,
    input.functionalRole,
  );

  if (!valid) {
    throw new Error(
      "Supervisors must be Team Leads or Managers with the same functional role as the employee.",
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  return db.$transaction(async (tx) => {
    const employee = await tx.user.create({
      data: {
        fullName: input.fullName,
        username: input.username.toLowerCase(),
        email: input.email.toLowerCase(),
        passwordHash,
        userType: "EMPLOYEE",
        functionalRole: input.functionalRole,
        phoneNumber: input.phoneNumber || null,
      },
    });

    await tx.employeeTeamLead.createMany({
      data: input.supervisorIds.map((teamLeadId) => ({
        employeeId: employee.id,
        teamLeadId,
        assignedById: currentUser.id,
      })),
      skipDuplicates: true,
    });

    return employee;
  });
}

export async function updateEmployeeTeamLeads(
  employeeId: string,
  supervisorIds: string[],
) {
  const currentUser = await requireUserTypes(["ADMIN", "MANAGER"]);

  assertEmployeeHasAtLeastOneSupervisor(supervisorIds);
  assertUniqueIds(supervisorIds, "supervisor");

  return db.$transaction(async (tx) => {
    const employee = await tx.user.findUnique({
      where: { id: employeeId },
      select: { id: true, userType: true, functionalRole: true },
    });

    if (!employee || employee.userType !== "EMPLOYEE") {
      throw new Error("Employee not found.");
    }

    const valid = await validateSupervisors(
      supervisorIds,
      employee.functionalRole ?? "OTHER",
    );

    if (!valid) {
      throw new Error(
        "Supervisors must be Team Leads or Managers with the same functional role as the employee.",
      );
    }

    await tx.employeeTeamLead.deleteMany({
      where: { employeeId },
    });

    await tx.employeeTeamLead.createMany({
      data: supervisorIds.map((teamLeadId) => ({
        employeeId,
        teamLeadId,
        assignedById: currentUser.id,
      })),
      skipDuplicates: true,
    });

    return { success: true };
  });
}