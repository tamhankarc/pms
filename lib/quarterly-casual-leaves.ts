import "server-only";
import { db } from "@/lib/db";
import { getDayBoundsUtcFromIstDateKey, getIstDateKey } from "@/lib/ist";
import {
  ensureQuarterlyCreditForUser,
  recalculateFutureAllocationsForUser,
  lockUserLeaveTimeline,
  LEAVE_SYSTEM_START_DATE_KEY,
} from "@/lib/leave-system";

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

type EligibleUser = {
  id: string;
  userType: string;
  functionalRole?: string | null;
  isActive?: boolean;
};

function isEligibleForPaidLeaves(user: EligibleUser) {
  if (user.isActive === false) return false;
  if (["OPERATIONS", "REPORT_VIEWER", "ACCOUNTS"].includes(user.userType)) return false;
  if (user.userType === "ADMIN" && user.functionalRole !== "PROJECT_MANAGER") return false;
  return true;
}

export async function ensureQuarterlyCasualLeaveCreditForUser(
  userId: string,
  year: number,
  asOfDateKey = getIstDateKey(),
  creditedById?: string | null,
  source = "ADMIN",
) {
  const quarterStartDateKey = getCurrentQuarterStartDateKey(asOfDateKey);
  if (Number(quarterStartDateKey.slice(0, 4)) !== year) {
    throw new Error("Quarter credit year does not match the selected date.");
  }
  return db.$transaction(async (tx) => {
    await lockUserLeaveTimeline(tx, userId);
    const result = await ensureQuarterlyCreditForUser(tx, {
      userId,
      dateKey: quarterStartDateKey,
      actorId: creditedById,
      source,
    });
    await recalculateFutureAllocationsForUser(tx, userId, asOfDateKey);
    const profile = await tx.leaveYearProfile.findUnique({
      where: { userId_year: { userId, year } },
    });
    if (!profile) throw new Error("Leave year profile not found after credit processing.");
    return {
      profile,
      credited: result.credited,
      skipped: result.reason === "UNPAID_ONLY",
      reason: result.reason,
    };
  });
}

export async function ensureQuarterlyCasualLeaveCreditsForAllEligibleUsers(
  year: number,
  asOfDateKey = getIstDateKey(),
  creditedById?: string | null,
  source = "ADMIN",
) {
  const users = await db.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, userType: true, functionalRole: true, isActive: true },
    orderBy: { fullName: "asc" },
  });
  const eligibleUsers = users.filter(isEligibleForPaidLeaves);
  let creditedUsers = 0;
  let totalCredited = 0;
  const rows: Array<{ userId: string; fullName: string; credited: number; reason: string }> = [];
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
    rows.push({ userId: user.id, fullName: user.fullName, credited: result.credited, reason: result.reason });
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


export async function ensureDueQuarterlyCasualLeaveCreditsForAllEligibleUsers(
  asOfDateKey = getIstDateKey(),
  creditedById?: string | null,
  source = "DAILY_CRON",
) {
  const year = Number(asOfDateKey.slice(0, 4));
  const dueQuarterStarts = [
    `${year}-01-01`,
    `${year}-04-01`,
    `${year}-07-01`,
    `${year}-10-01`,
  ].filter(
    (dateKey) =>
      dateKey >= LEAVE_SYSTEM_START_DATE_KEY && dateKey <= asOfDateKey,
  );

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
    quarterResults: Array<{ dateKey: string; credited: number; reason: string }>;
  }> = [];

  for (const user of eligibleUsers) {
    const result = await db.$transaction(async (tx) => {
      await lockUserLeaveTimeline(tx, user.id);
      const quarterResults = [];
      let credited = 0;
      for (const dateKey of dueQuarterStarts) {
        const quarterResult = await ensureQuarterlyCreditForUser(tx, {
          userId: user.id,
          dateKey,
          actorId: creditedById,
          source,
        });
        credited += quarterResult.credited;
        quarterResults.push({
          dateKey,
          credited: quarterResult.credited,
          reason: quarterResult.reason,
        });
      }
      await recalculateFutureAllocationsForUser(tx, user.id, asOfDateKey);
      return { credited, quarterResults };
    });

    if (result.credited > 0) creditedUsers += 1;
    totalCredited += result.credited;
    rows.push({
      userId: user.id,
      fullName: user.fullName,
      credited: result.credited,
      quarterResults: result.quarterResults,
    });
  }

  return {
    year,
    asOfDateKey,
    dueQuarterStarts,
    eligibleUsers: eligibleUsers.length,
    creditedUsers,
    totalCredited,
    rows,
  };
}

export async function getQuarterlyCasualLeaveAdjustmentCandidates({
  fromDateKey = getCurrentQuarterStartDateKey(),
  toDateKey = getIstDateKey(),
}: { fromDateKey?: string; toDateKey?: string } = {}) {
  const fromBounds = getDayBoundsUtcFromIstDateKey(fromDateKey);
  const toBounds = getDayBoundsUtcFromIstDateKey(toDateKey);
  const requests = await db.leaveRequest.findMany({
    where: {
      status: { in: ["APPROVED", "PARTIALLY_CANCELLED"] },
      createdAt: { gte: fromBounds.startUtc, lt: toBounds.endUtc },
      dateAllocations: { some: { status: "SCHEDULED" } },
    },
    include: {
      user: { select: { fullName: true } },
      dateAllocations: { where: { status: "SCHEDULED" }, orderBy: { leaveDate: "asc" } },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });
  const candidates = requests.map((request) => ({
    id: request.id,
    userId: request.userId,
    userName: request.user.fullName,
    createdAt: request.createdAt,
    approvedAt: request.approvedAt,
    startDate: request.startDate,
    endDate: request.endDate,
    reason: request.reason,
    oldBreakup: {
      totalLeaveDays: Number(request.totalLeaveDays ?? 0),
      casualDaysUsed: Number(request.casualDaysUsed ?? 0),
      earnedDaysUsed: Number(request.earnedDaysUsed ?? 0),
      unpaidDaysUsed: Number(request.unpaidDaysUsed ?? 0),
    },
    newBreakup: {
      totalLeaveDays: request.dateAllocations.reduce((sum, row) => sum + Number(row.duration), 0),
      casualDaysUsed: request.dateAllocations.reduce((sum, row) => sum + Number(row.casualDays), 0),
      earnedDaysUsed: request.dateAllocations.reduce((sum, row) => sum + Number(row.earnedDays), 0),
      unpaidDaysUsed: request.dateAllocations.reduce((sum, row) => sum + Number(row.unpaidDays), 0),
    },
    casualIncreaseInRequest: 0,
    earnedReductionInRequest: 0,
    unpaidReductionInRequest: 0,
    hasUsefulAdjustment: request.dateAllocations.length > 0,
  }));
  return { fromDateKey, toDateKey, candidates };
}

export async function rectifyApprovedLeaveRequestAllocation(requestId: string) {
  const request = await db.leaveRequest.findUnique({ where: { id: requestId }, select: { id: true, userId: true } });
  if (!request) throw new Error("Leave request not found.");
  await db.$transaction(async (tx) => {
    await recalculateFutureAllocationsForUser(tx, request.userId, getIstDateKey());
  });
  return request;
}
