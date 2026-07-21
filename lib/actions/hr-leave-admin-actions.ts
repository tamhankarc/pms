"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { isHR } from "@/lib/permissions";
import { getDayBoundsUtcFromIstDateKey, getIstDateKey } from "@/lib/ist";
import {
  recalculateFutureAllocationsForUser,
  recordManualBalanceAdjustment,
  lockUserLeaveTimeline,
} from "@/lib/leave-system";

export async function updateLeaveAdminUserAction(formData: FormData) {
  const actor = await requireUserForAction();
  if (!isHR(actor))
    throw new Error("Only Administration/HR can update leave admin settings.");

  const userId = String(formData.get("userId") || "");
  const year = Number(formData.get("year") || getIstDateKey().slice(0, 4));
  const casualLeaves = Number(formData.get("casualLeaves") || 0);
  const earnedLeaves = Number(formData.get("earnedLeaves") || 0);
  const shift = String(formData.get("shift") || "DAY") as "DAY" | "NIGHT";
  const employmentStatus = String(formData.get("employmentStatus") || "PROBATION") as
    | "PROBATION"
    | "PERMANENT"
    | "CONSULTANT";
  const adjustmentNote = String(formData.get("adjustmentNote") || "").trim();
  const returnTo = String(formData.get("returnTo") || "/leave-admin").trim();

  if (!userId) throw new Error("User is required.");
  if (!Number.isFinite(casualLeaves) || casualLeaves < 0 || !Number.isFinite(earnedLeaves) || earnedLeaves < 0)
    throw new Error("Leave balances must be valid non-negative numbers.");

  const unpaidOnly = employmentStatus === "PROBATION" || employmentStatus === "CONSULTANT";
  const savedCasualLeaves = unpaidOnly ? 0 : casualLeaves;
  const savedEarnedLeaves = unpaidOnly ? 0 : earnedLeaves;
  const todayKey = getIstDateKey();
  const todayBounds = getDayBoundsUtcFromIstDateKey(todayKey);
  const tomorrowStart = todayBounds.endUtc;

  await db.$transaction(async (tx) => {
    await lockUserLeaveTimeline(tx, userId);
    const existing = await tx.leaveYearProfile.findUnique({
      where: { userId_year: { userId, year } },
    });
    const beforeCasual = Number(existing?.casualLeaves ?? 0);
    const beforeEarned = Number(existing?.earnedLeaves ?? 0);
    const statusChanged = Boolean(existing && existing.employmentStatus !== employmentStatus);
    const shiftChanged = Boolean(existing && existing.shift !== shift);
    const balanceChanged =
      Math.abs(beforeCasual - savedCasualLeaves) > 0.001 ||
      Math.abs(beforeEarned - savedEarnedLeaves) > 0.001;

    if ((statusChanged || shiftChanged || balanceChanged) && !adjustmentNote) {
      throw new Error(
        "A required HR note must explain balance, shift, or employment-status changes.",
      );
    }

    if (statusChanged || shiftChanged) {
      const activeFutureLeave = await tx.leaveRequest.findFirst({
        where: {
          userId,
          OR: [
            {
              status: { in: ["PENDING", "RECONSIDER"] },
              endDate: { gte: tomorrowStart },
            },
            {
              status: { in: ["APPROVED", "PARTIALLY_CANCELLED"] },
              dateAllocations: {
                some: { status: "SCHEDULED", leaveDate: { gte: tomorrowStart } },
              },
            },
            {
              status: "APPROVED",
              dateAllocations: { none: {} },
              endDate: { gte: tomorrowStart },
            },
          ],
        },
        select: { id: true },
      });
      const pendingCancellation = await tx.leaveCancellationRequest.findFirst({
        where: {
          status: "PENDING",
          leaveRequest: { userId, endDate: { gte: tomorrowStart } },
        },
        select: { id: true },
      });
      if (activeFutureLeave || pendingCancellation) {
        throw new Error(
          "Employment status or shift cannot be changed while the employee has active future leave. HR must cancel or resolve every future leave first, then recreate it after the change.",
        );
      }
    }

    const saved = await tx.leaveYearProfile.upsert({
      where: { userId_year: { userId, year } },
      update: {
        casualLeaves: new Prisma.Decimal(savedCasualLeaves.toFixed(2)),
        earnedLeaves: new Prisma.Decimal(savedEarnedLeaves.toFixed(2)),
        shift,
        employmentStatus,
      },
      create: {
        userId,
        year,
        casualLeaves: new Prisma.Decimal(savedCasualLeaves.toFixed(2)),
        earnedLeaves: new Prisma.Decimal(savedEarnedLeaves.toFixed(2)),
        shift,
        employmentStatus,
      },
    });

    if (balanceChanged || (!existing && (savedCasualLeaves > 0 || savedEarnedLeaves > 0))) {
      await recordManualBalanceAdjustment(tx, {
        userId,
        year,
        casualBefore: beforeCasual,
        earnedBefore: beforeEarned,
        casualAfter: Number(saved.casualLeaves),
        earnedAfter: Number(saved.earnedLeaves),
        actorId: actor.id,
        note: adjustmentNote,
      });
    }
    await recalculateFutureAllocationsForUser(tx, userId, todayKey);
  });

  revalidatePath("/leave-admin");
  revalidatePath(`/leave-admin/${userId}`);
  revalidatePath("/leave-admin/leave-ledger");
  revalidatePath("/leave-requests");
  revalidatePath("/dashboard");
  revalidatePath("/hr-reports");
  const safeReturnTo = returnTo.startsWith("/leave-admin") ? returnTo : "/leave-admin";
  redirect(safeReturnTo);
}

export async function createOfficialHolidayAction(formData: FormData) {
  const user = await requireUserForAction();
  if (!isHR(user))
    throw new Error("Only Administration/HR can manage official holidays.");

  const name = String(formData.get("name") || "").trim();
  const holidayDate = String(formData.get("holidayDate") || "").trim();
  const shiftValue = String(formData.get("shift") || "DAY")
    .trim()
    .toUpperCase();
  const shift =
    shiftValue === "BOTH" ? "BOTH" : shiftValue === "NIGHT" ? "NIGHT" : "DAY";

  if (!name || !holidayDate)
    throw new Error("Holiday name and date are required.");

  await db.officialHoliday.create({
    data: {
      name,
      holidayDate: new Date(`${holidayDate}T00:00:00+05:30`),
      year: Number(holidayDate.slice(0, 4)),
      shift,
    },
  });

  revalidatePath("/leave-admin");
  revalidatePath("/leave-requests");
  revalidatePath("/dashboard");
}

export async function deleteOfficialHolidayAction(formData: FormData) {
  const user = await requireUserForAction();
  if (!isHR(user))
    throw new Error("Only Administration/HR can manage official holidays.");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Holiday is required.");

  await db.officialHoliday.delete({ where: { id } });

  revalidatePath("/leave-admin");
  revalidatePath("/leave-requests");
  revalidatePath("/dashboard");
}
