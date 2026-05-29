import "server-only";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrCreateLeaveYearProfile } from "@/lib/ems-queries";
import {
  formatDateInIst,
  formatTimeInIst,
  getDayBoundsUtcFromIstDateKey,
  getIstDateKey,
} from "@/lib/ist";
import {
  formatFunctionalRoleLabel,
  formatUserTypeLabel,
} from "@/lib/display-labels";

export type HRReportType = "attendance" | "leaves" | "leave-counts";
export type HRReportRow = Array<string | number>;
export type HRReportData = {
  type: HRReportType;
  title: string;
  fromDate: string;
  toDate: string;
  periodLabel: string;
  fileDatePart: string;
  headers: string[];
  rows: HRReportRow[];
};

const eligibleUserWhere: Prisma.UserWhereInput = {
  isActive: true,
  userType: { notIn: ["ADMIN", "OPERATIONS", "REPORT_VIEWER", "ACCOUNTS"] },
};

export function normalizeHRReportType(value?: string | null): HRReportType {
  return value === "leaves" || value === "leave-counts" ? value : "attendance";
}

export function validateReportDateRange(
  fromDate?: string | null,
  toDate?: string | null,
) {
  if (
    !fromDate ||
    !toDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
  ) {
    throw new Error(
      "Select both From Date and To Date before exporting an HR report.",
    );
  }
  if (toDate < fromDate) throw new Error("To Date cannot be before From Date.");
  return { fromDate, toDate };
}

function dateKeys(fromDate: string, toDate: string) {
  const keys: string[] = [];
  let cursor = fromDate;
  while (cursor <= toDate) {
    keys.push(cursor);
    cursor = getIstDateKey(getDayBoundsUtcFromIstDateKey(cursor).endUtc);
  }
  return keys;
}

function statusLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");
}

export async function getHRReportData(
  type: HRReportType,
  fromDate?: string,
  toDate?: string,
): Promise<HRReportData> {
  if (type === "leave-counts") {
    const year = Number(getIstDateKey().slice(0, 4));
    const { startUtc: yearStart } = getDayBoundsUtcFromIstDateKey(
      `${year}-01-01`,
    );
    const { startUtc: nextYearStart } = getDayBoundsUtcFromIstDateKey(
      `${year + 1}-01-01`,
    );
    const users = await db.user.findMany({
      where: eligibleUserWhere,
      select: {
        id: true,
        fullName: true,
        userType: true,
        functionalRole: true,
      },
      orderBy: { fullName: "asc" },
    });
    const unpaidTotals = users.length
      ? await db.leaveRequest.groupBy({
          by: ["userId"],
          where: {
            userId: { in: users.map((user) => user.id) },
            status: "APPROVED",
            startDate: { gte: yearStart, lt: nextYearStart },
          },
          _sum: { unpaidDaysUsed: true },
        })
      : [];
    const unpaidDaysByUserId = new Map(
      unpaidTotals.map((row) => [
        row.userId,
        Number(row._sum.unpaidDaysUsed ?? 0),
      ]),
    );
    const rows = await Promise.all(
      users.map(async (user) => {
        const profile = await getOrCreateLeaveYearProfile(user.id, year);
        return [
          user.fullName,
          formatUserTypeLabel(user.userType),
          formatFunctionalRoleLabel(user.functionalRole),
          Number(profile.casualLeaves),
          Number(profile.earnedLeaves),
          unpaidDaysByUserId.get(user.id) ?? 0,
        ];
      }),
    );
    return {
      type,
      title: "Casual, Earned & Unpaid Leave Counts",
      fromDate: "",
      toDate: "",
      periodLabel: `Leave Year ${year}`,
      fileDatePart: String(year),
      headers: [
        "Employee",
        "User Type",
        "Functional Role",
        "Remaining Casual Leaves",
        "Remaining Earned Leaves",
        "Approved Unpaid Leaves",
      ],
      rows,
    };
  }

  if (!fromDate || !toDate) {
    throw new Error(
      "Select both From Date and To Date before exporting an HR report.",
    );
  }
  const { startUtc } = getDayBoundsUtcFromIstDateKey(fromDate);
  const { endUtc } = getDayBoundsUtcFromIstDateKey(toDate);

  if (type === "attendance") {
    const [users, logs, approvedLeaves] = await Promise.all([
      db.user.findMany({
        where: eligibleUserWhere,
        select: {
          id: true,
          fullName: true,
          userType: true,
          functionalRole: true,
        },
        orderBy: { fullName: "asc" },
      }),
      db.attendanceLog.findMany({
        where: { attendanceDate: { gte: startUtc, lt: endUtc } },
        orderBy: { markedAt: "asc" },
      }),
      db.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lt: endUtc },
          endDate: { gte: startUtc },
        },
        select: { userId: true, startDate: true, endDate: true },
      }),
    ]);
    const logMap = new Map<
      string,
      { markIn?: (typeof logs)[number]; markOut?: (typeof logs)[number] }
    >();
    for (const log of logs) {
      const key = `${log.userId}|${getIstDateKey(log.attendanceDate)}`;
      const item = logMap.get(key) ?? {};
      if (log.type === "MARK_IN" && !item.markIn) item.markIn = log;
      if (log.type === "MARK_OUT") item.markOut = log;
      logMap.set(key, item);
    }
    const approvedByUser = new Map<
      string,
      Array<{ start: string; end: string }>
    >();
    for (const leave of approvedLeaves) {
      const items = approvedByUser.get(leave.userId) ?? [];
      items.push({
        start: getIstDateKey(leave.startDate),
        end: getIstDateKey(leave.endDate),
      });
      approvedByUser.set(leave.userId, items);
    }
    const rows = dateKeys(fromDate, toDate).flatMap((dateKey) =>
      users.map((user) => {
        const attendance = logMap.get(`${user.id}|${dateKey}`);
        const onLeave = (approvedByUser.get(user.id) ?? []).some(
          (leave) => leave.start <= dateKey && leave.end >= dateKey,
        );
        const presence = attendance?.markIn
          ? "Present"
          : onLeave
            ? "Approved Leave"
            : "Absent";
        return [
          dateKey,
          user.fullName,
          formatUserTypeLabel(user.userType),
          formatFunctionalRoleLabel(user.functionalRole),
          presence,
          formatTimeInIst(attendance?.markIn?.markedAt),
          formatTimeInIst(attendance?.markOut?.markedAt),
          attendance?.markIn?.city ?? attendance?.markOut?.city ?? "—",
        ];
      }),
    );
    return {
      type,
      title: "Per Day Attendance",
      fromDate,
      toDate,
      periodLabel: `${fromDate} to ${toDate}`,
      fileDatePart: `${fromDate}_to_${toDate}`,
      headers: [
        "Date",
        "Employee",
        "User Type",
        "Functional Role",
        "Attendance Status",
        "Mark-In",
        "Mark-Out",
        "City",
      ],
      rows,
    };
  }

  const requests = await db.leaveRequest.findMany({
    where: {
      user: eligibleUserWhere,
      startDate: { lt: endUtc },
      endDate: { gte: startUtc },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          userType: true,
          functionalRole: true,
        },
      },
      approver: { select: { fullName: true } },
    },
    orderBy: [{ user: { fullName: "asc" } }, { startDate: "asc" }],
  });

  if (type === "leaves") {
    return {
      type,
      title: "Leaves with Status",
      fromDate,
      toDate,
      periodLabel: `${fromDate} to ${toDate}`,
      fileDatePart: `${fromDate}_to_${toDate}`,
      headers: [
        "Employee",
        "User Type",
        "Functional Role",
        "From Date",
        "To Date",
        "Status",
        "Total Days",
        "Casual",
        "Earned",
        "Unpaid",
        "Approver",
        "Reason",
      ],
      rows: requests.map((row) => [
        row.user.fullName,
        formatUserTypeLabel(row.user.userType),
        formatFunctionalRoleLabel(row.user.functionalRole),
        formatDateInIst(row.startDate),
        formatDateInIst(row.endDate),
        statusLabel(row.status),
        Number(row.totalLeaveDays ?? 0),
        Number(row.casualDaysUsed ?? 0),
        Number(row.earnedDaysUsed ?? 0),
        Number(row.unpaidDaysUsed ?? 0),
        row.approver?.fullName ?? "—",
        row.reason ?? "—",
      ]),
    };
  }

  throw new Error("Unsupported HR report type.");
}

