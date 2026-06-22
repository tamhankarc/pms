"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAttendanceAction } from "@/lib/actions/attendance-actions";

type Props = {
  canMarkIn: boolean;
  canMarkOut: boolean;
  markInAt?: string | null;
  markOutAt?: string | null;
  city?: string | null;
  shift: "DAY" | "NIGHT";
};

function isDesktopLikeDevice() {
  if (typeof window === "undefined") return true;
  const ua = navigator.userAgent || "";
  const mobileOrTablet =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const smallTouch = window.innerWidth < 1024 && navigator.maxTouchPoints > 0;
  return !(mobileOrTablet || smallTouch);
}

type GoogleGeolocationCapture = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string | null;
  error: string | null;
};

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

export function AttendanceActionsCard({
  canMarkIn,
  canMarkOut,
  markInAt,
  markOutAt,
  city,
  shift,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<
    "MARK_IN" | "MARK_OUT" | null
  >(null);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const evaluate = () => setIsDesktop(isDesktopLikeDevice());
    evaluate();
    window.addEventListener("resize", evaluate);
    return () => window.removeEventListener("resize", evaluate);
  }, []);

  const subtitle = useMemo(() => {
    return shift === "NIGHT"
      ? "Night Shift · Mark-In: 9:00 PM to 3:00 AM IST. Mark-Out: 1:00 AM to 8:59 PM IST."
      : "Day Shift · Mark-In: 8:30 AM to 3:00 PM IST. Mark-Out: 12:00 PM IST to 8:29 AM IST next day.";
  }, [shift]);

  function submit(actionType: "MARK_IN" | "MARK_OUT") {
    setError("");
    if (!isDesktopLikeDevice()) {
      setError(
        "Attendance is available only on desktop, laptop, or MacBook browsers.",
      );
      return;
    }
    if (!("geolocation" in navigator)) {
      setError("Browser geolocation is required.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPendingAction(actionType);
        startTransition(async () => {
          try {
            const googleGeolocation = await captureGoogleGeolocation();
            const formData = new FormData();
            formData.set("actionType", actionType);
            formData.set("latitude", String(position.coords.latitude));
            formData.set("longitude", String(position.coords.longitude));
            if (Number.isFinite(position.coords.accuracy)) {
              formData.set("browserAccuracy", String(position.coords.accuracy));
            }
            formData.set(
              "browserCapturedAt",
              new Date(position.timestamp).toISOString(),
            );

            if (googleGeolocation.latitude !== null) {
              formData.set(
                "geolocationLatitude",
                String(googleGeolocation.latitude),
              );
            }
            if (googleGeolocation.longitude !== null) {
              formData.set(
                "geolocationLongitude",
                String(googleGeolocation.longitude),
              );
            }
            if (googleGeolocation.accuracy !== null) {
              formData.set(
                "geolocationAccuracy",
                String(googleGeolocation.accuracy),
              );
            }
            if (googleGeolocation.capturedAt) {
              formData.set(
                "geolocationCapturedAt",
                googleGeolocation.capturedAt,
              );
            }
            if (googleGeolocation.error) {
              formData.set("geolocationError", googleGeolocation.error);
            }

            const result = await markAttendanceAction(formData);
            if (!result.success) {
              const message = result.error || "Unable to mark attendance.";
              setError(message);
              if (message.includes("signed out")) {
                window.location.href = "/login";
              }
              return;
            }
            router.refresh();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Unable to mark attendance.",
            );
          } finally {
            setPendingAction(null);
          }
        });
      },
      (geoError) => {
        setError(geoError.message || "Please enable browser geolocation.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  if (!isDesktop) {
    return (
      <section className="card p-6">
        <div>
          <h2 className="section-title">Attendance</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          Attendance actions are available only on desktop, laptop, or MacBook
          browsers.
        </div>
      </section>
    );
  }

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="section-title">Attendance</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={`btn ${canMarkIn ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"}`}
            disabled={!canMarkIn || pending}
            onClick={() => submit("MARK_IN")}
          >
            {pendingAction === "MARK_IN" ? "Processing..." : "Mark-In"}
          </button>
          <button
            type="button"
            className={`btn ${canMarkOut ? "bg-slate-900 text-white hover:bg-slate-800" : "border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"}`}
            disabled={!canMarkOut || pending}
            onClick={() => submit("MARK_OUT")}
          >
            {pendingAction === "MARK_OUT" ? "Processing..." : "Mark-Out"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            In-Time
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {markInAt || "Not marked"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Out-Time
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {markOutAt || "Not marked"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            City
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {city || "—"}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}
