import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getDayBoundsUtcFromIstDateKey,
  getIstDateKey,
  isWeekendDateKey,
} from "@/lib/ist";
import { getOrCreateLeaveYearProfile, getOfficialHolidayDateKeysForYear } from "@/lib/ems-queries";

type DayDuration = "FULL_DAY" | "HALF_DAY" | "FIRST_HALF" | "SECOND_HALF";
type DaySelectionMode = "FULL_DAYS" | "HALF_DAYS" | "CUSTOM";

type EligibleUser = {
  id: string;
  userType: string;
  functionalRole?: string | null;
  isActive?: boolean;
};

function isEligibleForPaidLeaves(user: EligibleUser) {
  if (user.isActive === false) return false;
  if (["OPERATIONS", "REPORT_VIEWER", "ACCOUNTS"].includes(user.userType))
    return false;
  if (user.userType === "ADMIN" && user.functionalRole !== "PROJECT_MANAGER")
    return false;
  return true;
}

function normalizeDayDuration(value: string | undefined): DayDuration {
  if (
    value === "FIRST_HALF" ||
    value === "SECOND_HALF" ||
    value === "HALF_DAY"
  ) {
    return value;
  }
  return "FULL_DAY";
}

function isHalfDayDuration(value: DayDuration) {
  return (
    value === "HALF_DAY" || value === "FIRST_HALF" || value === "SECOND_HALF"
  );
}

function parseCustomDurations(
  raw: string | null | undefined,
): Record<string, DayDuration> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        normalizeDayDuration(value),
      ]),
    );
  } catch {
    return {};
  }
}

function getDurationByDate(
  keys: string[],
  mode: DaySelectionMode,
  rawDayTypes?: string | null,
) {
  const custom = parseCustomDurations(rawDayTypes);
  const durationByDate: Record<string, DayDuration> = {};
  for (const key of keys) {
    durationByDate[key] =
      mode === "HALF_DAYS"
        ? normalizeDayDuration(custom[key]) === "SECOND_HALF"
          ? "SECOND_HALF"
          : "FIRST_HALF"
        : mode === "CUSTOM"
          ? normalizeDayDuration(custom[key])
          : "FULL_DAY";
  }
  return durationByDate;
}

function sumSelectedWorkingDays(durationByDate: Record<string, DayDuration>) {
  return Object.values(durationByDate).reduce(
    (total, type) => total + (isHalfDayDuration(type) ? 0.5 : 1),
    0,
  );
}

function quarterCountForDateKey(dateKey: string) {
  const month = Number(dateKey.slice(5, 7));
  return month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
}

export function getQuarterForDateKey(dateKey = getIstDateKey()) {
  return quarterCountForDateKey(dateKey);
}

export function getCurrentQuarterStartDateKey(asOfDateKey = getIstDateKey()) {
  const year = Number(asOfDateKey.slice(0, 4));
  const quarter = quarterCountForDateKey(asOfDateKey);
  const startMonth = (quarter - 1) * 3 + 1;
  return `${year}-${String(startMonth).padStart(2, "0")}-01`;
}

const QUARTERLY_CASUAL_CREDIT = 2;

export async function ensureQuarterlyCasualLeaveCreditForUser(
  userId: string,
  year: number,
  asOfDateKey = getIstDateKey(),
  creditedById?: string | null,
  source = "ADMIN",
) {
  const quarter = quarterCountForDateKey(asOfDateKey);
  const profile = await getOrCreateLeaveYearProfile(userId, year);

  if (
    profile.employmentStatus === "PROBATION" ||
    profile.employmentStatus === "CONSULTANT"
  ) {
    return { profile, credited: 0, skipped: true, reason: "UNPAID_ONLY" };
  }

  const existingCredit = await db.leaveQuarterlyCasualCredit.findUnique({
    where: {
      userId_year_quarter: {
        userId,
        year,
        quarter,
      },
    },
  });

  if (existingCredit) {
    return {
      profile,
      credited: 0,
      skipped: false,
      reason: "ALREADY_CREDITED",
    };
  }

  const creditToAdd = QUARTERLY_CASUAL_CREDIT;

  try {
    const updatedProfile = await db.$transaction(async (tx) => {
      const updated = await tx.leaveYearProfile.update({
        where: { id: profile.id },
        data: {
          casualLeaves: {
            increment: new Prisma.Decimal(creditToAdd.toFixed(2)),
          },
        },
      });

      await tx.leaveQuarterlyCasualCredit.create({
        data: {
          userId,
          year,
          quarter,
          credited: new Prisma.Decimal(creditToAdd.toFixed(2)),
          creditedById: creditedById ?? null,
          runDateKey: asOfDateKey,
          source,
        },
      });

      return updated;
    });

    return {
      profile: updatedProfile,
      credited: creditToAdd,
      skipped: false,
      reason: "CREDITED",
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        profile,
        credited: 0,
        skipped: false,
        reason: "ALREADY_CREDITED",
      };
    }

    throw error;
  }
}

