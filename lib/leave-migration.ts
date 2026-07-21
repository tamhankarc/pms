import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getDayBoundsUtcFromIstDateKey, getIstDateKey, isValidIstDateKey } from "@/lib/ist";
import { isLeaveAllowedUser } from "@/lib/ems-queries";
import { buildLegacyPredictiveLedgerSnapshot } from "@/lib/leave-admin-ledger";
import {
  createMigrationRestoreTransaction,
  createOpeningBalanceTransaction,
  getSandwichDateSpecs,
  getWorkingDateSpecs,
  getProjectedLeaveBalanceForUserWithClient,
  lockUserLeaveTimeline,
  recalculateFutureAllocationsForUser,
  syncRequestAggregates,
} from "@/lib/leave-system";

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function allocateLegacyWorkingRows(
  specs: Array<{ dateKey: string; date: Date; year: number; duration: number; dayPart: string }>,
  totals: { casual: number; earned: number; unpaid: number },
) {
  let casualRemaining = totals.casual;
  let earnedRemaining = totals.earned;
  let unpaidRemaining = totals.unpaid;
  return specs.map((spec) => {
    let remaining = spec.duration;
    const casual = Math.min(casualRemaining, remaining);
    casualRemaining -= casual;
    remaining -= casual;
    const earned = Math.min(earnedRemaining, remaining);
    earnedRemaining -= earned;
    remaining -= earned;
    const unpaid = Math.min(unpaidRemaining, remaining);
    unpaidRemaining -= unpaid;
    remaining -= unpaid;
    return { ...spec, casual, earned, unpaid: unpaid + Math.max(0, remaining) };
  });
}

async function legacyRequests() {
  return db.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      dateAllocations: { none: {} },
    },
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: [{ userId: "asc" }, { startDate: "asc" }, { approvedAt: "asc" }],
  });
}