export async function buildHRReportWorkbook(data: HRReportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS EMS";
  const sheet = workbook.addWorksheet(data.title.slice(0, 31));
  sheet.addRow([data.title]);
  sheet.addRow([
    data.type === "leave-counts" ? "Leave Year" : "Date Range",
    data.periodLabel,
  ]);
  sheet.addRow([]);
  sheet.addRow(data.headers);
  for (const row of data.rows) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(4).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.columns.forEach((column) => {
    column.width = Math.min(Math.max(column.width ?? 12, 14), 42);
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function escapePdfText(value: string | number) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[^\x20-\x7E]/g, "-");
}

export function buildHRReportPdf(data: HRReportData) {
  const lines = [
    data.title,
    `${data.type === "leave-counts" ? "Leave Year" : "Date Range"}: ${data.periodLabel}`,
    "",
    data.headers.join(" | "),
    ...data.rows.map((row) => row.map(String).join(" | ")),
  ];
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 45)
    pages.push(lines.slice(index, index + 45));
  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3;
  let nextId = 4;
  for (const pageLines of pages) {
    const content = [
      "BT",
      "/F1 8 Tf",
      "38 805 Td",
      ...pageLines.flatMap((line, i) =>
        i === 0
          ? [`(${escapePdfText(line.slice(0, 145))}) Tj`]
          : ["0 -16 Td", `(${escapePdfText(line.slice(0, 145))}) Tj`],
      ),
      "ET",
    ].join("\n");
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
    objects[contentId] =
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
  }
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = Buffer.byteLength(pdf);
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1)
    pdf += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

export function getHRReportFileName(
  data: HRReportData,
  extension: "xlsx" | "pdf",
) {
  const base =
    data.type === "attendance"
      ? "per_day_attendance"
      : data.type === "leaves"
        ? "leaves_with_status"
        : "leave_counts";
  return `${base}_${data.fileDatePart}.${extension}`;
}
