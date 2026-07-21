import { NextResponse } from "next/server";
import {
  applyPreSystemQuarterlyCreditIncidentFix,
  previewPreSystemQuarterlyCreditIncidentFix,
} from "@/lib/leave-credit-incident-fix";

const CONFIRMATION = "REVERT_2026_Q1_Q2";

function isAuthorized(request: Request) {
  const configuredSecret =
    process.env.MAINTENANCE_CRON_SECRET || process.env.CRON_SECRET;
  if (!configuredSecret) return process.env.NODE_ENV !== "production";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  const authorization = request.headers.get("authorization") || "";
  return (
    headerSecret === configuredSecret ||
    authorization === `Bearer ${configuredSecret}`
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({
      ok: true,
      mode: "PREVIEW",
      result: await previewPreSystemQuarterlyCreditIncidentFix(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to preview the incident correction.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({} as { confirm?: string }));
  if (body.confirm !== CONFIRMATION) {
    return NextResponse.json(
      { error: `Confirmation must be ${CONFIRMATION}.` },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({
      ok: true,
      mode: "APPLY",
      result: await applyPreSystemQuarterlyCreditIncidentFix(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to apply the incident correction.",
      },
      { status: 500 },
    );
  }
}
