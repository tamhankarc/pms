'use server';

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertEstimatePositive } from "@/lib/domain/rules";
import { assertProjectAllowsNewEntries } from "@/lib/guards/project";
import { assertCanReviewEstimateOrThrow } from "@/lib/guards/review";

type CreateEstimateInput = {
  projectId: string;
  employeeId: string;
  countryId: string;
  workDate: string;
  estimatedMinutes: number;
  notes?: string;
};

export async function createEstimate(input: CreateEstimateInput) {
  const currentUser = await requireUser();

  await assertProjectAllowsNewEntries(input.projectId);
  assertEstimatePositive(input.estimatedMinutes);

  const allowed =
    currentUser.userType === "ADMIN" ||
    currentUser.userType === "MANAGER" ||
    currentUser.id === input.employeeId;

  if (!allowed) {
    throw new Error("You can create estimates only for yourself unless you are Admin/Manager.");
  }

  return db.estimate.create({
    data: {
      projectId: input.projectId,
      employeeId: input.employeeId,
      countryId: input.countryId,
      workDate: new Date(input.workDate),
      estimatedMinutes: input.estimatedMinutes,
      notes: input.notes || null,
      status: "SUBMITTED",
    },
  });
}

export async function reviewEstimate(
  estimateId: string,
  decisionStatus: "APPROVED" | "REJECTED" | "REVISED",
  remarks?: string,
) {
  const currentUser = await requireUser();
  const estimate = await assertCanReviewEstimateOrThrow(currentUser, estimateId);

  return db.$transaction(async (tx) => {
    await tx.estimateReview.create({
      data: {
        estimateId,
        reviewerId: currentUser.id,
        decisionStatus,
        remarks: remarks || null,
      },
    });

    await tx.estimate.update({
      where: { id: estimate.id },
      data: { status: decisionStatus },
    });

    return { success: true };
  });
}