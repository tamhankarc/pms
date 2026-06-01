#!/usr/bin/env node
/*
  PMS Mark-Out + Time Entries reminder cron script.

  Usage:
    node scripts/send-markout-time-entry-reminders.js --shift=DAY
    node scripts/send-markout-time-entry-reminders.js --shift=NIGHT
    node scripts/send-markout-time-entry-reminders.js --shift=DAY --dry-run

  Cron on UTC server:
    # Day shift reminder at 6:15 PM IST = 12:45 UTC
    45 12 * * * cd /path/to/pms && /usr/bin/node scripts/send-markout-time-entry-reminders.js --shift=DAY >> logs/attendance-markout-time-entry-reminders.log 2>&1

    # Night shift reminder at 6:45 AM IST = 01:15 UTC
    15 1 * * * cd /path/to/pms && /usr/bin/node scripts/send-markout-time-entry-reminders.js --shift=NIGHT >> logs/attendance-markout-time-entry-reminders.log 2>&1
*/

const { PrismaClient } = require("@prisma/client");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const IST_OFFSET_MINUTES = 330;
const VALID_SHIFTS = new Set(["DAY", "NIGHT"]);
const ATTENDANCE_USER_TYPES = ["EMPLOYEE", "TEAM_LEAD", "MANAGER"];
const EXCLUDED_MANAGER_ROLES = new Set(["PROJECT_MANAGER", "GENERAL_MANAGER"]);

const db = new PrismaClient();

function getArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function parseBooleanEnv(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function formatDateParts(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toIstDate(date) {
  return new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
}

function getIstDateKey(date = new Date()) {
  const ist = toIstDate(date);
  return formatDateParts(ist.getUTCFullYear(), ist.getUTCMonth() + 1, ist.getUTCDate());
}

function getIstTimeParts(date = new Date()) {
  const ist = toIstDate(date);
  return { hours: ist.getUTCHours(), minutes: ist.getUTCMinutes() };
}

function getDayBoundsUtcFromIstDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const startUtc = new Date(Date.UTC(year, month - 1, day, 0, -IST_OFFSET_MINUTES, 0, 0));
  const endUtc = new Date(Date.UTC(year, month - 1, day + 1, 0, -IST_OFFSET_MINUTES, 0, 0));
  return { startUtc, endUtc };
}

function getWeekday(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function isWeekendDateKey(dateKey) {
  const day = getWeekday(dateKey);
  return day === 0 || day === 6;
}

function getAttendanceWorkDateKey(date = new Date(), shift = "DAY") {
  const ist = toIstDate(date);
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();

  if (shift === "NIGHT") {
    const total = hours * 60 + minutes;
    if (total < 21 * 60) {
      const prev = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - 1, 12, 0, 0));
      return formatDateParts(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate());
    }
  }

  return formatDateParts(ist.getUTCFullYear(), ist.getUTCMonth() + 1, ist.getUTCDate());
}