export async function getLeaveBalanceTransitionPreview(cutoverDateKey = getIstDateKey()) {
  if (!isValidIstDateKey(cutoverDateKey)) {
    throw new Error("Enter a valid IST cutover date.");
  }
  if (cutoverDateKey > getIstDateKey()) {
    throw new Error("The migration cutover date cannot be in the future.");
  }
  const appliedRun = await db.leaveMigrationRun.findFirst({
    where: { status: "APPLIED" },
    orderBy: { appliedAt: "desc" },
    include: {
      createdBy: { select: { fullName: true } },
      snapshots: {
        include: { user: { select: { fullName: true } } },
        orderBy: [{ year: "asc" }, { user: { fullName: "asc" } }],
      },
    },
  });
  if (appliedRun) {
    const rows = appliedRun.snapshots.map((snapshot) => ({
      userId: snapshot.userId,
      fullName: snapshot.user.fullName,
      year: snapshot.year,
      beforeCasual: Number(snapshot.beforeCasual),
      beforeEarned: Number(snapshot.beforeEarned),
      restoredCasual: Number(snapshot.restoredCasual),
      restoredEarned: Number(snapshot.restoredEarned),
      afterCasual: Number(snapshot.afterCasual),
      afterEarned: Number(snapshot.afterEarned),
      futureCasual: Number(snapshot.futureCasual),
      futureEarned: Number(snapshot.futureEarned),
      futureUnpaid: Number(snapshot.futureUnpaid),
      projectedCasual: Number(snapshot.projectedCasual),
      projectedEarned: Number(snapshot.projectedEarned),
      details: snapshot.detailsJson ? JSON.parse(snapshot.detailsJson) : [],
      warnings: snapshot.warningsJson ? JSON.parse(snapshot.warningsJson) : [],
      affected:
        Number(snapshot.restoredCasual) > 0 ||
        Number(snapshot.restoredEarned) > 0 ||
        Number(snapshot.futureUnpaid) > 0,
    }));
    return {
      cutoverDateKey: appliedRun.cutoverDateKey,
      year: Number(appliedRun.cutoverDateKey.slice(0, 4)),
      rows,
      legacyRequestCount: 0,
      appliedRun,
    };
  }

  const year = Number(cutoverDateKey.slice(0, 4));
  const [allUsers, requests, profiles] = await Promise.all([
    db.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, userType: true, functionalRole: true, isActive: true },
      orderBy: { fullName: "asc" },
    }),
    legacyRequests(),
    db.leaveYearProfile.findMany({ where: { year } }),
  ]);
  const users = allUsers.filter(isLeaveAllowedUser);
  const profileByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const rows = [];
  for (const user of users) {
    const profile = profileByUser.get(user.id);
    const beforeCasual = Number(profile?.casualLeaves ?? 0);
    const beforeEarned = Number(profile?.earnedLeaves ?? 0);
    let restoredCasual = 0;
    let restoredEarned = 0;
    let futureCasual = 0;
    let futureEarned = 0;
    let futureUnpaid = 0;
    const futureWorkingEvents: Array<{
      requestId: string;
      dateKey: string;
      duration: number;
    }> = [];
    const futureSandwichCountByRequest = new Map<string, number>();
    const requestHasProcessedWorkingUnpaid = new Map<string, boolean>();
    const details: Array<Record<string, unknown>> = [];
    const warnings: string[] = [];
    for (const request of requests.filter((item) => item.userId === user.id)) {
      const { specs } = await getWorkingDateSpecs(db as unknown as Prisma.TransactionClient, request);
      const allocated = allocateLegacyWorkingRows(specs, {
        casual: Number(request.casualDaysUsed ?? 0),
        earned: Number(request.earnedDaysUsed ?? 0),
        unpaid: Number(request.unpaidDaysUsed ?? 0),
      });
      const future = allocated.filter((row) => row.dateKey > cutoverDateKey);
      restoredCasual += future.reduce((sum, row) => sum + row.casual, 0);
      restoredEarned += future.reduce((sum, row) => sum + row.earned, 0);
      for (const row of future) {
        if (row.year === year) {
          futureWorkingEvents.push({
            requestId: request.id,
            dateKey: row.dateKey,
            duration: row.duration,
          });
        }
      }
      requestHasProcessedWorkingUnpaid.set(
        request.id,
        allocated.some(
          (row) => row.dateKey <= cutoverDateKey && row.unpaid > 0.001,
        ),
      );
      const workingUnpaid = allocated.reduce((sum, row) => sum + row.unpaid, 0);
      const legacyUnpaid = Number(request.unpaidDaysUsed ?? 0);
      if (legacyUnpaid > workingUnpaid + 0.001) {
        const sandwichCount = Math.max(
          0,
          Math.round(legacyUnpaid - workingUnpaid),
        );
        const migratedSandwichRows = (await getSandwichDateSpecs(db as unknown as Prisma.TransactionClient, request)).slice(
          0,
          sandwichCount,
        );
        futureSandwichCountByRequest.set(
          request.id,
          migratedSandwichRows.filter(
            (spec) =>
              spec.dateKey > cutoverDateKey && spec.year === year,
          ).length,
        );
      }
      if (Number(request.casualDaysUsed ?? 0) + Number(request.earnedDaysUsed ?? 0) + workingUnpaid < specs.reduce((sum, row) => sum + row.duration, 0) - 0.001) {
        warnings.push(`Request ${request.id} has an incomplete legacy breakup and will assign the uncovered portion as unpaid.`);
      }
      details.push({
        requestId: request.id,
        dates: `${getIstDateKey(request.startDate)} to ${getIstDateKey(request.endDate)}`,
        futureDates: future.length,
        restoreCasual: future.reduce((sum, row) => sum + row.casual, 0),
        restoreEarned: future.reduce((sum, row) => sum + row.earned, 0),
      });
    }
    const afterCasual = beforeCasual + restoredCasual;
    const afterEarned = beforeEarned + restoredEarned;
    let projectedCasual = afterCasual;
    let projectedEarned = afterEarned;
    let projectionCursor = cutoverDateKey;
    const projectedUnpaidRequests = new Set<string>();
    const unpaidOnly =
      profile?.employmentStatus === "PROBATION" ||
      profile?.employmentStatus === "CONSULTANT";
    const quarterStarts = [
      `${year}-01-01`,
      `${year}-04-01`,
      `${year}-07-01`,
      `${year}-10-01`,
    ];
    futureWorkingEvents.sort(
      (a, b) =>
        a.dateKey.localeCompare(b.dateKey) ||
        a.requestId.localeCompare(b.requestId),
    );
    for (const event of futureWorkingEvents) {
      if (!unpaidOnly) {
        for (const creditDate of quarterStarts) {
          if (
            creditDate > cutoverDateKey &&
            creditDate > projectionCursor &&
            creditDate <= event.dateKey
          ) {
            projectedCasual += 2;
          }
        }
      }
      projectionCursor = event.dateKey;
      let remaining = event.duration;
      const casual = unpaidOnly ? 0 : Math.min(projectedCasual, remaining);
      projectedCasual -= casual;
      remaining -= casual;
      const earned = unpaidOnly ? 0 : Math.min(projectedEarned, remaining);
      projectedEarned -= earned;
      remaining -= earned;
      const unpaid = Math.max(0, remaining);
      futureCasual += casual;
      futureEarned += earned;
      futureUnpaid += unpaid;
      if (unpaid > 0.001) projectedUnpaidRequests.add(event.requestId);
    }
    for (const [requestId, count] of futureSandwichCountByRequest) {
      if (
        requestHasProcessedWorkingUnpaid.get(requestId) ||
        projectedUnpaidRequests.has(requestId)
      ) {
        futureUnpaid += count;
      }
    }

    rows.push({
      userId: user.id,
      fullName: user.fullName,
      year,
      beforeCasual,
      beforeEarned,
      restoredCasual,
      restoredEarned,
      afterCasual,
      afterEarned,
      futureCasual,
      futureEarned,
      futureUnpaid,
      projectedCasual,
      projectedEarned,
      details,
      warnings,
      affected: restoredCasual > 0 || restoredEarned > 0 || futureUnpaid > 0,
    });
  }
  return { cutoverDateKey, year, rows, legacyRequestCount: requests.length, appliedRun: null };
}

