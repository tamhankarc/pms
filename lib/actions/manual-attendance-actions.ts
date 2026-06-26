"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AttendanceActionType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canAddManualAttendance } from "@/lib/permissions";
import { getDayBoundsUtcFromIstDateKey, IST_OFFSET_MINUTES } from "@/lib/ist";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTimeValue(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function parseOptionalNumber(value: string, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildIstDateTimeUtc(dateKey: string, timeValue: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes - IST_OFFSET_MINUTES, 0, 0),
  );
}

function redirectWithMessage(
  selectedUserId: string,
  fromDate: string,
  toDate: string,
  type: "success" | "error",
  message: string,
): never {
  const search = new URLSearchParams();
  if (selectedUserId) search.set("userId", selectedUserId);
  if (fromDate) search.set("fromDate", fromDate);
  if (toDate) search.set("toDate", toDate);
  search.set(type, message);
  redirect(`/attendance-history?${search.toString()}`);
}

const attendanceEligibleUserWhere: Prisma.UserWhereInput = {
  isActive: true,
  OR: [
    { userType: "EMPLOYEE" },
    { userType: "TEAM_LEAD" },
    {
      userType: "MANAGER",
      functionalRole: { notIn: ["PROJECT_MANAGER", "GENERAL_MANAGER"] },
    },
  ],
};

function getAttendanceHistoryRedirect(userId: string, fromDate: string, toDate: string) {
  const search = new URLSearchParams();
  if (userId) search.set("userId", userId);
  if (fromDate) search.set("fromDate", fromDate);
  if (toDate) search.set("toDate", toDate);
  const query = search.toString();
  return query ? `/attendance-history?${query}` : "/attendance-history";
}

export async function addManualAttendanceLogAction(formData: FormData) {
  const currentUser = await requireUserForAction();

  if (!canAddManualAttendance(currentUser)) {
    redirect("/dashboard");
  }

  const userId = getString(formData, "userId");
  const fromDate = getString(formData, "fromDate");
  const toDate = getString(formData, "toDate");
  const attendanceDate = getString(formData, "attendanceDate");
  const markedAtDate = getString(formData, "markedAtDate") || attendanceDate;
  const markedAtTime = getString(formData, "markedAtTime");
  const rawActionType = getString(formData, "actionType");
  const city = getString(formData, "city") || null;
  const stateDistrict = getString(formData, "stateDistrict") || null;
  const state = getString(formData, "state") || null;
  const latitude = parseOptionalNumber(getString(formData, "latitude"), 0);
  const longitude = parseOptionalNumber(getString(formData, "longitude"), 0);

  if (!userId) {
    redirectWithMessage(userId, fromDate, toDate, "error", "Please select a user first.");
  }

  if (!isDateKey(attendanceDate)) {
    redirectWithMessage(userId, fromDate, toDate, "error", "Please select a valid attendance/work date.");
  }

  if (!isDateKey(markedAtDate)) {
    redirectWithMessage(userId, fromDate, toDate, "error", "Please select a valid marked-at date.");
  }

  if (!isTimeValue(markedAtTime)) {
    redirectWithMessage(userId, fromDate, toDate, "error", "Please select a valid marked-at time.");
  }

  if (rawActionType !== "MARK_IN" && rawActionType !== "MARK_OUT") {
    redirectWithMessage(userId, fromDate, toDate, "error", "Please select Mark-In or Mark-Out.");
  }

  const actionType: AttendanceActionType = rawActionType === "MARK_IN" ? "MARK_IN" : "MARK_OUT";

  const targetUser = await db.user.findFirst({
    where: {
      AND: [{ id: userId }, attendanceEligibleUserWhere],
    },
    select: { id: true, fullName: true },
  });

  if (!targetUser) {
    redirectWithMessage(userId, fromDate, toDate, "error", "Selected user is not active or not eligible for attendance logs.");
  }

  const attendanceBounds = getDayBoundsUtcFromIstDateKey(attendanceDate);
  const existingSameType = await db.attendanceLog.findFirst({
    where: {
      userId,
      attendanceDate: {
        gte: attendanceBounds.startUtc,
        lt: attendanceBounds.endUtc,
      },
      type: actionType,
    },
    select: { id: true },
  });

  if (existingSameType) {
    redirectWithMessage(
      userId,
      fromDate,
      toDate,
      "error",
      `${actionType === "MARK_IN" ? "Mark-In" : "Mark-Out"} is already recorded for this attendance date.`,
    );
  }

  if (actionType === "MARK_OUT") {
    const existingMarkIn = await db.attendanceLog.findFirst({
      where: {
        userId,
        attendanceDate: {
          gte: attendanceBounds.startUtc,
          lt: attendanceBounds.endUtc,
        },
        type: "MARK_IN",
      },
      select: { id: true },
    });

    if (!existingMarkIn) {
      redirectWithMessage(userId, fromDate, toDate, "error", "Please add Mark-In before adding Mark-Out for this attendance date.");
    }
  }

  await db.attendanceLog.create({
    data: {
      userId,
      attendanceDate: attendanceBounds.startUtc,
      type: actionType,
      markedAt: buildIstDateTimeUtc(markedAtDate, markedAtTime),
      latitude,
      longitude,
      city,
      stateDistrict,
      state,
    },
  });

  revalidatePath("/attendance-history");
  revalidatePath("/dashboard");

  redirectWithMessage(
    userId,
    fromDate,
    toDate,
    "success",
    `${actionType === "MARK_IN" ? "Mark-In" : "Mark-Out"} added for ${targetUser.fullName}.`,
  );
}


