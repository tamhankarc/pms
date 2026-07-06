import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getDayBoundsUtcFromIstDateKey,
  getIstDateKey,
} from "@/lib/ist";
import { getOrCreateLeaveYearProfile, isLeaveAllowedUser } from "@/lib/ems-queries";

export const LEAVE_LEDGER_START_DATE_KEY = "2026-06-01";

const PAST_LEAVE_PAGE_SIZE = 10;
const LEDGER_PAGE_SIZE = 50;

type LeaveAllowedUser = {
  id: string;
  fullName: string;
  userType: string;
  functionalRole: string | null;
  isActive?: boolean | null;
};

function decimalNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function dateKeyToBounds(dateKey: string) {
  return getDayBoundsUtcFromIstDateKey(dateKey);
}

function startOfLedgerUtc() {
  return dateKeyToBounds(LEAVE_LEDGER_START_DATE_KEY).startUtc;
}

function todayStartUtc() {
  return dateKeyToBounds(getIstDateKey()).startUtc;
}

function isEligible(user: LeaveAllowedUser) {
  return isLeaveAllowedUser({
    userType: user.userType,
    functionalRole: user.functionalRole,
    isActive: user.isActive ?? true,
  });
}

export async function getPastApprovedLeaveDeletionCandidates({
  page = 1,
  pageSize = PAST_LEAVE_PAGE_SIZE,
}: {
  page?: number;
  pageSize?: number;
} = {}) {
  const safePage = page > 0 ? page : 1;
  const safePageSize = pageSize > 0 ? pageSize : PAST_LEAVE_PAGE_SIZE;
  const fromUtc = startOfLedgerUtc();
  const beforeTodayUtc = todayStartUtc();

  const where: Prisma.LeaveRequestWhereInput = {
    status: "APPROVED",
    startDate: { gte: fromUtc },
    endDate: { lt: beforeTodayUtc },
    user: {
      is: {
        isActive: true,
        userType: { notIn: ["ADMIN", "OPERATIONS", "REPORT_VIEWER", "ACCOUNTS"] },
      },
    },
  };

  const [totalItems, rows] = await Promise.all([
    db.leaveRequest.count({ where }),
    db.leaveRequest.findMany({
      where,
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
        approver: { select: { fullName: true } },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
  ]);

  return {
    rows: rows.filter((row) => isEligible(row.user)),
    totalItems,
    currentPage: safePage,
    totalPages: Math.max(1, Math.ceil(totalItems / safePageSize)),
    pageSize: safePageSize,
  };
}

export async function getPastApprovedLeaveDeletePreview(id: string) {
  const request = await db.leaveRequest.findUnique({
    where: { id },
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
      approver: { select: { fullName: true } },
      selectedApprovers: {
        include: { approver: { select: { fullName: true } } },
        orderBy: { approver: { fullName: "asc" } },
      },
    },
  });

  if (!request) return null;
  if (request.status !== "APPROVED") {
    throw new Error("Only approved leaves can be deleted from this screen.");
  }
  if (request.startDate < startOfLedgerUtc()) {
    throw new Error("Only approved leaves from 1 June 2026 onward can be deleted from this screen.");
  }
  if (request.endDate >= todayStartUtc()) {
    throw new Error("Only old/past approved leaves can be deleted from this screen.");
  }
  if (!isEligible(request.user)) {
    throw new Error("Selected user is not eligible for leave administration.");
  }

  const year = Number(getIstDateKey(request.startDate).slice(0, 4));
  const profile = await getOrCreateLeaveYearProfile(request.userId, year);
  const casualToRestore = decimalNumber(request.casualDaysUsed);
  const earnedToRestore = decimalNumber(request.earnedDaysUsed);
  const unpaidDays = decimalNumber(request.unpaidDaysUsed);

  return {
    request,
    profile,
    year,
    casualToRestore,
    earnedToRestore,
    unpaidDays,
    totalLeaveDays: decimalNumber(request.totalLeaveDays),
    currentCasualBalance: decimalNumber(profile.casualLeaves),
    currentEarnedBalance: decimalNumber(profile.earnedLeaves),
    resultingCasualBalance: decimalNumber(profile.casualLeaves) + casualToRestore,
    resultingEarnedBalance: decimalNumber(profile.earnedLeaves) + earnedToRestore,
  };
}

export async function getLeaveLedgerUserOptions() {
  const rows = await db.user.findMany({
    where: {
      isActive: true,
      leaveRequests: {
        some: {
          status: "APPROVED",
          startDate: { gte: startOfLedgerUtc() },
        },
      },
    },
    select: {
      id: true,
      fullName: true,
      userType: true,
      functionalRole: true,
      isActive: true,
    },
    orderBy: { fullName: "asc" },
  });

  return rows.filter(isEligible).map((row) => ({ id: row.id, fullName: row.fullName }));
}

export type PredictiveLeaveLedgerRow = {
  userId: string;
  userName: string;
  eventDate: Date;
  eventDateKey: string;
  eventType: "OPENING" | "CREDIT" | "DEDUCTION";
  description: string;
  referenceId?: string;
  casualChange: number;
  earnedChange: number;
  unpaidDays: number;
  casualBalance: number;
  earnedBalance: number;
};

export async function getPredictiveLeaveLedger({
  userId,
  fromDateKey,
  toDateKey,
  page = 1,
  pageSize = LEDGER_PAGE_SIZE,
}: {
  userId?: string;
  fromDateKey?: string;
  toDateKey?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const safePage = page > 0 ? page : 1;
  const safePageSize = pageSize > 0 ? pageSize : LEDGER_PAGE_SIZE;
  const ledgerStartUtc = startOfLedgerUtc();
  const fromUtc = fromDateKey ? dateKeyToBounds(fromDateKey).startUtc : ledgerStartUtc;
  const toUtcExclusive = toDateKey ? dateKeyToBounds(toDateKey).endUtc : undefined;

  const users = await db.user.findMany({
    where: {
      ...(userId ? { id: userId } : {}),
      isActive: true,
      leaveRequests: {
        some: {
          status: "APPROVED",
          startDate: { gte: ledgerStartUtc },
        },
      },
    },
    select: {
      id: true,
      fullName: true,
      userType: true,
      functionalRole: true,
      isActive: true,
    },
    orderBy: { fullName: "asc" },
  });

  const eligibleUsers = users.filter(isEligible);
  const allRows: PredictiveLeaveLedgerRow[] = [];

  for (const user of eligibleUsers) {
    const year = Number(LEAVE_LEDGER_START_DATE_KEY.slice(0, 4));
    const profile = await getOrCreateLeaveYearProfile(user.id, year);
    const [leaves, credits] = await Promise.all([
      db.leaveRequest.findMany({
        where: {
          userId: user.id,
          status: "APPROVED",
          startDate: { gte: ledgerStartUtc },
        },
        orderBy: [{ approvedAt: "asc" }, { startDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          startDate: true,
          endDate: true,
          approvedAt: true,
          createdAt: true,
          reason: true,
          casualDaysUsed: true,
          earnedDaysUsed: true,
          unpaidDaysUsed: true,
          totalLeaveDays: true,
        },
      }),
      db.leaveQuarterlyCasualCredit.findMany({
        where: {
          userId: user.id,
          year,
        },
        orderBy: [{ creditedAt: "asc" }],
        select: {
          id: true,
          quarter: true,
          credited: true,
          creditedAt: true,
          source: true,
          runDateKey: true,
        },
      }),
    ]);

    const totalLeaveCasual = leaves.reduce((sum, row) => sum + decimalNumber(row.casualDaysUsed), 0);
    const totalLeaveEarned = leaves.reduce((sum, row) => sum + decimalNumber(row.earnedDaysUsed), 0);
    const totalCreditCasual = credits.reduce((sum, row) => sum + decimalNumber(row.credited), 0);

    let casualBalance = decimalNumber(profile.casualLeaves) + totalLeaveCasual - totalCreditCasual;
    let earnedBalance = decimalNumber(profile.earnedLeaves) + totalLeaveEarned;

    const openingEventDate = dateKeyToBounds(LEAVE_LEDGER_START_DATE_KEY).startUtc;
    const events: Array<{
      eventDate: Date;
      eventType: PredictiveLeaveLedgerRow["eventType"];
      description: string;
      referenceId?: string;
      casualChange: number;
      earnedChange: number;
      unpaidDays: number;
    }> = [
      {
        eventDate: openingEventDate,
        eventType: "OPENING",
        description: "Estimated opening balance from HR manual records as of 1 June 2026. Calculated from current balance, approved leave deductions, and recorded quarterly credits.",
        casualChange: casualBalance,
        earnedChange: earnedBalance,
        unpaidDays: 0,
      },
    ];

    for (const credit of credits) {
      events.push({
        eventDate: credit.creditedAt,
        eventType: "CREDIT",
        description: `Quarter ${credit.quarter} casual leave credit${credit.runDateKey ? ` (${credit.runDateKey})` : ""}`,
        referenceId: credit.id,
        casualChange: decimalNumber(credit.credited),
        earnedChange: 0,
        unpaidDays: 0,
      });
    }

    for (const leave of leaves) {
      events.push({
        eventDate: leave.approvedAt ?? leave.createdAt,
        eventType: "DEDUCTION",
        description: `Approved leave ${getIstDateKey(leave.startDate)} to ${getIstDateKey(leave.endDate)}${leave.reason ? ` · ${leave.reason.split("\n")[0].slice(0, 120)}` : ""}`,
        referenceId: leave.id,
        casualChange: -decimalNumber(leave.casualDaysUsed),
        earnedChange: -decimalNumber(leave.earnedDaysUsed),
        unpaidDays: decimalNumber(leave.unpaidDaysUsed),
      });
    }

    events.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

    let seenOpening = false;
    for (const event of events) {
      if (event.eventType === "OPENING") {
        seenOpening = true;
      } else {
        casualBalance += event.casualChange;
        earnedBalance += event.earnedChange;
      }

      const eventDateKey = getIstDateKey(event.eventDate);
      if (event.eventDate < fromUtc) continue;
      if (toUtcExclusive && event.eventDate >= toUtcExclusive) continue;

      allRows.push({
        userId: user.id,
        userName: user.fullName,
        eventDate: event.eventDate,
        eventDateKey,
        eventType: event.eventType,
        description: event.description,
        referenceId: event.referenceId,
        casualChange: event.eventType === "OPENING" && seenOpening ? event.casualChange : event.casualChange,
        earnedChange: event.eventType === "OPENING" && seenOpening ? event.earnedChange : event.earnedChange,
        unpaidDays: event.unpaidDays,
        casualBalance,
        earnedBalance,
      });
    }
  }

  allRows.sort((a, b) => {
    const userCompare = a.userName.localeCompare(b.userName);
    if (userCompare) return userCompare;
    return a.eventDate.getTime() - b.eventDate.getTime();
  });

  const totalItems = allRows.length;
  return {
    rows: allRows.slice((safePage - 1) * safePageSize, safePage * safePageSize),
    totalItems,
    currentPage: safePage,
    totalPages: Math.max(1, Math.ceil(totalItems / safePageSize)),
    pageSize: safePageSize,
    userOptions: await getLeaveLedgerUserOptions(),
    fromDateKey: fromDateKey || LEAVE_LEDGER_START_DATE_KEY,
    toDateKey: toDateKey || getIstDateKey(),
  };
}
