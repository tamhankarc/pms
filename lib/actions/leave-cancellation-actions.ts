"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { isHR } from "@/lib/permissions";
import { getIstDateKey } from "@/lib/ist";
import {
  recalculateFutureAllocationsForUser,
  reverseProcessedAllocation,
  syncRequestAggregates,
  lockUserLeaveTimeline,
} from "@/lib/leave-system";

function revalidateLeavePaths() {
  revalidatePath("/leave-requests");
  revalidatePath("/leave-approvals");
  revalidatePath("/leave-admin");
  revalidatePath("/leave-admin/cancellations");
  revalidatePath("/leave-admin/leave-ledger");
  revalidatePath("/dashboard");
  revalidatePath("/hr-reports");
}

export async function reviewLeaveCancellationAction(formData: FormData) {
  const actor = await requireUserForAction();
  if (!isHR(actor))
    throw new Error("Only Administration/HR can review leave cancellations.");

  const id = String(formData.get("id") || "").trim();
  const decision = String(formData.get("decision") || "")
    .trim()
    .toUpperCase();
  const reviewNote = String(formData.get("reviewNote") || "").trim();
  const confirmedKeepProcessedDates =
    String(formData.get("confirmKeepProcessedDates") || "").trim() === "YES";
  const restoreDateKeys = Array.from(
    new Set(formData.getAll("restoreDateKeys").map(String).filter(Boolean)),
  );

  if (!id) throw new Error("Cancellation request is required.");
  if (!['APPROVED', 'REJECTED'].includes(decision))
    throw new Error("Invalid cancellation review action.");
  await db.$transaction(async (tx) => {
    const initial = await tx.leaveCancellationRequest.findUnique({
      where: { id },
      include: { leaveRequest: { select: { userId: true } } },
    });
    if (!initial) throw new Error("Cancellation request not found.");
    await lockUserLeaveTimeline(tx, initial.leaveRequest.userId);
    const cancellation = await tx.leaveCancellationRequest.findUnique({
      where: { id },
      include: {
        leaveRequest: {
          include: {
            dateAllocations: { orderBy: { leaveDate: "asc" } },
          },
        },
      },
    });
    if (!cancellation || cancellation.status !== "PENDING") {
      throw new Error("Pending cancellation request not found.");
    }

    if (decision === "REJECTED") {
      await tx.leaveCancellationRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewedById: actor.id,
          reviewNote: reviewNote || null,
          reviewedAt: new Date(),
        },
      });
      return;
    }

    const request = cancellation.leaveRequest;
    if (["PENDING", "RECONSIDER"].includes(request.status)) {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      await tx.leaveCancellationRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: actor.id,
          reviewNote: reviewNote || null,
          restoredProcessedDateKeysJson: JSON.stringify([]),
          reviewedAt: new Date(),
        },
      });
      return;
    }

    const processedAllocations = request.dateAllocations.filter(
      (row) => row.status === "PROCESSED",
    );
    const nonSandwichAllocations = request.dateAllocations.filter(
      (row) => !row.isSandwichDay,
    );
    const isSingleDateLeave =
      nonSandwichAllocations.length === 1 &&
      Number(nonSandwichAllocations[0]?.duration ?? 0) <= 1;
    const autoRestoreAllocation =
      isSingleDateLeave &&
      processedAllocations.length === 1 &&
      processedAllocations[0]?.id === nonSandwichAllocations[0]?.id
        ? processedAllocations[0]
        : null;
    const effectiveRestoreDateKeys = Array.from(
      new Set([
        ...restoreDateKeys,
        ...(autoRestoreAllocation
          ? [getIstDateKey(autoRestoreAllocation.leaveDate)]
          : []),
      ]),
    );

    if (effectiveRestoreDateKeys.length && !reviewNote) {
      throw new Error(
        "A review note is required when restoring any processed leave date.",
      );
    }

    const allowedRestoreKeys = new Set(
      processedAllocations.map((row) => getIstDateKey(row.leaveDate)),
    );
    for (const key of effectiveRestoreDateKeys) {
      if (!allowedRestoreKeys.has(key))
        throw new Error(`Leave date ${key} is not available for restoration.`);
    }

    const scheduledBeforeCancellation = request.dateAllocations.filter(
      (row) => row.status === "SCHEDULED",
    ).length;
    if (
      scheduledBeforeCancellation === 0 &&
      effectiveRestoreDateKeys.length === 0
    ) {
      throw new Error(
        "This leave has no future dates to cancel. Select at least one processed date to restore, or reject the cancellation request.",
      );
    }
    if (
      processedAllocations.length > 0 &&
      scheduledBeforeCancellation > 0 &&
      effectiveRestoreDateKeys.length === 0 &&
      !confirmedKeepProcessedDates
    ) {
      throw new Error(
        "Confirm that the processed dates should remain recorded as leave before approving this cancellation.",
      );
    }

    await tx.leaveDateAllocation.updateMany({
      where: {
        leaveRequestId: request.id,
        status: "SCHEDULED",
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        note: `Cancellation approved by HR${reviewNote ? `: ${reviewNote}` : "."}`,
      },
    });

    for (const row of request.dateAllocations) {
      const dateKey = getIstDateKey(row.leaveDate);
      if (
        row.status === "PROCESSED" &&
        effectiveRestoreDateKeys.includes(dateKey)
      ) {
        await reverseProcessedAllocation(tx, {
          allocationId: row.id,
          actorId: actor.id,
          note: reviewNote,
        });
      }
    }

    const remainingProcessed = await tx.leaveDateAllocation.count({
      where: { leaveRequestId: request.id, status: "PROCESSED" },
    });
    const remainingScheduled = await tx.leaveDateAllocation.count({
      where: { leaveRequestId: request.id, status: "SCHEDULED" },
    });
    await tx.leaveRequest.update({
      where: { id: request.id },
      data: {
        status:
          remainingProcessed > 0
            ? "PARTIALLY_CANCELLED"
            : remainingScheduled > 0
              ? "APPROVED"
              : "CANCELLED",
        cancelledAt: remainingScheduled === 0 ? new Date() : null,
      },
    });
    await syncRequestAggregates(tx, request.id);
    await recalculateFutureAllocationsForUser(
      tx,
      request.userId,
      getIstDateKey(),
    );
    await tx.leaveCancellationRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedById: actor.id,
        reviewNote: reviewNote || null,
        restoredProcessedDateKeysJson: JSON.stringify(
          effectiveRestoreDateKeys,
        ),
        reviewedAt: new Date(),
      },
    });
  });

  revalidateLeavePaths();
  revalidatePath(`/leave-admin/cancellations/${id}`);
}
