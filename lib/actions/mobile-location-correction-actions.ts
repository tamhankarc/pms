"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canMarkAttendance } from "@/lib/permissions";
import { reverseGeocodeLocation } from "@/lib/geo";
import { getGoogleAddressDetailsForCoordinates } from "@/lib/google-location";
import {
  formatDateInIst,
  formatTimeInIst,
  getAttendanceWorkDateKey,
  getDayBoundsUtcFromIstDateKey,
  getMarkInWindowLabel,
  getMarkOutWindowLabel,
  isMarkInWindow,
  isMarkOutWindow,
} from "@/lib/ist";
import { getLeaveBalanceForUser } from "@/lib/ems-queries";

type AttendanceActionTypeForCorrection = "MARK_IN" | "MARK_OUT";

type LocationDisplay = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  city: string | null;
  district: string | null;
  town: string | null;
  village: string | null;
  state: string | null;
  formattedAddress: string | null;
  capturedAt: string | null;
  error: string | null;
};

type CorrectionEntry = {
  actionType: AttendanceActionTypeForCorrection;
  label: string;
  available: boolean;
  reason: string | null;
  attendanceDate: string | null;
  markedAt: string | null;
  saved: LocationDisplay | null;
  currentBrowser: LocationDisplay | null;
  currentGeocoding: LocationDisplay | null;
  currentGeolocation: LocationDisplay | null;
  cityChanged: boolean;
  stateChanged: boolean;
  canUpdate: boolean;
};

type CheckLocationResult = {
  success: boolean;
  error?: string;
  checkedAt?: string;
  entries?: CorrectionEntry[];
};

type UpdateLocationResult = {
  success: boolean;
  error?: string;
  message?: string;
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

function getCurrentIstYear() {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
    }).format(new Date()),
  );
}

