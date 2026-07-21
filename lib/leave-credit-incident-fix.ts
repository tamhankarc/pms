import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getIstDateKey } from "@/lib/ist";
import {
  lockUserLeaveTimeline,
  processDueLeaveAllocationsForUser,
  recalculateFutureAllocationsForUser,
} from "@/lib/leave-system";

const INCIDENT_YEAR = 2026;
const INCIDENT_QUARTERS = [1, 2] as const;
const INCIDENT_AS_OF_DATE_KEY = "2026-07-17";
const INCIDENT_RUN_START = new Date("2026-07-16T18:29:00.000Z");
const INCIDENT_RUN_END = new Date("2026-07-16T18:31:00.000Z");
const EXPECTED_CREDIT_TRANSACTION_COUNT = 114;
const EXPECTED_CREDIT_TOTAL = 228;
const EXPECTED_QUARTER_MARKER_COUNT = 114;
const EXPECTED_DEDUCTION_COUNT = 6;
const REPLAYABLE_DEDUCTION_SOURCES = new Set([
  "DAILY_CRON",
  "URGENT_APPROVAL",
  "BACKDATED_APPROVAL",
]);

type ReplayableDeductionSource =
  | "DAILY_CRON"
  | "URGENT_APPROVAL"
  | "BACKDATED_APPROVAL";

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}

function isReplayableDeduction(
  row: Awaited<ReturnType<typeof findAllLaterTransactions>>[number],
) {
  return (
    row.transactionType === "LEAVE_DEDUCTION" &&
    Boolean(row.leaveYearProfileId) &&
    Boolean(row.leaveRequestId) &&
    Boolean(row.leaveDateAllocationId) &&
    REPLAYABLE_DEDUCTION_SOURCES.has(row.source)
  );
}

