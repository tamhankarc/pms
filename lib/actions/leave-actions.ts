"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import {
  canAccessLeaveRequests,
  canAssignApprovers,
  isHR,
} from "@/lib/permissions";
import {
  getDayBoundsUtcFromIstDateKey,
  getIstDateKey,
  isWeekendDateKey,
} from "@/lib/ist";
import {
  getEligibleEmployeeIdsForGlobalApproverAssignment,
  getOfficialHolidayDateKeysForYear,
  getOrCreateLeaveYearProfile,
  isLeaveAllowedUser,
  isValidLeaveRequestApproverForUser,
} from "@/lib/ems-queries";
import {
  sendLeaveRequestStatusEmail,
  sendLeaveRequestSubmittedEmail,
} from "@/lib/mail/leave-mail";

const leaveSchema = z.object({
  id: z.string().optional(),
  requestedForUserId: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().trim().min(1, "Reason is required.").max(3000),
  approverId: z.string().min(1, "Approver is required."),
  diwaliLeave: z.enum(["true", "false"]).optional(),
  daySelectionMode: z
    .enum(["FULL_DAYS", "HALF_DAYS", "CUSTOM"])
    .default("FULL_DAYS"),
  leaveDayTypesJson: z.string().optional(),
});

type DayDuration = "FULL_DAY" | "HALF_DAY";
type DaySelectionMode = "FULL_DAYS" | "HALF_DAYS" | "CUSTOM";

function parseDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00+05:30`);
  const end = new Date(`${endDate}T23:59:59+05:30`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    throw new Error("Invalid leave dates.");
  if (end < start) throw new Error("End date cannot be before start date.");
  return { start, end };
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
  const targetUserId =
    isHR(actor) && requestedForUserId ? requestedForUserId : actor.id;
  if (!isHR(actor) && targetUserId !== actor.id)
    throw new Error(
      "Only HR can submit leave requests on behalf of another user.",
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
  if (
    !target ||
    !isLeaveAllowedUser(target) ||
    ["ADMIN", "ACCOUNTS", "OPERATIONS"].includes(target.userType)
  ) {
    throw new Error("Selected user is not eligible for leave requests.");
  }
  return target;
}

async function getWorkingDateKeys(
  startDateKey: string,
  endDateKey: string,
  userId: string,
) {
  const year = Number(startDateKey.slice(0, 4));
  const profile = await getOrCreateLeaveYearProfile(userId, year);
  const holidayKeys = new Set(
    await getOfficialHolidayDateKeysForYear(year, profile.shift),
  );
  const keys: string[] = [];
  let cursor = startDateKey;
  while (cursor <= endDateKey) {
    if (!isWeekendDateKey(cursor) && !holidayKeys.has(cursor))
      keys.push(cursor);
    cursor = getIstDateKey(getDayBoundsUtcFromIstDateKey(cursor).endUtc);
  }
  return { profile, year, keys, holidayKeys };
}

async function validateBoundaryDates(
  startDate: string,
  endDate: string,
  userId: string,
) {
  const { holidayKeys } = await getWorkingDateKeys(startDate, endDate, userId);
  if (isWeekendDateKey(startDate) || holidayKeys.has(startDate))
    throw new Error(
      "Start date cannot be a Saturday, Sunday, or official holiday.",
    );
  if (isWeekendDateKey(endDate) || holidayKeys.has(endDate))
    throw new Error(
      "End date cannot be a Saturday, Sunday, or official holiday.",
    );
}

function parseCustomDurations(
  raw: string | undefined,
): Record<string, DayDuration> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        value === "HALF_DAY" ? "HALF_DAY" : "FULL_DAY",
      ]),
    );
  } catch {
    return {};
  }
}

async function computeLeaveBreakup(
  startDateKey: string,
  endDateKey: string,
  userId: string,
  mode: DaySelectionMode,
  rawDayTypes?: string,
) {
  const { profile, year, keys } = await getWorkingDateKeys(
    startDateKey,
    endDateKey,
    userId,
  );
  if (!keys.length)
    throw new Error("Selected range has no working leave days.");
  const custom = parseCustomDurations(rawDayTypes);
  const durationByDate: Record<string, DayDuration> = {};
  for (const key of keys) {
    durationByDate[key] =
      mode === "HALF_DAYS"
        ? "HALF_DAY"
        : mode === "CUSTOM"
          ? custom[key] || "FULL_DAY"
          : "FULL_DAY";
  }
  const totalLeaveDays = keys.reduce(
    (total, key) => total + (durationByDate[key] === "HALF_DAY" ? 0.5 : 1),
    0,
  );
  const casualAvailable = Number(profile.casualLeaves);
  const earnedAvailable = Number(profile.earnedLeaves);
  const casualDaysUsed = Math.min(casualAvailable, totalLeaveDays);
  const remainingAfterCasual = totalLeaveDays - casualDaysUsed;
  const earnedDaysUsed = Math.min(earnedAvailable, remainingAfterCasual);
  const unpaidDaysUsed = Math.max(0, remainingAfterCasual - earnedDaysUsed);
  const leaveType =
    casualDaysUsed > 0 ? "CASUAL" : earnedDaysUsed > 0 ? "EARNED" : "UNPAID";
  return {
    year,
    totalLeaveDays,
    casualDaysUsed,
    earnedDaysUsed,
    unpaidDaysUsed,
    leaveType: leaveType as "CASUAL" | "EARNED" | "UNPAID",
    daySelectionMode: mode,
    leaveDayTypesJson: JSON.stringify(durationByDate),
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

export type LeaveFormState = { success?: boolean; error?: string };

export async function createLeaveRequestAction(
  _prevState: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  try {
    const actor = await requireUserForAction();
    if (!canAccessLeaveRequests(actor))
      return {
        success: false,
        error: "You do not have access to leave requests.",
      };
    const parsed = leaveSchema.safeParse({
      requestedForUserId: formData.get("requestedForUserId") || undefined,
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      reason: formData.get("reason") || "",
      approverId: formData.get("approverId"),
      diwaliLeave: formData.get("diwaliLeave") === "on" ? "true" : "false",
      daySelectionMode: formData.get("daySelectionMode") || "FULL_DAYS",
      leaveDayTypesJson: formData.get("leaveDayTypesJson") || undefined,
    });
    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid leave request.",
      };
    const employee = await getRequestEmployee(
      actor,
      parsed.data.requestedForUserId,
    );
    if (
      !(await isValidLeaveRequestApproverForUser(
        employee.id,
        parsed.data.approverId,
      ))
    )
      return {
        success: false,
        error: "Selected approver is not available for this employee.",
      };
    validateStartDateNotInPast(parsed.data.startDate);
    await validateBoundaryDates(
      parsed.data.startDate,
      parsed.data.endDate,
      employee.id,
    );
    const { start, end } = parseDateRange(
      parsed.data.startDate,
      parsed.data.endDate,
    );
    const breakup = await computeLeaveBreakup(
      parsed.data.startDate,
      parsed.data.endDate,
      employee.id,
      parsed.data.daySelectionMode,
      parsed.data.leaveDayTypesJson,
    );
    const request = await db.leaveRequest.create({
      data: {
        userId: employee.id,
        leaveType: breakup.leaveType,
        startDate: start,
        endDate: end,
        reason: buildReason(parsed.data.reason, parsed.data.diwaliLeave),
        approverId: parsed.data.approverId,
        daySelectionMode: breakup.daySelectionMode,
        leaveDayTypesJson: breakup.leaveDayTypesJson,
        totalLeaveDays: new Prisma.Decimal(breakup.totalLeaveDays.toFixed(2)),
        casualDaysUsed: new Prisma.Decimal(breakup.casualDaysUsed.toFixed(2)),
        earnedDaysUsed: new Prisma.Decimal(breakup.earnedDaysUsed.toFixed(2)),
        unpaidDaysUsed: new Prisma.Decimal(breakup.unpaidDaysUsed.toFixed(2)),
      },
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
      approverId: formData.get("approverId"),
      diwaliLeave: formData.get("diwaliLeave") === "on" ? "true" : "false",
      daySelectionMode: formData.get("daySelectionMode") || "FULL_DAYS",
      leaveDayTypesJson: formData.get("leaveDayTypesJson") || undefined,
    });
    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid leave request.",
      };
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
    if (!existing || (existing.userId !== actor.id && !isHR(actor)))
      return { success: false, error: "Leave request not found." };
    if (existing.status !== "RECONSIDER")
      return {
        success: false,
        error: "Only leave requests marked for reconsider can be edited.",
      };
    const employee = existing.user;
    if (
      !isLeaveAllowedUser(employee) ||
      ["ADMIN", "ACCOUNTS", "OPERATIONS"].includes(employee.userType)
    )
      return {
        success: false,
        error: "Selected user is not eligible for leave requests.",
      };
    if (
      !(await isValidLeaveRequestApproverForUser(
        employee.id,
        parsed.data.approverId,
      ))
    )
      return {
        success: false,
        error: "Selected approver is not available for this employee.",
      };
    validateStartDateNotInPast(parsed.data.startDate);
    await validateBoundaryDates(
      parsed.data.startDate,
      parsed.data.endDate,
      employee.id,
    );
    const { start, end } = parseDateRange(
      parsed.data.startDate,
      parsed.data.endDate,
    );
    const breakup = await computeLeaveBreakup(
      parsed.data.startDate,
      parsed.data.endDate,
      employee.id,
      parsed.data.daySelectionMode,
      parsed.data.leaveDayTypesJson,
    );
    const request = await db.leaveRequest.update({
      where: { id: parsed.data.id },
      data: {
        leaveType: breakup.leaveType,
        startDate: start,
        endDate: end,
        reason: buildReason(parsed.data.reason, parsed.data.diwaliLeave),
        approverId: parsed.data.approverId,
        status: "PENDING",
        reconsiderNote: null,
        rejectedAt: null,
        reconsideredAt: new Date(),
        daySelectionMode: breakup.daySelectionMode,
        leaveDayTypesJson: breakup.leaveDayTypesJson,
        totalLeaveDays: new Prisma.Decimal(breakup.totalLeaveDays.toFixed(2)),
        casualDaysUsed: new Prisma.Decimal(breakup.casualDaysUsed.toFixed(2)),
        earnedDaysUsed: new Prisma.Decimal(breakup.earnedDaysUsed.toFixed(2)),
        unpaidDaysUsed: new Prisma.Decimal(breakup.unpaidDaysUsed.toFixed(2)),
      },
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
  if (existing.status === "APPROVED")
    throw new Error("Approved leave requests cannot be deleted.");
  await db.leaveRequest.delete({ where: { id } });
  revalidatePath("/leave-requests");
  revalidatePath("/leave-approvals");
  revalidatePath("/dashboard");
}

export async function cancelLeaveRequestAction(formData: FormData) {
  const user = await requireUserForAction();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Leave request is required.");
  const existing = await db.leaveRequest.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) throw new Error("Leave request not found.");
  if (existing.status !== "APPROVED")
    throw new Error("Only approved leave requests can be cancelled.");
  const { startUtc } = getDayBoundsUtcFromIstDateKey(getIstDateKey());
  if (existing.endDate < startUtc)
    throw new Error("Past leave requests cannot be cancelled.");
  const profile = await getOrCreateLeaveYearProfile(
    user.id,
    Number(getIstDateKey(existing.startDate).slice(0, 4)),
  );
  await db.$transaction([
    db.leaveRequest.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    }),
    db.leaveYearProfile.update({
      where: { id: profile.id },
      data: {
        casualLeaves: {
          increment: existing.casualDaysUsed ?? new Prisma.Decimal(0),
        },
        earnedLeaves: {
          increment: existing.earnedDaysUsed ?? new Prisma.Decimal(0),
        },
      },
    }),
  ]);
  revalidatePath("/leave-requests");
  revalidatePath("/leave-approvals");
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
  const existing = await db.leaveRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Leave request not found.");
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
  if (!(existing.approverId === user.id || adminPmApprover))
    throw new Error(
      "Only the selected approver or an Admin user with functional role Project Manager who is included in the approver list can approve, reject, or reconsider this leave request.",
    );
  if (decision === "APPROVED") {
    const profile = await getOrCreateLeaveYearProfile(
      existing.userId,
      Number(getIstDateKey(existing.startDate).slice(0, 4)),
    );
    await db.$transaction([
      db.leaveRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approverId: user.id,
          approverComment: comment || null,
          approvedAt: new Date(),
          rejectedAt: null,
          reconsiderNote: null,
        },
      }),
      db.leaveYearProfile.update({
        where: { id: profile.id },
        data: {
          casualLeaves: {
            decrement: existing.casualDaysUsed ?? new Prisma.Decimal(0),
          },
          earnedLeaves: {
            decrement: existing.earnedDaysUsed ?? new Prisma.Decimal(0),
          },
        },
      }),
    ]);
  } else {
    await db.leaveRequest.update({
      where: { id },
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