export async function applyLeaveBalanceTransition(input: {
  cutoverDateKey: string;
  actorId: string;
  note: string;
}) {
  if (!isValidIstDateKey(input.cutoverDateKey)) {
    throw new Error("Enter a valid IST cutover date.");
  }
  if (input.cutoverDateKey > getIstDateKey()) {
    throw new Error("The migration cutover date cannot be in the future.");
  }
  if (!input.note.trim()) throw new Error("A migration note is required.");
  const preview = await getLeaveBalanceTransitionPreview(input.cutoverDateKey);
  if (preview.appliedRun) {
    throw new Error("The deferred leave-balance migration has already been applied.");
  }
  const previewByUser = new Map(preview.rows.map((row) => [row.userId, row]));

  return db.$transaction(async (tx) => {
    const previous = await tx.leaveMigrationRun.findFirst({ where: { status: "APPLIED" }, select: { id: true } });
    if (previous) throw new Error("The deferred leave-balance migration has already been applied.");
    const run = await tx.leaveMigrationRun.create({
      data: {
        cutoverDateKey: input.cutoverDateKey,
        status: "APPLIED",
        note: input.note,
        createdById: input.actorId,
        appliedAt: new Date(),
      },
    });
    const legacyPredictiveRows = await buildLegacyPredictiveLedgerSnapshot(tx);
    if (legacyPredictiveRows.length > 0) {
      await tx.leaveLegacyPredictiveLedgerRow.createMany({
        data: legacyPredictiveRows.map((row) => ({
          migrationRunId: run.id,
          userId: row.userId,
          eventDate: row.eventDate,
          eventDateKey: row.eventDateKey,
          eventType: row.eventType,
          description: row.description,
          referenceId: row.referenceId,
          casualChange: decimal(row.casualChange),
          earnedChange: decimal(row.earnedChange),
          unpaidDays: decimal(row.unpaidDays),
          casualBalance: decimal(row.casualBalance),
          earnedBalance: decimal(row.earnedBalance),
        })),
      });
    }
    const requests = await tx.leaveRequest.findMany({
      where: { status: "APPROVED", dateAllocations: { none: {} } },
      orderBy: [{ userId: "asc" }, { startDate: "asc" }, { approvedAt: "asc" }],
    });
    const affectedUsers = new Set<string>();
    const lockedUsers = new Set<string>();
    const restoreByUserYear = new Map<string, { userId: string; year: number; casual: number; earned: number }>();

    for (const request of requests) {
      if (!lockedUsers.has(request.userId)) {
        await lockUserLeaveTimeline(tx, request.userId);
        lockedUsers.add(request.userId);
      }
      const { specs } = await getWorkingDateSpecs(tx, request);
      const allocated = allocateLegacyWorkingRows(specs, {
        casual: Number(request.casualDaysUsed ?? 0),
        earned: Number(request.earnedDaysUsed ?? 0),
        unpaid: Number(request.unpaidDaysUsed ?? 0),
      });
      let workingUnpaid = 0;
      for (const row of allocated) {
        workingUnpaid += row.unpaid;
        const future = row.dateKey > input.cutoverDateKey;
        await tx.leaveDateAllocation.create({
          data: {
            leaveRequestId: request.id,
            userId: request.userId,
            year: row.year,
            leaveDate: row.date,
            duration: decimal(row.duration),
            dayPart: row.dayPart,
            casualDays: decimal(row.casual),
            earnedDays: decimal(row.earned),
            unpaidDays: decimal(row.unpaid),
            status: future ? "SCHEDULED" : "PROCESSED",
            processedAt: future ? null : request.approvedAt ?? request.updatedAt,
            processingSource: "MIGRATION",
            note: future
              ? "Legacy approved future leave converted to a scheduled allocation."
              : "Legacy approved leave recorded as already processed at migration cutover.",
          },
        });
        if (future && (row.casual > 0 || row.earned > 0)) {
          // The old implementation deducted the entire request from its start-year profile.
          const originalYear = Number(getIstDateKey(request.startDate).slice(0, 4));
          const key = `${request.userId}:${originalYear}`;
          const current = restoreByUserYear.get(key) ?? { userId: request.userId, year: originalYear, casual: 0, earned: 0 };
          current.casual += row.casual;
          current.earned += row.earned;
          restoreByUserYear.set(key, current);
        }
      }
      const sandwichCount = Math.max(0, Math.round(Number(request.unpaidDaysUsed ?? 0) - workingUnpaid));
      if (sandwichCount > 0) {
        const sandwich = await getSandwichDateSpecs(tx, request);
        for (const spec of sandwich.slice(0, sandwichCount)) {
          const future = spec.dateKey > input.cutoverDateKey;
          await tx.leaveDateAllocation.create({
            data: {
              leaveRequestId: request.id,
              userId: request.userId,
              year: spec.year,
              leaveDate: spec.date,
              duration: decimal(1),
              dayPart: "SANDWICH",
              casualDays: decimal(0),
              earnedDays: decimal(0),
              unpaidDays: decimal(1),
              isSandwichDay: true,
              status: future ? "SCHEDULED" : "PROCESSED",
              processedAt: future ? null : request.approvedAt ?? request.updatedAt,
              processingSource: "MIGRATION",
              note: "Legacy sandwich unpaid day reconstructed during migration.",
            },
          });
        }
      }
      affectedUsers.add(request.userId);
      await syncRequestAggregates(tx, request.id);
    }

    const year = Number(input.cutoverDateKey.slice(0, 4));
    const users = await tx.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        userType: true,
        functionalRole: true,
        isActive: true,
      },
    });
    const eligibleUsers = users.filter(isLeaveAllowedUser);
    for (const user of eligibleUsers) {
      if (!lockedUsers.has(user.id)) {
        await lockUserLeaveTimeline(tx, user.id);
        lockedUsers.add(user.id);
      }
      const profile = await tx.leaveYearProfile.findUnique({
        where: { userId_year: { userId: user.id, year } },
        select: { id: true },
      });
      if (!profile) continue;
      await createOpeningBalanceTransaction(tx, {
        userId: user.id,
        year,
        actorId: input.actorId,
        note: `Opening actual balance captured at deferred-leave migration cutover ${input.cutoverDateKey}.`,
        idempotencyKey: `migration-opening:${run.id}:${user.id}:${year}`,
        eventDateKey: input.cutoverDateKey,
      });
    }

    for (const row of restoreByUserYear.values()) {
      await createOpeningBalanceTransaction(tx, {
        userId: row.userId,
        year: row.year,
        actorId: input.actorId,
        note: `Opening actual balance captured before deferred-leave migration ${run.id}.`,
        idempotencyKey: `migration-opening:${run.id}:${row.userId}:${row.year}`,
        eventDateKey: input.cutoverDateKey,
      });
      await createMigrationRestoreTransaction(tx, {
        userId: row.userId,
        year: row.year,
        casualRestore: row.casual,
        earnedRestore: row.earned,
        actorId: input.actorId,
        note: `Restored paid leave previously deducted for approved dates after ${input.cutoverDateKey}.`,
        idempotencyKey: `migration-restore:${run.id}:${row.userId}:${row.year}`,
        eventDateKey: input.cutoverDateKey,
      });
    }

    for (const userId of affectedUsers) {
      await recalculateFutureAllocationsForUser(tx, userId, input.cutoverDateKey);
    }

    for (const user of eligibleUsers) {
      const profile = await tx.leaveYearProfile.findUnique({ where: { userId_year: { userId: user.id, year } } });
      if (!profile) continue;
      const scheduled = await tx.leaveDateAllocation.findMany({
        where: { userId: user.id, year, status: "SCHEDULED", leaveDate: { gt: getDayBoundsUtcFromIstDateKey(input.cutoverDateKey).startUtc } },
      });
      const restored = [...restoreByUserYear.values()].filter((row) => row.userId === user.id && row.year === year).reduce((sum, row) => ({ casual: sum.casual + row.casual, earned: sum.earned + row.earned }), { casual: 0, earned: 0 });
      const futureCasual = scheduled.reduce((sum, row) => sum + Number(row.casualDays), 0);
      const futureEarned = scheduled.reduce((sum, row) => sum + Number(row.earnedDays), 0);
      const futureUnpaid = scheduled.reduce((sum, row) => sum + Number(row.unpaidDays), 0);
      const projected = await getProjectedLeaveBalanceForUserWithClient(
        tx,
        user.id,
        year,
        input.cutoverDateKey,
      );
      await tx.leaveMigrationUserSnapshot.create({
        data: {
          migrationRunId: run.id,
          userId: user.id,
          year,
          beforeCasual: decimal(Number(profile.casualLeaves) - restored.casual),
          beforeEarned: decimal(Number(profile.earnedLeaves) - restored.earned),
          restoredCasual: decimal(restored.casual),
          restoredEarned: decimal(restored.earned),
          afterCasual: decimal(Number(profile.casualLeaves)),
          afterEarned: decimal(Number(profile.earnedLeaves)),
          futureCasual: decimal(futureCasual),
          futureEarned: decimal(futureEarned),
          futureUnpaid: decimal(futureUnpaid),
          projectedCasual: decimal(projected.projected.casualLeaves),
          projectedEarned: decimal(projected.projected.earnedLeaves),
          warningsJson: JSON.stringify(previewByUser.get(user.id)?.warnings ?? []),
          detailsJson: JSON.stringify(
            previewByUser.get(user.id)?.details ?? {
              migratedRequests: requests
                .filter((request) => request.userId === user.id)
                .map((request) => request.id),
            },
          ),
        },
      });
    }
    await tx.leaveMigrationRun.update({
      where: { id: run.id },
      data: { summaryJson: JSON.stringify({ requests: requests.length, users: affectedUsers.size, restoredGroups: restoreByUserYear.size, legacyPredictiveRows: legacyPredictiveRows.length }) },
    });
    return { runId: run.id, requests: requests.length, users: affectedUsers.size };
  }, { timeout: 120000 });
}