async function findAllLaterTransactions(
  client: Prisma.TransactionClient,
  affectedUserIds: string[],
) {
  if (!affectedUserIds.length) return [];
  return client.leaveBalanceTransaction.findMany({
    where: {
      userId: { in: affectedUserIds },
      createdAt: { gte: INCIDENT_RUN_END },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

async function findIncidentRows(client: Prisma.TransactionClient) {
  const creditTransactions = await client.leaveBalanceTransaction.findMany({
    where: {
      transactionType: "QUARTERLY_CREDIT",
      source: "DAILY_CRON",
      year: INCIDENT_YEAR,
      OR: [
        { idempotencyKey: { endsWith: `:${INCIDENT_YEAR}:1` } },
        { idempotencyKey: { endsWith: `:${INCIDENT_YEAR}:2` } },
      ],
    },
    orderBy: [{ userId: "asc" }, { eventDate: "asc" }],
  });

  const quarterMarkers = await client.leaveQuarterlyCasualCredit.findMany({
    where: {
      year: INCIDENT_YEAR,
      quarter: { in: [...INCIDENT_QUARTERS] },
      source: "DAILY_CRON",
    },
    orderBy: [{ userId: "asc" }, { quarter: "asc" }],
  });

  const incidentDeductionTransactions =
    await client.leaveBalanceTransaction.findMany({
      where: {
        transactionType: "LEAVE_DEDUCTION",
        source: "DAILY_CRON",
        createdAt: { gte: INCIDENT_RUN_START, lt: INCIDENT_RUN_END },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

  const initiallyAffectedUserIds = unique([
    ...creditTransactions.map((row) => row.userId),
    ...incidentDeductionTransactions.map((row) => row.userId),
  ]);

  const allLaterTransactions = await findAllLaterTransactions(
    client,
    initiallyAffectedUserIds,
  );
  const laterDeductionTransactions = allLaterTransactions.filter(
    isReplayableDeduction,
  );
  const unsupportedLaterTransactions = allLaterTransactions.filter(
    (row) => !isReplayableDeduction(row),
  );

  const replayDeductionTransactions = [
    ...incidentDeductionTransactions,
    ...laterDeductionTransactions,
  ].sort((left, right) => {
    const createdDifference =
      left.createdAt.getTime() - right.createdAt.getTime();
    return createdDifference || left.id.localeCompare(right.id);
  });

  const affectedUserIds = unique([
    ...creditTransactions.map((row) => row.userId),
    ...replayDeductionTransactions.map((row) => row.userId),
  ]);

  return {
    creditTransactions,
    quarterMarkers,
    incidentDeductionTransactions,
    laterDeductionTransactions,
    replayDeductionTransactions,
    unsupportedLaterTransactions,
    affectedUserIds,
  };
}

function transactionSummary(
  row: Awaited<ReturnType<typeof findIncidentRows>>["laterDeductionTransactions"][number],
) {
  return {
    id: row.id,
    userId: row.userId,
    transactionType: row.transactionType,
    source: row.source,
    eventDate: row.eventDate,
    createdAt: row.createdAt,
    leaveRequestId: row.leaveRequestId,
    leaveDateAllocationId: row.leaveDateAllocationId,
    note: row.note,
  };
}

function summarizeRows(rows: Awaited<ReturnType<typeof findIncidentRows>>) {
  const totalCredit = rows.creditTransactions.reduce(
    (sum, row) => sum + numberValue(row.casualChange),
    0,
  );
  const markerTotal = rows.quarterMarkers.reduce(
    (sum, row) => sum + numberValue(row.credited),
    0,
  );
  const validation = {
    creditTransactionCount:
      rows.creditTransactions.length === EXPECTED_CREDIT_TRANSACTION_COUNT,
    creditTotal: Math.abs(totalCredit - EXPECTED_CREDIT_TOTAL) < 0.0001,
    quarterMarkerCount:
      rows.quarterMarkers.length === EXPECTED_QUARTER_MARKER_COUNT,
    quarterMarkerTotal: Math.abs(markerTotal - EXPECTED_CREDIT_TOTAL) < 0.0001,
    deductionCount:
      rows.incidentDeductionTransactions.length === EXPECTED_DEDUCTION_COUNT,
    noUnsupportedLaterTransactions:
      rows.unsupportedLaterTransactions.length === 0,
  };

  return {
    incident: {
      year: INCIDENT_YEAR,
      quarters: [...INCIDENT_QUARTERS],
      asOfDateKey: INCIDENT_AS_OF_DATE_KEY,
      runWindowUtc: {
        start: INCIDENT_RUN_START.toISOString(),
        end: INCIDENT_RUN_END.toISOString(),
      },
    },
    creditTransactions: rows.creditTransactions.length,
    creditTotal: Number(totalCredit.toFixed(2)),
    quarterMarkers: rows.quarterMarkers.length,
    quarterMarkerTotal: Number(markerTotal.toFixed(2)),
    incidentDeductionsToReprocess:
      rows.incidentDeductionTransactions.length,
    laterDeductionsToReprocess: rows.laterDeductionTransactions.map(
      transactionSummary,
    ),
    totalDeductionsToReprocess: rows.replayDeductionTransactions.length,
    affectedUsers: rows.affectedUserIds.length,
    unsupportedLaterTransactions: rows.unsupportedLaterTransactions.map(
      transactionSummary,
    ),
    validation,
    safeToApply: Object.values(validation).every(Boolean),
  };
}

export async function previewPreSystemQuarterlyCreditIncidentFix() {
  return db.$transaction(async (tx) => summarizeRows(await findIncidentRows(tx)));
}

export async function applyPreSystemQuarterlyCreditIncidentFix() {
  const preview = await previewPreSystemQuarterlyCreditIncidentFix();
  if (!preview.safeToApply) {
    throw new Error(
      `Incident correction validation failed. Review preview output before applying: ${JSON.stringify(preview)}`,
    );
  }

  return db.$transaction(
    async (tx) => {
      const rows = await findIncidentRows(tx);
      const current = summarizeRows(rows);
      if (!current.safeToApply) {
        throw new Error(
          `Incident rows changed after preview. Nothing was changed: ${JSON.stringify(current)}`,
        );
      }

      for (const userId of rows.affectedUserIds) {
        await lockUserLeaveTimeline(tx, userId);
      }

      // Rewind every leave deduction whose allocation was calculated while the
      // erroneous Q1/Q2 credits were present. This includes the six deductions
      // from the faulty cron run and any later urgent/backdated/daily deduction
      // for the same affected employees.
      const deductionProfileAdjustments = new Map<
        string,
        { casual: number; earned: number }
      >();
      for (const row of rows.replayDeductionTransactions) {
        if (!row.leaveYearProfileId || !row.leaveDateAllocationId) {
          throw new Error(
            `Leave deduction ${row.id} is missing its profile or date allocation reference.`,
          );
        }
        const existing = deductionProfileAdjustments.get(
          row.leaveYearProfileId,
        ) ?? { casual: 0, earned: 0 };
        existing.casual += -numberValue(row.casualChange);
        existing.earned += -numberValue(row.earnedChange);
        deductionProfileAdjustments.set(row.leaveYearProfileId, existing);
      }

      for (const [profileId, adjustment] of deductionProfileAdjustments) {
        await tx.leaveYearProfile.update({
          where: { id: profileId },
          data: {
            casualLeaves: { increment: decimal(adjustment.casual) },
            earnedLeaves: { increment: decimal(adjustment.earned) },
          },
        });
      }

      for (const row of rows.replayDeductionTransactions) {
        await tx.leaveDateAllocation.update({
          where: { id: row.leaveDateAllocationId! },
          data: {
            status: "SCHEDULED",
            processedAt: null,
            processedById: null,
            processingSource: null,
            note: null,
          },
        });
      }

      await tx.leaveBalanceTransaction.deleteMany({
        where: {
          id: { in: rows.replayDeductionTransactions.map((row) => row.id) },
        },
      });

      const creditProfileAdjustments = new Map<string, number>();
      for (const row of rows.creditTransactions) {
        if (!row.leaveYearProfileId) {
          throw new Error(
            `Quarterly credit ${row.id} is missing its profile reference.`,
          );
        }
        creditProfileAdjustments.set(
          row.leaveYearProfileId,
          (creditProfileAdjustments.get(row.leaveYearProfileId) ?? 0) +
            numberValue(row.casualChange),
        );
      }

      for (const [profileId, credit] of creditProfileAdjustments) {
        await tx.leaveYearProfile.update({
          where: { id: profileId },
          data: { casualLeaves: { decrement: decimal(credit) } },
        });
      }

      await tx.leaveBalanceTransaction.deleteMany({
        where: { id: { in: rows.creditTransactions.map((row) => row.id) } },
      });
      await tx.leaveQuarterlyCasualCredit.deleteMany({
        where: { id: { in: rows.quarterMarkers.map((row) => row.id) } },
      });

      for (const userId of rows.affectedUserIds) {
        await recalculateFutureAllocationsForUser(
          tx,
          userId,
          INCIDENT_AS_OF_DATE_KEY,
        );
      }

      let reprocessedDeductions = 0;
      for (const row of rows.replayDeductionTransactions) {
        const source = row.source as ReplayableDeductionSource;
        const processed = await processDueLeaveAllocationsForUser(tx, {
          userId: row.userId,
          throughDateKey: getIstDateKey(row.eventDate),
          actorId: row.actorId,
          allocationIds: [row.leaveDateAllocationId!],
          sourceOverride: source,
        });
        if (processed.processed !== 1) {
          throw new Error(
            `Expected to reprocess allocation ${row.leaveDateAllocationId}, but processed ${processed.processed}. Nothing was committed.`,
          );
        }
        reprocessedDeductions += processed.processed;
      }

      const replayThroughDateKey = rows.replayDeductionTransactions.reduce(
        (latest, row) => {
          const rowDateKey = getIstDateKey(row.eventDate);
          return rowDateKey > latest ? rowDateKey : latest;
        },
        INCIDENT_AS_OF_DATE_KEY,
      );
      for (const userId of rows.affectedUserIds) {
        await recalculateFutureAllocationsForUser(
          tx,
          userId,
          replayThroughDateKey,
        );
      }

      if (reprocessedDeductions !== rows.replayDeductionTransactions.length) {
        throw new Error(
          `Expected to reprocess ${rows.replayDeductionTransactions.length} leave deductions, but processed ${reprocessedDeductions}. Nothing was committed.`,
        );
      }

      const remainingBadCredits = await tx.leaveBalanceTransaction.count({
        where: {
          transactionType: "QUARTERLY_CREDIT",
          source: "DAILY_CRON",
          year: INCIDENT_YEAR,
          OR: [
            { idempotencyKey: { endsWith: `:${INCIDENT_YEAR}:1` } },
            { idempotencyKey: { endsWith: `:${INCIDENT_YEAR}:2` } },
          ],
        },
      });
      const remainingMarkers = await tx.leaveQuarterlyCasualCredit.count({
        where: {
          year: INCIDENT_YEAR,
          quarter: { in: [...INCIDENT_QUARTERS] },
          source: "DAILY_CRON",
        },
      });
      if (remainingBadCredits || remainingMarkers) {
        throw new Error(
          "Erroneous quarterly-credit rows still exist. Nothing was committed.",
        );
      }

      const recreatedTransactions =
        await tx.leaveBalanceTransaction.findMany({
          where: {
            leaveDateAllocationId: {
              in: rows.replayDeductionTransactions.map(
                (row) => row.leaveDateAllocationId!,
              ),
            },
            transactionType: "LEAVE_DEDUCTION",
          },
          select: {
            leaveDateAllocationId: true,
            source: true,
          },
        });
      const recreatedByAllocation = new Map(
        recreatedTransactions.map((row) => [
          row.leaveDateAllocationId,
          row.source,
        ]),
      );
      for (const original of rows.replayDeductionTransactions) {
        if (
          recreatedByAllocation.get(original.leaveDateAllocationId) !==
          original.source
        ) {
          throw new Error(
            `Replayed deduction ${original.leaveDateAllocationId} did not retain source ${original.source}. Nothing was committed.`,
          );
        }
      }

      return {
        ok: true,
        removedCreditTransactions: rows.creditTransactions.length,
        removedQuarterMarkers: rows.quarterMarkers.length,
        removedCreditTotal: EXPECTED_CREDIT_TOTAL,
        rewoundIncidentDeductions:
          rows.incidentDeductionTransactions.length,
        rewoundLaterDeductions: rows.laterDeductionTransactions.length,
        reprocessedDeductions,
        affectedUsers: rows.affectedUserIds.length,
      };
    },
    { maxWait: 30_000, timeout: 180_000 },
  );
}
