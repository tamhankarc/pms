import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getAttendanceWorkDateKey,
  getDayBoundsUtcFromIstDateKey,
  getInitialCalendarStartMonth,
  getIstDateKey,
  getMonthEndUtcExclusiveFromIstKey,
  getMonthStartUtcFromIstKey,
  shiftMonthKey,
  isWeekendDateKey,
} from "@/lib/ist";

export function isLeaveAllowedUser(user: { userType: string; functionalRole?: string | null; isActive?: boolean }) {
  if (user.isActive === false) return false;
  if (user.userType === "REPORT_VIEWER" || user.userType === "ACCOUNTS") return false;
  if (user.userType === "ADMIN" && ["DIRECTOR", "OTHER"].includes(user.functionalRole ?? "")) return false;
  return true;
}


export async function getApprovedLeaveMonthCalendar(monthKey: string) {
  const monthStart = getMonthStartUtcFromIstKey(monthKey);
  const monthEndExclusive = getMonthEndUtcExclusiveFromIstKey(monthKey);
  const rows = await db.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lt: monthEndExclusive },
      endDate: { gte: monthStart },
    },
    select: {
      startDate: true,
      endDate: true,
      user: {
        select: {
          fullName: true,
        },
      },
    },
    orderBy: [{ startDate: "asc" }, { user: { fullName: "asc" } }],
  });

  const itemsByDate: Record<string, string[]> = {}
  for (const row of rows) {
    let cursorKey = getIstDateKey(row.startDate);
    const endKey = getIstDateKey(row.endDate);
    while (cursorKey <= endKey) {
      if (cursorKey.startsWith(monthKey)) {
        if (!itemsByDate[cursorKey]) itemsByDate[cursorKey] = [];
        itemsByDate[cursorKey].push(row.user.fullName);
      }
      const nextStart = getDayBoundsUtcFromIstDateKey(cursorKey).endUtc;
      cursorKey = getIstDateKey(nextStart);
    }
  }

  Object.keys(itemsByDate).forEach((dateKey) => {
    itemsByDate[dateKey] = [...new Set(itemsByDate[dateKey])].sort((a, b) => a.localeCompare(b));
  });

  const currentMonth = getIstDateKey().slice(0, 7);
  return {
    monthKey,
    selectedDateKey: getIstDateKey(),
    minMonthKey: shiftMonthKey(currentMonth, -12),
    maxMonthKey: shiftMonthKey(currentMonth, 12),
    itemsByDate,
  };
}

export async function getPendingLeaveCount() {
  return db.leaveRequest.count({ where: { status: "PENDING" } });
}

export async function getPendingLeaveApprovalInfoForUser(viewer: {
  id: string;
  userType: string;
  functionalRole?: string | null;
}) {
  const globallyAssignedApproverIds = await getGlobalApproverAssignmentIds();
  const isAdminProjectManagerApprover =
    viewer.userType === "ADMIN" &&
    viewer.functionalRole === "PROJECT_MANAGER" &&
    globallyAssignedApproverIds.includes(viewer.id);

  if (isAdminProjectManagerApprover) {
    const totalPendingCount = await getPendingLeaveCount();
    return {
      count: totalPendingCount,
      mode: "total" as const,
      canActOnAnyPendingRequest: true,
    };
  }

  const ownPendingCount = await db.leaveRequest.count({
    where: {
      status: "PENDING",
      approverId: viewer.id,
    },
  });

  return {
    count: ownPendingCount,
    mode: "assigned" as const,
    canActOnAnyPendingRequest: false,
  };
}

export async function getApproverOptions() {
  return db.user.findMany({
    where: {
      isActive: true,
      OR: [{ userType: "TEAM_LEAD" }, { userType: "MANAGER" }, { userType: "ADMIN" }],
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      userType: true,
      functionalRole: true,
    },
    orderBy: [{ fullName: "asc" }],
  });
}

export async function getGlobalApproverAssignmentIds() {
  const rows = await db.leaveApproverAssignment.findMany({
    select: { approverId: true },
    distinct: ["approverId"],
    orderBy: { approverId: "asc" },
  });
  return rows.map((row) => row.approverId);
}

