"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";
import {
  assertEmployeeHasAtLeastOneTeamLead,
  assertUniqueIds,
} from "@/lib/domain/rules";

type CreateEmployeeInput = {
  fullName: string;
  email: string;
  password: string;
  functionalRole:
    | "DEVELOPER"
    | "QA"
    | "DESIGNER"
    | "LOCALIZATION"
    | "DEVOPS"
    | "PROJECT_MANAGER"
    | "OTHER";
  teamLeadIds: string[];
  phoneNumber?: string;
};

export async function createEmployee(input: CreateEmployeeInput) {
  const currentUser = await requireUserTypes(["ADMIN", "MANAGER"]);

  assertEmployeeHasAtLeastOneTeamLead(input.teamLeadIds);
  assertUniqueIds(input.teamLeadIds, "team lead");

  const passwordHash = await bcrypt.hash(input.password, 10);

  return db.$transaction(async (tx) => {
    const employee = await tx.user.create({
      data: {
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        passwordHash,
        userType: "EMPLOYEE",
        functionalRole: input.functionalRole,
        phoneNumber: input.phoneNumber || null,
      },
    });

    await tx.employeeTeamLead.createMany({
      data: input.teamLeadIds.map((teamLeadId) => ({
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
  teamLeadIds: string[],
) {
  const currentUser = await requireUserTypes(["ADMIN", "MANAGER"]);

  assertEmployeeHasAtLeastOneTeamLead(teamLeadIds);
  assertUniqueIds(teamLeadIds, "team lead");

  return db.$transaction(async (tx) => {
    const employee = await tx.user.findUnique({
      where: { id: employeeId },
      select: { id: true, userType: true },
    });

    if (!employee || employee.userType !== "EMPLOYEE") {
      throw new Error("Employee not found.");
    }

    await tx.employeeTeamLead.deleteMany({
      where: { employeeId },
    });

    await tx.employeeTeamLead.createMany({
      data: teamLeadIds.map((teamLeadId) => ({
        employeeId,
        teamLeadId,
        assignedById: currentUser.id,
      })),
      skipDuplicates: true,
    });

    return { success: true };
  });
}