function normalizeComparable(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function getCityDistrictLabel(city?: string | null, district?: string | null) {
  const normalizedCity = (city ?? "").trim();
  const normalizedDistrict = (district ?? "").trim();

  if (
    normalizedCity &&
    normalizedDistrict &&
    normalizeComparable(normalizedCity) !==
      normalizeComparable(normalizedDistrict)
  ) {
    return `${normalizedCity}, ${normalizedDistrict}`;
  }

  return normalizedCity || normalizedDistrict || "";
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

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && "toNumber" in value) {
    const decimalValue = value as { toNumber?: () => number };
    if (typeof decimalValue.toNumber === "function") {
      const parsed = decimalValue.toNumber();
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSavedLocationDisplay(
  log: Awaited<ReturnType<typeof getEligibleAttendanceLog>>,
): LocationDisplay | null {
  if (!log) return null;
  return {
    latitude: decimalToNumber(log.googleLatitude),
    longitude: decimalToNumber(log.googleLongitude),
    accuracy: decimalToNumber(log.googleAccuracy),
    city: log.googleCity ?? null,
    district: log.googleDistrict ?? null,
    town: log.googleTown ?? null,
    village: log.googleVillage ?? null,
    state: log.googleState ?? null,
    formattedAddress: log.googleFormattedAddress ?? null,
    capturedAt: log.googleCapturedAt
      ? log.googleCapturedAt.toISOString()
      : null,
    error: log.googleError ?? null,
  };
}

async function getUserShift(userId: string) {
  const leaveBalance = await getLeaveBalanceForUser(
    userId,
    getCurrentIstYear(),
  );
  return leaveBalance.shift;
}

async function getEligibleAttendanceLog(
  userId: string,
  actionType: AttendanceActionTypeForCorrection,
  startUtc: Date,
  endUtc: Date,
) {
  return db.attendanceLog.findFirst({
    where: {
      userId,
      type: actionType,
      attendanceDate: { gte: startUtc, lt: endUtc },
    },
    orderBy: { markedAt: "desc" },
  });
}

async function resolveCurrentLocation(formData: FormData) {
  const latitude = toNumber(formData.get("latitude"));
  const longitude = toNumber(formData.get("longitude"));
  const browserAccuracy = toNumber(formData.get("browserAccuracy"));
  const browserCapturedAt = toDate(formData.get("browserCapturedAt"));

  if (latitude === null || longitude === null) {
    throw new Error(
      "Mobile browser location is required. Please allow location access and try again.",
    );
  }

  const browserAddress = await reverseGeocodeLocation(latitude, longitude);
  const browserCity =
    browserAddress?.city ||
    browserAddress?.town ||
    browserAddress?.village ||
    browserAddress?.stateDistrict ||
    browserAddress?.state ||
    null;
  const geocodingAddress = await getGoogleAddressDetailsForCoordinates(
    latitude,
    longitude,
  );

  return {
    raw: {
      latitude,
      longitude,
      browserAccuracy,
      browserCapturedAt,
      browserCity,
      browserAddress,
      geocodingAddress,
    },
    browserDisplay: {
      latitude,
      longitude,
      accuracy: browserAccuracy,
      city: browserCity,
      district: browserAddress?.stateDistrict ?? null,
      town: browserAddress?.town ?? null,
      village: browserAddress?.village ?? null,
      state: browserAddress?.state ?? null,
      formattedAddress: browserAddress?.formattedAddress ?? null,
      capturedAt: browserCapturedAt ? browserCapturedAt.toISOString() : null,
      error: null,
    } satisfies LocationDisplay,
    geocodingDisplay: {
      latitude: geocodingAddress.latitude,
      longitude: geocodingAddress.longitude,
      accuracy: null,
      city: geocodingAddress.city,
      district: geocodingAddress.district,
      town: geocodingAddress.town,
      village: geocodingAddress.village,
      state: geocodingAddress.state,
      formattedAddress: geocodingAddress.formattedAddress,
      capturedAt: geocodingAddress.capturedAt
        ? geocodingAddress.capturedAt.toISOString()
        : null,
      error: geocodingAddress.error,
    } satisfies LocationDisplay,
    geolocationDisplay: null,
  };
}

function isActionWindowOpen(
  actionType: AttendanceActionTypeForCorrection,
  now: Date,
  shift: "DAY" | "NIGHT",
) {
  return actionType === "MARK_IN"
    ? isMarkInWindow(now, shift)
    : isMarkOutWindow(now, shift);
}

function getWindowClosedReason(
  actionType: AttendanceActionTypeForCorrection,
  shift: "DAY" | "NIGHT",
) {
  return actionType === "MARK_IN"
    ? `${getMarkInWindowLabel(shift)} Location correction for Mark-In is available only during this window.`
    : `${getMarkOutWindowLabel(shift)} Location correction for Mark-Out is available only during this window.`;
}

export async function checkMobileAttendanceLocationAction(
  formData: FormData,
): Promise<CheckLocationResult> {
  try {
    const user = await requireUserForAction();

    if (!canMarkAttendance(user)) {
      return {
        success: false,
        error: "You do not have permission to update attendance location.",
      };
    }

    const shift = await getUserShift(user.id);
    const now = new Date();
    const workDateKey = getAttendanceWorkDateKey(now, shift);
    const { startUtc, endUtc } = getDayBoundsUtcFromIstDateKey(workDateKey);
    const currentLocation = await resolveCurrentLocation(formData);

    const entries: CorrectionEntry[] = [];

    for (const actionType of ["MARK_IN", "MARK_OUT"] as const) {
      const label = actionType === "MARK_IN" ? "Mark-In" : "Mark-Out";
      const windowOpen = isActionWindowOpen(actionType, now, shift);
      const log = await getEligibleAttendanceLog(
        user.id,
        actionType,
        startUtc,
        endUtc,
      );
      const saved = buildSavedLocationDisplay(log);
      const savedCityDistrict = saved
        ? getCityDistrictLabel(saved.city, saved.district)
        : "";
      const currentCityDistrict = getCityDistrictLabel(
        currentLocation.geocodingDisplay.city,
        currentLocation.geocodingDisplay.district,
      );
      const cityChanged = Boolean(
        saved &&
        normalizeComparable(savedCityDistrict) !==
          normalizeComparable(currentCityDistrict),
      );
      const stateChanged = Boolean(
        saved &&
        normalizeComparable(saved.state) !==
          normalizeComparable(currentLocation.geocodingDisplay.state),
      );

      entries.push({
        actionType,
        label,
        available: Boolean(log && windowOpen),
        reason: !log
          ? `${label} is not recorded for the current attendance date.`
          : !windowOpen
            ? getWindowClosedReason(actionType, shift)
            : null,
        attendanceDate: log ? formatDateInIst(log.attendanceDate) : null,
        markedAt: log ? formatTimeInIst(log.markedAt) : null,
        saved,
        currentBrowser: currentLocation.geocodingDisplay,
        currentGeocoding: currentLocation.geocodingDisplay,
        currentGeolocation: currentLocation.geolocationDisplay,
        cityChanged,
        stateChanged,
        canUpdate: Boolean(log && windowOpen && (cityChanged || stateChanged)),
      });
    }

    return {
      success: true,
      checkedAt: new Date().toISOString(),
      entries,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to check current mobile location.",
    };
  }
}

export async function updateMobileAttendanceLocationAction(
  formData: FormData,
): Promise<UpdateLocationResult> {
  try {
    const user = await requireUserForAction();

    if (!canMarkAttendance(user)) {
      return {
        success: false,
        error: "You do not have permission to update attendance location.",
      };
    }

    const actionType = String(
      formData.get("actionType") || "",
    ) as AttendanceActionTypeForCorrection;
    if (actionType !== "MARK_IN" && actionType !== "MARK_OUT") {
      return { success: false, error: "Invalid attendance action." };
    }

    const shift = await getUserShift(user.id);
    const now = new Date();

    if (!isActionWindowOpen(actionType, now, shift)) {
      return {
        success: false,
        error: getWindowClosedReason(actionType, shift),
      };
    }

    const workDateKey = getAttendanceWorkDateKey(now, shift);
    const { startUtc, endUtc } = getDayBoundsUtcFromIstDateKey(workDateKey);
    const log = await getEligibleAttendanceLog(
      user.id,
      actionType,
      startUtc,
      endUtc,
    );

    if (!log) {
      return {
        success: false,
        error:
          actionType === "MARK_IN"
            ? "Mark-In is not recorded for the current attendance date."
            : "Mark-Out is not recorded for the current attendance date.",
      };
    }

    const currentLocation = await resolveCurrentLocation(formData);
    const { raw } = currentLocation;
    const locationDistanceMeters = calculateDistanceMeters(
      raw.latitude,
      raw.longitude,
      raw.geocodingAddress.latitude,
      raw.geocodingAddress.longitude,
    );

    await db.attendanceLog.update({
      where: { id: log.id },
      data: {
        latitude: raw.latitude,
        longitude: raw.longitude,
        browserAccuracy: raw.browserAccuracy,
        browserCapturedAt: raw.browserCapturedAt,
        browserFormattedAddress: raw.browserAddress?.formattedAddress ?? null,
        googleLatitude: raw.geocodingAddress.latitude,
        googleLongitude: raw.geocodingAddress.longitude,
        googleAccuracy: null,
        googleCapturedAt: raw.geocodingAddress.capturedAt,
        googleError: raw.geocodingAddress.error,
        googleCity: raw.geocodingAddress.city,
        googleDistrict: raw.geocodingAddress.district,
        googleTown: raw.geocodingAddress.town,
        googleVillage: raw.geocodingAddress.village,
        googleState: raw.geocodingAddress.state,
        googleFormattedAddress: raw.geocodingAddress.formattedAddress,
        locationDistanceMeters,
        city: raw.browserCity,
        town: raw.browserAddress?.town ?? null,
        village: raw.browserAddress?.village ?? null,
        stateDistrict: raw.browserAddress?.stateDistrict ?? null,
        state: raw.browserAddress?.state ?? null,
      },
    });

    revalidatePath("/mobile-location-correction");
    revalidatePath("/attendance-history");
    revalidatePath("/dashboard");

    return {
      success: true,
      message:
        actionType === "MARK_IN"
          ? "Mark-In location updated successfully."
          : "Mark-Out location updated successfully.",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to update attendance location.",
    };
  }
}
