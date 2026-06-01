"use server";

import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { getIstDateKey } from "@/lib/ist";
import { getOrCreateLeaveYearProfile } from "@/lib/ems-queries";

type ImportIntent = "preview" | "apply";

type SheetRow = {
  rowNumber: number;
  username: string;
  email: string;
  employeeCode: string;
  casualLeavesRemaining: number | null;
  earnedLeavesRemaining: number | null;
  designation: string;
  joiningDate: Date | null;
};

export type UserImportRowResult = {
  rowNumber: number;
  username: string;
  email: string;
  status: "ready" | "updated" | "skipped";
  message: string;
  userId?: string;
  employeeName?: string;
  changes?: string[];
};

export type UserImportActionState = {
  success: boolean;
  applied: boolean;
  message: string;
  totalRows: number;
  readyRows: number;
  updatedRows: number;
  skippedRows: number;
  results: UserImportRowResult[];
};

const EMPTY_STATE: UserImportActionState = {
  success: false,
  applied: false,
  message: "Upload an Excel file to preview updates before applying them.",
  totalRows: 0,
  readyRows: 0,
  updatedRows: 0,
  skippedRows: 0,
  results: [],
};

const REQUIRED_HEADERS = [
  "Username",
  "Email",
  "Employee Code",
  "Casual Leaves Remaining",
  "Earned Leaves Remaining",
  "Designation",
  "Joining Date",
] as const;

type HeaderName = (typeof REQUIRED_HEADERS)[number];

type HeaderMap = Record<HeaderName, number>;

function assertAdminOther(
  user: Awaited<ReturnType<typeof requireUserForAction>>,
) {
  if (user.userType !== "ADMIN" || user.functionalRole !== "OTHER") {
    throw new Error(
      "Only Admin users with Functional Role Other can use this import page.",
    );
  }
}