export async function getEligibleEmployeeIdsForGlobalApproverAssignment() {
  const rows = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { userType: "EMPLOYEE" },
        { userType: "TEAM_LEAD" },
        { userType: "MANAGER", NOT: { functionalRole: "PROJECT_MANAGER" } },
      ],
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function getAdminDashboardData(attendanceDateKey: string, leaveStartDateKey?: string, leaveEndDateKey?: string) {
  const attendanceBounds = getDayBoundsUtcFromIstDateKey(attendanceDateKey);
  const rangeStartKey = leaveStartDateKey || attendanceDateKey;
  const rangeEndKey = leaveEndDateKey || attendanceDateKey;
  const leaveStartBounds = getDayBoundsUtcFromIstDateKey(rangeStartKey);
  const leaveEndBounds = getDayBoundsUtcFromIstDateKey(rangeEndKey);

  const employees = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { userType: "EMPLOYEE" },
        { userType: "TEAM_LEAD" },
        { userType: "MANAGER", NOT: { functionalRole: "PROJECT_MANAGER" } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      userType: true,
      functionalRole: true,
      attendanceLogs: {
        where: {
          attendanceDate: { gte: attendanceBounds.startUtc, lt: attendanceBounds.endUtc },
        },
        orderBy: { markedAt: "asc" },
        select: {
          id: true,
          type: true,
          markedAt: true,
          city: true,
          town: true,
          village: true,
          stateDistrict: true,
          state: true,
        },
      },
    },
    orderBy: [{ fullName: "asc" }],
  });

  const approvedLeaves = await db.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lt: leaveEndBounds.endUtc },
      endDate: { gte: leaveStartBounds.startUtc },
    },
    select: {
      id: true,
      leaveType: true,
      startDate: true,
      endDate: true,
      totalLeaveDays: true,
      casualDaysUsed: true,
      earnedDaysUsed: true,
      unpaidDaysUsed: true,
      user: {
        select: {
          fullName: true,
          userType: true,
          functionalRole: true,
        },
      },
    },
    orderBy: [{ startDate: "asc" }, { user: { fullName: "asc" } }],
  });

  return {
    attendanceRows: employees.map((employee) => {
      const markIn = employee.attendanceLogs.find((row) => row.type === "MARK_IN") ?? null;
      const markOut = [...employee.attendanceLogs].reverse().find((row) => row.type === "MARK_OUT") ?? null;
      return {
        id: employee.id,
        fullName: employee.fullName,
        userType: employee.userType,
        functionalRole: employee.functionalRole,
        markIn,
        markOut,
        city: markOut?.city || markIn?.city || null,
      };
    }),
    leaveRows: approvedLeaves,
  };
}

export async function getActiveDashboardAnnouncementsForUser(user: { id: string; userType: string; functionalRole?: string | null }) {
  const now = new Date();
  const rows = await db.dashboardAnnouncement.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      OR: [
        { targetAll: true },
        { recipients: { some: { userId: user.id } } },
      ],
    },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
  });

  return rows.filter((row) => !(row.targetAll && user.userType === 'ADMIN' && user.functionalRole === 'DIRECTOR'));
}

export async function getAttendanceStatusForUser(userId: string) {
  const year = Number(getIstDateKey().slice(0, 4));
  const leaveBalance = await getLeaveBalanceForUser(userId, year);
  const todayWorkDateKey = getAttendanceWorkDateKey(new Date(), leaveBalance.shift);
  const { startUtc, endUtc } = getDayBoundsUtcFromIstDateKey(todayWorkDateKey);
  const rows = await db.attendanceLog.findMany({
    where: {
      userId,
      attendanceDate: { gte: startUtc, lt: endUtc },
    },
    orderBy: { markedAt: "asc" },
  });

  const markIn = rows.find((row) => row.type === "MARK_IN") ?? null;
  const markOut = [...rows].reverse().find((row) => row.type === "MARK_OUT") ?? null;

  return { dateKey: todayWorkDateKey, markIn, markOut, shift: leaveBalance.shift };
}

export async function getEmployeeDashboardSnapshot(userId: string) {
  const [attendanceStatus, leaveSummary, leaveBalance] = await Promise.all([
    getAttendanceStatusForUser(userId),
    db.leaveRequest.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "APPROVED", "RECONSIDER"] },
      },
      orderBy: [{ startDate: "asc" }],
      take: 5,
    }),
    getLeaveBalanceForUser(userId, new Date().getUTCFullYear()),
  ]);

  return { attendanceStatus, leaveSummary, leaveBalance };
}