function isExpectedReminderTime(now, shift) {
  const { hours, minutes } = getIstTimeParts(now);
  const total = hours * 60 + minutes;

  if (shift === "DAY") {
    // Intended cron: 6:15 PM IST. Allow 6:00 PM to 6:30 PM for retry tolerance.
    return total >= 18 * 60 && total <= 18 * 60 + 30;
  }

  // Intended cron: 6:45 AM IST. Allow 6:30 AM to 7:00 AM for retry tolerance.
  return total >= 6 * 60 + 30 && total <= 7 * 60;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildSourceEmail() {
  const email = process.env.ATTENDANCE_REMINDER_FROM_EMAIL?.trim() || process.env.SES_FROM_EMAIL?.trim();
  const name = process.env.ATTENDANCE_REMINDER_FROM_NAME?.trim() || process.env.SES_FROM_NAME?.trim() || "PMS Attendance Reminder";
  if (!email) throw new Error("ATTENDANCE_REMINDER_FROM_EMAIL or SES_FROM_EMAIL is required.");
  return `${name} <${email}>`;
}

async function sendReminderEmail({ user, shift, workDateKey, dryRun }) {
  const subject = `Mark-Out and Time Entries Reminder - ${shift === "DAY" ? "Day" : "Night"} Shift`;
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const dashboardUrl = appUrl ? `${appUrl}/dashboard` : "";
  const timeEntriesUrl = appUrl ? `${appUrl}/time-entries/new` : "";
  const displayName = user.fullName || user.username || user.email;
  const shiftLabel = shift === "DAY" ? "Day Shift" : "Night Shift";

  const text = [
    `Hello ${displayName},`,
    "",
    `This is a reminder for ${shiftLabel} for attendance date ${workDateKey}.`,
    "Once your work is finished, please do not forget to mark-out and add time entries for all work completed today.",
    dashboardUrl ? `Dashboard: ${dashboardUrl}` : "Please open PMS Dashboard to mark-out.",
    timeEntriesUrl ? `Add Time Entry: ${timeEntriesUrl}` : "Please open PMS to add your time entries.",
    "",
    "Regards,",
    "PMS Attendance Reminder",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #111827;">
      <p>Hello ${htmlEscape(displayName)},</p>
      <p>This is a reminder for <strong>${htmlEscape(shiftLabel)}</strong> for attendance date <strong>${htmlEscape(workDateKey)}</strong>.</p>
      <p>Once your work is finished, please do not forget to <strong>mark-out</strong> and add <strong>time entries for all work completed today</strong>.</p>
      <ul>
        ${dashboardUrl ? `<li><a href="${htmlEscape(dashboardUrl)}">Open PMS Dashboard</a></li>` : ""}
        ${timeEntriesUrl ? `<li><a href="${htmlEscape(timeEntriesUrl)}">Add Time Entry</a></li>` : ""}
      </ul>
      <p>Regards,<br />PMS Attendance Reminder</p>
    </div>`;

  if (dryRun) {
    console.log(`[DRY RUN] Would send to ${user.email}: ${subject}`);
    return { skipped: true, dryRun: true };
  }

  if (!parseBooleanEnv(process.env.SEND_MAILS_ENABLED)) {
    console.log(`[SKIPPED] SEND_MAILS_ENABLED is not true. Would send to ${user.email}`);
    return { skipped: true, disabled: true };
  }

  const region = process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim();
  if (!region) throw new Error("AWS_REGION or AWS_DEFAULT_REGION is required.");

  const ses = new SESClient({ region });
  const command = new SendEmailCommand({
    Source: buildSourceEmail(),
    Destination: { ToAddresses: [user.email] },
    Message: {
      Subject: { Charset: "UTF-8", Data: subject },
      Body: {
        Text: { Charset: "UTF-8", Data: text },
        Html: { Charset: "UTF-8", Data: html },
      },
    },
  });

  const response = await ses.send(command);
  console.log(`Sent to ${user.email}. MessageId: ${response.MessageId || "n/a"}`);
  return { skipped: false, messageId: response.MessageId || null };
}

async function getUsersForReminder({ shift, year, workDateKey, startUtc, endUtc }) {
  const users = await db.user.findMany({
    where: {
      isActive: true,
      email: { not: "" },
      userType: { in: ATTENDANCE_USER_TYPES },
      OR: [
        { userType: { not: "MANAGER" } },
        { functionalRole: null },
        { functionalRole: { notIn: [...EXCLUDED_MANAGER_ROLES] } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      userType: true,
      functionalRole: true,
      leaveYearProfiles: { where: { year }, take: 1, select: { shift: true } },
    },
    orderBy: [{ fullName: "asc" }, { email: "asc" }],
  });

  const shiftedUsers = users.filter((user) => (user.leaveYearProfiles[0]?.shift || "DAY") === shift);
  if (!shiftedUsers.length) return [];

  const shiftedUserIds = shiftedUsers.map((user) => user.id);
  const approvedLeaveRows = await db.leaveRequest.findMany({
    where: {
      userId: { in: shiftedUserIds },
      status: "APPROVED",
      startDate: { lt: endUtc },
      endDate: { gte: startUtc },
    },
    select: { userId: true },
  });
  const approvedLeaveUserIds = new Set(approvedLeaveRows.map((row) => row.userId));

  return shiftedUsers.filter((user) => !approvedLeaveUserIds.has(user.id));
}

async function main() {
  const shift = String(getArg("shift") || "").trim().toUpperCase();
  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const now = new Date();

  if (!VALID_SHIFTS.has(shift)) {
    throw new Error("Usage: node scripts/send-markout-time-entry-reminders.js --shift=DAY|NIGHT [--dry-run] [--force]");
  }

  if (!force && !isExpectedReminderTime(now, shift)) {
    const { hours, minutes } = getIstTimeParts(now);
    console.log(`Skipped: current IST time ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} is outside the ${shift} mark-out/time-entry reminder window. Use --force to override.`);
    return;
  }

  const workDateKey = getAttendanceWorkDateKey(now, shift);
  const year = Number(workDateKey.slice(0, 4));
  const { startUtc, endUtc } = getDayBoundsUtcFromIstDateKey(workDateKey);

  if (isWeekendDateKey(workDateKey)) {
    console.log(`Skipped: ${workDateKey} is a weekend.`);
    return;
  }

  const holiday = await db.officialHoliday.findFirst({
    where: {
      year,
      holidayDate: { gte: startUtc, lt: endUtc },
      shift: { in: shift === "DAY" ? ["DAY", "BOTH"] : ["NIGHT", "BOTH"] },
    },
    select: { name: true, shift: true },
  });

  if (holiday) {
    console.log(`Skipped: ${workDateKey} is an official holiday for ${shift} shift (${holiday.name}).`);
    return;
  }

  console.log(`Running ${shift} Mark-Out/Time Entry reminder for attendance date ${workDateKey}. Dry run: ${dryRun ? "yes" : "no"}`);

  const recipients = await getUsersForReminder({ shift, year, workDateKey, startUtc, endUtc });

  if (!recipients.length) {
    console.log("No users require Mark-Out/Time Entry reminder.");
    return;
  }

  console.log(`Users requiring reminder: ${recipients.length}`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of recipients) {
    try {
      const result = await sendReminderEmail({ user, shift, workDateKey, dryRun });
      if (result.skipped) skipped += 1;
      else sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed for ${user.email}:`, error);
    }
  }

  console.log(`Completed. Sent: ${sent}, skipped: ${skipped}, failed: ${failed}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
