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

export type SesFromEmailOption = "primary" | "secondary";

export type SesFromEmailDetails = {
  key: SesFromEmailOption;
  label: string;
  email: string;
  source: string;
};

function buildSourceEmail(fromEmail: string, fromName?: string) {
  const email = fromEmail.trim();
  const name = fromName?.trim() || "PMS System";

  if (!email) {
    throw new Error("SES From email is not configured.");
  }

  return `${name} <${email}>`;
}

export function getSesFromEmailOptions(): SesFromEmailDetails[] {
  const fromName = process.env.SES_FROM_NAME?.trim() || "PMS System";
  const primaryEmail = process.env.SES_FROM_EMAIL?.trim();
  const secondaryEmail = process.env.SES_FROM_EMAIL_2?.trim();
  const options: SesFromEmailDetails[] = [];

  if (primaryEmail) {
    options.push({
      key: "primary",
      label: "From email 1",
      email: primaryEmail,
      source: buildSourceEmail(primaryEmail, fromName),
    });
  }

  if (secondaryEmail) {
    options.push({
      key: "secondary",
      label: "From email 2",
      email: secondaryEmail,
      source: buildSourceEmail(secondaryEmail, fromName),
    });
  }

  return options;
}

function getSourceEmail(fromEmailOption: SesFromEmailOption = "primary") {
  const options = getSesFromEmailOptions();
  const selected = options.find((option) => option.key === fromEmailOption) ?? options[0];

  if (!selected) {
    throw new Error("SES_FROM_EMAIL is not configured.");
  }

  return selected.source;
}

export function isMailSendingEnabled() {
  return parseBooleanEnv(process.env.SEND_MAILS_ENABLED);
}

export type SendAppEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  fromEmailOption?: SesFromEmailOption;
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

  const sourceEmail = getSourceEmail(input.fromEmailOption);

  const command = new SendEmailCommand({
    Source: sourceEmail,
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
    from: sourceEmail,
  };
}
