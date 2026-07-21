import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isLeaveAllowedUser } from "@/lib/ems-queries";
import { getDayBoundsUtcFromIstDateKey, getIstDateKey } from "@/lib/ist";

export const LEAVE_LEDGER_START_DATE_KEY = "2026-06-01";
const LEDGER_PAGE_SIZE = 50;
const LEGACY_LEDGER_YEAR = Number(LEAVE_LEDGER_START_DATE_KEY.slice(0, 4));

export async function getPastApprovedLeaveDeletionCandidates() {
  return { rows: [], totalItems: 0, currentPage: 1, totalPages: 1, pageSize: 10 };
}

export async function getPastApprovedLeaveDeletePreview(id: string) {
  void id;
  throw new Error("Approved leave deletion has been replaced by the HR cancellation and date-restoration workflow.");
}

export async function getLeaveLedgerUserOptions() {
  return db.user.findMany({
    where: { leaveBalanceTransactions: { some: {} } },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

export type PredictiveLeaveLedgerRow = {
  userId: string;
  userName: string;
  eventDate: Date;
  eventDateKey: string;
  eventType: string;
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
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const where: Prisma.LeaveBalanceTransactionWhereInput = {
    ...(userId ? { userId } : {}),
    eventDate: {
      ...(fromDateKey ? { gte: getDayBoundsUtcFromIstDateKey(fromDateKey).startUtc } : {}),
      ...(toDateKey ? { lt: getDayBoundsUtcFromIstDateKey(toDateKey).endUtc } : {}),
    },
  };
  const [totalItems, transactions, userOptions] = await Promise.all([
    db.leaveBalanceTransaction.count({ where }),
    db.leaveBalanceTransaction.findMany({
      where,
      include: {
        user: { select: { fullName: true } },
        actor: { select: { fullName: true } },
        leaveRequest: { select: { startDate: true, endDate: true } },
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    getLeaveLedgerUserOptions(),
  ]);
  const rows: PredictiveLeaveLedgerRow[] = transactions.map((row) => ({
    userId: row.userId,
    userName: row.user.fullName,
    eventDate: row.eventDate,
    eventDateKey: getIstDateKey(row.eventDate),
    eventType: row.transactionType,
    description: [
      row.note || row.source.replaceAll("_", " "),
      row.leaveRequest
        ? `Request ${getIstDateKey(row.leaveRequest.startDate)} to ${getIstDateKey(row.leaveRequest.endDate)}`
        : null,
      row.actor ? `Actor: ${row.actor.fullName}` : null,
    ].filter(Boolean).join(" · "),
    referenceId: row.leaveRequestId ?? row.id,
    casualChange: Number(row.casualChange),
    earnedChange: Number(row.earnedChange),
    unpaidDays: Number(row.unpaidChange),
    casualBalance: Number(row.casualBalanceAfter),
    earnedBalance: Number(row.earnedBalanceAfter),
  }));
  return {
    rows,
    totalItems,
    currentPage: safePage,
    totalPages: Math.max(1, Math.ceil(totalItems / safePageSize)),
    pageSize: safePageSize,
    userOptions,
    fromDateKey: fromDateKey || LEAVE_LEDGER_START_DATE_KEY,
    toDateKey: toDateKey || getIstDateKey(),
  };
}

type LegacyLedgerUser = {
  id: string;
  fullName: string;
  userType: string;
  functionalRole: string | null;
  isActive: boolean;
};

type LegacyLedgerProfile = {
  userId: string;
  casualLeaves: Prisma.Decimal;
  earnedLeaves: Prisma.Decimal;
};

type LegacyLedgerLeave = {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  approvedAt: Date | null;
  createdAt: Date;
  reason: string | null;
  casualDaysUsed: Prisma.Decimal | null;
  earnedDaysUsed: Prisma.Decimal | null;
  unpaidDaysUsed: Prisma.Decimal | null;
};

type LegacyLedgerCredit = {
  id: string;
  userId: string;
  quarter: number;
  credited: Prisma.Decimal;
  creditedAt: Date;
  runDateKey: string | null;
};

export type LegacyPredictiveLedgerSnapshotRow = Omit<PredictiveLeaveLedgerRow, "userName">;

function buildLegacyRowsFromSource(input: {
  users: LegacyLedgerUser[];
  profiles: LegacyLedgerProfile[];
  leaves: LegacyLedgerLeave[];
  credits: LegacyLedgerCredit[];
}) {
  const eligibleUsers = input.users.filter(isLeaveAllowedUser);
  const profileByUser = new Map(input.profiles.map((row) => [row.userId, row]));
  const leavesByUser = new Map<string, LegacyLedgerLeave[]>();
  const creditsByUser = new Map<string, LegacyLedgerCredit[]>();

  for (const leave of input.leaves) {
    const rows = leavesByUser.get(leave.userId) ?? [];
    rows.push(leave);
    leavesByUser.set(leave.userId, rows);
  }
  for (const credit of input.credits) {
    const rows = creditsByUser.get(credit.userId) ?? [];
    rows.push(credit);
    creditsByUser.set(credit.userId, rows);
  }

  const rows: LegacyPredictiveLedgerSnapshotRow[] = [];
  const openingEventDate = getDayBoundsUtcFromIstDateKey(LEAVE_LEDGER_START_DATE_KEY).startUtc;

  for (const user of eligibleUsers) {
    const profile = profileByUser.get(user.id);
    const leaves = (leavesByUser.get(user.id) ?? []).sort(
      (a, b) =>
        (a.approvedAt ?? a.createdAt).getTime() - (b.approvedAt ?? b.createdAt).getTime() ||
        a.startDate.getTime() - b.startDate.getTime() ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const credits = (creditsByUser.get(user.id) ?? []).sort(
      (a, b) => a.creditedAt.getTime() - b.creditedAt.getTime(),
    );

    const totalLeaveCasual = leaves.reduce((sum, row) => sum + Number(row.casualDaysUsed), 0);
    const totalLeaveEarned = leaves.reduce((sum, row) => sum + Number(row.earnedDaysUsed), 0);
    const totalCreditCasual = credits.reduce((sum, row) => sum + Number(row.credited), 0);
    let casualBalance = Number(profile?.casualLeaves ?? 0) + totalLeaveCasual - totalCreditCasual;
    let earnedBalance = Number(profile?.earnedLeaves ?? 0) + totalLeaveEarned;

    const events: Array<{
      eventDate: Date;
      eventType: string;
      description: string;
      referenceId?: string;
      casualChange: number;
      earnedChange: number;
      unpaidDays: number;
    }> = [
      {
        eventDate: openingEventDate,
        eventType: "OPENING",
        description: "Estimated opening balance from HR manual records as of 1 June 2026. Calculated from the balance available before migration, approved leave deductions, and recorded quarterly credits.",
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
        casualChange: Number(credit.credited),
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
        casualChange: -Number(leave.casualDaysUsed),
        earnedChange: -Number(leave.earnedDaysUsed),
        unpaidDays: Number(leave.unpaidDaysUsed),
      });
    }

    events.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
    for (const event of events) {
      if (event.eventType !== "OPENING") {
        casualBalance += event.casualChange;
        earnedBalance += event.earnedChange;
      }
      rows.push({
        userId: user.id,
        eventDate: event.eventDate,
        eventDateKey: getIstDateKey(event.eventDate),
        eventType: event.eventType,
        description: event.description,
        referenceId: event.referenceId,
        casualChange: event.casualChange,
        earnedChange: event.earnedChange,
        unpaidDays: event.unpaidDays,
        casualBalance,
        earnedBalance,
      });
    }
  }

  return rows;
}

async function loadLegacyPredictiveSourceFromDb() {
  const ledgerStartUtc = getDayBoundsUtcFromIstDateKey(LEAVE_LEDGER_START_DATE_KEY).startUtc;
  const users = await db.user.findMany({
    where: {
      isActive: true,
      leaveRequests: { some: { status: "APPROVED", startDate: { gte: ledgerStartUtc } } },
    },
    select: { id: true, fullName: true, userType: true, functionalRole: true, isActive: true },
    orderBy: { fullName: "asc" },
  });
  const userIds = users.map((row) => row.id);
  const [profiles, leaves, credits] = await Promise.all([
    db.leaveYearProfile.findMany({
      where: { userId: { in: userIds }, year: LEGACY_LEDGER_YEAR },
      select: { userId: true, casualLeaves: true, earnedLeaves: true },
    }),
    db.leaveRequest.findMany({
      where: { userId: { in: userIds }, status: "APPROVED", startDate: { gte: ledgerStartUtc } },
      select: {
        id: true,
        userId: true,
        startDate: true,
        endDate: true,
        approvedAt: true,
        createdAt: true,
        reason: true,
        casualDaysUsed: true,
        earnedDaysUsed: true,
        unpaidDaysUsed: true,
      },
    }),
    db.leaveQuarterlyCasualCredit.findMany({
      where: { userId: { in: userIds }, year: LEGACY_LEDGER_YEAR },
      select: { id: true, userId: true, quarter: true, credited: true, creditedAt: true, runDateKey: true },
    }),
  ]);
  return { users, profiles, leaves, credits };
}

export async function buildLegacyPredictiveLedgerSnapshot(tx: Prisma.TransactionClient) {
  const ledgerStartUtc = getDayBoundsUtcFromIstDateKey(LEAVE_LEDGER_START_DATE_KEY).startUtc;
  const users = await tx.user.findMany({
    where: {
      isActive: true,
      leaveRequests: { some: { status: "APPROVED", startDate: { gte: ledgerStartUtc } } },
    },
    select: { id: true, fullName: true, userType: true, functionalRole: true, isActive: true },
    orderBy: { fullName: "asc" },
  });
  const userIds = users.map((row) => row.id);
  const [profiles, leaves, credits] = await Promise.all([
    tx.leaveYearProfile.findMany({
      where: { userId: { in: userIds }, year: LEGACY_LEDGER_YEAR },
      select: { userId: true, casualLeaves: true, earnedLeaves: true },
    }),
    tx.leaveRequest.findMany({
      where: { userId: { in: userIds }, status: "APPROVED", startDate: { gte: ledgerStartUtc } },
      select: {
        id: true,
        userId: true,
        startDate: true,
        endDate: true,
        approvedAt: true,
        createdAt: true,
        reason: true,
        casualDaysUsed: true,
        earnedDaysUsed: true,
        unpaidDaysUsed: true,
      },
    }),
    tx.leaveQuarterlyCasualCredit.findMany({
      where: { userId: { in: userIds }, year: LEGACY_LEDGER_YEAR },
      select: { id: true, userId: true, quarter: true, credited: true, creditedAt: true, runDateKey: true },
    }),
  ]);
  return buildLegacyRowsFromSource({ users, profiles, leaves, credits });
}

export async function getLegacyPredictiveLeaveLedger({
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
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const appliedRun = await db.leaveMigrationRun.findFirst({
    where: { status: "APPLIED" },
    orderBy: { appliedAt: "desc" },
    select: { id: true, cutoverDateKey: true, appliedAt: true },
  });

  if (appliedRun) {
    const where: Prisma.LeaveLegacyPredictiveLedgerRowWhereInput = {
      migrationRunId: appliedRun.id,
      ...(userId ? { userId } : {}),
      eventDate: {
        ...(fromDateKey ? { gte: getDayBoundsUtcFromIstDateKey(fromDateKey).startUtc } : {}),
        ...(toDateKey ? { lt: getDayBoundsUtcFromIstDateKey(toDateKey).endUtc } : {}),
      },
    };
    const [totalItems, storedRows, userOptions] = await Promise.all([
      db.leaveLegacyPredictiveLedgerRow.count({ where }),
      db.leaveLegacyPredictiveLedgerRow.findMany({
        where,
        include: { user: { select: { fullName: true } } },
        orderBy: [{ user: { fullName: "asc" } }, { eventDate: "asc" }, { createdAt: "asc" }],
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      db.user.findMany({
        where: { legacyPredictiveLedgerRows: { some: { migrationRunId: appliedRun.id } } },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
    ]);
    return {
      rows: storedRows.map((row) => ({
        userId: row.userId,
        userName: row.user.fullName,
        eventDate: row.eventDate,
        eventDateKey: row.eventDateKey,
        eventType: row.eventType,
        description: row.description,
        referenceId: row.referenceId ?? undefined,
        casualChange: Number(row.casualChange),
        earnedChange: Number(row.earnedChange),
        unpaidDays: Number(row.unpaidDays),
        casualBalance: Number(row.casualBalance),
        earnedBalance: Number(row.earnedBalance),
      })),
      totalItems,
      currentPage: safePage,
      totalPages: Math.max(1, Math.ceil(totalItems / safePageSize)),
      pageSize: safePageSize,
      userOptions,
      fromDateKey: fromDateKey || LEAVE_LEDGER_START_DATE_KEY,
      toDateKey: toDateKey || getIstDateKey(),
      isFrozenSnapshot: true,
      cutoverDateKey: appliedRun.cutoverDateKey,
      appliedAt: appliedRun.appliedAt,
    };
  }

  const source = await loadLegacyPredictiveSourceFromDb();
  const userNameById = new Map(source.users.map((row) => [row.id, row.fullName]));
  const allRows = buildLegacyRowsFromSource(source)
    .filter((row) => !userId || row.userId === userId)
    .filter((row) => !fromDateKey || row.eventDate >= getDayBoundsUtcFromIstDateKey(fromDateKey).startUtc)
    .filter((row) => !toDateKey || row.eventDate < getDayBoundsUtcFromIstDateKey(toDateKey).endUtc)
    .sort((a, b) => {
      const userCompare = (userNameById.get(a.userId) ?? "").localeCompare(userNameById.get(b.userId) ?? "");
      return userCompare || a.eventDate.getTime() - b.eventDate.getTime();
    });
  const userOptions = source.users
    .filter((row) => allRows.some((item) => item.userId === row.id))
    .map((row) => ({ id: row.id, fullName: row.fullName }));
  const totalItems = allRows.length;
  return {
    rows: allRows.slice((safePage - 1) * safePageSize, safePage * safePageSize).map((row) => ({
      ...row,
      userName: userNameById.get(row.userId) ?? "Unknown user",
    })),
    totalItems,
    currentPage: safePage,
    totalPages: Math.max(1, Math.ceil(totalItems / safePageSize)),
    pageSize: safePageSize,
    userOptions,
    fromDateKey: fromDateKey || LEAVE_LEDGER_START_DATE_KEY,
    toDateKey: toDateKey || getIstDateKey(),
    isFrozenSnapshot: false,
    cutoverDateKey: null,
    appliedAt: null,
  };
}

type UnifiedLeaveLedgerInternalRow = PredictiveLeaveLedgerRow & {
  sourceRank: number;
  sortTimestamp: number;
};

function normalizeLegacyEventType(eventType: string) {
  if (eventType === "OPENING") return "OPENING_BALANCE";
  if (eventType === "CREDIT") return "QUARTERLY_CREDIT";
  if (eventType === "DEDUCTION") return "LEAVE_DEDUCTION";
  return eventType;
}

function normalizeLegacyDescription(row: {
  eventType: string;
  description: string;
  eventDateKey: string;
}) {
  if (row.eventType === "OPENING") {
    return `Opening balance as of ${row.eventDateKey}.`;
  }
  return row.description;
}

function normalizeActualEventType(eventType: string) {
  return eventType === "MIGRATION_RESTORE" ? "BALANCE_ADJUSTMENT" : eventType;
}

function normalizeActualDescription(row: {
  transactionType: string;
  note: string | null;
  source: string;
  leaveRequest: { startDate: Date; endDate: Date } | null;
  actor: { fullName: string } | null;
}) {
  const primaryDescription =
    row.transactionType === "MIGRATION_RESTORE"
      ? "Approved future leave balance carried forward for date-based processing."
      : row.note || row.source.replaceAll("_", " ");
  return [
    primaryDescription,
    row.leaveRequest
      ? `Request ${getIstDateKey(row.leaveRequest.startDate)} to ${getIstDateKey(row.leaveRequest.endDate)}`
      : null,
    row.actor ? `Actor: ${row.actor.fullName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Presents the retained pre-cutover predictive history and the post-cutover
 * actual balance transactions as one continuous ledger. Their storage remains
 * separate so audit data is never rewritten or misclassified.
 */
export async function getUnifiedLeaveLedger({
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
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const fromUtc = fromDateKey
    ? getDayBoundsUtcFromIstDateKey(fromDateKey).startUtc
    : undefined;
  const toUtc = toDateKey
    ? getDayBoundsUtcFromIstDateKey(toDateKey).endUtc
    : undefined;
  const appliedRun = await db.leaveMigrationRun.findFirst({
    where: { status: "APPLIED" },
    orderBy: { appliedAt: "desc" },
    select: { id: true, cutoverDateKey: true, appliedAt: true },
  });

  let allRows: UnifiedLeaveLedgerInternalRow[] = [];
  let userOptions: Array<{ id: string; fullName: string }> = [];
  let knownTotalItems: number | null = null;

  if (!appliedRun) {
    const source = await loadLegacyPredictiveSourceFromDb();
    const userNameById = new Map(
      source.users.map((row) => [row.id, row.fullName]),
    );
    allRows = buildLegacyRowsFromSource(source)
      .filter((row) => !userId || row.userId === userId)
      .filter((row) => !fromUtc || row.eventDate >= fromUtc)
      .filter((row) => !toUtc || row.eventDate < toUtc)
      .map((row) => ({
        ...row,
        userName: userNameById.get(row.userId) ?? "Unknown user",
        eventType: normalizeLegacyEventType(row.eventType),
        description: normalizeLegacyDescription(row),
        sourceRank: 0,
        sortTimestamp: row.eventDate.getTime(),
      }));
    userOptions = source.users
      .filter((row) =>
        allRows.some((ledgerRow) => ledgerRow.userId === row.id),
      )
      .map((row) => ({ id: row.id, fullName: row.fullName }));
  } else {
    const cutoverStartUtc = getDayBoundsUtcFromIstDateKey(
      appliedRun.cutoverDateKey,
    ).startUtc;
    const legacyWhere: Prisma.LeaveLegacyPredictiveLedgerRowWhereInput = {
      migrationRunId: appliedRun.id,
      ...(userId ? { userId } : {}),
      eventDate: {
        ...(fromUtc ? { gte: fromUtc } : {}),
        ...(toUtc ? { lt: toUtc } : {}),
      },
    };
    const actualWhere: Prisma.LeaveBalanceTransactionWhereInput = {
      ...(userId ? { userId } : {}),
      transactionType: { not: "OPENING_BALANCE" },
      eventDate: {
        gte:
          fromUtc && fromUtc > cutoverStartUtc ? fromUtc : cutoverStartUtc,
        ...(toUtc ? { lt: toUtc } : {}),
      },
    };
    const candidateLimit = safePage * safePageSize;
    const [legacyCount, actualCount, legacyRows, actualRows, users] =
      await Promise.all([
        db.leaveLegacyPredictiveLedgerRow.count({ where: legacyWhere }),
        db.leaveBalanceTransaction.count({ where: actualWhere }),
        db.leaveLegacyPredictiveLedgerRow.findMany({
          where: legacyWhere,
          include: { user: { select: { fullName: true } } },
          orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
          take: candidateLimit,
        }),
        db.leaveBalanceTransaction.findMany({
          where: actualWhere,
          include: {
            user: { select: { fullName: true } },
            actor: { select: { fullName: true } },
            leaveRequest: { select: { startDate: true, endDate: true } },
          },
          orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
          take: candidateLimit,
        }),
        db.user.findMany({
        where: {
          OR: [
            {
              legacyPredictiveLedgerRows: {
                some: { migrationRunId: appliedRun.id },
              },
            },
            {
              leaveBalanceTransactions: {
                some: {
                  transactionType: { not: "OPENING_BALANCE" },
                  eventDate: { gte: cutoverStartUtc },
                },
              },
            },
          ],
        },
        select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        }),
      ]);

    allRows = [
      ...legacyRows.map((row) => ({
        userId: row.userId,
        userName: row.user.fullName,
        eventDate: row.eventDate,
        eventDateKey: row.eventDateKey,
        eventType: normalizeLegacyEventType(row.eventType),
        description: normalizeLegacyDescription(row),
        referenceId: row.referenceId ?? undefined,
        casualChange: Number(row.casualChange),
        earnedChange: Number(row.earnedChange),
        unpaidDays: Number(row.unpaidDays),
        casualBalance: Number(row.casualBalance),
        earnedBalance: Number(row.earnedBalance),
        sourceRank: 0,
        sortTimestamp: row.eventDate.getTime(),
      })),
      ...actualRows.map((row) => ({
        userId: row.userId,
        userName: row.user.fullName,
        eventDate: row.eventDate,
        eventDateKey: getIstDateKey(row.eventDate),
        eventType: normalizeActualEventType(row.transactionType),
        description: normalizeActualDescription(row),
        referenceId: row.leaveRequestId ?? row.id,
        casualChange: Number(row.casualChange),
        earnedChange: Number(row.earnedChange),
        unpaidDays: Number(row.unpaidChange),
        casualBalance: Number(row.casualBalanceAfter),
        earnedBalance: Number(row.earnedBalanceAfter),
        sourceRank: 1,
        sortTimestamp:
          row.transactionType === "MIGRATION_RESTORE"
            ? row.createdAt.getTime()
            : row.eventDate.getTime(),
      })),
    ];
    userOptions = users;
    knownTotalItems = legacyCount + actualCount;
  }

  allRows.sort((a, b) => {
    const dateCompare = b.eventDateKey.localeCompare(a.eventDateKey);
    if (dateCompare) return dateCompare;
    const sourceCompare = b.sourceRank - a.sourceRank;
    if (sourceCompare) return sourceCompare;
    const timeCompare = b.sortTimestamp - a.sortTimestamp;
    if (timeCompare) return timeCompare;
    return a.userName.localeCompare(b.userName);
  });

  const totalItems = knownTotalItems ?? allRows.length;
  const rows = allRows
    .slice((safePage - 1) * safePageSize, safePage * safePageSize)
    .map(({ sourceRank: _sourceRank, sortTimestamp: _sortTimestamp, ...row }) => {
      void _sourceRank;
      void _sortTimestamp;
      return row;
    });

  return {
    rows,
    totalItems,
    currentPage: safePage,
    totalPages: Math.max(1, Math.ceil(totalItems / safePageSize)),
    pageSize: safePageSize,
    userOptions,
    fromDateKey: fromDateKey || LEAVE_LEDGER_START_DATE_KEY,
    toDateKey: toDateKey || getIstDateKey(),
    cutoverDateKey: appliedRun?.cutoverDateKey ?? null,
  };
}
