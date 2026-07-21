import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getDayBoundsUtcFromIstDateKey,
  getDisplayDateFromKey,
  getIstDateKey,
  isWeekendDateKey,
} from "@/lib/ist";

export type LeaveDayPart =
  | "FULL_DAY"
  | "HALF_DAY"
  | "FIRST_HALF"
  | "SECOND_HALF"
  | "SANDWICH";
export type LeaveSelectionMode = "FULL_DAYS" | "HALF_DAYS" | "CUSTOM";

type DbClient = Prisma.TransactionClient;

type RequestLike = {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  daySelectionMode: unknown;
  leaveDayTypesJson?: string | null;
  manualAllocationOverrideJson?: string | null;
  manualOverrideNote?: string | null;
  approvedAt?: Date | null;
  createdAt?: Date;
};

type WorkingDateSpec = {
  dateKey: string;
  date: Date;
  year: number;
  duration: number;
  dayPart: LeaveDayPart;
};

type AllocationAmounts = {
  casual: number;
  earned: number;
  unpaid: number;
};

type ProjectionYearState = {
  year: number;
  casual: number;
  earned: number;
  employmentStatus: "PROBATION" | "PERMANENT" | "CONSULTANT";
  shift: "DAY" | "NIGHT";
  lastProjectedDateKey: string;
};

const EARNED_ANNUAL_CREDIT = 12.96;
const EARNED_CARRY_FORWARD_LIMIT = 45;
export const LEAVE_SYSTEM_START_DATE_KEY = "2026-06-01";
export const PAST_LEAVE_CANCELLATION_WINDOW_DAYS = 10;
const QUARTERLY_CASUAL_CREDIT = 2;

export function isLeaveStartWithinPastCancellationWindow(
  startDate: Date | string,
  asOfDateKey: string = getIstDateKey(),
) {
  const asOfDate = getDisplayDateFromKey(asOfDateKey);
  const cutoffDate = new Date(
    asOfDate.getTime() - PAST_LEAVE_CANCELLATION_WINDOW_DAYS * 86_400_000,
  );
  const cutoffDateKey = getIstDateKey(cutoffDate);
  const startDateKey = getIstDateKey(
    typeof startDate === "string" ? new Date(startDate) : startDate,
  );

  return startDateKey >= cutoffDateKey;
}

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}


export async function lockUserLeaveTimeline(
  client: Prisma.TransactionClient,
  userId: string,
) {
  await client.$queryRaw`SELECT id FROM \`User\` WHERE id = ${userId} FOR UPDATE`;
}

export function nextIstDateKey(dateKey: string) {
  return getIstDateKey(getDayBoundsUtcFromIstDateKey(dateKey).endUtc);
}

export function previousIstDateKey(dateKey: string) {
  const start = getDayBoundsUtcFromIstDateKey(dateKey).startUtc;
  return getIstDateKey(new Date(start.getTime() - 1));
}

function normalizeDayPart(value: unknown): LeaveDayPart {
  return value === "FIRST_HALF" ||
    value === "SECOND_HALF" ||
    value === "HALF_DAY"
    ? value
    : "FULL_DAY";
}

function durationForPart(value: LeaveDayPart) {
  return value === "FULL_DAY" || value === "SANDWICH" ? 1 : 0.5;
}

export function parseLeaveDayTypesJson(raw?: string | null) {
  if (!raw) return {} as Record<string, LeaveDayPart>;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([dateKey, value]) => [
        dateKey,
        normalizeDayPart(value),
      ]),
    ) as Record<string, LeaveDayPart>;
  } catch {
    return {} as Record<string, LeaveDayPart>;
  }
}

export function parseManualAllocationOverride(raw?: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<{
      casualDays: number;
      earnedDays: number;
      unpaidDays: number;
    }>;
    const casualDays = Math.max(0, Number(parsed.casualDays ?? 0));
    const earnedDays = Math.max(0, Number(parsed.earnedDays ?? 0));
    const unpaidDays = Math.max(0, Number(parsed.unpaidDays ?? 0));
    if (![casualDays, earnedDays, unpaidDays].every(Number.isFinite)) return null;
    return { casualDays, earnedDays, unpaidDays };
  } catch {
    return null;
  }
}

