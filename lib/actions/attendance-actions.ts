"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clearSession, requireUserForAction } from "@/lib/auth";
import { canMarkAttendance } from "@/lib/permissions";
import { reverseGeocodeLocation } from "@/lib/geo";
import { getGoogleAddressDetailsForCoordinates } from "@/lib/google-location";
import {
  getAttendanceWorkDateKey,
  getDayBoundsUtcFromIstDateKey,
  getMarkInWindowLabel,
  getMarkOutWindowLabel,
  isMarkInWindow,
  isMarkOutWindow,
} from "@/lib/ist";
import { getLeaveBalanceForUser } from "@/lib/ems-queries";
import { getSweepInMarkInOverride } from "@/lib/sweep-in-triggers";

type MarkAttendanceActionResult = {
  success: boolean;
  error?: string;
};

function toNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculateDistanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number | null,
  longitudeB: number | null,
) {
  if (latitudeB === null || longitudeB === null) return null;

  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const startLatitude = toRadians(latitudeA);
  const endLatitude = toRadians(latitudeB);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function getCurrentIstYear() {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
    }).format(new Date()),
  );
}

export async function markAttendanceAction(
  formData: FormData,
): Promise<MarkAttendanceActionResult> {
  try {
    const user = await requireUserForAction();

    if (!canMarkAttendance(user)) {
      return {
        success: false,
        error: "You do not have permission to mark attendance.",
      };
    }

    const actionType = String(formData.get("actionType") || "");
    const latitude = toNumber(formData.get("latitude"));
    const longitude = toNumber(formData.get("longitude"));
    const browserAccuracy = toNumber(formData.get("browserAccuracy"));
    const browserCapturedAt = toDate(formData.get("browserCapturedAt"));
    const leaveBalance = await getLeaveBalanceForUser(
      user.id,
      getCurrentIstYear(),
    );
    const shift = leaveBalance.shift;

    if (latitude === null || longitude === null) {
      await clearSession();
      return {
        success: false,
        error:
          "Browser geolocation is required. You have been signed out. Please enable geolocation and sign in again.",
      };
    }

    const now = new Date();
    const workDateKey = getAttendanceWorkDateKey(now, shift);
    const { startUtc, endUtc } = getDayBoundsUtcFromIstDateKey(workDateKey);
    const existing = await db.attendanceLog.findMany({
      where: {
        userId: user.id,
        attendanceDate: { gte: startUtc, lt: endUtc },
      },
      orderBy: { markedAt: "asc" },
    });

    if (actionType === "MARK_IN") {
      if (!isMarkInWindow(now, shift)) {
        return {
          success: false,
          error: `${getMarkInWindowLabel(shift)} Mark-In is not allowed right now.`,
        };
      }
      if (existing.some((row) => row.type === "MARK_IN")) {
        return {
          success: false,
          error: "Mark-In is already recorded for this attendance day.",
        };
      }
    } else if (actionType === "MARK_OUT") {
      if (!isMarkOutWindow(now, shift)) {
        return {
          success: false,
          error: `${getMarkOutWindowLabel(shift)} Mark-Out is not allowed right now.`,
        };
      }
      if (!existing.some((row) => row.type === "MARK_IN")) {
        return {
          success: false,
          error: "Mark-In must be recorded before Mark-Out.",
        };
      }
      if (existing.some((row) => row.type === "MARK_OUT")) {
        return {
          success: false,
          error: "Mark-Out is already recorded for this attendance day.",
        };
      }
    } else {
      return { success: false, error: "Invalid attendance action." };
    }

    const location = await reverseGeocodeLocation(latitude, longitude);
    const city =
      location?.city ||
      location?.town ||
      location?.village ||
      location?.stateDistrict ||
      location?.state ||
      null;

    const googleAddressDetails = await getGoogleAddressDetailsForCoordinates(
      latitude,
      longitude,
    );

    const locationDistanceMeters = calculateDistanceMeters(
      latitude,
      longitude,
      googleAddressDetails.latitude,
      googleAddressDetails.longitude,
    );

    const sweepInMarkedAt =
      actionType === "MARK_IN"
        ? await getSweepInMarkInOverride(user.id, startUtc)
        : null;

    await db.attendanceLog.create({
      data: {
        userId: user.id,
        attendanceDate: startUtc,
        type: actionType,
        markedAt: sweepInMarkedAt ?? now,
        latitude,
        longitude,
        browserAccuracy,
        browserCapturedAt,
        browserFormattedAddress: location?.formattedAddress ?? null,
        googleLatitude: googleAddressDetails.latitude,
        googleLongitude: googleAddressDetails.longitude,
        googleAccuracy: null,
        googleCapturedAt: googleAddressDetails.capturedAt,
        googleError: googleAddressDetails.error,
        googleCity: googleAddressDetails.city,
        googleDistrict: googleAddressDetails.district,
        googleTown: googleAddressDetails.town,
        googleVillage: googleAddressDetails.village,
        googleState: googleAddressDetails.state,
        googleFormattedAddress: googleAddressDetails.formattedAddress,
        locationDistanceMeters,
        city,
        town: location?.town ?? null,
        village: location?.village ?? null,
        stateDistrict: location?.stateDistrict ?? null,
        state: location?.state ?? null,
      },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("markAttendanceAction failed", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unable to mark attendance.",
    };
  }
}