export async function getAttendanceCalendarData(userId: string, monthKey: string, joiningDate: Date | null | undefined) {
  const monthStart = getMonthStartUtcFromIstKey(monthKey);
  const monthEndExclusive = getMonthEndUtcExclusiveFromIstKey(monthKey);

  const [attendanceRows, leaveRows] = await Promise.all([
    db.attendanceLog.findMany({
      where: {
        userId,
        attendanceDate: {
          gte: monthStart,
          lt: monthEndExclusive,
        },
      },
      select: {
        attendanceDate: true,
        type: true,
      },
    }),
    db.leaveRequest.findMany({
      where: {
        userId,
        status: "APPROVED",
        startDate: { lt: monthEndExclusive },
        endDate: { gte: monthStart },
      },
      select: {
        startDate: true,
        endDate: true,
        unpaidDaysUsed: true,
      },
    }),
  ]);

  const presentDays = new Set(
    attendanceRows.filter((row) => row.type === "MARK_IN").map((row) => getIstDateKey(row.attendanceDate)),
  );

  const holidayRows = await db.officialHoliday.findMany({
    where: {
      holidayDate: { gte: monthStart, lt: monthEndExclusive },
    },
    select: { holidayDate: true, name: true },
    orderBy: { holidayDate: "asc" },
  });

  const holidayNamesByDate: Record<string, string> = {};
  for (const row of holidayRows) {
    const dateKey = getIstDateKey(row.holidayDate);
    holidayNamesByDate[dateKey] = row.name;
  }

  const holidayKeys = new Set(Object.keys(holidayNamesByDate));
  const weekendOrHolidayDays = new Set<string>(holidayKeys);
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isWeekendDateKey(dateKey)) {
      weekendOrHolidayDays.add(dateKey);
    }
  }

  const leaveDays = new Set<string>();
  for (const row of leaveRows) {
    const shouldCountSandwichDaysAsLeave = Number(row.unpaidDaysUsed ?? 0) > 0;
    let cursorKey = getIstDateKey(row.startDate);
    const endKey = getIstDateKey(row.endDate);
    while (cursorKey <= endKey) {
      const isWeekendOrHoliday = isWeekendDateKey(cursorKey) || holidayKeys.has(cursorKey);
      if (cursorKey.startsWith(monthKey)) {
        if (isWeekendOrHoliday) {
          if (shouldCountSandwichDaysAsLeave) {
            leaveDays.add(cursorKey);
          }
        } else {
          leaveDays.add(cursorKey);
        }
      }
      const nextStart = getDayBoundsUtcFromIstDateKey(cursorKey).endUtc;
      cursorKey = getIstDateKey(nextStart);
    }
  }

  return {
    monthKey,
    presentDays: [...presentDays],
    leaveDays: [...leaveDays],
    weekendOrHolidayDays: [...weekendOrHolidayDays],
    holidayNamesByDate,
    minMonthKey: getInitialCalendarStartMonth(joiningDate),
    maxMonthKey: getIstDateKey().slice(0, 7),
  };
}

