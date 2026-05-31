"use server";

import { revalidatePath } from "next/cache";
import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendAppEmail } from "@/lib/mail/ses";
import {
  getAttendanceWorkDateKey,
  getDayBoundsUtcFromIstDateKey,
  getIstDateKey,
} from "@/lib/ist";
import {
  getActiveAttendanceReminderShift,
  type AttendanceReminderKind as ReminderKind,
  type AttendanceReminderShift as ReminderShift,
} from "@/lib/attendance-reminder-utils";

function assertCanSendAttendanceReminders(user: {
  userType: string;
  functionalRole?: string | null;
}) {
  if (user.userType !== "ADMIN" || user.functionalRole !== "OTHER") {
    throw new Error("You do not have permission to send attendance reminders.");
  }
}

async function getReminderRecipients(
  kind: ReminderKind,
  shift: ReminderShift,
  now = new Date(),
) {
  const year = Number(getIstDateKey(now).slice(0, 4));
  const workDateKey = getAttendanceWorkDateKey(now, shift);
  const bounds = getDayBoundsUtcFromIstDateKey(workDateKey);

  const eligibleUsers = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { userType: "EMPLOYEE" },
        { userType: "TEAM_LEAD" },
        {
          userType: "MANAGER",
          functionalRole: { notIn: ["PROJECT_MANAGER", "GENERAL_MANAGER"] },
        },
      ],
      leaveYearProfiles: { some: { year, shift } },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      attendanceLogs: {
        where: {
          attendanceDate: { gte: bounds.startUtc, lt: bounds.endUtc },
          type: kind,
        },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { fullName: "asc" },
  });

  return {
    workDateKey,
    recipients: eligibleUsers.filter(
      (user) => user.attendanceLogs.length === 0,
    ),
  };
}

function buildReminderEmail(
  kind: ReminderKind,
  shift: ReminderShift,
  workDateKey: string,
) {
  const action = kind === "MARK_IN" ? "Mark-In" : "Mark-Out";
  const subject = `${action} Reminder - ${workDateKey}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <p>Dear Team Member,</p>
      <p>This is a reminder to complete your <strong>${action}</strong> for <strong>${workDateKey}</strong>.</p>
      <p><strong>Shift:</strong> ${shift === "DAY" ? "Day Shift" : "Night Shift"}</p>
      <p>Please log in to the PMS application and complete the attendance action as soon as possible.</p>
      <p>Regards,<br />PMS Administration</p>
    </div>
  `;
  const text = `Dear Team Member,\n\nThis is a reminder to complete your ${action} for ${workDateKey}.\nShift: ${shift === "DAY" ? "Day Shift" : "Night Shift"}\n\nPlease log in to the PMS application and complete the attendance action as soon as possible.\n\nRegards,\nPMS Administration`;
  return { subject, html, text };
}

async function sendAttendanceReminder(kind: ReminderKind) {
  const user = await requireUserForAction();
  assertCanSendAttendanceReminders(user);

  const activeShift = getActiveAttendanceReminderShift(kind);
  if (!activeShift) {
    throw new Error(
      kind === "MARK_IN"
        ? "Mark-In reminders can be sent only during the configured Day or Night shift reminder window."
        : "Mark-Out reminders can be sent only during the configured Day or Night shift reminder window.",
    );
  }

  const { workDateKey, recipients } = await getReminderRecipients(
    kind,
    activeShift,
  );
  if (!recipients.length) {
    revalidatePath("/dashboard");
    return;
  }

  const email = buildReminderEmail(kind, activeShift, workDateKey);
  for (const recipient of recipients) {
    await sendAppEmail({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }
  revalidatePath("/dashboard");
}

export async function sendMarkInReminderAction() {
  await sendAttendanceReminder("MARK_IN");
}

export async function sendMarkOutReminderAction() {
  await sendAttendanceReminder("MARK_OUT");
}
