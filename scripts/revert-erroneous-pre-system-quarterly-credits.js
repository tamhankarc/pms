#!/usr/bin/env node
/*
  One-time correction for the 17 July 2026 daily leave run that incorrectly
  credited the 2026 Q1 and Q2 Casual Leave amounts after the PMS leave-system
  cutover.

  Preview (default):
    node scripts/revert-erroneous-pre-system-quarterly-credits.js

  Apply only when preview reports safeToApply=true and the expected counts:
    node scripts/revert-erroneous-pre-system-quarterly-credits.js \
      --apply --confirm=REVERT_2026_Q1_Q2
*/

const path = require("node:path");
const { loadEnvConfig } = require("@next/env");

const projectRoot = path.resolve(__dirname, "..");
process.env.NODE_ENV ||= "production";
loadEnvConfig(projectRoot, process.env.NODE_ENV === "development", console);

function getArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : "";
}

const apply = process.argv.includes("--apply");
const confirmation = getArg("confirm");
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

if (!baseUrl) {
  throw new Error(
    "PMS_BASE_URL, APP_URL, NEXT_PUBLIC_APP_URL, or --base-url is required.",
  );
}
if (!secret) {
  throw new Error(
    "MAINTENANCE_CRON_SECRET (or CRON_SECRET) is required.",
  );
}
if (apply && confirmation !== "REVERT_2026_Q1_Q2") {
  throw new Error(
    "Apply mode requires --confirm=REVERT_2026_Q1_Q2.",
  );
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

async function main() {
  const endpoint = `${baseUrl}/api/maintenance/revert-pre-system-quarterly-credits`;
  const response = await fetch(endpoint, {
    method: apply ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: apply ? JSON.stringify({ confirm: confirmation }) : undefined,
    signal: controller.signal,
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  console.log(
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        endpoint,
        mode: apply ? "APPLY" : "PREVIEW",
        response: body,
      },
      null,
      2,
    ),
  );
  if (!response.ok) {
    throw new Error(
      `Correction request failed (${response.status} ${response.statusText}).`,
    );
  }
}

main()
  .catch((error) => {
    console.error(
      `[${new Date().toISOString()}] Quarterly-credit incident correction failed:`,
      error,
    );
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(timeout));
