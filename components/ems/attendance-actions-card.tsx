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

type GoogleGeolocationComparison = {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  capturedAt?: string;
  error?: string;
  city?: string;
  district?: string;
  town?: string;
  village?: string;
  state?: string;
  formattedAddress?: string;
};

const googleGeolocationApiKey =
  process.env.NEXT_PUBLIC_GOOGLE_GEOLOCATION_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  "";

function getAddressComponent(
  components: Array<{ long_name?: string; types?: string[] }> | undefined,
  types: string[],
) {
  if (!components?.length) return undefined;
  const match = components.find((component) =>
    types.every((type) => component.types?.includes(type)),
  );
  return match?.long_name || undefined;
}

async function getGoogleAddressDetails(
  latitude: number,
  longitude: number,
): Promise<
  Pick<
    GoogleGeolocationComparison,
    | "city"
    | "district"
    | "town"
    | "village"
    | "state"
    | "formattedAddress"
    | "error"
  >
> {
  if (!googleGeolocationApiKey) return {};

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${latitude},${longitude}`)}&key=${encodeURIComponent(googleGeolocationApiKey)}`,
    );
    const payload = (await response.json().catch(() => null)) as {
      status?: string;
      error_message?: string;
      results?: Array<{
        formatted_address?: string;
        address_components?: Array<{ long_name?: string; types?: string[] }>;
      }>;
    } | null;

    if (
      !response.ok ||
      payload?.status === "REQUEST_DENIED" ||
      payload?.status === "OVER_QUERY_LIMIT"
    ) {
      return {
        error:
          payload?.error_message ||
          payload?.status ||
          `Google Geocoding failed with status ${response.status}.`,
      };
    }

    const firstResult = payload?.results?.[0];
    const components = firstResult?.address_components;
    if (!components?.length) return {};

    const city =
      getAddressComponent(components, ["locality"]) ||
      getAddressComponent(components, ["administrative_area_level_2"]);
    const district =
      getAddressComponent(components, ["administrative_area_level_3"]) ||
      getAddressComponent(components, ["administrative_area_level_2"]);
    const town =
      getAddressComponent(components, ["postal_town"]) ||
      getAddressComponent(components, ["sublocality_level_1"]) ||
      getAddressComponent(components, ["sublocality"]);
    const village =
      getAddressComponent(components, ["neighborhood"]) ||
      getAddressComponent(components, ["sublocality_level_2"]);
    const state = getAddressComponent(components, [
      "administrative_area_level_1",
    ]);

    return {
      city,
      district,
      town,
      village,
      state,
      formattedAddress: firstResult?.formatted_address,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Google Geocoding request failed.",
    };
  }
}

async function getGoogleGeolocationComparison(): Promise<GoogleGeolocationComparison> {
  if (!googleGeolocationApiKey) return {};

  try {
    const response = await fetch(
      `https://www.googleapis.com/geolocation/v1/geolocate?key=${encodeURIComponent(googleGeolocationApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ considerIp: true }),
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      location?: { lat?: number; lng?: number };
      accuracy?: number;
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      return {
        capturedAt: new Date().toISOString(),
        error:
          payload?.error?.message ||
          `Google Geolocation failed with status ${response.status}.`,
      };
    }

    const latitude = payload?.location?.lat;
    const longitude = payload?.location?.lng;
    if (
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      typeof longitude !== "number" ||
      !Number.isFinite(longitude)
    ) {
      return {
        capturedAt: new Date().toISOString(),
        error: "Google Geolocation did not return coordinates.",
      };
    }

    const addressDetails = await getGoogleAddressDetails(latitude, longitude);
    return {
      latitude,
      longitude,
      accuracy:
        typeof payload?.accuracy === "number" &&
        Number.isFinite(payload.accuracy)
          ? payload.accuracy
          : undefined,
      capturedAt: new Date().toISOString(),
      city: addressDetails.city,
      district: addressDetails.district,
      town: addressDetails.town,
      village: addressDetails.village,
      state: addressDetails.state,
      formattedAddress: addressDetails.formattedAddress,
      error: addressDetails.error,
    };
  } catch (error) {
    return {
      capturedAt: new Date().toISOString(),
      error:
        error instanceof Error
          ? error.message
          : "Google Geolocation request failed.",
    };
  }
}

function isDesktopLikeDevice() {
  if (typeof window === "undefined") return true;
  const ua = navigator.userAgent || "";
  const mobileOrTablet =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const smallTouch = window.innerWidth < 1024 && navigator.maxTouchPoints > 0;
  return !(mobileOrTablet || smallTouch);
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
            const googleLocation = await getGoogleGeolocationComparison();
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
            if (googleLocation.latitude !== undefined) {
              formData.set("googleLatitude", String(googleLocation.latitude));
            }
            if (googleLocation.longitude !== undefined) {
              formData.set("googleLongitude", String(googleLocation.longitude));
            }
            if (googleLocation.accuracy !== undefined) {
              formData.set("googleAccuracy", String(googleLocation.accuracy));
            }
            if (googleLocation.capturedAt) {
              formData.set("googleCapturedAt", googleLocation.capturedAt);
            }
            if (googleLocation.error) {
              formData.set("googleError", googleLocation.error);
            }
            if (googleLocation.city) {
              formData.set("googleCity", googleLocation.city);
            }
            if (googleLocation.district) {
              formData.set("googleDistrict", googleLocation.district);
            }
            if (googleLocation.town) {
              formData.set("googleTown", googleLocation.town);
            }
            if (googleLocation.village) {
              formData.set("googleVillage", googleLocation.village);
            }
            if (googleLocation.state) {
              formData.set("googleState", googleLocation.state);
            }
            if (googleLocation.formattedAddress) {
              formData.set(
                "googleFormattedAddress",
                googleLocation.formattedAddress,
              );
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