export async function updateManualAttendanceLogAction(formData: FormData) {
  const currentUser = await requireUserForAction();

  if (!canAddManualAttendance(currentUser)) {
    redirect("/dashboard");
  }

  const logId = getString(formData, "logId");
  const userId = getString(formData, "userId");
  const fromDate = getString(formData, "fromDate");
  const toDate = getString(formData, "toDate");
  const attendanceDate = getString(formData, "attendanceDate");
  const markedAtDate = getString(formData, "markedAtDate") || attendanceDate;
  const markedAtTime = getString(formData, "markedAtTime");
  const rawActionType = getString(formData, "actionType");
  const city = getString(formData, "city") || null;
  const stateDistrict = getString(formData, "stateDistrict") || null;
  const state = getString(formData, "state") || null;
  const latitude = parseOptionalNumber(getString(formData, "latitude"), 0);
  const longitude = parseOptionalNumber(getString(formData, "longitude"), 0);

  if (!logId) {
    redirectWithMessage(userId, fromDate, toDate, "error", "Attendance log record was not found.");
  }

  const existingLog = await db.attendanceLog.findUnique({
    where: { id: logId },
    include: { user: { select: { id: true, fullName: true } } },
  });

  if (!existingLog) {
    redirectWithMessage(userId, fromDate, toDate, "error", "Attendance log record was not found.");
  }

  if (!isDateKey(attendanceDate)) {
    redirectWithMessage(existingLog.userId, fromDate, toDate, "error", "Please select a valid attendance/work date.");
  }

  if (!isDateKey(markedAtDate)) {
    redirectWithMessage(existingLog.userId, fromDate, toDate, "error", "Please select a valid marked-at date.");
  }

  if (!isTimeValue(markedAtTime)) {
    redirectWithMessage(existingLog.userId, fromDate, toDate, "error", "Please select a valid marked-at time.");
  }

  if (rawActionType !== "MARK_IN" && rawActionType !== "MARK_OUT") {
    redirectWithMessage(existingLog.userId, fromDate, toDate, "error", "Please select Mark-In or Mark-Out.");
  }

  const targetUser = await db.user.findFirst({
    where: {
      AND: [{ id: existingLog.userId }, attendanceEligibleUserWhere],
    },
    select: { id: true, fullName: true },
  });

  if (!targetUser) {
    redirectWithMessage(existingLog.userId, fromDate, toDate, "error", "Selected user is not active or not eligible for attendance logs.");
  }

  const actionType: AttendanceActionType = rawActionType === "MARK_IN" ? "MARK_IN" : "MARK_OUT";
  const attendanceBounds = getDayBoundsUtcFromIstDateKey(attendanceDate);

  const existingSameType = await db.attendanceLog.findFirst({
    where: {
      id: { not: logId },
      userId: existingLog.userId,
      attendanceDate: {
        gte: attendanceBounds.startUtc,
        lt: attendanceBounds.endUtc,
      },
      type: actionType,
    },
    select: { id: true },
  });

  if (existingSameType) {
    redirectWithMessage(
      existingLog.userId,
      fromDate,
      toDate,
      "error",
      `${actionType === "MARK_IN" ? "Mark-In" : "Mark-Out"} is already recorded for this attendance date.`,
    );
  }

  if (actionType === "MARK_OUT") {
    const existingMarkIn = await db.attendanceLog.findFirst({
      where: {
        id: { not: logId },
        userId: existingLog.userId,
        attendanceDate: {
          gte: attendanceBounds.startUtc,
          lt: attendanceBounds.endUtc,
        },
        type: "MARK_IN",
      },
      select: { id: true },
    });

    if (!existingMarkIn) {
      redirectWithMessage(existingLog.userId, fromDate, toDate, "error", "Please add Mark-In before saving Mark-Out for this attendance date.");
    }
  }

  await db.attendanceLog.update({
    where: { id: logId },
    data: {
      attendanceDate: attendanceBounds.startUtc,
      type: actionType,
      markedAt: buildIstDateTimeUtc(markedAtDate, markedAtTime),
      latitude,
      longitude,
      city,
      stateDistrict,
      state,
    },
  });

  revalidatePath("/attendance-history");
  revalidatePath("/dashboard");

  const search = new URLSearchParams();
  search.set("success", `${actionType === "MARK_IN" ? "Mark-In" : "Mark-Out"} updated for ${targetUser.fullName}.`);
  const redirectTarget = getAttendanceHistoryRedirect(existingLog.userId, fromDate, toDate);
  redirect(`${redirectTarget}${redirectTarget.includes("?") ? "&" : "?"}${search.toString()}`);
}