export async function getAllowedLeaveRequestApproversForUser(userId: string) {
  const requester = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      userType: true,
      functionalRole: true,
      isActive: true,
    },
  });

  if (!requester) return [];

  const [globallyAssignedApprovers, employeeAssignedApproverRows] = await Promise.all([
    db.user.findMany({
      where: {
        isActive: true,
        approverForEmployees: {
          some: {},
        },
      },
      select: {
        id: true,
        fullName: true,
        userType: true,
        functionalRole: true,
      },
      orderBy: [{ fullName: "asc" }],
    }),
    db.leaveApproverAssignment.findMany({
      where: {
        employeeId: userId,
      },
      include: {
        approver: {
          select: {
            id: true,
            fullName: true,
            userType: true,
            functionalRole: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ approver: { fullName: "asc" } }],
    }),
  ]);

  const assignedApprovers = employeeAssignedApproverRows
    .map((row) => row.approver)
    .filter((approver) => approver?.isActive);

  const globalApprovers = globallyAssignedApprovers.filter((approver) => approver.id !== userId);

  const mergedMap = new Map<
    string,
    {
      id: string;
      fullName: string;
      userType: string;
      functionalRole: string | null;
    }
  >();

  for (const approver of [...assignedApprovers, ...globalApprovers]) {
    if (!approver) continue;
    mergedMap.set(approver.id, {
      id: approver.id,
      fullName: approver.fullName,
      userType: approver.userType,
      functionalRole: approver.functionalRole ?? null,
    });
  }

  const allCandidates = [...mergedMap.values()];

  const isAdminProjectManager = (user: {
    userType: string;
    functionalRole: string | null;
  }) => user.userType === "ADMIN" && user.functionalRole === "PROJECT_MANAGER";

  const isManagerProjectManager = (user: {
    userType: string;
    functionalRole: string | null;
  }) => user.userType === "MANAGER" && user.functionalRole === "PROJECT_MANAGER";

  const isAdminDirector = (user: {
    userType: string;
    functionalRole: string | null;
  }) => user.userType === "ADMIN" && user.functionalRole === "DIRECTOR";

  const isRoleScopedManager = (user: {
    userType: string;
    functionalRole: string | null;
  }) => user.userType === "MANAGER" && user.functionalRole !== "PROJECT_MANAGER";

  const isAssignedToEmployee = (approverId: string) =>
    assignedApprovers.some((approver) => approver.id === approverId);

  const results = allCandidates.filter((candidate) => {
    if (!candidate.id || candidate.id === requester.id) return false;

    if (
      requester.userType === "HR" ||
      isAdminProjectManager(requester) ||
      isManagerProjectManager(requester)
    ) {
      return isAdminDirector(candidate);
    }

    if (
      requester.userType === "EMPLOYEE" ||
      requester.userType === "TEAM_LEAD" ||
      isRoleScopedManager(requester)
    ) {
      if (isAdminProjectManager(candidate)) {
        return true;
      }
    }

    if (requester.userType === "EMPLOYEE") {
      const sameRoleAssignedRsm =
        isAssignedToEmployee(candidate.id) &&
        isRoleScopedManager(candidate) &&
        (candidate.functionalRole ?? null) === (requester.functionalRole ?? null);

      const sameRoleAssignedTl =
        isAssignedToEmployee(candidate.id) &&
        candidate.userType === "TEAM_LEAD" &&
        (candidate.functionalRole ?? null) === (requester.functionalRole ?? null);

      if (sameRoleAssignedRsm || sameRoleAssignedTl) {
        return true;
      }
    }

    if (
      (requester.userType === "EMPLOYEE" || requester.userType === "TEAM_LEAD") &&
      requester.functionalRole === "DEVELOPER"
    ) {
      if (isManagerProjectManager(candidate)) {
        return true;
      }
    }

    return false;
  });

  return results.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function isValidLeaveRequestApproverForUser(userId: string, approverId: string) {
  if (!approverId) return false;
  const approvers = await getAllowedLeaveRequestApproversForUser(userId);
  return approvers.some((approver) => approver.id === approverId);
}

export async function getLeaveBalanceForUser(userId: string, year: number) {
  const profile = await getOrCreateLeaveYearProfile(userId, year);
  return {
    year,
    casualLeaves: Number(profile.casualLeaves),
    earnedLeaves: Number(profile.earnedLeaves),
    shift: profile.shift,
    employmentStatus: profile.employmentStatus,
  };
}

export async function getLeaveRequestsForUser(userId: string, todayDateKey: string) {
  const { startUtc } = getDayBoundsUtcFromIstDateKey(todayDateKey);

  const current = await db.leaveRequest.findMany({
    where: {
      userId,
      OR: [{ endDate: { gte: startUtc } }, { status: { in: ["PENDING", "APPROVED", "RECONSIDER"] } }],
    },
    include: {
      approver: {
        select: { fullName: true, userType: true },
      },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
  });

  const past = await db.leaveRequest.findMany({
    where: {
      userId,
      NOT: {
        OR: [{ endDate: { gte: startUtc } }, { status: { in: ["PENDING", "APPROVED", "RECONSIDER"] } }],
      },
    },
    include: {
      approver: {
        select: { fullName: true, userType: true },
      },
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });

  const [approvers, leaveBalance, officialHolidays] = await Promise.all([
    getAllowedLeaveRequestApproversForUser(userId),
    getLeaveBalanceForUser(userId, Number(todayDateKey.slice(0, 4))),
    getOfficialHolidayDateKeysForYear(Number(todayDateKey.slice(0, 4))),
  ]);

  return { current, past, approvers, leaveBalance, officialHolidays };
}

export async function getLeaveApprovalsForUser(viewerId: string, restrictToAssigned: boolean) {
  const where = restrictToAssigned
    ? {
        OR: [{ approverId: viewerId }, { user: { leaveApproverAssignments: { some: { approverId: viewerId } } } }],
      }
    : {};

  return db.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: {
          fullName: true,
          userType: true,
          functionalRole: true,
        },
      },
      approver: {
        select: {
          fullName: true,
          userType: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

function getQuarterCountForToday(year: number) {
  const todayKey = getIstDateKey();
  if (!todayKey.startsWith(String(year))) return 4;
  const month = Number(todayKey.slice(5, 7));
  return month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
}

export async function getOrCreateLeaveYearProfile(userId: string, year: number) {
  const existing = await db.leaveYearProfile.findUnique({ where: { userId_year: { userId, year } } });
  if (existing) return existing;

  const previous = await db.leaveYearProfile.findUnique({ where: { userId_year: { userId, year: year - 1 } } });
  const carryForwardEarned = Math.min(Number(previous?.earnedLeaves ?? 0), 45);
  const initialEarned = carryForwardEarned + 12.96;
  const initialCasual = getQuarterCountForToday(year) * 2;

  return db.leaveYearProfile.create({
    data: {
      userId,
      year,
      casualLeaves: new Prisma.Decimal(initialCasual.toFixed(2)),
      earnedLeaves: new Prisma.Decimal(initialEarned.toFixed(2)),
      shift: previous?.shift ?? "DAY",
      employmentStatus: previous?.employmentStatus ?? "PROBATION",
    },
  });
}

export async function getOfficialHolidayDateKeysForYear(year: number) {
  const rows = await db.officialHoliday.findMany({
    where: { year },
    orderBy: { holidayDate: "asc" },
    select: { holidayDate: true },
  });
  return rows.map((row) => getIstDateKey(row.holidayDate));
}

export async function getOfficialHolidaysForYear(year: number) {
  return db.officialHoliday.findMany({
    where: { year },
    orderBy: { holidayDate: "asc" },
  });
}

export async function getLeaveAdminList(filters?: { functionalRole?: string; userId?: string; page?: number; pageSize?: number }) {
  const page = filters?.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters?.pageSize && filters.pageSize > 0 ? filters.pageSize : 10;
  const year = Number(getIstDateKey().slice(0, 4));

  const userWhere: Prisma.UserWhereInput = {
    isActive: true,
    AND: [
      { NOT: [{ userType: "REPORT_VIEWER" }, { userType: "ACCOUNTS" }] },
      { NOT: [{ userType: "ADMIN", functionalRole: { in: ["DIRECTOR", "OTHER"] } }] },
    ],
  };

  if (filters?.functionalRole) {
    userWhere.functionalRole = filters.functionalRole as never;
  }
  if (filters?.userId) {
    userWhere.id = filters.userId;
  }

  const [totalItems, users, nameOptions, holidays] = await Promise.all([
    db.user.count({ where: userWhere }),
    db.user.findMany({
      where: userWhere,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        userType: true,
        functionalRole: true,
        leaveYearProfiles: {
          where: { year },
          take: 1,
          orderBy: { year: "desc" },
        },
      },
    }),
    db.user.findMany({
      where: filters?.functionalRole
        ? {
            ...userWhere,
            functionalRole: filters.functionalRole as never,
          }
        : userWhere,
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    getOfficialHolidaysForYear(year),
  ]);

  const hydratedUsers = await Promise.all(
    users.map(async (user) => ({
      ...user,
      profile: user.leaveYearProfiles[0] ?? (await getOrCreateLeaveYearProfile(user.id, year)),
    })),
  );

  return {
    year,
    users: hydratedUsers,
    totalItems,
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    pageSize,
    nameOptions,
    holidays,
  };
}
