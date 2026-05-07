import "server-only";

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

function parseBooleanEnv(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function normalizeEmails(value?: string | string[]) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : value.split(",");
  return values.map((item) => item.trim()).filter(Boolean);
}

function getSourceEmail() {
  const fromEmail = process.env.SES_FROM_EMAIL?.trim();
  const fromName = process.env.SES_FROM_NAME?.trim() || "PMS System";

  if (!fromEmail) {
    throw new Error("SES_FROM_EMAIL is not configured.");
  }

  return `${fromName} <${fromEmail}>`;
}

export function isMailSendingEnabled() {
  return parseBooleanEnv(process.env.SEND_MAILS_ENABLED);
}

export type SendAppEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
};

export async function sendAppEmail(input: SendAppEmailInput) {
  if (!isMailSendingEnabled()) {
    return {
      skipped: true,
      message: "Email sending is disabled. Set SEND_MAILS_ENABLED=true to send mails.",
    };
  }

  const toAddresses = normalizeEmails(input.to);

  if (!toAddresses.length) {
    throw new Error("Email recipient is required.");
  }

  if (!input.subject.trim()) {
    throw new Error("Email subject is required.");
  }

  if (!input.html && !input.text) {
    throw new Error("Either HTML or text email body is required.");
  }

  const region = process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim();
  if (!region) {
    throw new Error("AWS_REGION is not configured.");
  }

  const sesClient = new SESClient({
    region,
    // Do not pass credentials here. The AWS SDK will use the default credential provider chain.
    // On production this can come from the server role, task role, instance profile, or env provided by DevOps.
  });

  const command = new SendEmailCommand({
    Source: getSourceEmail(),
    Destination: {
      ToAddresses: toAddresses,
      CcAddresses: normalizeEmails(input.cc),
      BccAddresses: normalizeEmails(input.bcc),
    },
    ReplyToAddresses: normalizeEmails(input.replyTo),
    Message: {
      Subject: {
        Charset: "UTF-8",
        Data: input.subject,
      },
      Body: {
        ...(input.text
          ? {
              Text: {
                Charset: "UTF-8",
                Data: input.text,
              },
            }
          : {}),
        ...(input.html
          ? {
              Html: {
                Charset: "UTF-8",
                Data: input.html,
              },
            }
          : {}),
      },
    },
  });

  const response = await sesClient.send(command);
  return {
    skipped: false,
    messageId: response.MessageId ?? null,
  };
}
