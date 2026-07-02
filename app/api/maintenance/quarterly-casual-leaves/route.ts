import { NextResponse } from "next/server";
import { getIstDateKey } from "@/lib/ist";
import { ensureQuarterlyCasualLeaveCreditsForAllEligibleUsers } from "@/lib/quarterly-casual-leaves";

function isAuthorized(request: Request) {
  const configuredSecret = process.env.MAINTENANCE_CRON_SECRET || process.env.CRON_SECRET;
  if (!configuredSecret) return true;
  const headerSecret = request.headers.get("x-cron-secret") || "";
  const authorization = request.headers.get("authorization") || "";
  return (
    headerSecret === configuredSecret ||
    authorization === `Bearer ${configuredSecret}`
  );
}

async function runCredit(asOfDateKey: string) {
  const year = Number(asOfDateKey.slice(0, 4));
  return ensureQuarterlyCasualLeaveCreditsForAllEligibleUsers(year, asOfDateKey, null, "API");
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const asOfDateKey = url.searchParams.get("asOfDateKey") || getIstDateKey();
  const result = await runCredit(asOfDateKey);
  return NextResponse.json({ ok: true, result });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as { asOfDateKey?: string }));
  const asOfDateKey = body.asOfDateKey || getIstDateKey();
  const result = await runCredit(asOfDateKey);
  return NextResponse.json({ ok: true, result });
}
