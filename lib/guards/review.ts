import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth-types";
import {
  canComprehensivelyModerateProject,
  isManager,
  isTeamLead,
} from "@/lib/permissions";

export async function assertCanReviewEmployeeOrThrow(
  currentUser: CurrentUser,
  employeeId: string,
) {
  if (canComprehensivelyModerateProject(currentUser)) {
    return true;
  }

  if (!isTeamLead(currentUser) && !isManager(currentUser)) {
    throw new Error("You are not allowed to review this employee's work.");
  }

  const employee = await db.user.findUnique({
    where: { id: employeeId },
    select: { id: true, functionalRole: true },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  const assignment = await db.employeeTeamLead.findUnique({
    where: {
      employeeId_teamLeadId: {
        employeeId,
        teamLeadId: currentUser.id,
      },
    },
    select: { employeeId: true },
  });

  if (!assignment) {
    throw new Error("You can review only employees assigned to you.");
  }

  if (
    currentUser.functionalRole &&
    currentUser.functionalRole !== "UNASSIGNED" &&
    employee.functionalRole !== currentUser.functionalRole
  ) {
    throw new Error("You can review only employees with a matching functional role.");
  }

  return true;
}

export async function assertCanReviewEstimateOrThrow(
  currentUser: CurrentUser,
  estimateId: string,
) {
  const estimate = await db.estimate.findUnique({
    where: { id: estimateId },
    select: { id: true, employeeId: true, projectId: true },
  });

  if (!estimate) {
    throw new Error("Estimate not found.");
  }

  await assertCanReviewEmployeeOrThrow(currentUser, estimate.employeeId);
  return estimate;
}

export async function assertCanReviewTimeEntryOrThrow(
  currentUser: CurrentUser,
  timeEntryId: string,
) {
  const timeEntry = await db.timeEntry.findUnique({
    where: { id: timeEntryId },
    select: { id: true, employeeId: true, projectId: true },
  });

  if (!timeEntry) {
    throw new Error("Time entry not found.");
  }

  await assertCanReviewEmployeeOrThrow(currentUser, timeEntry.employeeId);
  return timeEntry;
}
