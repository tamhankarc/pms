"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  checkMobileAttendanceLocationAction,
  updateMobileAttendanceLocationAction,
} from "@/lib/actions/mobile-location-correction-actions";

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

type GoogleGeolocationCapture = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string | null;
  error: string | null;
};

function isMobileLikeDevice() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const mobileOrTablet =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const smallTouch = window.innerWidth < 1024 && navigator.maxTouchPoints > 0;
  return mobileOrTablet || smallTouch;
}

function formatCoordinate(value: number | null) {
  return value === null ? "—" : value.toFixed(7);
}

function formatAccuracy(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} m`;
}

function getClientErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatCapturedAt(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getGoogleGeolocationApiKey() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_GEOLOCATION_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_GEOLOCATION_BROWSER_API_KEY ||
    ""
  ).trim();
}

async function captureGoogleGeolocation(): Promise<GoogleGeolocationCapture> {
  const apiKey = getGoogleGeolocationApiKey();
  const capturedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      capturedAt,
      error: "NEXT_PUBLIC_GOOGLE_GEOLOCATION_API_KEY is not configured.",
    };
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/geolocation/v1/geolocate?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ considerIp: true }),
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      location?: { lat?: number; lng?: number };
      accuracy?: number;
      error?: { message?: string; status?: string };
    } | null;

    if (!response.ok || payload?.error) {
      return {
        latitude: null,
        longitude: null,
        accuracy: null,
        capturedAt,
        error:
          payload?.error?.message ||
          payload?.error?.status ||
          `Google Geolocation failed with status ${response.status}.`,
      };
    }

    return {
      latitude:
        typeof payload?.location?.lat === "number"
          ? payload.location.lat
          : null,
      longitude:
        typeof payload?.location?.lng === "number"
          ? payload.location.lng
          : null,
      accuracy: typeof payload?.accuracy === "number" ? payload.accuracy : null,
      capturedAt,
      error: null,
    };
  } catch (error) {
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      capturedAt,
      error:
        error instanceof Error
          ? error.message
          : "Google Geolocation request failed.",
    };
  }
}

async function getMobileBrowserPosition() {
  if (!("geolocation" in navigator)) {
    throw new Error(
      "Mobile browser geolocation is not available on this device/browser.",
    );
  }

  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 0,
    });
  });
}

async function buildLocationFormData(
  actionType?: AttendanceActionTypeForCorrection,
) {
  const position = await getMobileBrowserPosition();
  const googleGeolocation = await captureGoogleGeolocation();
  const formData = new FormData();

  if (actionType) formData.set("actionType", actionType);
  formData.set("latitude", String(position.coords.latitude));
  formData.set("longitude", String(position.coords.longitude));
  if (Number.isFinite(position.coords.accuracy)) {
    formData.set("browserAccuracy", String(position.coords.accuracy));
  }
  formData.set("browserCapturedAt", new Date(position.timestamp).toISOString());

  if (googleGeolocation.latitude !== null) {
    formData.set("geolocationLatitude", String(googleGeolocation.latitude));
  }
  if (googleGeolocation.longitude !== null) {
    formData.set("geolocationLongitude", String(googleGeolocation.longitude));
  }
  if (googleGeolocation.accuracy !== null) {
    formData.set("geolocationAccuracy", String(googleGeolocation.accuracy));
  }
  if (googleGeolocation.capturedAt) {
    formData.set("geolocationCapturedAt", googleGeolocation.capturedAt);
  }
  if (googleGeolocation.error) {
    formData.set("geolocationError", googleGeolocation.error);
  }

  return formData;
}

function LocationCityState({ location }: { location: LocationDisplay | null }) {
  if (!location) return <p className="text-sm text-slate-500">—</p>;

  return (
    <div className="space-y-1 text-sm text-slate-700">
      <p>
        <span className="font-semibold text-slate-900">City:</span>{" "}
        {location.city || "—"}
      </p>
      <p>
        <span className="font-semibold text-slate-900">State:</span>{" "}
        {location.state || "—"}
      </p>
      {location.error ? (
        <p className="text-xs font-medium text-amber-700">{location.error}</p>
      ) : null}
    </div>
  );
}

function EntryCard({
  entry,
  onUpdate,
  updatingAction,
}: {
  entry: CorrectionEntry;
  onUpdate: (actionType: AttendanceActionTypeForCorrection) => void;
  updatingAction: AttendanceActionTypeForCorrection | null;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            {entry.label} location
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Attendance date: {entry.attendanceDate || "—"} · Marked at:{" "}
            {entry.markedAt || "—"}
          </p>
        </div>
        {entry.available ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Eligible now
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Not eligible now
          </span>
        )}
      </div>

      {entry.reason ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {entry.reason}
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Saved Location
          </p>
          <LocationCityState location={entry.saved} />
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
            Current Location
          </p>
          <LocationCityState location={entry.currentBrowser} />
        </div>
      </div>

      {entry.available ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          {entry.cityChanged || entry.stateChanged ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-800">
                {entry.cityChanged && entry.stateChanged
                  ? "City and State are different from the saved attendance location."
                  : entry.cityChanged
                    ? "City is different from the saved attendance location."
                    : "State is different from the saved attendance location."}
              </p>
              <button
                type="button"
                className="btn-primary w-full justify-center"
                disabled={updatingAction === entry.actionType}
                onClick={() => onUpdate(entry.actionType)}
              >
                {updatingAction === entry.actionType
                  ? "Updating..."
                  : `Update ${entry.label} Location`}
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium text-emerald-700">
              City and State match the saved attendance location. No update is
              required.
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function MobileLocationCorrectionClient() {
  const [isMobile, setIsMobile] = useState(false);
  const [hasCheckedDevice, setHasCheckedDevice] = useState(false);
  const [result, setResult] = useState<CheckLocationResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [updatingAction, setUpdatingAction] =
    useState<AttendanceActionTypeForCorrection | null>(null);

  useEffect(() => {
    setIsMobile(isMobileLikeDevice());
    setHasCheckedDevice(true);
  }, []);

  const eligibleEntries = useMemo(
    () => result?.entries?.filter((entry) => entry.available) ?? [],
    [result],
  );

  function checkCurrentLocation() {
    setError("");
    setMessage("");
    setResult(null);

    if (!isMobileLikeDevice()) {
      setError("This page is intended for mobile browsers only.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = await buildLocationFormData();
        const nextResult = await checkMobileAttendanceLocationAction(formData);
        if (!nextResult.success) {
          setError(nextResult.error || "Unable to check current location.");
          return;
        }
        setResult(nextResult);
      } catch (locationError) {
        setError(
          getClientErrorMessage(
            locationError,
            "Unable to get current mobile location.",
          ),
        );
      }
    });
  }

  function updateLocation(actionType: AttendanceActionTypeForCorrection) {
    setError("");
    setMessage("");
    setUpdatingAction(actionType);

    startTransition(async () => {
      try {
        const formData = await buildLocationFormData(actionType);
        const updateResult =
          await updateMobileAttendanceLocationAction(formData);
        if (!updateResult.success) {
          setError(
            updateResult.error || "Unable to update attendance location.",
          );
          return;
        }
        setMessage(
          updateResult.message || "Attendance location updated successfully.",
        );
        const refreshedFormData = await buildLocationFormData();
        const refreshed =
          await checkMobileAttendanceLocationAction(refreshedFormData);
        if (refreshed.success) setResult(refreshed);
      } catch (updateError) {
        setError(
          getClientErrorMessage(
            updateError,
            "Unable to update attendance location.",
          ),
        );
      } finally {
        setUpdatingAction(null);
      }
    });
  }

  if (hasCheckedDevice && !isMobile) {
    return (
      <section className="card p-6">
        <h1 className="section-title">Mobile Attendance Location Check</h1>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          This page is available only on mobile browsers. Please open it from
          your phone and allow location access.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="card p-5">
        <h1 className="section-title">Mobile Attendance Location Check</h1>
        <p className="section-subtitle mt-2">
          Use this page on mobile to compare your current location with
          today&apos;s saved Mark-In / Mark-Out location. Update is available
          only if the saved city or state is different and the relevant
          attendance window is currently open.
        </p>
        <button
          type="button"
          className="btn-primary mt-5 w-full justify-center"
          disabled={pending}
          onClick={checkCurrentLocation}
        >
          {pending && !updatingAction
            ? "Checking location..."
            : "Check Current Mobile Location"}
        </button>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      {result?.entries?.length ? (
        <div className="space-y-4">
          {eligibleEntries.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
              No Mark-In or Mark-Out entry is currently eligible for mobile
              location update. Check the messages below for the reason.
            </div>
          ) : null}
          {result.entries.map((entry) => (
            <EntryCard
              key={entry.actionType}
              entry={entry}
              onUpdate={updateLocation}
              updatingAction={updatingAction}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
