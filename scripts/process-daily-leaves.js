#!/usr/bin/env node
/*
  PMS deferred-leave daily processor for AWS/Linux crontab.

  The production server runs crontab in UTC, so schedule this at 18:30 UTC
  for 00:00 IST. The script loads Next.js environment files from the project
  root, then calls the protected internal maintenance route.

  Usage:
    node scripts/process-daily-leaves.js
    node scripts/process-daily-leaves.js --as-of=2026-07-20
    node scripts/process-daily-leaves.js --base-url=http://127.0.0.1:3000

  Required environment:
    MAINTENANCE_CRON_SECRET (preferred) or CRON_SECRET

  Base URL resolution order:
    --base-url, PMS_BASE_URL, APP_URL, NEXT_PUBLIC_APP_URL
*/

const path = require("node:path");
const { loadEnvConfig } = require("@next/env");

const projectRoot = path.resolve(__dirname, "..");
// Cron normally does not set NODE_ENV. Default to production so .env.production
// is loaded on the AWS server; set NODE_ENV=development explicitly for local use.
process.env.NODE_ENV ||= "production";
loadEnvConfig(projectRoot, process.env.NODE_ENV === "development", console);

function getArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : "";
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const baseUrl = String(
  getArg("base-url") ||
    process.env.PMS_BASE_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "",
).replace(/\/$/, "");
const secret = String(
  process.env.MAINTENANCE_CRON_SECRET || process.env.CRON_SECRET || "",
).trim();
const asOfDateKey = getArg("as-of");

if (!baseUrl) {
  throw new Error(
    "PMS_BASE_URL, APP_URL, NEXT_PUBLIC_APP_URL, or --base-url is required.",
  );
}
if (!secret) {
  throw new Error(
    "MAINTENANCE_CRON_SECRET (or CRON_SECRET) is required for the daily leave processor.",
  );
}
if (asOfDateKey && !isValidDateKey(asOfDateKey)) {
  throw new Error("--as-of must be a valid date in YYYY-MM-DD format.");
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);

async function main() {
  const endpoint = `${baseUrl}/api/maintenance/daily-leave-deductions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(asOfDateKey ? { asOfDateKey } : {}),
    signal: controller.signal,
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Daily leave processor failed (${response.status} ${response.statusText}): ${body}`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  console.log(
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        endpoint,
        response: parsed,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      `[${new Date().toISOString()}] Daily leave processor failed:`,
      error,
    );
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(timeout));
