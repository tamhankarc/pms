import type { FunctionalRoleCode, Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import {
  isAdmin,
  isProjectManager,
  isRoleScopedManager,
} from "@/lib/permissions";
import { db } from "@/lib/db";
import { getDayBoundsUtcFromIstDateKey, IST_OFFSET_MINUTES } from "@/lib/ist";

export type SweepInAccessLevel = "none" | "view" | "edit" | "create";

export const SWEEP_IN_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const SWEEP_IN_TIME_REGEX = /^\d{2}:\d{2}$/;

const selectableUserSelect = {
  id: true,
  fullName: true,
  username: true,
  email: true,
  employeeCode: true,
  userType: true,
  functionalRole: true,
} satisfies Prisma.UserSelect;

export type SweepInSelectableUser = Prisma.UserGetPayload<{
  select: typeof selectableUserSelect;
}>;

export function getSweepInAccessLevel(user: SessionUser): SweepInAccessLevel {
  if (user.userType === "HR") return "view";
  if (isAdmin(user) && user.functionalRole === "OTHER") return "edit";
  if (isRoleScopedManager(user) || isProjectManager(user)) return "create";
  return "none";
}

export function canViewSweepInTriggers(user: SessionUser) {
  return getSweepInAccessLevel(user) !== "none";
}

export function canCreateSweepInTriggers(user: SessionUser) {
  return getSweepInAccessLevel(user) === "create";
}

export function canEditSweepInTriggers(user: SessionUser) {
  const access = getSweepInAccessLevel(user);
  return access === "create" || access === "edit";
}

export function isDateKey(value: string) {
  return SWEEP_IN_DATE_REGEX.test(value);
}

export function isTimeValue(value: string) {
  if (!SWEEP_IN_TIME_REGEX.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function buildIstDateTimeUtc(dateKey: string, timeValue: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes - IST_OFFSET_MINUTES, 0, 0),
  );
}

export function getAttendanceDateStartUtc(dateKey: string) {
  return getDayBoundsUtcFromIstDateKey(dateKey).startUtc;
}

function getActiveUserWhereForSelection(user: SessionUser): Prisma.UserWhereInput {
  if (isAdmin(user) && user.functionalRole === "OTHER") {
    return {
      isActive: true,
      userType: { notIn: ["ADMIN", "ACCOUNTS", "OPERATIONS", "REPORT_VIEWER", "HR"] },
    };
  }

  const orFilters: Prisma.UserWhereInput[] = [];

  if (user.functionalRole && user.functionalRole !== "UNASSIGNED") {
    orFilters.push({ functionalRole: user.functionalRole as FunctionalRoleCode });
  }

  orFilters.push({ id: user.id });

  return {
    isActive: true,
    userType: { notIn: ["ADMIN", "ACCOUNTS", "OPERATIONS", "REPORT_VIEWER", "HR"] },
    OR: orFilters,
  };
}

export async function getSweepInSelectableUsers(
  user: SessionUser,
  includeUserIds: string[] = [],
): Promise<SweepInSelectableUser[]> {
  if (!canEditSweepInTriggers(user)) return [];

  const baseUsers = await db.user.findMany({
    where: getActiveUserWhereForSelection(user),
    select: selectableUserSelect,
    orderBy: [{ fullName: "asc" }],
  });

  const assignedUsers = await db.employeeTeamLead
    .findMany({
      where: {
        teamLeadId: user.id,
        employee: {
          isActive: true,
          userType: { notIn: ["ADMIN", "ACCOUNTS", "OPERATIONS", "REPORT_VIEWER", "HR"] },
        },
      },
      include: {
        employee: {
          select: selectableUserSelect,
        },
      },
      orderBy: {
        employee: {
          fullName: "asc",
        },
      },
    })
    .then((assignments) => assignments.map((assignment) => assignment.employee));

  const explicitlyIncluded = includeUserIds.length
    ? await db.user.findMany({
        where: {
          id: { in: includeUserIds },
          isActive: true,
        },
        select: selectableUserSelect,
        orderBy: [{ fullName: "asc" }],
      })
    : [];

  const usersById = new Map<string, SweepInSelectableUser>();
  for (const option of [...baseUsers, ...assignedUsers, ...explicitlyIncluded]) {
    usersById.set(option.id, option);
  }

  return Array.from(usersById.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
}

export function canSeeAllSweepInTriggers(user: SessionUser) {
  return user.userType === "HR" || (isAdmin(user) && user.functionalRole === "OTHER");
}

export async function getVisibleSweepInTriggerWhere(
  user: SessionUser,
): Promise<Prisma.SweepInTriggerWhereInput> {
  if (canSeeAllSweepInTriggers(user)) return {};

  const selectableUsers = await getSweepInSelectableUsers(user);
  const selectableUserIds = selectableUsers.map((option) => option.id);

  return {
    OR: [
      { createdById: user.id },
      selectableUserIds.length
        ? { users: { some: { userId: { in: selectableUserIds } } } }
        : { id: "__none__" },
    ],
  };
}

export async function getSweepInMarkInOverride(userId: string, attendanceDate: Date) {
  const trigger = await db.sweepInTrigger.findFirst({
    where: {
      triggerDate: attendanceDate,
      users: {
        some: { userId },
      },
    },
    select: { markInAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return trigger?.markInAt ?? null;
}