export async function ensureQuarterlyCasualLeaveCreditsForAllEligibleUsers(
  year: number,
  asOfDateKey = getIstDateKey(),
  creditedById?: string | null,
  source = "ADMIN",
) {
  const users = await db.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fullName: true,
      userType: true,
      functionalRole: true,
      isActive: true,
    },
    orderBy: { fullName: "asc" },
  });

  const eligibleUsers = users.filter(isEligibleForPaidLeaves);
  let creditedUsers = 0;
  let totalCredited = 0;
  const rows: Array<{
    userId: string;
    fullName: string;
    credited: number;
    reason: string;
  }> = [];

  for (const user of eligibleUsers) {
    const result = await ensureQuarterlyCasualLeaveCreditForUser(
      user.id,
      year,
      asOfDateKey,
      creditedById,
      source,
    );
    if (result.credited > 0) {
      creditedUsers += 1;
      totalCredited += result.credited;
    }
    rows.push({
      userId: user.id,
      fullName: user.fullName,
      credited: result.credited,
      reason: result.reason,
    });
  }

  return {
    year,
    quarter: quarterCountForDateKey(asOfDateKey),
    asOfDateKey,
    eligibleUsers: eligibleUsers.length,
    creditedUsers,
    totalCredited,
    rows,
  };
}

async function getWorkingLeaveDetailsForRequest(request: {
  startDate: Date;
  endDate: Date;
  userId: string;
  daySelectionMode: unknown;
  leaveDayTypesJson?: string | null;
}) {
  const startDateKey = getIstDateKey(request.startDate);
  const endDateKey = getIstDateKey(request.endDate);
  const year = Number(startDateKey.slice(0, 4));
  const profile = await getOrCreateLeaveYearProfile(request.userId, year);
  const holidayKeys = new Set<string>(
    await getOfficialHolidayDateKeysForYear(year, profile.shift),
  );
  const keys: string[] = [];
  let cursor = startDateKey;
  while (cursor <= endDateKey) {
    if (!isWeekendDateKey(cursor) && !holidayKeys.has(cursor)) keys.push(cursor);
    cursor = getIstDateKey(getDayBoundsUtcFromIstDateKey(cursor).endUtc);
  }

  const mode =
    request.daySelectionMode === "HALF_DAYS" ||
    request.daySelectionMode === "CUSTOM"
      ? (request.daySelectionMode as DaySelectionMode)
      : "FULL_DAYS";
  const durationByDate = getDurationByDate(
    keys,
    mode,
    request.leaveDayTypesJson,
  );
  const workingLeaveDays = sumSelectedWorkingDays(durationByDate);

  return {
    year,
    profile,
    startDateKey,
    endDateKey,
    holidayKeys,
    workingLeaveDays,
  };
}

function computeBreakupWithAvailableBalances({
  startDateKey,
  endDateKey,
  holidayKeys,
  workingLeaveDays,
  casualAvailable,
  earnedAvailable,
  unpaidOnly,
}: {
  startDateKey: string;
  endDateKey: string;
  holidayKeys: Set<string>;
  workingLeaveDays: number;
  casualAvailable: number;
  earnedAvailable: number;
  unpaidOnly: boolean;
}) {
  const casualDaysUsed = unpaidOnly ? 0 : Math.min(casualAvailable, workingLeaveDays);
  const remainingAfterCasual = workingLeaveDays - casualDaysUsed;
  const earnedDaysUsed = unpaidOnly ? 0 : Math.min(earnedAvailable, remainingAfterCasual);
  const workingUnpaidDaysUsed = Math.max(0, remainingAfterCasual - earnedDaysUsed);

  let sandwichUnpaidDaysUsed = 0;
  if (workingUnpaidDaysUsed > 0) {
    let cursor = startDateKey;
    while (cursor <= endDateKey) {
      const isInsideRange = cursor !== startDateKey && cursor !== endDateKey;
      if (
        isInsideRange &&
        (isWeekendDateKey(cursor) || holidayKeys.has(cursor))
      ) {
        sandwichUnpaidDaysUsed += 1;
      }
      cursor = getIstDateKey(getDayBoundsUtcFromIstDateKey(cursor).endUtc);
    }
  }

  const unpaidDaysUsed = workingUnpaidDaysUsed + sandwichUnpaidDaysUsed;
  const totalLeaveDays = workingLeaveDays + sandwichUnpaidDaysUsed;
  const leaveType =
    casualDaysUsed > 0 ? "CASUAL" : earnedDaysUsed > 0 ? "EARNED" : "UNPAID";

  return {
    totalLeaveDays,
    casualDaysUsed,
    earnedDaysUsed,
    unpaidDaysUsed,
    leaveType,
  };
}

