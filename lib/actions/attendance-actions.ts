"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clearSession, requireUserForAction } from "@/lib/auth";
import { canMarkAttendance } from "@/lib/permissions";
import { reverseGeocodeLocation } from "@/lib/geo";
import { getAttendanceWorkDateKey, getDayBoundsUtcFromIstDateKey, getMarkInWindowLabel, getMarkOutWindowLabel, isMarkInWindow, isMarkOutWindow } from "@/lib/ist";
import { getLeaveBalanceForUser } from "@/lib/ems-queries";

function toNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function markAttendanceAction(formData: FormData) {
  const user = await requireUserForAction();

  if (!canMarkAttendance(user)) {
    throw new Error("You do not have permission to mark attendance.");
  }

  const actionType = String(formData.get("actionType") || "");
  const latitude = toNumber(formData.get("latitude"));
  const longitude = toNumber(formData.get("longitude"));
  const currentYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric" }).format(new Date()));
  const leaveBalance = await getLeaveBalanceForUser(user.id, currentYear);
  const shift = leaveBalance.shift;

  if (!latitude || !longitude) {
    await clearSession();
    throw new Error("Browser geolocation is required. You have been signed out. Please enable geolocation and sign in again.");
  }

  const workDateKey = getAttendanceWorkDateKey(new Date(), shift);
  const { startUtc, endUtc } = getDayBoundsUtcFromIstDateKey(workDateKey);
  const existing = await db.attendanceLog.findMany({
    where: {
      userId: user.id,
      attendanceDate: { gte: startUtc, lt: endUtc },
    },
    orderBy: { markedAt: "asc" },
  });

  if (actionType === "MARK_IN") {
    if (!isMarkInWindow(new Date(), shift)) throw new Error(`${getMarkInWindowLabel(shift)} Mark-In is not allowed right now.`);
    if (existing.some((row) => row.type === "MARK_IN")) throw new Error("Mark-In is already recorded for this attendance day.");
  } else if (actionType === "MARK_OUT") {
    if (!isMarkOutWindow(new Date(), shift)) throw new Error(`${getMarkOutWindowLabel(shift)} Mark-Out is not allowed right now.`);
    if (!existing.some((row) => row.type === "MARK_IN")) throw new Error("Mark-In must be recorded before Mark-Out.");
    if (existing.some((row) => row.type === "MARK_OUT")) throw new Error("Mark-Out is already recorded for this attendance day.");
  } else {
    throw new Error("Invalid attendance action.");
  }

  const location = await reverseGeocodeLocation(latitude, longitude);
  const city = location?.city || location?.town || location?.village || location?.stateDistrict || location?.state || null;

  await db.attendanceLog.create({
    data: {
      userId: user.id,
      attendanceDate: startUtc,
      type: actionType,
      latitude,
      longitude,
      city,
      town: location?.town ?? null,
      village: location?.village ?? null,
      stateDistrict: location?.stateDistrict ?? null,
      state: location?.state ?? null,
    },
  });

  revalidatePath("/dashboard");
}
