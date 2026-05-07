"use server";

import { z } from "zod";
import { requireUserTypesForAction } from "@/lib/auth";
import { isMailSendingEnabled, sendAppEmail } from "@/lib/mail/ses";

export type TestMailState = {
  success?: boolean;
  message?: string;
};

const testMailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export async function sendTestMailAction(
  _prevState: TestMailState,
  formData: FormData,
): Promise<TestMailState> {
  try {
    const user = await requireUserTypesForAction(["ADMIN"]);
    const parsed = testMailSchema.safeParse({ email: formData.get("email") });

    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid email address.",
      };
    }

    const now = new Date();
    const result = await sendAppEmail({
      to: parsed.data.email,
      subject: "PMS test email",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
          <h2 style="margin: 0 0 12px;">PMS test email</h2>
          <p>This is a test email from the PMS application.</p>
          <p><strong>Triggered by:</strong> ${escapeHtml(user.fullName || user.email)}</p>
          <p><strong>Triggered at:</strong> ${escapeHtml(now.toISOString())}</p>
        </div>
      `,
      text: `PMS test email\n\nThis is a test email from the PMS application.\nTriggered by: ${user.fullName || user.email}\nTriggered at: ${now.toISOString()}`,
    });

    if (result.skipped) {
      return {
        success: false,
        message: result.message,
      };
    }

    return {
      success: true,
      message: result.messageId
        ? `Test email sent successfully. SES Message ID: ${result.messageId}`
        : "Test email sent successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to send test email.",
    };
  }
}

export async function getMailSendingStatusForDashboard() {
  await requireUserTypesForAction(["ADMIN"]);
  return isMailSendingEnabled();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
