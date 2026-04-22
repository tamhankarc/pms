"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { loginAction } from "@/lib/actions/auth-actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "ready" | "blocked" | "unsupported">("idle");
  const [geoError, setGeoError] = useState("");
  const [coords, setCoords] = useState<{ latitude: string; longitude: string }>({ latitude: "", longitude: "" });

  const geoMessage = useMemo(() => {
    if (geoState === "loading") return "Checking browser geolocation permission...";
    if (geoState === "ready") return "Geolocation enabled. You can sign in.";
    if (geoState === "blocked") return geoError || "Please allow browser geolocation to sign in.";
    if (geoState === "unsupported") return "This browser does not support geolocation.";
    return "Browser geolocation must be enabled before sign in.";
  }, [geoError, geoState]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoState("unsupported");
      return;
    }

    const run = async () => {
      setGeoState("loading");
      setGeoError("");
      try {
        if ("permissions" in navigator && navigator.permissions?.query) {
          const permission = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          if (permission.state === "denied") {
            setGeoState("blocked");
            setGeoError("Geolocation permission is blocked. Please enable it in your browser settings.");
            return;
          }
        }
      } catch {
        // ignore permission API issues and attempt direct location request
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            latitude: String(position.coords.latitude),
            longitude: String(position.coords.longitude),
          });
          setGeoState("ready");
        },
        (error) => {
          setGeoState("blocked");
          setGeoError(error.message || "Please enable browser geolocation.");
        },
        {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 0,
        },
      );
    };

    run();
  }, []);

  return (
    <form action={action} className="card w-full max-w-md p-8">
      <input type="hidden" name="latitude" value={coords.latitude} />
      <input type="hidden" name="longitude" value={coords.longitude} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">Internal EMS</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign in with your username or email and password. Browser geolocation must be enabled before you can access attendance.
        </p>
      </div>

      <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
        geoState === "ready"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}>
        {geoMessage}
      </div>

      <div className="mt-8 space-y-5">
        <div>
          <label className="label" htmlFor="usernameOrEmail">Username or Email</label>
          <input
            id="usernameOrEmail"
            name="usernameOrEmail"
            type="text"
            className="input"
            placeholder="username or you@company.com"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            placeholder="••••••••"
            required
          />
        </div>

        {state && typeof state === "object" && "error" in state ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error as string}</p>
        ) : null}

        <button className="btn-primary w-full" disabled={pending || geoState !== "ready"}>
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </form>
  );
}
