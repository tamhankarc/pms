import "server-only";

import { db } from "@/lib/db";
import { formatDateInIst } from "@/lib/ist";
import { isMailSendingEnabled, sendAppEmail } from "@/lib/mail/ses";

const LEAVE_REQUEST_FROM_EMAIL = "leave-request@billing.sycamoresol.com";
const LEAVE_STATUS_FROM_EMAIL = "leave-request-status@billing.sycamoresol.com";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function uniqueEmails(
  values: Array<string | null | undefined>,
  except?: string | string[],
) {
  const excluded = new Set(
    (Array.isArray(except) ? except : except ? [except] : [])
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
        .filter((value) => !excluded.has(value.toLowerCase())),
    ),
  );
}

function appBaseUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(
    /\/$/,
    "",
  );
}

function approvalRequestLink(id: string) {
  const baseUrl = appBaseUrl();
  return baseUrl
    ? `${baseUrl}/leave-approvals?requestId=${encodeURIComponent(id)}`
    : `/leave-approvals?requestId=${encodeURIComponent(id)}`;
}

function employeeRequestLink(id: string) {
  const baseUrl = appBaseUrl();
  return baseUrl
    ? `${baseUrl}/leave-requests#leave-request-${encodeURIComponent(id)}`
    : `/leave-requests#leave-request-${encodeURIComponent(id)}`;
}

function formatDaySelections(json: string | null) {
  if (!json) return "Full day";
  try {
    const parsed = JSON.parse(json) as Record<string, string>;
    return Object.entries(parsed)
      .map(
        ([date, type]) =>
          `${date}: ${type === "HALF_DAY" ? "Half day" : "Full day"}`,
      )
      .join("\n");
  } catch {
    return "Full day";
  }
}

async function getNotificationDetails(requestId: string) {
  return db.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { fullName: true, email: true } },
      approver: { select: { fullName: true, email: true } },
      selectedApprovers: {
        include: { approver: { select: { fullName: true, email: true } } },
        orderBy: { approver: { fullName: "asc" } },
      },
    },
  });
}

async function getRequestCcAddresses(
  userEmail: string,
  approverEmails?: string[],
) {
  const rows = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { userType: "HR" },
        { userType: "ADMIN", functionalRole: "PROJECT_MANAGER" },
      ],
    },
    select: { email: true },
  });
  return uniqueEmails(
    [userEmail, ...rows.map((row) => row.email)],
    approverEmails ?? undefined,
  );
}

async function getStatusCcAddresses(
  userEmail: string,
  approverEmails: string[],
) {
  const rows = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { userType: "HR" },
        { userType: "ADMIN", functionalRole: "PROJECT_MANAGER" },
      ],
    },
    select: { email: true },
  });
  return uniqueEmails(
    [...approverEmails, ...rows.map((row) => row.email)],
    userEmail,
  );
}

