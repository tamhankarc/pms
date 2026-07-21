import { NextResponse } from "next/server";
import { getIstDateKey, isValidIstDateKey } from "@/lib/ist";
import { ensureQuarterlyCasualLeaveCreditsForAllEligibleUsers } from "@/lib/quarterly-casual-leaves";

function isAuthorized(request: Request) {
  const configuredSecret = process.env.MAINTENANCE_CRON_SECRET || process.env.CRON_SECRET;
  if (!configuredSecret) return process.env.NODE_ENV !== "production";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  const authorization = request.headers.get("authorization") || "";
  return headerSecret === configuredSecret || authorization === `Bearer ${configuredSecret}`;
}

function validateAsOfDateKey(asOfDateKey: string) {
  if (!isValidIstDateKey(asOfDateKey)) {
    throw new Error("Enter a valid IST processing date.");
  }
  if (asOfDateKey > getIstDateKey()) {
    throw new Error("Quarterly Casual Leave maintenance cannot run for a future date.");
  }
}

async function runCredit(asOfDateKey: string) {
  validateAsOfDateKey(asOfDateKey);
  const year = Number(asOfDateKey.slice(0, 4));
  return ensureQuarterlyCasualLeaveCreditsForAllEligibleUsers(
    year,
    asOfDateKey,
    null,
    "QUARTERLY_MAINTENANCE",
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const asOfDateKey = new URL(request.url).searchParams.get("asOfDateKey") || getIstDateKey();
  try {
    return NextResponse.json({ ok: true, result: await runCredit(asOfDateKey) });
  } catch (error) {
    console.error("Quarterly Casual Leave maintenance failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Quarterly Casual Leave maintenance failed.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as { asOfDateKey?: string }));
  const asOfDateKey = body.asOfDateKey || getIstDateKey();
  try {
    return NextResponse.json({ ok: true, result: await runCredit(asOfDateKey) });
  } catch (error) {
    console.error("Quarterly Casual Leave maintenance failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Quarterly Casual Leave maintenance failed.",
      },
      { status: 500 },
    );
  }
}