async function getOrCreateProfile(
  client: DbClient,
  userId: string,
  year: number,
) {
  const existing = await client.leaveYearProfile.findUnique({
    where: { userId_year: { userId, year } },
  });
  if (existing) return existing;

  const previous = await client.leaveYearProfile.findUnique({
    where: { userId_year: { userId, year: year - 1 } },
  });
  const employmentStatus = previous?.employmentStatus ?? "PROBATION";
  const unpaidOnly =
    employmentStatus === "PROBATION" || employmentStatus === "CONSULTANT";
  const carryForwardEarned = Math.min(
    numberValue(previous?.earnedLeaves),
    EARNED_CARRY_FORWARD_LIMIT,
  );

  try {
    return await client.leaveYearProfile.create({
      data: {
        userId,
        year,
        casualLeaves: decimal(0),
        earnedLeaves: decimal(
          unpaidOnly ? 0 : carryForwardEarned + EARNED_ANNUAL_CREDIT,
        ),
        shift: previous?.shift ?? "DAY",
        employmentStatus,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await client.leaveYearProfile.findUnique({
        where: { userId_year: { userId, year } },
      });
      if (raced) return raced;
    }
    throw error;
  }
}

type CalendarProfile = {
  shift: "DAY" | "NIGHT";
  employmentStatus: "PROBATION" | "PERMANENT" | "CONSULTANT";
};

async function getProfileForCalendarRules(
  client: DbClient,
  userId: string,
  year: number,
): Promise<CalendarProfile> {
  const existing = await client.leaveYearProfile.findUnique({
    where: { userId_year: { userId, year } },
    select: { shift: true, employmentStatus: true },
  });
  if (existing) return existing;

  const currentYear = Number(getIstDateKey().slice(0, 4));
  if (year <= currentYear) {
    const profile = await getOrCreateProfile(client, userId, year);
    return { shift: profile.shift, employmentStatus: profile.employmentStatus };
  }

  // Do not create a future-year balance profile merely to determine working
  // days. Its eventual opening Earned balance must be based on the actual
  // closing balance of the preceding year, not today's projected snapshot.
  const source = await client.leaveYearProfile.findFirst({
    where: { userId, year: { lte: currentYear } },
    orderBy: { year: "desc" },
    select: { shift: true, employmentStatus: true },
  });
  if (source) return source;
  const current = await getOrCreateProfile(client, userId, currentYear);
  return { shift: current.shift, employmentStatus: current.employmentStatus };
}

async function getHolidayKeys(
  client: DbClient,
  year: number,
  shift: "DAY" | "NIGHT",
) {
  const rows = await client.officialHoliday.findMany({
    where: {
      year,
      OR: [{ shift }, { shift: "BOTH" }],
    },
    select: { holidayDate: true },
  });
  return new Set(rows.map((row) => getIstDateKey(row.holidayDate)));
}

export async function getWorkingDateSpecs(
  client: DbClient,
  request: Pick<
    RequestLike,
    | "userId"
    | "startDate"
    | "endDate"
    | "daySelectionMode"
    | "leaveDayTypesJson"
  >,
) {
  const startDateKey = getIstDateKey(request.startDate);
  const endDateKey = getIstDateKey(request.endDate);
  const storedParts = parseLeaveDayTypesJson(request.leaveDayTypesJson);
  const mode: LeaveSelectionMode =
    request.daySelectionMode === "HALF_DAYS" ||
    request.daySelectionMode === "CUSTOM"
      ? request.daySelectionMode
      : "FULL_DAYS";
  const profileByYear = new Map<number, CalendarProfile>();
  const holidaysByYear = new Map<number, Set<string>>();
  const specs: WorkingDateSpec[] = [];

  let cursor = startDateKey;
  while (cursor <= endDateKey) {
    const year = Number(cursor.slice(0, 4));
    let profile = profileByYear.get(year);
    if (!profile) {
      profile = await getProfileForCalendarRules(client, request.userId, year);
      profileByYear.set(year, profile);
    }
    let holidayKeys = holidaysByYear.get(year);
    if (!holidayKeys) {
      holidayKeys = await getHolidayKeys(client, year, profile.shift);
      holidaysByYear.set(year, holidayKeys);
    }

    if (!isWeekendDateKey(cursor) && !holidayKeys.has(cursor)) {
      const stored = normalizeDayPart(storedParts[cursor]);
      const dayPart =
        mode === "HALF_DAYS"
          ? stored === "SECOND_HALF"
            ? "SECOND_HALF"
            : "FIRST_HALF"
          : mode === "CUSTOM"
            ? stored
            : "FULL_DAY";
      specs.push({
        dateKey: cursor,
        date: getDayBoundsUtcFromIstDateKey(cursor).startUtc,
        year,
        duration: durationForPart(dayPart),
        dayPart,
      });
    }
    cursor = nextIstDateKey(cursor);
  }

  return { specs, profileByYear, holidaysByYear, startDateKey, endDateKey };
}

export async function getSandwichDateSpecs(
  client: DbClient,
  request: Pick<RequestLike, "userId" | "startDate" | "endDate">,
) {
  const startDateKey = getIstDateKey(request.startDate);
  const endDateKey = getIstDateKey(request.endDate);
  const profileByYear = new Map<number, CalendarProfile>();
  const holidaysByYear = new Map<number, Set<string>>();
  const specs: WorkingDateSpec[] = [];
  let cursor = nextIstDateKey(startDateKey);
  while (cursor < endDateKey) {
    const year = Number(cursor.slice(0, 4));
    let profile = profileByYear.get(year);
    if (!profile) {
      profile = await getProfileForCalendarRules(client, request.userId, year);
      profileByYear.set(year, profile);
    }
    let holidayKeys = holidaysByYear.get(year);
    if (!holidayKeys) {
      holidayKeys = await getHolidayKeys(client, year, profile.shift);
      holidaysByYear.set(year, holidayKeys);
    }
    if (isWeekendDateKey(cursor) || holidayKeys.has(cursor)) {
      specs.push({
        dateKey: cursor,
        date: getDayBoundsUtcFromIstDateKey(cursor).startUtc,
        year,
        duration: 1,
        dayPart: "SANDWICH",
      });
    }
    cursor = nextIstDateKey(cursor);
  }
  return specs;
}

function quarterStartKeys(year: number) {
  return [
    `${year}-01-01`,
    `${year}-04-01`,
    `${year}-07-01`,
    `${year}-10-01`,
  ];
}

function isUnpaidOnly(status: ProjectionYearState["employmentStatus"]) {
  return status === "PROBATION" || status === "CONSULTANT";
}

async function createProjectionState(
  client: DbClient,
  userId: string,
  year: number,
  asOfDateKey: string,
  previous?: ProjectionYearState,
): Promise<ProjectionYearState> {
  const currentYear = Number(asOfDateKey.slice(0, 4));
  const existing = await client.leaveYearProfile.findUnique({
    where: { userId_year: { userId, year } },
  });

  if (year <= currentYear) {
    const profile = existing ?? (await getOrCreateProfile(client, userId, year));
    return {
      year,
      casual: numberValue(profile.casualLeaves),
      earned: numberValue(profile.earnedLeaves),
      employmentStatus: profile.employmentStatus,
      shift: profile.shift,
      lastProjectedDateKey:
        year === currentYear ? asOfDateKey : `${year}-01-01`,
    };
  }

  // A future LeaveYearProfile may already exist because a cross-year request
  // was inspected. Its stored balance must not override the projected closing
  // balance of the preceding year. Carry-forward is derived from the timeline.
  const source =
    previous ??
    (await createProjectionState(client, userId, year - 1, asOfDateKey));
  const employmentStatus = existing?.employmentStatus ?? source.employmentStatus;
  const unpaidOnly = isUnpaidOnly(employmentStatus);
  return {
    year,
    casual: 0,
    earned: unpaidOnly
      ? 0
      : Math.min(source.earned, EARNED_CARRY_FORWARD_LIMIT) +
        EARNED_ANNUAL_CREDIT,
    employmentStatus,
    shift: existing?.shift ?? source.shift,
    lastProjectedDateKey: `${year - 1}-12-31`,
  };
}

function applyGuaranteedCreditsThrough(
  state: ProjectionYearState,
  throughDateKey: string,
  asOfDateKey: string,
) {
  if (isUnpaidOnly(state.employmentStatus)) {
    state.lastProjectedDateKey = throughDateKey;
    return;
  }
  const starts = quarterStartKeys(state.year);
  for (const dateKey of starts) {
    if (
      dateKey > asOfDateKey &&
      dateKey > state.lastProjectedDateKey &&
      dateKey <= throughDateKey
    ) {
      state.casual += QUARTERLY_CASUAL_CREDIT;
    }
  }
  state.lastProjectedDateKey = throughDateKey;
}

function consumeAmount(
  remaining: { value: number },
  duration: number,
) {
  const used = Math.min(Math.max(remaining.value, 0), duration);
  remaining.value = Math.max(0, remaining.value - used);
  return used;
}

function allocateFromState(
  state: ProjectionYearState,
  duration: number,
): AllocationAmounts {
  if (isUnpaidOnly(state.employmentStatus)) {
    return { casual: 0, earned: 0, unpaid: duration };
  }
  const casual = Math.min(state.casual, duration);
  state.casual -= casual;
  const afterCasual = duration - casual;
  const earned = Math.min(state.earned, afterCasual);
  state.earned -= earned;
  return {
    casual,
    earned,
    unpaid: Math.max(0, afterCasual - earned),
  };
}

function allocateManualOverride(
  specs: WorkingDateSpec[],
  override: NonNullable<ReturnType<typeof parseManualAllocationOverride>>,
) {
  const casual = { value: override.casualDays };
  const earned = { value: override.earnedDays };
  const unpaid = { value: override.unpaidDays };
  const allocations = new Map<string, AllocationAmounts>();
  for (const spec of specs) {
    let remaining = spec.duration;
    const casualUsed = consumeAmount(casual, remaining);
    remaining -= casualUsed;
    const earnedUsed = consumeAmount(earned, remaining);
    remaining -= earnedUsed;
    const unpaidUsed = consumeAmount(unpaid, remaining);
    remaining -= unpaidUsed;
    if (remaining > 0.0001) {
      throw new Error(
        "HR manual allocation does not cover all selected working leave days.",
      );
    }
    allocations.set(spec.dateKey, {
      casual: casualUsed,
      earned: earnedUsed,
      unpaid: unpaidUsed,
    });
  }
  if (casual.value > 0.0001 || earned.value > 0.0001 || unpaid.value > 0.0001) {
    throw new Error(
      "HR manual allocation exceeds the selected working leave duration.",
    );
  }
  return allocations;
}

async function updateRequestAggregates(
  client: DbClient,
  leaveRequestId: string,
) {
  const rows = await client.leaveDateAllocation.findMany({
    where: {
      leaveRequestId,
      status: { in: ["SCHEDULED", "PROCESSED"] },
    },
    select: {
      casualDays: true,
      earnedDays: true,
      unpaidDays: true,
      duration: true,
    },
  });
  const totals = rows.reduce(
    (sum, row) => ({
      total: sum.total + numberValue(row.duration),
      casual: sum.casual + numberValue(row.casualDays),
      earned: sum.earned + numberValue(row.earnedDays),
      unpaid: sum.unpaid + numberValue(row.unpaidDays),
    }),
    { total: 0, casual: 0, earned: 0, unpaid: 0 },
  );
  const leaveType =
    totals.casual > 0 ? "CASUAL" : totals.earned > 0 ? "EARNED" : "UNPAID";
  await client.leaveRequest.update({
    where: { id: leaveRequestId },
    data: {
      leaveType,
      totalLeaveDays: decimal(totals.total),
      casualDaysUsed: decimal(totals.casual),
      earnedDaysUsed: decimal(totals.earned),
      unpaidDaysUsed: decimal(totals.unpaid),
    },
  });
  return totals;
}

async function upsertWorkingAllocationRows(
  client: DbClient,
  request: RequestLike,
  specs: WorkingDateSpec[],
) {
  for (const spec of specs) {
    await client.leaveDateAllocation.upsert({
      where: {
        leaveRequestId_leaveDate: {
          leaveRequestId: request.id,
          leaveDate: spec.date,
        },
      },
      update: {
        userId: request.userId,
        year: spec.year,
        duration: decimal(spec.duration),
        dayPart: spec.dayPart,
        isSandwichDay: false,
      },
      create: {
        leaveRequestId: request.id,
        userId: request.userId,
        year: spec.year,
        leaveDate: spec.date,
        duration: decimal(spec.duration),
        dayPart: spec.dayPart,
        isSandwichDay: false,
        casualDays: decimal(0),
        earnedDays: decimal(0),
        unpaidDays: decimal(0),
        status: "SCHEDULED",
      },
    });
  }
}

export async function createAllocationRowsForApprovedRequest(
  client: DbClient,
  request: RequestLike,
) {
  const { specs } = await getWorkingDateSpecs(client, request);
  if (!specs.length) throw new Error("Selected range has no working leave days.");
  await upsertWorkingAllocationRows(client, request, specs);
  return specs;
}

export async function ensureSandwichAllocationsForRequest(
  client: DbClient,
  request: RequestLike,
  asOfDateKey = getIstDateKey(),
) {
  const workingRows = await client.leaveDateAllocation.findMany({
    where: {
      leaveRequestId: request.id,
      isSandwichDay: false,
      status: { in: ["SCHEDULED", "PROCESSED"] },
    },
    select: { unpaidDays: true },
  });
  const hasWorkingUnpaid = workingRows.some(
    (row) => numberValue(row.unpaidDays) > 0,
  );
  const specs = await getSandwichDateSpecs(client, request);
  const validDates = specs.map((spec) => spec.date);

  if (hasWorkingUnpaid) {
    for (const spec of specs) {
      const existing = await client.leaveDateAllocation.findUnique({
        where: {
          leaveRequestId_leaveDate: {
            leaveRequestId: request.id,
            leaveDate: spec.date,
          },
        },
      });
      if (!existing) {
        await client.leaveDateAllocation.create({
          data: {
            leaveRequestId: request.id,
            userId: request.userId,
            year: spec.year,
            leaveDate: spec.date,
            duration: decimal(1),
            dayPart: "SANDWICH",
            isSandwichDay: true,
            casualDays: decimal(0),
            earnedDays: decimal(0),
            unpaidDays: decimal(1),
            status: "SCHEDULED",
          },
        });
      } else if (existing.status === "SCHEDULED" || existing.status === "CANCELLED") {
        await client.leaveDateAllocation.update({
          where: { id: existing.id },
          data: {
            userId: request.userId,
            year: spec.year,
            duration: decimal(1),
            dayPart: "SANDWICH",
            isSandwichDay: true,
            casualDays: decimal(0),
            earnedDays: decimal(0),
            unpaidDays: decimal(1),
            status: "SCHEDULED",
            cancelledAt: null,
            reversedAt: null,
          },
        });
      }
    }
  }

  await client.leaveDateAllocation.updateMany({
    where: {
      leaveRequestId: request.id,
      isSandwichDay: true,
      status: "SCHEDULED",
      ...(hasWorkingUnpaid && validDates.length
        ? { leaveDate: { notIn: validDates } }
        : {}),
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      note: hasWorkingUnpaid
        ? "No longer part of the sandwich-date range."
        : "Sandwich deduction removed because the leave no longer has unpaid working days.",
    },
  });

  await updateRequestAggregates(client, request.id);
  return { hasWorkingUnpaid, sandwichDates: specs.length, asOfDateKey };
}

async function getProjectionRequests(client: DbClient, userId: string, afterDateKey: string) {
  const afterUtc = getDayBoundsUtcFromIstDateKey(afterDateKey).endUtc;
  return client.leaveRequest.findMany({
    where: {
      userId,
      status: { in: ["APPROVED", "PARTIALLY_CANCELLED"] },
      dateAllocations: {
        some: { status: "SCHEDULED", leaveDate: { gte: afterUtc } },
      },
    },
    include: {
      dateAllocations: {
        where: { status: { in: ["SCHEDULED", "PROCESSED"] } },
        orderBy: { leaveDate: "asc" },
      },
    },
    orderBy: [{ startDate: "asc" }, { approvedAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function applyManualOverrideToRequestAllocations(
  client: DbClient,
  request: RequestLike,
  actorId?: string | null,
) {
  const override = parseManualAllocationOverride(
    request.manualAllocationOverrideJson,
  );
  if (!override) return { applied: false };
  if (!request.manualOverrideNote?.trim()) {
    throw new Error(
      "A note is required for an HR manual leave allocation override.",
    );
  }
  const rows = await client.leaveDateAllocation.findMany({
    where: {
      leaveRequestId: request.id,
      status: "SCHEDULED",
      isSandwichDay: false,
    },
    orderBy: { leaveDate: "asc" },
  });
  const byDate = allocateManualOverride(
    rows.map((row) => ({
      dateKey: getIstDateKey(row.leaveDate),
      date: row.leaveDate,
      year: row.year,
      duration: numberValue(row.duration),
      dayPart: normalizeDayPart(row.dayPart),
    })),
    override,
  );

  const asOfDateKey = getIstDateKey();
  const states = new Map<number, ProjectionYearState>();
  async function stateForYear(year: number) {
    const existing = states.get(year);
    if (existing) return existing;
    let previous: ProjectionYearState | undefined;
    if (year > Number(asOfDateKey.slice(0, 4))) {
      previous = await stateForYear(year - 1);
    }
    const created = await createProjectionState(
      client,
      request.userId,
      year,
      asOfDateKey,
      previous,
    );
    states.set(year, created);
    return created;
  }

  for (const row of rows) {
    const dateKey = getIstDateKey(row.leaveDate);
    if (dateKey <= asOfDateKey) {
      const credit = await ensureQuarterlyCreditForUser(client, {
        userId: request.userId,
        dateKey,
        actorId,
        source: "APPROVAL_PREPARATION",
      });
      // Refresh only when this call actually changed the stored balance.
      if (credit.credited > 0) states.delete(row.year);
    }
    const state = await stateForYear(row.year);
    if (dateKey > asOfDateKey) {
      applyGuaranteedCreditsThrough(state, dateKey, asOfDateKey);
    }
    const allocation = byDate.get(dateKey);
    if (!allocation) continue;
    if (
      allocation.casual > state.casual + 0.0001 ||
      allocation.earned > state.earned + 0.0001
    ) {
      throw new Error(
        `HR manual allocation for ${dateKey} exceeds the actual/projected paid balance.`,
      );
    }
    state.casual -= allocation.casual;
    state.earned -= allocation.earned;
    await client.leaveDateAllocation.update({
      where: { id: row.id },
      data: {
        casualDays: decimal(allocation.casual),
        earnedDays: decimal(allocation.earned),
        unpaidDays: decimal(allocation.unpaid),
      },
    });
  }
  await updateRequestAggregates(client, request.id);
  return { applied: true };
}

export async function recalculateFutureAllocationsForUser(
  client: DbClient,
  userId: string,
  asOfDateKey = getIstDateKey(),
) {
  const requests = await getProjectionRequests(client, userId, asOfDateKey);
  const states = new Map<number, ProjectionYearState>();
  const changedRequestIds = new Set<string>();
  const manualAllocationByRequest = new Map<
    string,
    Map<string, AllocationAmounts>
  >();
  const hasWorkingUnpaidByRequest = new Map<string, boolean>();

  async function stateForYear(year: number) {
    const existing = states.get(year);
    if (existing) return existing;
    let previous: ProjectionYearState | undefined;
    if (year > Number(asOfDateKey.slice(0, 4))) {
      previous = await stateForYear(year - 1);
    }
    const created = await createProjectionState(
      client,
      userId,
      year,
      asOfDateKey,
      previous,
    );
    states.set(year, created);
    return created;
  }

  for (const request of requests) {
    const futureWorkingRows = request.dateAllocations.filter(
      (row) =>
        row.status === "SCHEDULED" &&
        !row.isSandwichDay &&
        getIstDateKey(row.leaveDate) > asOfDateKey,
    );
    const processedWorking = request.dateAllocations.filter(
      (row) => row.status === "PROCESSED" && !row.isSandwichDay,
    );
    hasWorkingUnpaidByRequest.set(
      request.id,
      processedWorking.some((row) => numberValue(row.unpaidDays) > 0),
    );

    const manualOverride = parseManualAllocationOverride(
      request.manualAllocationOverrideJson,
    );
    if (manualOverride && futureWorkingRows.length) {
      const remainingOverride = {
        casualDays: Math.max(
          0,
          manualOverride.casualDays -
            processedWorking.reduce(
              (sum, row) => sum + numberValue(row.casualDays),
              0,
            ),
        ),
        earnedDays: Math.max(
          0,
          manualOverride.earnedDays -
            processedWorking.reduce(
              (sum, row) => sum + numberValue(row.earnedDays),
              0,
            ),
        ),
        unpaidDays: Math.max(
          0,
          manualOverride.unpaidDays -
            processedWorking.reduce(
              (sum, row) => sum + numberValue(row.unpaidDays),
              0,
            ),
        ),
      };
      manualAllocationByRequest.set(
        request.id,
        allocateManualOverride(
          futureWorkingRows.map((row) => ({
            dateKey: getIstDateKey(row.leaveDate),
            date: row.leaveDate,
            year: row.year,
            duration: numberValue(row.duration),
            dayPart: normalizeDayPart(row.dayPart),
          })),
          remainingOverride,
        ),
      );
    }
  }

  const requestOrder = new Map(
    requests.map((request, index) => [request.id, index]),
  );
  const futureWorkingTimeline = requests
    .flatMap((request) =>
      request.dateAllocations
        .filter(
          (row) =>
            row.status === "SCHEDULED" &&
            !row.isSandwichDay &&
            getIstDateKey(row.leaveDate) > asOfDateKey,
        )
        .map((row) => ({ request, row })),
    )
    .sort((a, b) => {
      const byDate = a.row.leaveDate.getTime() - b.row.leaveDate.getTime();
      if (byDate) return byDate;
      return (requestOrder.get(a.request.id) ?? 0) -
        (requestOrder.get(b.request.id) ?? 0);
    });

  for (const { request, row } of futureWorkingTimeline) {
    const dateKey = getIstDateKey(row.leaveDate);
    const state = await stateForYear(row.year);
    applyGuaranteedCreditsThrough(state, dateKey, asOfDateKey);
    const duration = numberValue(row.duration);
    const manualAllocation = manualAllocationByRequest
      .get(request.id)
      ?.get(dateKey);
    const allocation = manualAllocation ?? allocateFromState(state, duration);
    if (manualAllocation) {
      if (
        allocation.casual > state.casual + 0.0001 ||
        allocation.earned > state.earned + 0.0001
      ) {
        throw new Error(
          `HR manual allocation for ${dateKey} exceeds the projected paid balance.`,
        );
      }
      state.casual -= allocation.casual;
      state.earned -= allocation.earned;
    }
    if (allocation.unpaid > 0) {
      hasWorkingUnpaidByRequest.set(request.id, true);
    }
    await client.leaveDateAllocation.update({
      where: { id: row.id },
      data: {
        casualDays: decimal(allocation.casual),
        earnedDays: decimal(allocation.earned),
        unpaidDays: decimal(allocation.unpaid),
      },
    });
    changedRequestIds.add(request.id);
  }

  for (const request of requests) {
    const hasWorkingUnpaid = hasWorkingUnpaidByRequest.get(request.id) ?? false;
    const sandwichSpecs = await getSandwichDateSpecs(client, request);
    const futureSandwichSpecs = sandwichSpecs.filter(
      (spec) => spec.dateKey > asOfDateKey,
    );
    const futureSandwichDates = futureSandwichSpecs.map((spec) => spec.date);

    if (hasWorkingUnpaid) {
      for (const spec of futureSandwichSpecs) {
        const existing = await client.leaveDateAllocation.findUnique({
          where: {
            leaveRequestId_leaveDate: {
              leaveRequestId: request.id,
              leaveDate: spec.date,
            },
          },
        });
        if (!existing) {
          await client.leaveDateAllocation.create({
            data: {
              leaveRequestId: request.id,
              userId,
              year: spec.year,
              leaveDate: spec.date,
              duration: decimal(1),
              dayPart: "SANDWICH",
              isSandwichDay: true,
              status: "SCHEDULED",
              casualDays: decimal(0),
              earnedDays: decimal(0),
              unpaidDays: decimal(1),
            },
          });
        } else if (
          existing.status === "SCHEDULED" ||
          existing.status === "CANCELLED"
        ) {
          await client.leaveDateAllocation.update({
            where: { id: existing.id },
            data: {
              status: "SCHEDULED",
              duration: decimal(1),
              dayPart: "SANDWICH",
              isSandwichDay: true,
              casualDays: decimal(0),
              earnedDays: decimal(0),
              unpaidDays: decimal(1),
              cancelledAt: null,
              reversedAt: null,
            },
          });
        }
      }
    }

    await client.leaveDateAllocation.updateMany({
      where: {
        leaveRequestId: request.id,
        status: "SCHEDULED",
        isSandwichDay: true,
        leaveDate: {
          gt: getDayBoundsUtcFromIstDateKey(asOfDateKey).startUtc,
          ...(hasWorkingUnpaid && futureSandwichDates.length
            ? { notIn: futureSandwichDates }
            : {}),
        },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        note: hasWorkingUnpaid
          ? "No longer part of the projected sandwich-date range."
          : "Sandwich deduction removed because projected working leave is paid.",
      },
    });
    changedRequestIds.add(request.id);
  }

  for (const requestId of changedRequestIds) {
    await updateRequestAggregates(client, requestId);
  }

  return { requestsRecalculated: changedRequestIds.size };
}

async function createBalanceTransaction(
  client: DbClient,
  input: {
    userId: string;
    profileId: string;
    year: number;
    transactionType:
      | "OPENING_BALANCE"
      | "QUARTERLY_CREDIT"
      | "LEAVE_DEDUCTION"
      | "LEAVE_REVERSAL"
      | "MANUAL_ADJUSTMENT"
      | "MIGRATION_RESTORE";
    eventDate: Date;
    casualChange?: number;
    earnedChange?: number;
    unpaidChange?: number;
    casualBalanceAfter: number;
    earnedBalanceAfter: number;
    source: string;
    note?: string | null;
    actorId?: string | null;
    leaveRequestId?: string | null;
    leaveDateAllocationId?: string | null;
    idempotencyKey?: string | null;
  },
) {
  return client.leaveBalanceTransaction.create({
    data: {
      userId: input.userId,
      leaveYearProfileId: input.profileId,
      leaveRequestId: input.leaveRequestId ?? null,
      leaveDateAllocationId: input.leaveDateAllocationId ?? null,
      year: input.year,
      transactionType: input.transactionType,
      eventDate: input.eventDate,
      casualChange: decimal(input.casualChange ?? 0),
      earnedChange: decimal(input.earnedChange ?? 0),
      unpaidChange: decimal(input.unpaidChange ?? 0),
      casualBalanceAfter: decimal(input.casualBalanceAfter),
      earnedBalanceAfter: decimal(input.earnedBalanceAfter),
      source: input.source,
      note: input.note ?? null,
      actorId: input.actorId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });
}

export async function ensureQuarterlyCreditForUser(
  client: DbClient,
  input: {
    userId: string;
    dateKey: string;
    actorId?: string | null;
    source: string;
  },
) {
  if (input.dateKey < LEAVE_SYSTEM_START_DATE_KEY) {
    return { credited: 0, reason: "BEFORE_SYSTEM_START" };
  }
  const monthDay = input.dateKey.slice(5);
  if (!["01-01", "04-01", "07-01", "10-01"].includes(monthDay)) {
    return { credited: 0, reason: "NOT_QUARTER_START" };
  }
  const year = Number(input.dateKey.slice(0, 4));
  const month = Number(input.dateKey.slice(5, 7));
  const quarter = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
  const profile = await getOrCreateProfile(client, input.userId, year);
  if (isUnpaidOnly(profile.employmentStatus)) {
    return { credited: 0, reason: "UNPAID_ONLY" };
  }
  const idempotencyKey = `quarter-credit:${input.userId}:${year}:${quarter}`;
  const existing = await client.leaveQuarterlyCasualCredit.findUnique({
    where: {
      userId_year_quarter: { userId: input.userId, year, quarter },
    },
  });
  if (existing) return { credited: 0, reason: "ALREADY_CREDITED" };

  const updated = await client.leaveYearProfile.update({
    where: { id: profile.id },
    data: { casualLeaves: { increment: decimal(QUARTERLY_CASUAL_CREDIT) } },
  });
  await client.leaveQuarterlyCasualCredit.create({
    data: {
      userId: input.userId,
      year,
      quarter,
      credited: decimal(QUARTERLY_CASUAL_CREDIT),
      creditedById: input.actorId ?? null,
      runDateKey: input.dateKey,
      source: input.source,
    },
  });
  await createBalanceTransaction(client, {
    userId: input.userId,
    profileId: profile.id,
    year,
    transactionType: "QUARTERLY_CREDIT",
    eventDate: getDayBoundsUtcFromIstDateKey(input.dateKey).startUtc,
    casualChange: QUARTERLY_CASUAL_CREDIT,
    casualBalanceAfter: numberValue(updated.casualLeaves),
    earnedBalanceAfter: numberValue(updated.earnedLeaves),
    source: input.source,
    actorId: input.actorId,
    idempotencyKey,
    note: `Quarter ${quarter} scheduled casual leave credit.`,
  });
  return { credited: QUARTERLY_CASUAL_CREDIT, reason: "CREDITED" };
}

export async function processDueLeaveAllocationsForUser(
  client: DbClient,
  input: {
    userId: string;
    throughDateKey?: string;
    actorId?: string | null;
    approvalRequestId?: string | null;
    allocationIds?: string[];
    sourceOverride?: "DAILY_CRON" | "URGENT_APPROVAL" | "BACKDATED_APPROVAL";
  },
) {
  const throughDateKey = input.throughDateKey ?? getIstDateKey();
  const throughEnd = getDayBoundsUtcFromIstDateKey(throughDateKey).endUtc;
  const rows = await client.leaveDateAllocation.findMany({
    where: {
      userId: input.userId,
      status: "SCHEDULED",
      leaveDate: { lt: throughEnd },
      ...(input.allocationIds?.length
        ? { id: { in: input.allocationIds } }
        : {}),
    },
    include: { leaveRequest: true },
    orderBy: [{ leaveDate: "asc" }, { createdAt: "asc" }],
  });
  const changedRequestIds = new Set<string>();
  let processed = 0;

  for (const row of rows) {
    const dateKey = getIstDateKey(row.leaveDate);
    await ensureQuarterlyCreditForUser(client, {
      userId: input.userId,
      dateKey,
      actorId: input.actorId,
      source: "DAILY_LEAVE_PROCESSOR",
    });
    const claimed = await client.leaveDateAllocation.updateMany({
      where: { id: row.id, status: "SCHEDULED" },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        processedById: input.actorId ?? null,
      },
    });
    if (claimed.count !== 1) continue;

    const profile = await getOrCreateProfile(client, row.userId, row.year);
    const actualCasual = numberValue(profile.casualLeaves);
    const actualEarned = numberValue(profile.earnedLeaves);
    const duration = numberValue(row.duration);
    const plannedCasual = numberValue(row.casualDays);
    const plannedEarned = numberValue(row.earnedDays);
    const plannedUnpaid = numberValue(row.unpaidDays);
    let casual = 0;
    let earned = 0;
    let unpaid = plannedUnpaid;

    if (row.isSandwichDay || isUnpaidOnly(profile.employmentStatus)) {
      unpaid = duration;
    } else if (parseManualAllocationOverride(row.leaveRequest.manualAllocationOverrideJson)) {
      // HR's noted override is respected, while a last-moment paid-balance
      // shortfall safely falls through to Earned and then Unpaid.
      const plannedTotal = plannedCasual + plannedEarned + plannedUnpaid;
      const unplannedDuration = Math.max(0, duration - plannedTotal);
      casual = Math.min(actualCasual, plannedCasual + unplannedDuration);
      const casualShortfall = plannedCasual + unplannedDuration - casual;
      earned = Math.min(actualEarned, plannedEarned + casualShortfall);
      unpaid = Math.max(0, duration - casual - earned);
    } else {
      // At the actual leave date, use the real balance in policy order. The
      // scheduled breakup is a projection and may have changed since approval.
      casual = Math.min(actualCasual, duration);
      earned = Math.min(actualEarned, duration - casual);
      unpaid = Math.max(0, duration - casual - earned);
    }

    const source =
      input.sourceOverride ??
      (input.approvalRequestId === row.leaveRequestId
        ? dateKey === throughDateKey
          ? "URGENT_APPROVAL"
          : "BACKDATED_APPROVAL"
        : "DAILY_CRON");
    const updatedProfile = await client.leaveYearProfile.update({
      where: { id: profile.id },
      data: {
        casualLeaves: { decrement: decimal(casual) },
        earnedLeaves: { decrement: decimal(earned) },
      },
    });
    await client.leaveDateAllocation.update({
      where: { id: row.id },
      data: {
        casualDays: decimal(casual),
        earnedDays: decimal(earned),
        unpaidDays: decimal(unpaid),
        processingSource: source,
        note:
          source === "URGENT_APPROVAL"
            ? "Approved on the leave date and deducted immediately."
            : source === "BACKDATED_APPROVAL"
              ? row.leaveRequest.manualOverrideNote ??
                "Backdated leave approved and deducted immediately."
              : "Processed by the daily IST leave deduction job.",
      },
    });
    await createBalanceTransaction(client, {
      userId: row.userId,
      profileId: profile.id,
      year: row.year,
      transactionType: "LEAVE_DEDUCTION",
      eventDate: row.leaveDate,
      casualChange: -casual,
      earnedChange: -earned,
      unpaidChange: unpaid,
      casualBalanceAfter: numberValue(updatedProfile.casualLeaves),
      earnedBalanceAfter: numberValue(updatedProfile.earnedLeaves),
      source,
      actorId: input.actorId,
      leaveRequestId: row.leaveRequestId,
      leaveDateAllocationId: row.id,
      idempotencyKey: `leave-deduction:${row.id}`,
      note:
        row.leaveRequest.manualOverrideNote ??
        `Leave deduction for ${dateKey}.`,
    });
    changedRequestIds.add(row.leaveRequestId);
    processed += 1;
  }

  for (const requestId of changedRequestIds) {
    await updateRequestAggregates(client, requestId);
  }
  return { processed, changedRequestIds: [...changedRequestIds] };
}

export async function processDueLeaveAllocations(
  throughDateKey = getIstDateKey(),
) {
  const users = await db.leaveDateAllocation.findMany({
    where: {
      status: "SCHEDULED",
      leaveDate: { lt: getDayBoundsUtcFromIstDateKey(throughDateKey).endUtc },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  let processed = 0;
  for (const row of users) {
    const result = await db.$transaction(async (tx) => {
      await lockUserLeaveTimeline(tx, row.userId);
      const due = await processDueLeaveAllocationsForUser(tx, {
        userId: row.userId,
        throughDateKey,
      });
      await recalculateFutureAllocationsForUser(tx, row.userId, throughDateKey);
      return due;
    });
    processed += result.processed;
  }
  return { throughDateKey, users: users.length, processed };
}

export async function reverseProcessedAllocation(
  client: DbClient,
  input: {
    allocationId: string;
    actorId: string;
    note: string;
  },
) {
  const row = await client.leaveDateAllocation.findUnique({
    where: { id: input.allocationId },
  });
  if (!row || row.status !== "PROCESSED") return false;
  const claimed = await client.leaveDateAllocation.updateMany({
    where: { id: row.id, status: "PROCESSED" },
    data: {
      status: "REVERSED",
      reversedAt: new Date(),
      processingSource: "HR_REVERSAL",
      processedById: input.actorId,
      note: input.note,
    },
  });
  if (claimed.count !== 1) return false;
  const profile = await getOrCreateProfile(client, row.userId, row.year);
  const casual = numberValue(row.casualDays);
  const earned = numberValue(row.earnedDays);
  const unpaid = numberValue(row.unpaidDays);
  const updated = await client.leaveYearProfile.update({
    where: { id: profile.id },
    data: {
      casualLeaves: { increment: decimal(casual) },
      earnedLeaves: { increment: decimal(earned) },
    },
  });
  await createBalanceTransaction(client, {
    userId: row.userId,
    profileId: profile.id,
    year: row.year,
    transactionType: "LEAVE_REVERSAL",
    eventDate: row.leaveDate,
    casualChange: casual,
    earnedChange: earned,
    unpaidChange: -unpaid,
    casualBalanceAfter: numberValue(updated.casualLeaves),
    earnedBalanceAfter: numberValue(updated.earnedLeaves),
    source: "HR_CANCELLATION_APPROVAL",
    note: input.note,
    actorId: input.actorId,
    leaveRequestId: row.leaveRequestId,
    leaveDateAllocationId: row.id,
    idempotencyKey: `leave-reversal:${row.id}`,
  });
  await updateRequestAggregates(client, row.leaveRequestId);
  return true;
}

export async function recordManualBalanceAdjustment(
  client: DbClient,
  input: {
    userId: string;
    year: number;
    casualBefore: number;
    earnedBefore: number;
    casualAfter: number;
    earnedAfter: number;
    actorId: string;
    note: string;
  },
) {
  const profile = await getOrCreateProfile(client, input.userId, input.year);
  return createBalanceTransaction(client, {
    userId: input.userId,
    profileId: profile.id,
    year: input.year,
    transactionType: "MANUAL_ADJUSTMENT",
    eventDate: getDayBoundsUtcFromIstDateKey(getIstDateKey()).startUtc,
    casualChange: input.casualAfter - input.casualBefore,
    earnedChange: input.earnedAfter - input.earnedBefore,
    casualBalanceAfter: input.casualAfter,
    earnedBalanceAfter: input.earnedAfter,
    source: "HR_MANUAL_ADJUSTMENT",
    actorId: input.actorId,
    note: input.note,
  });
}

export async function previewLeaveRequestAllocation(
  client: DbClient,
  request: Pick<
    RequestLike,
    | "userId"
    | "startDate"
    | "endDate"
    | "daySelectionMode"
    | "leaveDayTypesJson"
    | "manualAllocationOverrideJson"
    | "manualOverrideNote"
  >,
  asOfDateKey = getIstDateKey(),
) {
  const { specs } = await getWorkingDateSpecs(client, request);
  if (!specs.length) {
    throw new Error("Selected range has no working leave days.");
  }

  const existingRequests = await client.leaveRequest.findMany({
    where: {
      userId: request.userId,
      status: { in: ["APPROVED", "PARTIALLY_CANCELLED"] },
      dateAllocations: {
        some: { status: "SCHEDULED", isSandwichDay: false },
      },
    },
    include: {
      dateAllocations: {
        where: { status: "SCHEDULED", isSandwichDay: false },
        orderBy: { leaveDate: "asc" },
      },
    },
    orderBy: [{ startDate: "asc" }, { approvedAt: "asc" }, { createdAt: "asc" }],
  });

  const manualOverride = parseManualAllocationOverride(
    request.manualAllocationOverrideJson,
  );
  if (manualOverride && !request.manualOverrideNote?.trim()) {
    throw new Error(
      "A note is required for an HR manual leave allocation override.",
    );
  }
  const candidateManualByDate = manualOverride
    ? allocateManualOverride(specs, manualOverride)
    : null;

  type TimelineRow = {
    dateKey: string;
    date: Date;
    year: number;
    duration: number;
    candidate: boolean;
    manualAllocation?: AllocationAmounts;
    requestOrder: number;
  };

  const timeline: TimelineRow[] = [];
  existingRequests.forEach((existingRequest, requestOrder) => {
    const hasManualOverride = Boolean(
      parseManualAllocationOverride(
        existingRequest.manualAllocationOverrideJson,
      ),
    );
    for (const row of existingRequest.dateAllocations) {
      timeline.push({
        dateKey: getIstDateKey(row.leaveDate),
        date: row.leaveDate,
        year: row.year,
        duration: numberValue(row.duration),
        candidate: false,
        manualAllocation: hasManualOverride
          ? {
              casual: numberValue(row.casualDays),
              earned: numberValue(row.earnedDays),
              unpaid: numberValue(row.unpaidDays),
            }
          : undefined,
        requestOrder,
      });
    }
  });
  const candidateOrder = existingRequests.length;
  for (const spec of specs) {
    timeline.push({
      dateKey: spec.dateKey,
      date: spec.date,
      year: spec.year,
      duration: spec.duration,
      candidate: true,
      manualAllocation: candidateManualByDate?.get(spec.dateKey),
      requestOrder: candidateOrder,
    });
  }
  timeline.sort((a, b) => {
    const byDate = a.date.getTime() - b.date.getTime();
    if (byDate) return byDate;
    return a.requestOrder - b.requestOrder;
  });

  const states = new Map<number, ProjectionYearState>();
  async function stateForYear(year: number) {
    const existing = states.get(year);
    if (existing) return existing;
    let previous: ProjectionYearState | undefined;
    if (year > Number(asOfDateKey.slice(0, 4))) {
      previous = await stateForYear(year - 1);
    }
    const created = await createProjectionState(
      client,
      request.userId,
      year,
      asOfDateKey,
      previous,
    );
    states.set(year, created);
    return created;
  }

  const candidateTotals = { casual: 0, earned: 0, unpaid: 0, total: 0 };
  for (const row of timeline) {
    const state = await stateForYear(row.year);
    if (row.dateKey > asOfDateKey) {
      applyGuaranteedCreditsThrough(state, row.dateKey, asOfDateKey);
    }
    const allocation = row.manualAllocation ?? allocateFromState(state, row.duration);
    if (row.manualAllocation) {
      if (
        allocation.casual > state.casual + 0.0001 ||
        allocation.earned > state.earned + 0.0001
      ) {
        throw new Error(
          `Manual leave allocation for ${row.dateKey} exceeds the actual/projected paid balance.`,
        );
      }
      state.casual -= allocation.casual;
      state.earned -= allocation.earned;
    }
    if (row.candidate) {
      candidateTotals.casual += allocation.casual;
      candidateTotals.earned += allocation.earned;
      candidateTotals.unpaid += allocation.unpaid;
      candidateTotals.total += row.duration;
    }
  }

  let sandwichUnpaid = 0;
  if (candidateTotals.unpaid > 0.0001) {
    const sandwichSpecs = await getSandwichDateSpecs(client, request);
    sandwichUnpaid = sandwichSpecs.reduce(
      (sum, spec) => sum + spec.duration,
      0,
    );
    candidateTotals.unpaid += sandwichUnpaid;
    candidateTotals.total += sandwichUnpaid;
  }

  return {
    totalLeaveDays: candidateTotals.total,
    casualDaysUsed: candidateTotals.casual,
    earnedDaysUsed: candidateTotals.earned,
    unpaidDaysUsed: candidateTotals.unpaid,
    sandwichUnpaidDays: sandwichUnpaid,
    leaveType:
      candidateTotals.casual > 0
        ? ("CASUAL" as const)
        : candidateTotals.earned > 0
          ? ("EARNED" as const)
          : ("UNPAID" as const),
    daySelectionMode:
      request.daySelectionMode === "HALF_DAYS" ||
      request.daySelectionMode === "CUSTOM"
        ? request.daySelectionMode
        : ("FULL_DAYS" as const),
    leaveDayTypesJson: JSON.stringify(
      Object.fromEntries(specs.map((spec) => [spec.dateKey, spec.dayPart])),
    ),
  };
}

export async function getProjectedLeaveBalanceForUserWithClient(
  client: DbClient,
  userId: string,
  year: number,
  asOfDateKey = getIstDateKey(),
) {
  const profile = await getOrCreateProfile(client, userId, year);
  const scheduledRows = await client.leaveDateAllocation.findMany({
    where: {
      userId,
      year,
      status: "SCHEDULED",
      leaveDate: { gt: getDayBoundsUtcFromIstDateKey(asOfDateKey).startUtc },
    },
    orderBy: { leaveDate: "asc" },
  });
  const futureCasual = scheduledRows.reduce(
    (sum, row) => sum + numberValue(row.casualDays),
    0,
  );
  const futureEarned = scheduledRows.reduce(
    (sum, row) => sum + numberValue(row.earnedDays),
    0,
  );
  const futureUnpaid = scheduledRows.reduce(
    (sum, row) => sum + numberValue(row.unpaidDays),
    0,
  );
  const latestDateKey = scheduledRows.length
    ? getIstDateKey(scheduledRows[scheduledRows.length - 1].leaveDate)
    : asOfDateKey;
  let futureCredits = 0;
  if (!isUnpaidOnly(profile.employmentStatus)) {
    futureCredits = quarterStartKeys(year).filter(
      (key) => key > asOfDateKey && key <= latestDateKey,
    ).length * QUARTERLY_CASUAL_CREDIT;
  }
  return {
    year,
    casualLeaves: numberValue(profile.casualLeaves),
    earnedLeaves: numberValue(profile.earnedLeaves),
    shift: profile.shift,
    employmentStatus: profile.employmentStatus,
    futureApproved: {
      casualLeaves: futureCasual,
      earnedLeaves: futureEarned,
      unpaidLeaves: futureUnpaid,
      scheduledCasualCredits: futureCredits,
    },
    projected: {
      casualLeaves:
        numberValue(profile.casualLeaves) + futureCredits - futureCasual,
      earnedLeaves: numberValue(profile.earnedLeaves) - futureEarned,
    },
  };
}

export async function getProjectedLeaveBalanceForUser(
  userId: string,
  year: number,
  asOfDateKey = getIstDateKey(),
) {
  return getProjectedLeaveBalanceForUserWithClient(
    db as unknown as Prisma.TransactionClient,
    userId,
    year,
    asOfDateKey,
  );
}

export async function validateManualOverrideForRequest(
  client: DbClient,
  request: Pick<
    RequestLike,
    | "userId"
    | "startDate"
    | "endDate"
    | "daySelectionMode"
    | "leaveDayTypesJson"
    | "manualAllocationOverrideJson"
    | "manualOverrideNote"
  >,
) {
  const override = parseManualAllocationOverride(
    request.manualAllocationOverrideJson,
  );
  if (!override) return;
  if (!request.manualOverrideNote?.trim()) {
    throw new Error("A note is required for an HR manual leave allocation override.");
  }
  const { specs } = await getWorkingDateSpecs(client, request);
  const total = specs.reduce((sum, spec) => sum + spec.duration, 0);
  const overrideTotal =
    override.casualDays + override.earnedDays + override.unpaidDays;
  if (Math.abs(total - overrideTotal) > 0.001) {
    throw new Error(
      `Manual allocation must total ${total.toFixed(2)} selected working day(s).`,
    );
  }
}

export async function syncRequestAggregates(
  client: DbClient,
  leaveRequestId: string,
) {
  return updateRequestAggregates(client, leaveRequestId);
}

export async function createOpeningBalanceTransaction(
  client: DbClient,
  input: {
    userId: string;
    year: number;
    actorId: string;
    note: string;
    idempotencyKey: string;
    eventDateKey?: string;
  },
) {
  const profile = await getOrCreateProfile(client, input.userId, input.year);
  const existing = await client.leaveBalanceTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return existing;
  return createBalanceTransaction(client, {
    userId: input.userId,
    profileId: profile.id,
    year: input.year,
    transactionType: "OPENING_BALANCE",
    eventDate: getDayBoundsUtcFromIstDateKey(
      input.eventDateKey ?? getIstDateKey(),
    ).startUtc,
    casualBalanceAfter: numberValue(profile.casualLeaves),
    earnedBalanceAfter: numberValue(profile.earnedLeaves),
    source: "LEAVE_MIGRATION",
    actorId: input.actorId,
    note: input.note,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function createMigrationRestoreTransaction(
  client: DbClient,
  input: {
    userId: string;
    year: number;
    casualRestore: number;
    earnedRestore: number;
    actorId: string;
    note: string;
    idempotencyKey: string;
    eventDateKey?: string;
  },
) {
  const existing = await client.leaveBalanceTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return existing;
  const profile = await getOrCreateProfile(client, input.userId, input.year);
  const updated = await client.leaveYearProfile.update({
    where: { id: profile.id },
    data: {
      casualLeaves: { increment: decimal(input.casualRestore) },
      earnedLeaves: { increment: decimal(input.earnedRestore) },
    },
  });
  return createBalanceTransaction(client, {
    userId: input.userId,
    profileId: profile.id,
    year: input.year,
    transactionType: "MIGRATION_RESTORE",
    eventDate: getDayBoundsUtcFromIstDateKey(
      input.eventDateKey ?? getIstDateKey(),
    ).startUtc,
    casualChange: input.casualRestore,
    earnedChange: input.earnedRestore,
    casualBalanceAfter: numberValue(updated.casualLeaves),
    earnedBalanceAfter: numberValue(updated.earnedLeaves),
    source: "LEAVE_MIGRATION",
    actorId: input.actorId,
    note: input.note,
    idempotencyKey: input.idempotencyKey,
  });
}
