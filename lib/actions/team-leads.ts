'use server';

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canAssignTeamLeads } from "@/lib/permissions";
import {
  assertEmployeeHasAtLeastOneTeamLead,
  assertUniqueIds,
} from "@/lib/domain/rules";

export async function assignTeamLeadsToEmployee(
  employeeId: string,
  teamLeadIds: string[],
) {
  const currentUser = await requireUser();

  if (!canAssignTeamLeads(currentUser)) {
    throw new Error("Only Admin/Manager can assign Team Leads.");
  }

  assertEmployeeHasAtLeastOneTeamLead(teamLeadIds);
  assertUniqueIds(teamLeadIds, "team lead");

  return db.$transaction(async (tx) => {
    await tx.employeeTeamLead.deleteMany({ where: { employeeId } });

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