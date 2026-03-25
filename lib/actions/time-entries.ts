'use server';

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertMinutesPositive } from "@/lib/domain/rules";
import { assertProjectAllowsNewEntries } from "@/lib/guards/project";
import { assertCanReviewTimeEntryOrThrow } from "@/lib/guards/review";

type CreateTimeEntryInput = {
  projectId: string;
  employeeId: string;
  countryId: string;
  workDate: string;
  taskName: string;
  minutesSpent: number;
  isBillable?: boolean;
  notes?: string;
};

export async function createTimeEntry(input: CreateTimeEntryInput) {
  const currentUser = await requireUser();

  await assertProjectAllowsNewEntries(input.projectId);
  assertMinutesPositive(input.minutesSpent);

  const allowed =
    currentUser.userType === "ADMIN" ||
    currentUser.userType === "MANAGER" ||
    currentUser.id === input.employeeId;

  if (!allowed) {
    throw new Error("You can create time entries only for yourself unless you are Admin/Manager.");
  }

  const taskName = input.taskName?.trim();
  if (!taskName) {
    throw new Error("Task name is required.");
  }

  return db.timeEntry.create({
    data: {
      projectId: input.projectId,
      employeeId: input.employeeId,
      countryId: input.countryId,
      workDate: new Date(input.workDate),
      taskName,
      minutesSpent: input.minutesSpent,
      isBillable: input.isBillable ?? true,
      notes: input.notes?.trim() || null,
      status: "SUBMITTED",
    },
  });
}

export async function reviewTimeEntry(
  timeEntryId: string,
  decisionStatus: "APPROVED" | "REJECTED" | "REVISED",
  remarks?: string,
) {
  const currentUser = await requireUser();
  const timeEntry = await assertCanReviewTimeEntryOrThrow(currentUser, timeEntryId);

  return db.$transaction(async (tx) => {
    await tx.timeEntryReview.create({
      data: {
        timeEntryId,
        reviewerId: currentUser.id,
        decisionStatus,
        remarks: remarks || null,
      },
    });

    await tx.timeEntry.update({
      where: { id: timeEntry.id },
      data: { status: decisionStatus },
    });

    return { success: true };
  });
}