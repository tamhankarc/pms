"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import {
  canAccessLeaveRequests,
  canAssignApprovers,
  isAdmin,
  isHR,
} from "@/lib/permissions";
import {
  getIstDateKey,
} from "@/lib/ist";
import {
  getEligibleEmployeeIdsForGlobalApproverAssignment,
  isLeaveAllowedUser,
  areValidLeaveRequestApproversForUser,
} from "@/lib/ems-queries";
import {
  sendLeaveCancellationRequestedEmail,
  sendLeaveRequestStatusEmail,
  sendLeaveRequestSubmittedEmail,
} from "@/lib/mail/leave-mail";
import {
  createAllocationRowsForApprovedRequest,
  applyManualOverrideToRequestAllocations,
  ensureSandwichAllocationsForRequest,
  processDueLeaveAllocationsForUser,
  recalculateFutureAllocationsForUser,
  syncRequestAggregates,
  validateManualOverrideForRequest,
  getWorkingDateSpecs,
  lockUserLeaveTimeline,
  ensureQuarterlyCreditForUser,
  isLeaveStartWithinPastCancellationWindow,
  previewLeaveRequestAllocation,
} from "@/lib/leave-system";
import { getCurrentQuarterStartDateKey } from "@/lib/quarterly-casual-leaves";

const leaveSchema = z.object({
  id: z.string().optional(),
  requestedForUserId: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().trim().min(1, "Reason is required.").max(3000),
  approverIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one approver."),
  diwaliLeave: z.enum(["true", "false"]).optional(),
  daySelectionMode: z
    .enum(["FULL_DAYS", "HALF_DAYS", "CUSTOM"])
    .default("FULL_DAYS"),
  leaveDayTypesJson: z.string().optional(),
  manualOverrideEnabled: z.enum(["true", "false"]).optional(),
  manualCasualDays: z.coerce.number().min(0).optional(),
  manualEarnedDays: z.coerce.number().min(0).optional(),
  manualUnpaidDays: z.coerce.number().min(0).optional(),
  manualOverrideNote: z.string().trim().max(3000).optional(),
});

type DaySelectionMode = "FULL_DAYS" | "HALF_DAYS" | "CUSTOM";

function parseDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00+05:30`);
  const end = new Date(`${endDate}T23:59:59+05:30`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    throw new Error("Invalid leave dates.");
  if (end < start) throw new Error("End date cannot be before start date.");
  return { start, end };
}

async function validateNoOverlappingLeaveRequest(
  client: Pick<Prisma.TransactionClient, "leaveRequest">,
  userId: string,
  start: Date,
  end: Date,
  excludeRequestId?: string,
) {
  const overlapping = await client.leaveRequest.findFirst({
    where: {
      userId,
      status: { notIn: ["REJECTED", "CANCELLED"] },
      startDate: { lte: end },
      endDate: { gte: start },
      ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
    },
    select: {
      startDate: true,
      endDate: true,
      status: true,
    },
    orderBy: { startDate: "asc" },
  });
  if (overlapping) {
    throw new Error(
      `A ${overlapping.status.toLowerCase()} leave request already overlaps the selected dates (${getIstDateKey(overlapping.startDate)} to ${getIstDateKey(overlapping.endDate)}).`,
    );
  }
}

function buildReason(reason: string, diwaliLeave?: string) {
  const normalizedReason = reason.trim();
  return diwaliLeave === "true"
    ? `Diwali Leave: Yes\n${normalizedReason}`
    : normalizedReason;
}

function validateStartDateNotInPast(startDate: string) {
  if (startDate < getIstDateKey())
    throw new Error("Start date cannot be in the past.");
}

async function getRequestEmployee(
  actor: Awaited<ReturnType<typeof requireUserForAction>>,
  requestedForUserId?: string,
) {
  const canCreateOnBehalf = isHR(actor) || isAdmin(actor);
  const targetUserId =
    canCreateOnBehalf && requestedForUserId ? requestedForUserId : actor.id;
  if (!canCreateOnBehalf && targetUserId !== actor.id)
    throw new Error(
      "Only Admin or Administration/HR can submit leave requests on behalf of another user.",
    );
  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      fullName: true,
      isActive: true,
      userType: true,
      functionalRole: true,
    },
  });
  if (!target || !isLeaveAllowedUser(target)) {
    throw new Error("Selected user is not eligible for leave requests.");
  }
  return target;
}

async function validateBoundaryDates(
  client: Prisma.TransactionClient,
  startDate: string,
  endDate: string,
  userId: string,
  mode: DaySelectionMode = "FULL_DAYS",
  rawDayTypes?: string,
) {
  const { start, end } = parseDateRange(startDate, endDate);
  const { specs } = await getWorkingDateSpecs(client, {
    userId,
    startDate: start,
    endDate: end,
    daySelectionMode: mode,
    leaveDayTypesJson: rawDayTypes,
  });
  const workingKeys = new Set(specs.map((spec) => spec.dateKey));
  if (!workingKeys.has(startDate))
    throw new Error(
      "Start date cannot be a Saturday, Sunday, or official holiday.",
    );
  if (!workingKeys.has(endDate))
    throw new Error(
      "End date cannot be a Saturday, Sunday, or official holiday.",
    );
}

async function computeRequestedLeaveDetails(
  client: Prisma.TransactionClient,
  startDateKey: string,
  endDateKey: string,
  userId: string,
  mode: DaySelectionMode,
  rawDayTypes?: string,
) {
  const { start, end } = parseDateRange(startDateKey, endDateKey);
  const { specs } = await getWorkingDateSpecs(client, {
    userId,
    startDate: start,
    endDate: end,
    daySelectionMode: mode,
    leaveDayTypesJson: rawDayTypes,
  });
  if (!specs.length)
    throw new Error("Selected range has no working leave days.");
  return {
    year: specs[0].year,
    requestedLeaveDays: specs.reduce((sum, spec) => sum + spec.duration, 0),
    daySelectionMode: mode,
    leaveDayTypesJson: JSON.stringify(
      Object.fromEntries(specs.map((spec) => [spec.dateKey, spec.dayPart])),
    ),
  };
}

async function sendSubmittedMailWithoutRollingBack(
  requestId: string,
  type: "new" | "updated",
) {
  try {
    await sendLeaveRequestSubmittedEmail(requestId, type);
  } catch (error) {
    console.error("Unable to send leave request notification email", error);
  }
}

async function sendStatusMailWithoutRollingBack(
  requestId: string,
  decision: "APPROVED" | "REJECTED" | "RECONSIDER",
  name: string,
) {
  try {
    await sendLeaveRequestStatusEmail(requestId, decision, name);
  } catch (error) {
    console.error("Unable to send leave request status email", error);
  }
}

async function sendCancellationMailWithoutRollingBack(
  cancellationRequestId: string,
) {
  try {
    await sendLeaveCancellationRequestedEmail(cancellationRequestId);
  } catch (error) {
    console.error("Unable to send leave cancellation notification email", error);
  }
}

export type LeaveFormState = { success?: boolean; error?: string };

export async function createLeaveRequestAction(
  _prevState: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  try {
    const actor = await requireUserForAction();
    if (!canAccessLeaveRequests(actor) && !isAdmin(actor) && !isHR(actor)) {
      return {
        success: false,
        error: "You do not have access to leave requests.",
      };
    }

    const parsed = leaveSchema.safeParse({
      requestedForUserId: formData.get("requestedForUserId") || undefined,
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      reason: formData.get("reason") || "",
      approverIds: formData.getAll("approverIds").map(String).filter(Boolean),
      diwaliLeave: formData.get("diwaliLeave") === "on" ? "true" : "false",
      daySelectionMode: formData.get("daySelectionMode") || "FULL_DAYS",
      leaveDayTypesJson: formData.get("leaveDayTypesJson") || undefined,
      manualOverrideEnabled:
        formData.get("manualOverrideEnabled") === "true" ? "true" : "false",
      manualCasualDays: formData.get("manualCasualDays") || undefined,
      manualEarnedDays: formData.get("manualEarnedDays") || undefined,
      manualUnpaidDays: formData.get("manualUnpaidDays") || undefined,
      manualOverrideNote: formData.get("manualOverrideNote") || undefined,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid leave request.",
      };
    }

    const employee = await getRequestEmployee(
      actor,
      parsed.data.requestedForUserId,
    );
    if (
      !(await areValidLeaveRequestApproversForUser(
        employee.id,
        parsed.data.approverIds,
      ))
    ) {
      return {
        success: false,
        error:
          "One or more selected approvers are not available for this employee.",
      };
    }

    const isPrivilegedCreatingForAnotherEmployee =
      (isHR(actor) || isAdmin(actor)) && employee.id !== actor.id;
    if (!isPrivilegedCreatingForAnotherEmployee) {
      validateStartDateNotInPast(parsed.data.startDate);
    }

    const isBackdated = parsed.data.startDate < getIstDateKey();
    const useManualOverride =
      isHR(actor) &&
      isBackdated &&
      parsed.data.manualOverrideEnabled === "true";
    const manualAllocationOverrideJson = useManualOverride
      ? JSON.stringify({
          casualDays: parsed.data.manualCasualDays ?? 0,
          earnedDays: parsed.data.manualEarnedDays ?? 0,
          unpaidDays: parsed.data.manualUnpaidDays ?? 0,
        })
      : null;
    const manualOverrideNote = useManualOverride
      ? parsed.data.manualOverrideNote?.trim() || null
      : null;
    const { start, end } = parseDateRange(
      parsed.data.startDate,
      parsed.data.endDate,
    );

    const request = await db.$transaction(async (tx) => {
      // Uses the same per-employee lock as employment-status changes,
      // approvals, cancellations and the daily processor. This prevents a
      // request from being created against stale leave eligibility or balance.
      await lockUserLeaveTimeline(tx, employee.id);

      const currentEmployee = await tx.user.findUnique({
        where: { id: employee.id },
        select: {
          id: true,
          fullName: true,
          isActive: true,
          userType: true,
          functionalRole: true,
        },
      });
      if (!currentEmployee || !isLeaveAllowedUser(currentEmployee)) {
        throw new Error("Selected user is not eligible for leave requests.");
      }

      await validateBoundaryDates(
        tx,
        parsed.data.startDate,
        parsed.data.endDate,
        employee.id,
        parsed.data.daySelectionMode,
        parsed.data.leaveDayTypesJson,
      );
      await validateNoOverlappingLeaveRequest(
        tx,
        employee.id,
        start,
        end,
      );
      const requestDetails = await computeRequestedLeaveDetails(
        tx,
        parsed.data.startDate,
        parsed.data.endDate,
        employee.id,
        parsed.data.daySelectionMode,
        parsed.data.leaveDayTypesJson,
      );

      const candidate = {
        userId: employee.id,
        startDate: start,
        endDate: end,
        daySelectionMode: requestDetails.daySelectionMode,
        leaveDayTypesJson: requestDetails.leaveDayTypesJson,
        manualAllocationOverrideJson,
        manualOverrideNote,
      };
      await validateManualOverrideForRequest(tx, candidate);
      // Preliminary validation is calculated against the complete approved
      // future timeline, including guaranteed quarterly Casual credits. The
      // authoritative calculation is repeated when the approver approves it.
      await previewLeaveRequestAllocation(tx, candidate);

      return tx.leaveRequest.create({
        data: {
          userId: employee.id,
          createdById: actor.id,
          // The final Casual/Earned/Unpaid breakup is assigned only on approval.
          leaveType: "UNPAID",
          startDate: start,
          endDate: end,
          reason: buildReason(parsed.data.reason, parsed.data.diwaliLeave),
          approverId: parsed.data.approverIds[0] ?? null,
          selectedApprovers: {
            create: parsed.data.approverIds.map((approverId) => ({ approverId })),
          },
          daySelectionMode: requestDetails.daySelectionMode,
          leaveDayTypesJson: requestDetails.leaveDayTypesJson,
          totalLeaveDays: new Prisma.Decimal(
            requestDetails.requestedLeaveDays.toFixed(2),
          ),
          casualDaysUsed: new Prisma.Decimal(0),
          earnedDaysUsed: new Prisma.Decimal(0),
          unpaidDaysUsed: new Prisma.Decimal(0),
          manualAllocationOverrideJson,
          manualOverrideNote,
        },
      });
    });

    await sendSubmittedMailWithoutRollingBack(request.id, "new");
    revalidatePath("/leave-requests");
    revalidatePath("/leave-requests/new");
    revalidatePath("/dashboard");
    revalidatePath("/leave-approvals");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function updateLeaveRequestAction(
  _prevState: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  try {
    const actor = await requireUserForAction();
    const parsed = leaveSchema.extend({ id: z.string().min(1) }).safeParse({
      id: formData.get("id"),
      requestedForUserId: formData.get("requestedForUserId") || undefined,
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      reason: formData.get("reason") || "",
      approverIds: formData.getAll("approverIds").map(String).filter(Boolean),
      diwaliLeave: formData.get("diwaliLeave") === "on" ? "true" : "false",
      daySelectionMode: formData.get("daySelectionMode") || "FULL_DAYS",
      leaveDayTypesJson: formData.get("leaveDayTypesJson") || undefined,
      manualOverrideEnabled: "false",
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid leave request.",
      };
    }

    const existing = await db.leaveRequest.findUnique({
      where: { id: parsed.data.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            isActive: true,
            userType: true,
            functionalRole: true,
          },
        },
      },
    });
    if (
      !existing ||
      (existing.userId !== actor.id && !isHR(actor) && !isAdmin(actor))
    ) {
      return { success: false, error: "Leave request not found." };
    }
    if (existing.status !== "RECONSIDER") {
      return {
        success: false,
        error: "Only leave requests marked for reconsider can be edited.",
      };
    }
    if (
      !isLeaveAllowedUser(existing.user) ||
      ["ADMIN", "ACCOUNTS", "OPERATIONS"].includes(existing.user.userType)
    ) {
      return {
        success: false,
        error: "Selected user is not eligible for leave requests.",
      };
    }
    if (
      !(await areValidLeaveRequestApproversForUser(
        existing.userId,
        parsed.data.approverIds,
      ))
    ) {
      return {
        success: false,
        error:
          "One or more selected approvers are not available for this employee.",
      };
    }

    validateStartDateNotInPast(parsed.data.startDate);
    const { start, end } = parseDateRange(
      parsed.data.startDate,
      parsed.data.endDate,
    );

    const request = await db.$transaction(async (tx) => {
      await lockUserLeaveTimeline(tx, existing.userId);
      const current = await tx.leaveRequest.findUnique({
        where: { id: parsed.data.id },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              isActive: true,
              userType: true,
              functionalRole: true,
            },
          },
        },
      });
      if (!current || current.status !== "RECONSIDER") {
        throw new Error(
          "This leave request is no longer available for reconsideration.",
        );
      }
      if (!isLeaveAllowedUser(current.user)) {
        throw new Error("Selected user is not eligible for leave requests.");
      }

      await validateBoundaryDates(
        tx,
        parsed.data.startDate,
        parsed.data.endDate,
        current.userId,
        parsed.data.daySelectionMode,
        parsed.data.leaveDayTypesJson,
      );
      await validateNoOverlappingLeaveRequest(
        tx,
        current.userId,
        start,
        end,
        parsed.data.id,
      );
      const requestDetails = await computeRequestedLeaveDetails(
        tx,
        parsed.data.startDate,
        parsed.data.endDate,
        current.userId,
        parsed.data.daySelectionMode,
        parsed.data.leaveDayTypesJson,
      );
      await previewLeaveRequestAllocation(tx, {
        userId: current.userId,
        startDate: start,
        endDate: end,
        daySelectionMode: requestDetails.daySelectionMode,
        leaveDayTypesJson: requestDetails.leaveDayTypesJson,
        manualAllocationOverrideJson: null,
        manualOverrideNote: null,
      });

      return tx.leaveRequest.update({
        where: { id: parsed.data.id },
        data: {
          // Final paid/unpaid allocation is recalculated only when approved.
          leaveType: "UNPAID",
          startDate: start,
          endDate: end,
          reason: buildReason(parsed.data.reason, parsed.data.diwaliLeave),
          approverId: parsed.data.approverIds[0] ?? null,
          selectedApprovers: {
            deleteMany: {},
            create: parsed.data.approverIds.map((approverId) => ({ approverId })),
          },
          status: "PENDING",
          reconsiderNote: null,
          rejectedAt: null,
          reconsideredAt: new Date(),
          daySelectionMode: requestDetails.daySelectionMode,
          leaveDayTypesJson: requestDetails.leaveDayTypesJson,
          totalLeaveDays: new Prisma.Decimal(
            requestDetails.requestedLeaveDays.toFixed(2),
          ),
          casualDaysUsed: new Prisma.Decimal(0),
          earnedDaysUsed: new Prisma.Decimal(0),
          unpaidDaysUsed: new Prisma.Decimal(0),
          manualAllocationOverrideJson: null,
          manualOverrideNote: null,
        },
      });
    });

    await sendSubmittedMailWithoutRollingBack(request.id, "updated");
    revalidatePath("/leave-requests");
    revalidatePath(`/leave-requests/${parsed.data.id}/edit`);
    revalidatePath("/leave-approvals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function deleteLeaveRequestAction(formData: FormData) {
  const user = await requireUserForAction();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Leave request is required.");
  const existing = await db.leaveRequest.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) throw new Error("Leave request not found.");
  if (existing.status !== "REJECTED") {
    throw new Error(
      "Active leave requests must be cancelled through the HR cancellation workflow. Only rejected requests can be deleted.",
    );
  }
  await db.leaveRequest.delete({ where: { id } });
  revalidatePath("/leave-requests");
  revalidatePath("/leave-approvals");
  revalidatePath("/dashboard");
}

export async function cancelLeaveRequestAction(formData: FormData) {
  const actor = await requireUserForAction();
  const id = String(formData.get("id") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!id) throw new Error("Leave request is required.");
  if (!reason) throw new Error("Cancellation reason is required.");

  const existing = await db.leaveRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Leave request not found.");
  const canRequest =
    existing.userId === actor.id || isAdmin(actor) || isHR(actor);
  if (!canRequest)
    throw new Error("You cannot request cancellation for this leave.");

  const cancellationRequestId = await db.$transaction(async (tx) => {
    await lockUserLeaveTimeline(tx, existing.userId);
    const current = await tx.leaveRequest.findUnique({ where: { id } });
    if (!current) throw new Error("Leave request not found.");
    if (
      !["PENDING", "RECONSIDER", "APPROVED", "PARTIALLY_CANCELLED"].includes(
        current.status,
      )
    ) {
      throw new Error("This leave request cannot be cancelled.");
    }

    const todayDateKey = getIstDateKey();
    const isPastLeave = getIstDateKey(current.endDate) < todayDateKey;
    const isEmployeeSelfServiceRequest =
      current.userId === actor.id && !isAdmin(actor) && !isHR(actor);

    if (
      isEmployeeSelfServiceRequest &&
      isPastLeave &&
      !isLeaveStartWithinPastCancellationWindow(
        current.startDate,
        todayDateKey,
      )
    ) {
      throw new Error(
        "Cancellation can be requested only within 10 days of the leave start date.",
      );
    }

    const pendingCancellation = await tx.leaveCancellationRequest.findFirst({
      where: { leaveRequestId: id, status: "PENDING" },
      select: { id: true },
    });
    if (pendingCancellation) {
      throw new Error("A cancellation request is already awaiting HR review.");
    }
    const cancellationRequest = await tx.leaveCancellationRequest.create({
      data: {
        leaveRequestId: id,
        requestedById: actor.id,
        reason,
      },
      select: { id: true },
    });
    return cancellationRequest.id;
  });
  await sendCancellationMailWithoutRollingBack(cancellationRequestId);
  revalidatePath("/leave-requests");
  revalidatePath("/leave-admin/cancellations");
  revalidatePath("/dashboard");
}

export async function reviewLeaveRequestAction(formData: FormData) {
  const user = await requireUserForAction();
  const id = String(formData.get("id") || "").trim();
  const decision = String(formData.get("decision") || "")
    .trim()
    .toUpperCase();
  const comment = String(formData.get("comment") || "").trim();
  if (!id) throw new Error("Leave request is required.");
  if (!["APPROVED", "REJECTED", "RECONSIDER"].includes(decision))
    throw new Error("Invalid leave review action.");
  const existing = await db.leaveRequest.findUnique({
    where: { id },
    include: {
      selectedApprovers: { select: { approverId: true } },
      cancellationRequests: {
        where: { status: "PENDING" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!existing) throw new Error("Leave request not found.");
  if (existing.status !== "PENDING")
    throw new Error("Only pending leave requests can be reviewed.");
  if (existing.cancellationRequests.length) {
    throw new Error(
      "This request has a cancellation awaiting HR review and cannot be reviewed by the designated approver.",
    );
  }
  const assigned = Boolean(
    await db.leaveApproverAssignment.findFirst({
      where: { approverId: user.id },
      select: { id: true },
    }),
  );
  const adminPmApprover =
    user.userType === "ADMIN" &&
    user.functionalRole === "PROJECT_MANAGER" &&
    assigned;
  const selectedApproverIds = existing.selectedApprovers.map(
    (row) => row.approverId,
  );
  if (
    !(
      selectedApproverIds.includes(user.id) ||
      existing.approverId === user.id ||
      adminPmApprover
    )
  )
    throw new Error(
      "Only one of the selected approvers or an Admin user with functional role Project Manager who is included in the approver list can approve, reject, or reconsider this leave request.",
    );
  if (decision === "APPROVED") {
    await db.$transaction(async (tx) => {
      await lockUserLeaveTimeline(tx, existing.userId);
      const pendingCancellation = await tx.leaveCancellationRequest.findFirst({
        where: { leaveRequestId: id, status: "PENDING" },
        select: { id: true },
      });
      if (pendingCancellation) {
        throw new Error(
          "This request has a cancellation awaiting HR review and cannot be approved.",
        );
      }
      const claimed = await tx.leaveRequest.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "APPROVED",
          approverId: user.id,
          approverComment: comment || null,
          approvedAt: new Date(),
          rejectedAt: null,
          reconsiderNote: null,
        },
      });
      if (claimed.count !== 1) {
        throw new Error("This leave request has already been reviewed.");
      }
      const approvedRequest = await tx.leaveRequest.findUnique({ where: { id } });
      if (!approvedRequest) throw new Error("Leave request not found.");
      const approvalDateKey = getIstDateKey();
      await ensureQuarterlyCreditForUser(tx, {
        userId: approvedRequest.userId,
        dateKey: getCurrentQuarterStartDateKey(approvalDateKey),
        actorId: user.id,
        source: "APPROVAL_PREPARATION",
      });
      await validateManualOverrideForRequest(tx, approvedRequest);
      await createAllocationRowsForApprovedRequest(tx, approvedRequest);
      await applyManualOverrideToRequestAllocations(tx, approvedRequest, user.id);
      await processDueLeaveAllocationsForUser(tx, {
        userId: approvedRequest.userId,
        throughDateKey: approvalDateKey,
        actorId: user.id,
        approvalRequestId: approvedRequest.id,
      });
      await ensureSandwichAllocationsForRequest(
        tx,
        approvedRequest,
        approvalDateKey,
      );
      await processDueLeaveAllocationsForUser(tx, {
        userId: approvedRequest.userId,
        throughDateKey: approvalDateKey,
        actorId: user.id,
        approvalRequestId: approvedRequest.id,
      });
      await recalculateFutureAllocationsForUser(
        tx,
        approvedRequest.userId,
        approvalDateKey,
      );
      await syncRequestAggregates(tx, approvedRequest.id);
    });
  } else {
    const claimed = await db.leaveRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: decision as "REJECTED" | "RECONSIDER",
        approverId: user.id,
        approverComment: comment || null,
        approvedAt: null,
        rejectedAt: decision === "REJECTED" ? new Date() : null,
        reconsiderNote:
          decision === "RECONSIDER"
            ? comment || "Please update and resubmit this request."
            : null,
      },
    });
    if (claimed.count !== 1) {
      throw new Error("This leave request has already been reviewed.");
    }
  }
  await sendStatusMailWithoutRollingBack(
    id,
    decision as "APPROVED" | "REJECTED" | "RECONSIDER",
    user.fullName || user.email,
  );
  revalidatePath("/leave-approvals");
  revalidatePath("/leave-requests");
  revalidatePath("/dashboard");
}

export async function assignApproversAction(formData: FormData) {
  const user = await requireUserForAction();
  if (!canAssignApprovers(user))
    throw new Error("You do not have permission to assign approvers.");
  const approverIds = formData
    .getAll("approverIds")
    .map(String)
    .filter(Boolean);
  if (!approverIds.length) throw new Error("Select at least one approver.");
  const employeeIds = await getEligibleEmployeeIdsForGlobalApproverAssignment();
  if (!employeeIds.length)
    throw new Error("No eligible employees found for approver assignment.");
  await db.leaveApproverAssignment.deleteMany({});
  await db.leaveApproverAssignment.createMany({
    data: employeeIds.flatMap((employeeId) =>
      approverIds.map((approverId) => ({
        employeeId,
        approverId,
        createdById: user.id,
      })),
    ),
    skipDuplicates: true,
  });
  revalidatePath("/dashboard");
  revalidatePath("/leave-approvals");
  revalidatePath("/leave-requests");
  revalidatePath("/leave-requests/new");
}