export async function sendLeaveRequestSubmittedEmail(
  requestId: string,
  requestKind: "new" | "updated",
) {
  if (!isMailSendingEnabled()) return;
  const row = await getNotificationDetails(requestId);
  if (!row) return;
  const approverEmails = uniqueEmails(
    row.selectedApprovers.map((item) => item.approver.email),
  );
  if (!approverEmails.length) return;
  const approverNames = row.selectedApprovers
    .map((item) => item.approver.fullName)
    .filter(Boolean)
    .join(", ");
  const subject = `${requestKind === "new" ? "New" : "Updated"} Leave Request by ${row.user.fullName}`;
  const details = formatDaySelections(row.leaveDayTypesJson);
  const link = approvalRequestLink(row.id);
  const cc = await getRequestCcAddresses(row.user.email, approverEmails);
  const reason = row.reason || "—";
  await sendAppEmail({
    fromEmail: LEAVE_REQUEST_FROM_EMAIL,
    fromName: "Leave Request",
    to: approverEmails,
    cc,
    subject,
    html: `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.55"><p>Dear Approver,</p><p>${escapeHtml(row.user.fullName)} has ${requestKind === "new" ? "submitted a new" : "updated and resubmitted a"} leave request for your review.</p><table style="border-collapse:collapse;margin:16px 0"><tr><td style="padding:6px 18px 6px 0;font-weight:600">Employee</td><td>${escapeHtml(row.user.fullName)}</td></tr><tr><td style="padding:6px 18px 6px 0;font-weight:600">Selected approvers</td><td>${escapeHtml(approverNames || "—")}</td></tr><tr><td style="padding:6px 18px 6px 0;font-weight:600">Date range</td><td>${escapeHtml(formatDateInIst(row.startDate))} - ${escapeHtml(formatDateInIst(row.endDate))}</td></tr><tr><td style="padding:6px 18px 6px 0;font-weight:600">Total leave days</td><td>${Number(row.totalLeaveDays ?? 0).toFixed(2)}</td></tr><tr><td style="padding:6px 18px 6px 0;font-weight:600">Duration breakup</td><td><pre style="font-family:Arial,sans-serif;margin:0;white-space:pre-wrap">${escapeHtml(details)}</pre></td></tr><tr><td style="padding:6px 18px 6px 0;font-weight:600">Reason</td><td><pre style="font-family:Arial,sans-serif;margin:0;white-space:pre-wrap">${escapeHtml(reason)}</pre></td></tr></table><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">Review leave request</a></p><p>Regards,<br/>PMS Leave Management</p></div>`,
    text: `Dear Approver,\n\n${row.user.fullName} has ${requestKind === "new" ? "submitted a new" : "updated and resubmitted a"} leave request for your review.\n\nEmployee: ${row.user.fullName}\nDate range: ${formatDateInIst(row.startDate)} - ${formatDateInIst(row.endDate)}\nTotal leave days: ${Number(row.totalLeaveDays ?? 0).toFixed(2)}\nDuration breakup:\n${details}\nReason: ${reason}\n\nReview leave request: ${link}\n\nRegards,\nPMS Leave Management`,
  });
}

export async function sendLeaveRequestStatusEmail(
  requestId: string,
  decision: "APPROVED" | "REJECTED" | "RECONSIDER",
  actionedBy: string,
) {
  if (!isMailSendingEnabled()) return;
  const row = await getNotificationDetails(requestId);
  if (!row?.user.email) return;
  const statusLabel =
    decision === "RECONSIDER"
      ? "Reconsideration Requested"
      : decision.charAt(0) + decision.slice(1).toLowerCase();
  const link = employeeRequestLink(row.id);
  const selectedApproverEmails = uniqueEmails(
    row.selectedApprovers.map((item) => item.approver.email),
  );
  const cc = await getStatusCcAddresses(row.user.email, selectedApproverEmails);
  await sendAppEmail({
    fromEmail: LEAVE_STATUS_FROM_EMAIL,
    fromName: "Leave Request Status",
    to: row.user.email,
    cc,
    subject: `Leave Request ${statusLabel} - ${row.user.fullName}`,
    html: `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.55"><p>Dear ${escapeHtml(row.user.fullName)},</p><p>Your leave request for <strong>${escapeHtml(formatDateInIst(row.startDate))} - ${escapeHtml(formatDateInIst(row.endDate))}</strong> has been marked as <strong>${escapeHtml(statusLabel)}</strong> by ${escapeHtml(actionedBy)}.</p>${row.approverComment ? `<p><strong>Comment:</strong> ${escapeHtml(row.approverComment)}</p>` : ""}<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">View leave request</a></p><p>Regards,<br/>PMS Leave Management</p></div>`,
    text: `Dear ${row.user.fullName},\n\nYour leave request for ${formatDateInIst(row.startDate)} - ${formatDateInIst(row.endDate)} has been marked as ${statusLabel} by ${actionedBy}.${row.approverComment ? `\nComment: ${row.approverComment}` : ""}\n\nView leave request: ${link}\n\nRegards,\nPMS Leave Management`,
  });
}
