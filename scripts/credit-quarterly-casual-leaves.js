#!/usr/bin/env node
/*
  Credits quarterly casual leaves for all eligible users.

  This script adds exactly 2 casual leaves for the selected quarter and writes
  a LeaveQuarterlyCasualCredit log row. Re-running it for the same user/year/
  quarter will not add leaves again.

  Usage:
    node scripts/credit-quarterly-casual-leaves.js 2026-07-02

  Cron examples on UTC server for 12:00 AM IST quarter starts:
    30 18 31 3 * cd /path/to/pms && node scripts/credit-quarterly-casual-leaves.js >> logs/quarterly-casual-leaves.log 2>&1
    30 18 30 6 * cd /path/to/pms && node scripts/credit-quarterly-casual-leaves.js >> logs/quarterly-casual-leaves.log 2>&1
    30 18 30 9 * cd /path/to/pms && node scripts/credit-quarterly-casual-leaves.js >> logs/quarterly-casual-leaves.log 2>&1
    30 18 31 12 * cd /path/to/pms && node scripts/credit-quarterly-casual-leaves.js >> logs/quarterly-casual-leaves.log 2>&1
*/

const { PrismaClient, Prisma } = require("@prisma/client");

const db = new PrismaClient();
const IST_OFFSET_MINUTES = 330;
const QUARTERLY_CASUAL_CREDIT = 2;

function formatDateParts(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getIstDateKey(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  return formatDateParts(ist.getUTCFullYear(), ist.getUTCMonth() + 1, ist.getUTCDate());
}

function quarterCountForDateKey(dateKey) {
  const month = Number(dateKey.slice(5, 7));
  return month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
}

function isEligibleForPaidLeaves(user) {
  if (!user.isActive) return false;
  if (["OPERATIONS", "REPORT_VIEWER", "ACCOUNTS"].includes(user.userType)) return false;
  if (user.userType === "ADMIN" && user.functionalRole !== "PROJECT_MANAGER") return false;
  return true;
}

async function getOrCreateLeaveYearProfile(user, year) {
  const existing = await db.leaveYearProfile.findUnique({
    where: { userId_year: { userId: user.id, year } },
  });
  if (existing) return existing;

  const previous = await db.leaveYearProfile.findUnique({
    where: { userId_year: { userId: user.id, year: year - 1 } },
  });
  const employmentStatus = previous?.employmentStatus ?? "PROBATION";
  const unpaidOnly = employmentStatus === "PROBATION" || employmentStatus === "CONSULTANT";
  const carryForwardEarned = Math.min(Number(previous?.earnedLeaves ?? 0), 45);
  return db.leaveYearProfile.create({
    data: {
      userId: user.id,
      year,
      casualLeaves: new Prisma.Decimal(0),
      earnedLeaves: new Prisma.Decimal(unpaidOnly ? 0 : (carryForwardEarned + 12.96).toFixed(2)),
      shift: previous?.shift ?? "DAY",
      employmentStatus,
    },
  });
}

async function main() {
  const asOfDateKey = process.argv[2] || getIstDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDateKey)) {
    throw new Error("Usage: node scripts/credit-quarterly-casual-leaves.js YYYY-MM-DD");
  }

  const year = Number(asOfDateKey.slice(0, 4));
  const quarter = quarterCountForDateKey(asOfDateKey);
  const users = await db.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, userType: true, functionalRole: true, isActive: true },
    orderBy: { fullName: "asc" },
  });

  const result = { year, quarter, asOfDateKey, eligibleUsers: 0, creditedUsers: 0, totalCredited: 0, rows: [] };

  for (const user of users) {
    if (!isEligibleForPaidLeaves(user)) continue;
    result.eligibleUsers += 1;
    const profile = await getOrCreateLeaveYearProfile(user, year);
    if (profile.employmentStatus === "PROBATION" || profile.employmentStatus === "CONSULTANT") {
      result.rows.push({ userId: user.id, fullName: user.fullName, credited: 0, reason: "UNPAID_ONLY" });
      continue;
    }

    const existingCredit = await db.leaveQuarterlyCasualCredit.findUnique({
      where: { userId_year_quarter: { userId: user.id, year, quarter } },
    });
    if (existingCredit) {
      result.rows.push({ userId: user.id, fullName: user.fullName, credited: 0, reason: "ALREADY_CREDITED" });
      continue;
    }

    try {
      await db.$transaction(async (tx) => {
        await tx.leaveYearProfile.update({
          where: { id: profile.id },
          data: { casualLeaves: { increment: new Prisma.Decimal(QUARTERLY_CASUAL_CREDIT.toFixed(2)) } },
        });
        await tx.leaveQuarterlyCasualCredit.create({
          data: {
            userId: user.id,
            year,
            quarter,
            credited: new Prisma.Decimal(QUARTERLY_CASUAL_CREDIT.toFixed(2)),
            runDateKey: asOfDateKey,
            source: "SCRIPT",
          },
        });
      });
      result.creditedUsers += 1;
      result.totalCredited += QUARTERLY_CASUAL_CREDIT;
      result.rows.push({ userId: user.id, fullName: user.fullName, credited: QUARTERLY_CASUAL_CREDIT, reason: "CREDITED" });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        result.rows.push({ userId: user.id, fullName: user.fullName, credited: 0, reason: "ALREADY_CREDITED" });
        continue;
      }
      throw error;
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