async function calculateRectifiedBreakup(requestId: string) {
  const request = await db.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          userType: true,
          functionalRole: true,
          isActive: true,
        },
      },
    },
  });
  if (!request) throw new Error("Leave request not found.");
  if (request.status !== "APPROVED")
    throw new Error("Only approved leave requests can be adjusted.");
  if (!isEligibleForPaidLeaves(request.user))
    throw new Error("Selected user is not eligible for paid leave adjustment.");

  const details = await getWorkingLeaveDetailsForRequest(request);
  const unpaidOnly =
    details.profile.employmentStatus === "PROBATION" ||
    details.profile.employmentStatus === "CONSULTANT";
  if (unpaidOnly) throw new Error("Probation/Consultant users cannot be adjusted to paid leave.");

  const oldCasual = Number(request.casualDaysUsed ?? 0);
  const oldEarned = Number(request.earnedDaysUsed ?? 0);
  const oldUnpaid = Number(request.unpaidDaysUsed ?? 0);
  const casualAvailableAfterReverse = Number(details.profile.casualLeaves) + oldCasual;
  const earnedAvailableAfterReverse = Number(details.profile.earnedLeaves) + oldEarned;
  const newBreakup = computeBreakupWithAvailableBalances({
    startDateKey: details.startDateKey,
    endDateKey: details.endDateKey,
    holidayKeys: details.holidayKeys,
    workingLeaveDays: details.workingLeaveDays,
    casualAvailable: casualAvailableAfterReverse,
    earnedAvailable: earnedAvailableAfterReverse,
    unpaidOnly,
  });

  return {
    request,
    profile: details.profile,
    year: details.year,
    oldBreakup: {
      totalLeaveDays: Number(request.totalLeaveDays ?? 0),
      casualDaysUsed: oldCasual,
      earnedDaysUsed: oldEarned,
      unpaidDaysUsed: oldUnpaid,
    },
    newBreakup,
    casualDelta: oldCasual - newBreakup.casualDaysUsed,
    earnedDelta: oldEarned - newBreakup.earnedDaysUsed,
    casualIncreaseInRequest: newBreakup.casualDaysUsed - oldCasual,
    earnedReductionInRequest: oldEarned - newBreakup.earnedDaysUsed,
    unpaidReductionInRequest: oldUnpaid - newBreakup.unpaidDaysUsed,
  };
}

export async function getQuarterlyCasualLeaveAdjustmentCandidates({
  fromDateKey = getCurrentQuarterStartDateKey(),
  toDateKey = getIstDateKey(),
}: {
  fromDateKey?: string;
  toDateKey?: string;
} = {}) {
  const fromUtc = getDayBoundsUtcFromIstDateKey(fromDateKey).startUtc;
  const toUtcExclusive = getDayBoundsUtcFromIstDateKey(toDateKey).endUtc;
  const requests = await db.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      createdAt: { gte: fromUtc, lt: toUtcExclusive },
      OR: [
        { earnedDaysUsed: { gt: new Prisma.Decimal(0) } },
        { unpaidDaysUsed: { gt: new Prisma.Decimal(0) } },
      ],
      user: { is: { isActive: true } },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          userType: true,
          functionalRole: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { startDate: "asc" }],
  });

  const candidates = [];
  for (const request of requests) {
    if (!isEligibleForPaidLeaves(request.user)) continue;
    try {
      const preview = await calculateRectifiedBreakup(request.id);
      const hasUsefulAdjustment =
        preview.casualIncreaseInRequest > 0 ||
        preview.earnedReductionInRequest > 0 ||
        preview.unpaidReductionInRequest > 0;
      candidates.push({
        id: request.id,
        userId: request.userId,
        userName: request.user.fullName,
        createdAt: request.createdAt,
        approvedAt: request.approvedAt,
        startDate: request.startDate,
        endDate: request.endDate,
        reason: request.reason,
        oldBreakup: preview.oldBreakup,
        newBreakup: preview.newBreakup,
        casualIncreaseInRequest: preview.casualIncreaseInRequest,
        earnedReductionInRequest: preview.earnedReductionInRequest,
        unpaidReductionInRequest: preview.unpaidReductionInRequest,
        hasUsefulAdjustment,
      });
    } catch {
      // Skip requests that cannot be safely recalculated.
    }
  }

  return { fromDateKey, toDateKey, candidates };
}

export async function rectifyApprovedLeaveRequestAllocation(requestId: string) {
  const preview = await calculateRectifiedBreakup(requestId);
  const { request, profile, newBreakup, casualDelta, earnedDelta } = preview;

  await db.$transaction([
    db.leaveRequest.update({
      where: { id: request.id },
      data: {
        leaveType: newBreakup.leaveType as "CASUAL" | "EARNED" | "UNPAID",
        totalLeaveDays: new Prisma.Decimal(newBreakup.totalLeaveDays.toFixed(2)),
        casualDaysUsed: new Prisma.Decimal(newBreakup.casualDaysUsed.toFixed(2)),
        earnedDaysUsed: new Prisma.Decimal(newBreakup.earnedDaysUsed.toFixed(2)),
        unpaidDaysUsed: new Prisma.Decimal(newBreakup.unpaidDaysUsed.toFixed(2)),
      },
    }),
    db.leaveYearProfile.update({
      where: { id: profile.id },
      data: {
        casualLeaves: {
          increment: new Prisma.Decimal(casualDelta.toFixed(2)),
        },
        earnedLeaves: {
          increment: new Prisma.Decimal(earnedDelta.toFixed(2)),
        },
      },
    }),
  ]);

  return preview;
}
