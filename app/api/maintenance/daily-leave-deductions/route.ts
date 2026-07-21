import { NextResponse } from "next/server";
import { getIstDateKey, isValidIstDateKey } from "@/lib/ist";
import { processDueLeaveAllocations } from "@/lib/leave-system";
import { ensureDueQuarterlyCasualLeaveCreditsForAllEligibleUsers } from "@/lib/quarterly-casual-leaves";

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
    throw new Error("The daily leave processor cannot run for a future date.");
  }
}

async function run(asOfDateKey: string) {
  validateAsOfDateKey(asOfDateKey);
  // This call is idempotent and deliberately runs every day so a missed
  // quarter-start execution is caught up before any due leave is deducted.
  const quarterlyCredit = await ensureDueQuarterlyCasualLeaveCreditsForAllEligibleUsers(
    asOfDateKey,
    null,
    "DAILY_CRON",
  );
  const deductions = await processDueLeaveAllocations(asOfDateKey);
  return { asOfDateKey, processingOrder: ["QUARTERLY_CREDIT", "DUE_LEAVE_DEDUCTION"], quarterlyCredit, deductions };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const asOfDateKey = new URL(request.url).searchParams.get("asOfDateKey") || getIstDateKey();
  try {
    return NextResponse.json({ ok: true, result: await run(asOfDateKey) });
  } catch (error) {
    console.error("Daily leave deduction failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Daily leave deduction failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({} as { asOfDateKey?: string }));
  const asOfDateKey = body.asOfDateKey || getIstDateKey();
  try {
    return NextResponse.json({ ok: true, result: await run(asOfDateKey) });
  } catch (error) {
    console.error("Daily leave deduction failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Daily leave deduction failed." }, { status: 500 });
  }
}