function normalizeText(value: unknown) {
  if (value == null) return "";
  if (
    typeof value === "object" &&
    "text" in value &&
    typeof value.text === "string"
  ) {
    return value.text.trim();
  }
  if (typeof value === "object" && "result" in value) {
    return normalizeText(value.result);
  }
  return String(value).trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function parseNumber(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = normalizeText(value).replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseExcelDate(value: unknown) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date; ExcelJS stores serial day 1 as 1900-01-01 with the
    // common 25569 offset to Unix epoch days.
    const millis = Math.round((value - 25569) * 86400 * 1000);
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = normalizeText(value);
  if (!text) return null;

  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00.000Z`)
    : null;
  if (iso && !Number.isNaN(iso.getTime())) return iso;

  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const [, day, month, year] = slash;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateForMessage(date: Date | null) {
  if (!date) return "blank";
  return date.toISOString().slice(0, 10);
}

function getCellValue(row: ExcelJS.Row, columnIndex: number) {
  return row.getCell(columnIndex).value;
}

function buildHeaderMap(worksheet: ExcelJS.Worksheet): HeaderMap {
  const firstRow = worksheet.getRow(1);
  const headers = new Map<string, number>();
  firstRow.eachCell((cell, columnNumber) => {
    const label = normalizeText(cell.value).toLowerCase();
    if (label) headers.set(label, columnNumber);
  });

  const missing = REQUIRED_HEADERS.filter(
    (header) => !headers.has(header.toLowerCase()),
  );
  if (missing.length) {
    throw new Error(`Missing required header(s): ${missing.join(", ")}.`);
  }

  return REQUIRED_HEADERS.reduce((map, header) => {
    map[header] = headers.get(header.toLowerCase())!;
    return map;
  }, {} as HeaderMap);
}

async function parseWorkbook(file: File): Promise<SheetRow[]> {
  if (!file || file.size === 0) throw new Error("Upload an Excel file.");
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".xlsx")) {
    throw new Error("Only .xlsx files are supported for this import.");
  }

  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet)
    throw new Error("The Excel file does not contain any worksheet.");

  const headerMap = buildHeaderMap(worksheet);
  const rows: SheetRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const username = normalizeText(getCellValue(row, headerMap.Username));
    const email = normalizeEmail(getCellValue(row, headerMap.Email));
    const employeeCode = normalizeText(
      getCellValue(row, headerMap["Employee Code"]),
    );
    const casualLeavesRemaining = parseNumber(
      getCellValue(row, headerMap["Casual Leaves Remaining"]),
    );
    const earnedLeavesRemaining = parseNumber(
      getCellValue(row, headerMap["Earned Leaves Remaining"]),
    );
    const designation = normalizeText(getCellValue(row, headerMap.Designation));
    const joiningDate = parseExcelDate(
      getCellValue(row, headerMap["Joining Date"]),
    );

    const hasAnyValue = [
      username,
      email,
      employeeCode,
      casualLeavesRemaining,
      earnedLeavesRemaining,
      designation,
      joiningDate,
    ].some((value) => value !== "" && value != null);
    if (!hasAnyValue) return;

    rows.push({
      rowNumber,
      username,
      email,
      employeeCode,
      casualLeavesRemaining,
      earnedLeavesRemaining,
      designation,
      joiningDate,
    });
  });

  if (!rows.length)
    throw new Error("No data rows found in the uploaded sheet.");
  return rows;
}

function getDuplicateKeys(
  rows: SheetRow[],
  selector: (row: SheetRow) => string,
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = selector(row);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key),
  );
}

function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined,
) {
  if (value == null) return 0;
  return Number(value);
}

function valuesDiffer(a: unknown, b: unknown) {
  return normalizeText(a) !== normalizeText(b);
}

async function validateRows(
  rows: SheetRow[],
  intent: ImportIntent,
): Promise<UserImportActionState> {
  const year = Number(getIstDateKey().slice(0, 4));
  const duplicateEmails = getDuplicateKeys(rows, (row) => row.email);
  const duplicateUsernames = getDuplicateKeys(rows, (row) =>
    row.username.toLowerCase(),
  );
  const results: UserImportRowResult[] = [];
  let readyRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    const changes: string[] = [];
    const skip = (message: string) => {
      skippedRows += 1;
      results.push({
        rowNumber: row.rowNumber,
        username: row.username || "—",
        email: row.email || "—",
        status: "skipped",
        message,
      });
    };

    if (!row.username || !row.email) {
      skip("Username and Email are required validators.");
      continue;
    }
    if (duplicateEmails.has(row.email)) {
      skip("Duplicate Email found in uploaded sheet.");
      continue;
    }
    if (duplicateUsernames.has(row.username.toLowerCase())) {
      skip("Duplicate Username found in uploaded sheet.");
      continue;
    }
    if (row.casualLeavesRemaining == null || row.casualLeavesRemaining < 0) {
      skip("Casual Leaves Remaining must be a valid non-negative number.");
      continue;
    }
    if (row.earnedLeavesRemaining == null || row.earnedLeavesRemaining < 0) {
      skip("Earned Leaves Remaining must be a valid non-negative number.");
      continue;
    }

    const user = await db.user.findUnique({
      where: { email: row.email },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        employeeCode: true,
        designation: true,
        joiningDate: true,
      },
    });

    if (!user) {
      skip("No user found with this Email.");
      continue;
    }
    if (
      user.username.trim().toLowerCase() !== row.username.trim().toLowerCase()
    ) {
      skip(
        `Email exists, but Username does not match DB username '${user.username}'.`,
      );
      continue;
    }

    if (row.employeeCode) {
      const conflict = await db.user.findFirst({
        where: { employeeCode: row.employeeCode, NOT: { id: user.id } },
        select: { id: true, fullName: true, email: true },
      });
      if (conflict) {
        skip(
          `Employee Code is already assigned to ${conflict.fullName} (${conflict.email}).`,
        );
        continue;
      }
    }

    const profile = await getOrCreateLeaveYearProfile(user.id, year);
    const unpaidOnly =
      profile.employmentStatus === "PROBATION" ||
      profile.employmentStatus === "CONSULTANT";
    const casualToStore = unpaidOnly ? 0 : row.casualLeavesRemaining;
    const earnedToStore = unpaidOnly ? 0 : row.earnedLeavesRemaining;

    if (valuesDiffer(user.employeeCode ?? "", row.employeeCode)) {
      changes.push(
        `Employee Code: ${user.employeeCode || "blank"} → ${row.employeeCode || "blank"}`,
      );
    }
    if (valuesDiffer(user.designation ?? "", row.designation)) {
      changes.push(
        `Designation: ${user.designation || "blank"} → ${row.designation || "blank"}`,
      );
    }
    if (
      formatDateForMessage(user.joiningDate) !==
      formatDateForMessage(row.joiningDate)
    ) {
      changes.push(
        `Joining Date: ${formatDateForMessage(user.joiningDate)} → ${formatDateForMessage(row.joiningDate)}`,
      );
    }
    if (decimalToNumber(profile.casualLeaves) !== casualToStore) {
      changes.push(
        `Casual Leaves: ${decimalToNumber(profile.casualLeaves).toFixed(2)} → ${casualToStore.toFixed(2)}`,
      );
    }
    if (decimalToNumber(profile.earnedLeaves) !== earnedToStore) {
      changes.push(
        `Earned Leaves: ${decimalToNumber(profile.earnedLeaves).toFixed(2)} → ${earnedToStore.toFixed(2)}`,
      );
    }
    if (
      unpaidOnly &&
      (row.casualLeavesRemaining > 0 || row.earnedLeavesRemaining > 0)
    ) {
      changes.push(
        `${profile.employmentStatus} employee: Casual/Earned balances are forced to 0 by leave rules.`,
      );
    }

    if (intent === "apply") {
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            employeeCode: row.employeeCode || null,
            designation: row.designation || null,
            joiningDate: row.joiningDate,
          },
        }),
        db.leaveYearProfile.update({
          where: { id: profile.id },
          data: {
            casualLeaves: new Prisma.Decimal(casualToStore.toFixed(2)),
            earnedLeaves: new Prisma.Decimal(earnedToStore.toFixed(2)),
          },
        }),
      ]);
      updatedRows += 1;
      results.push({
        rowNumber: row.rowNumber,
        username: row.username,
        email: row.email,
        status: "updated",
        message: changes.length
          ? "Updated successfully."
          : "No data changes found; record verified.",
        userId: user.id,
        employeeName: user.fullName,
        changes,
      });
    } else {
      readyRows += 1;
      results.push({
        rowNumber: row.rowNumber,
        username: row.username,
        email: row.email,
        status: "ready",
        message: changes.length ? "Ready to update." : "No data changes found.",
        userId: user.id,
        employeeName: user.fullName,
        changes,
      });
    }
  }

  return {
    success: skippedRows === 0,
    applied: intent === "apply",
    message:
      intent === "apply"
        ? `Import completed. Updated ${updatedRows} row(s), skipped ${skippedRows} row(s).`
        : `Preview completed. ${readyRows} row(s) ready, ${skippedRows} row(s) skipped.`,
    totalRows: rows.length,
    readyRows,
    updatedRows,
    skippedRows,
    results,
  };
}

export async function importUserProfileSheetAction(
  _previousState: UserImportActionState,
  formData: FormData,
): Promise<UserImportActionState> {
  try {
    const user = await requireUserForAction();
    assertAdminOther(user);

    const intentValue = formData.get("intent");
    const intent: ImportIntent = intentValue === "apply" ? "apply" : "preview";
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Upload an Excel .xlsx file.");
    }

    const rows = await parseWorkbook(file);
    const result = await validateRows(rows, intent);
    if (intent === "apply") {
      revalidatePath("/users");
      revalidatePath("/leave-admin");
      revalidatePath("/admin-user-import");
    }
    return result;
  } catch (caught) {
    return {
      ...EMPTY_STATE,
      message: caught instanceof Error ? caught.message : "Import failed.",
    };
  }
}
