import "server-only";
import ExcelJS from "exceljs";
import { Prisma, type ShiftType } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrCreateLeaveYearProfile } from "@/lib/ems-queries";
import { canMarkAttendance } from "@/lib/permissions";
import {
  formatDateInIst,
  formatMarkOutTimeInIst,
  formatTimeInIst,
  getDayBoundsUtcFromIstDateKey,
  getIstDateKey,
  isWeekendDateKey,
} from "@/lib/ist";

export type HRReportType = "attendance" | "leaves" | "leave-counts";
export type HRReportRow = Array<string | number>;
export type HRReportShiftFilter = "DAY" | "NIGHT" | "BOTH";

const ATTENDANCE_EXPORT_COMPANY_NAME = "Sycamore Software Solutions Pvt. Ltd.";
const DEFAULT_EXPORT_GENERATED_BY = "PMS EMS";

export function normalizeHRReportShift(
  value?: string | null,
): HRReportShiftFilter {
  return value === "DAY" || value === "NIGHT" ? value : "BOTH";
}

export function normalizeHRReportUserIds(value?: string | string[] | null) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(
    new Set(
      values
        .map((item) => item.trim())
        .filter((item) => item && item !== "ALL"),
    ),
  );
}

export function normalizeHRReportUserId(value?: string | null) {
  return normalizeHRReportUserIds(value)[0];
}

function shiftLabel(value?: ShiftType | HRReportShiftFilter | null) {
  return value === "NIGHT" ? "Night" : value === "BOTH" ? "Both" : "Day";
}

function getProfileShift(
  profiles: Array<{ year: number; shift: ShiftType }>,
  year: number,
): ShiftType {
  return profiles.find((profile) => profile.year === year)?.shift ?? "DAY";
}

export type AttendanceExportDay = {
  dateKey: string;
  status: string;
  inTime: string;
  outTime: string;
  total: string;
};

export type AttendanceExportEmployee = {
  employeeCode: string;
  fullName: string;
  department: string;
  shift: string;
  days: AttendanceExportDay[];
};

export type AttendanceExportMatrix = {
  dateKeys: string[];
  employees: AttendanceExportEmployee[];
};

export type HRReportData = {
  type: HRReportType;
  title: string;
  fromDate: string;
  toDate: string;
  periodLabel: string;
  fileDatePart: string;
  headers: string[];
  rows: HRReportRow[];
  attendanceMatrix?: AttendanceExportMatrix;
};

const eligibleUserWhere: Prisma.UserWhereInput = {
  isActive: true,
  userType: { notIn: ["ADMIN", "OPERATIONS", "REPORT_VIEWER", "ACCOUNTS"] },
};

function buildEligibleUserWhere(userIds: string[] = []): Prisma.UserWhereInput {
  return userIds.length
    ? { AND: [eligibleUserWhere, { id: { in: userIds } }] }
    : eligibleUserWhere;
}

export async function getHRReportUserOptions() {
  return db.user.findMany({
    where: eligibleUserWhere,
    select: {
      id: true,
      fullName: true,
      email: true,
      employeeCode: true,
    },
    orderBy: { fullName: "asc" },
  });
}

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

function formatDuration(start?: Date, end?: Date) {
  if (!start || !end || end.getTime() <= start.getTime()) return "00:00";
  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function attendanceExportStatus(value: string) {
  if (value === "Present") return "P";
  if (value === "On Leave") return "L";
  if (value === "Weekend") return "W";
  if (value === "Official Holiday") return "H";
  if (value === "Exempted") return "Exempted";
  return "A";
}

function dayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return `${Number(dateKey.slice(8, 10))} ${["S", "M", "T", "W", "Th", "F", "St"][date.getUTCDay()]}`;
}

export async function getHRReportData(
  type: HRReportType,
  fromDate?: string,
  toDate?: string,
  shiftFilter: HRReportShiftFilter = "BOTH",
  userIds: string[] = [],
): Promise<HRReportData> {
  const userWhere = buildEligibleUserWhere(userIds);
  if (type === "leave-counts") {
    const year = Number(getIstDateKey().slice(0, 4));
    const { startUtc: yearStart } = getDayBoundsUtcFromIstDateKey(
      `${year}-01-01`,
    );
    const { startUtc: nextYearStart } = getDayBoundsUtcFromIstDateKey(
      `${year + 1}-01-01`,
    );
    const users = await db.user.findMany({
      where: userWhere,
      select: {
        id: true,
        fullName: true,
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
    const rangeDateKeys = dateKeys(fromDate, toDate);
    const years = Array.from(
      new Set(rangeDateKeys.map((dateKey) => Number(dateKey.slice(0, 4)))),
    );
    const [users, logs, approvedLeaves, officialHolidays] = await Promise.all([
      db.user.findMany({
        where: userWhere,
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          designation: true,
          userType: true,
          functionalRole: true,
          leaveYearProfiles: {
            where: { year: { in: years } },
            select: { year: true, shift: true },
          },
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
      db.officialHoliday.findMany({
        where: {
          holidayDate: { gte: startUtc, lt: endUtc },
        },
        select: { holidayDate: true, shift: true },
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
    const officialHolidayShiftsByDate = new Map<string, Set<string>>();
    for (const holiday of officialHolidays) {
      const dateKey = getIstDateKey(holiday.holidayDate);
      const shifts =
        officialHolidayShiftsByDate.get(dateKey) ?? new Set<string>();
      shifts.add(holiday.shift);
      officialHolidayShiftsByDate.set(dateKey, shifts);
    }
    const isOfficialHolidayForShift = (dateKey: string, shift: ShiftType) => {
      const shifts = officialHolidayShiftsByDate.get(dateKey);
      return Boolean(shifts?.has("BOTH") || shifts?.has(shift));
    };
    for (const leave of approvedLeaves) {
      const items = approvedByUser.get(leave.userId) ?? [];
      items.push({
        start: getIstDateKey(leave.startDate),
        end: getIstDateKey(leave.endDate),
      });
      approvedByUser.set(leave.userId, items);
    }
    const rowItems = rangeDateKeys.flatMap((dateKey) =>
      users.flatMap((user) => {
        const rowShift = getProfileShift(
          user.leaveYearProfiles,
          Number(dateKey.slice(0, 4)),
        );
        if (shiftFilter !== "BOTH" && rowShift !== shiftFilter) return [];

        const attendance = logMap.get(`${user.id}|${dateKey}`);
        const onLeave = (approvedByUser.get(user.id) ?? []).some(
          (leave) => leave.start <= dateKey && leave.end >= dateKey,
        );
        const isWeekend = isWeekendDateKey(dateKey);
        const isOfficialHoliday = isOfficialHolidayForShift(dateKey, rowShift);
        const presence = !canMarkAttendance(user)
          ? "Exempted"
          : isOfficialHoliday
            ? "Official Holiday"
            : isWeekend
              ? "Weekend"
              : onLeave
                ? "On Leave"
                : attendance?.markIn
                  ? "Present"
                  : "Absent";
        return [
          {
            dateKey,
            employeeId: user.id,
            employeeCode: user.employeeCode ?? "—",
            fullName: user.fullName,
            department: user.designation ?? "General",
            shift: shiftLabel(rowShift),
            status: presence,
            inTime: formatTimeInIst(attendance?.markIn?.markedAt),
            outTime: formatMarkOutTimeInIst(
              attendance?.markOut?.markedAt,
              dateKey,
              rowShift,
            ),
            total: formatDuration(
              attendance?.markIn?.markedAt,
              attendance?.markOut?.markedAt,
            ),
            city: attendance?.markIn?.city ?? attendance?.markOut?.city ?? "—",
          },
        ];
      }),
    );
    const rows = rowItems.map((item) => [
      item.dateKey,
      item.fullName,
      item.shift,
      item.status,
      item.inTime,
      item.outTime,
      item.city,
    ]);
    const employeeMap = new Map<string, AttendanceExportEmployee>();
    for (const item of rowItems) {
      const existing: AttendanceExportEmployee = employeeMap.get(
        item.employeeId,
      ) ?? {
        employeeCode: item.employeeCode,
        fullName: item.fullName,
        department: item.department,
        shift: item.shift,
        days: [],
      };
      existing.days.push({
        dateKey: item.dateKey,
        status: attendanceExportStatus(item.status),
        inTime: item.inTime === "—" ? "" : item.inTime,
        outTime: item.outTime === "—" ? "" : item.outTime,
        total: item.total,
      });
      employeeMap.set(item.employeeId, existing);
    }
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
        "Shift",
        "Attendance Status",
        "Mark-In",
        "Mark-Out",
        "City",
      ],
      rows,
      attendanceMatrix: {
        dateKeys: rangeDateKeys,
        employees: Array.from(employeeMap.values()),
      },
    };
  }

  const requests = await db.leaveRequest.findMany({
    where: {
      user: userWhere,
      startDate: { lt: endUtc },
      endDate: { gte: startUtc },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
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

function getAttendanceExportEmployees(matrix: AttendanceExportMatrix) {
  return matrix.employees.filter((employee) =>
    employee.days.some((day) => day.status !== "Exempted"),
  );
}

function styleAttendanceCell(cell: ExcelJS.Cell, dotted = true) {
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border = {
    top: { style: dotted ? "dotted" : "thin" },
    left: { style: dotted ? "dotted" : "thin" },
    bottom: { style: dotted ? "dotted" : "thin" },
    right: { style: dotted ? "dotted" : "thin" },
  };
}

async function buildAttendanceWorkbook(
  data: HRReportData,
  generatedBy = DEFAULT_EXPORT_GENERATED_BY,
) {
  const matrix = data.attendanceMatrix;
  if (!matrix) throw new Error("Attendance report data is not available.");
  const employees = getAttendanceExportEmployees(matrix);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS EMS";
  const sheet = workbook.addWorksheet("Per Day Attendance");
  const totalColumns = Math.max(matrix.dateKeys.length + 1, 8);
  const printedOn =
    formatDateInIst(new Date()) + " " + formatTimeInIst(new Date());

  sheet.mergeCells(1, 1, 1, totalColumns);
  sheet.getCell(1, 1).value = "Monthly Status Report (Basic Work Duration)";
  sheet.getCell(1, 1).font = { bold: true, size: 14 };
  sheet.getCell(1, 1).alignment = { horizontal: "center" };

  sheet.mergeCells(3, 1, 3, totalColumns);
  sheet.getCell(3, 1).value = data.periodLabel;
  sheet.getCell(3, 1).alignment = { horizontal: "center" };

  sheet.getCell(5, 1).value = "Company:";
  sheet.getCell(5, 1).font = { bold: true };
  sheet.getCell(5, 2).value = ATTENDANCE_EXPORT_COMPANY_NAME;
  sheet.getCell(5, totalColumns - 1).value = "Printed On:";
  sheet.getCell(5, totalColumns - 1).font = { bold: true };
  sheet.getCell(5, totalColumns).value = printedOn;

  const dayHeader = ["Days", ...matrix.dateKeys.map(dayLabel)];
  sheet.addRow([]);
  const headerRow = sheet.addRow(dayHeader);
  headerRow.eachCell((cell) => styleAttendanceCell(cell, false));
  headerRow.font = { bold: true };

  for (const employee of employees) {
    sheet.addRow([]);

    const metaRow = sheet.addRow([
      "Emp. Code:",
      employee.employeeCode,
      "Emp. Name:",
      employee.fullName,
      "Shift:",
      employee.shift,
    ]);
    metaRow.getCell(1).font = { bold: true };
    metaRow.getCell(3).font = { bold: true };
    metaRow.getCell(5).font = { bold: true };

    const dayByKey = new Map(employee.days.map((day) => [day.dateKey, day]));
    const statusRow = sheet.addRow([
      "Status",
      ...matrix.dateKeys.map((dateKey) => dayByKey.get(dateKey)?.status ?? ""),
    ]);
    const inRow = sheet.addRow([
      "InTime",
      ...matrix.dateKeys.map((dateKey) => dayByKey.get(dateKey)?.inTime ?? ""),
    ]);
    const outRow = sheet.addRow([
      "OutTime",
      ...matrix.dateKeys.map((dateKey) => dayByKey.get(dateKey)?.outTime ?? ""),
    ]);
    const totalRow = sheet.addRow([
      "Total",
      ...matrix.dateKeys.map(
        (dateKey) => dayByKey.get(dateKey)?.total ?? "00:00",
      ),
    ]);
    for (const row of [statusRow, inRow, outRow, totalRow]) {
      row.eachCell((cell) => styleAttendanceCell(cell));
      row.getCell(1).font = { bold: true };
    }
  }

  sheet.addRow([]);
  const footerRow = sheet.addRow([`Generated By: ${generatedBy}`]);
  footerRow.getCell(1).font = { bold: true };
  sheet.getColumn(1).width = 12;
  for (let index = 2; index <= totalColumns; index += 1)
    sheet.getColumn(index).width = 10;
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    horizontalCentered: true,
  };
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 7 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildHRReportWorkbook(
  data: HRReportData,
  generatedBy = DEFAULT_EXPORT_GENERATED_BY,
) {
  if (data.type === "attendance")
    return buildAttendanceWorkbook(data, generatedBy);

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

function pdfText(
  x: number,
  y: number,
  text: string | number,
  size = 7,
  bold = false,
) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`;
}

function pdfLine(x1: number, y1: number, x2: number, y2: number, width = 0.5) {
  return `${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`;
}

function pdfRect(
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth = 0.5,
) {
  return `${lineWidth} w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`;
}

function pdfAttendanceEmployeeBlock(
  employee: AttendanceExportEmployee,
  dateKeys: string[],
  x: number,
  y: number,
  labelWidth: number,
  dayWidth: number,
) {
  const commands: string[] = [];
  const totalWidth = labelWidth + dateKeys.length * dayWidth;
  commands.push(pdfText(x, y, "Emp. Code:", 7, true));
  commands.push(pdfText(x + 55, y, employee.employeeCode, 7));
  commands.push(pdfText(x + 140, y, "Emp. Name:", 7, true));
  commands.push(pdfText(x + 205, y, employee.fullName, 7));
  commands.push(pdfText(x + 360, y, "Shift:", 7, true));
  commands.push(pdfText(x + 395, y, employee.shift, 7));

  const tableTop = y - 10;
  const rowHeight = 14;
  const labels = ["Status", "InTime", "OutTime", "Total"];
  const dayByKey = new Map(employee.days.map((day) => [day.dateKey, day]));
  const values = [
    dateKeys.map((dateKey) => dayByKey.get(dateKey)?.status ?? ""),
    dateKeys.map((dateKey) => dayByKey.get(dateKey)?.inTime ?? ""),
    dateKeys.map((dateKey) => dayByKey.get(dateKey)?.outTime ?? ""),
    dateKeys.map((dateKey) => dayByKey.get(dateKey)?.total ?? "00:00"),
  ];

  commands.push(
    pdfRect(x, tableTop - rowHeight * 4, totalWidth, rowHeight * 4),
  );
  for (let row = 1; row < 4; row += 1) {
    const yLine = tableTop - row * rowHeight;
    commands.push(pdfLine(x, yLine, x + totalWidth, yLine, 0.35));
  }
  commands.push(
    pdfLine(
      x + labelWidth,
      tableTop,
      x + labelWidth,
      tableTop - rowHeight * 4,
      0.35,
    ),
  );
  for (let index = 1; index < dateKeys.length; index += 1) {
    const xLine = x + labelWidth + index * dayWidth;
    commands.push(
      pdfLine(xLine, tableTop, xLine, tableTop - rowHeight * 4, 0.25),
    );
  }
  for (let row = 0; row < labels.length; row += 1) {
    const textY = tableTop - row * rowHeight - 9;
    commands.push(pdfText(x + 3, textY, labels[row], 6.5, true));
    for (let dayIndex = 0; dayIndex < dateKeys.length; dayIndex += 1) {
      commands.push(
        pdfText(
          x + labelWidth + dayIndex * dayWidth + 2,
          textY,
          values[row][dayIndex],
          5.7,
        ),
      );
    }
  }
  return commands;
}

function buildAttendancePdf(
  data: HRReportData,
  generatedBy = DEFAULT_EXPORT_GENERATED_BY,
) {
  const matrix = data.attendanceMatrix;
  if (!matrix) throw new Error("Attendance report data is not available.");
  const employees = getAttendanceExportEmployees(matrix);
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 22;
  const labelWidth = 44;
  const dayWidth = Math.min(
    28,
    Math.max(
      18,
      (pageWidth - margin * 2 - labelWidth) /
        Math.max(matrix.dateKeys.length, 1),
    ),
  );
  const totalTableWidth = labelWidth + matrix.dateKeys.length * dayWidth;
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = pageHeight - 24;
  const printedOn = `${formatDateInIst(new Date())} ${formatTimeInIst(new Date())}`;

  const addHeader = (pageNumber: number) => {
    commands.push(
      pdfText(
        300,
        pageHeight - 22,
        "Monthly Status Report (Basic Work Duration)",
        11,
        true,
      ),
    );
    commands.push(pdfText(355, pageHeight - 48, data.periodLabel, 8));
    commands.push(pdfText(margin, pageHeight - 84, "Company:", 7, true));
    commands.push(
      pdfText(margin + 55, pageHeight - 84, ATTENDANCE_EXPORT_COMPANY_NAME, 7),
    );
    commands.push(
      pdfText(pageWidth - 170, pageHeight - 84, "Printed On:", 7, true),
    );
    commands.push(pdfText(pageWidth - 100, pageHeight - 84, printedOn, 7));
    commands.push(
      pdfLine(margin, pageHeight - 92, pageWidth - margin, pageHeight - 92),
    );
    const headerTop = pageHeight - 110;
    commands.push(pdfRect(margin, headerTop - 16, totalTableWidth, 16));
    commands.push(pdfText(margin + 3, headerTop - 10, "Days", 6.5, true));
    commands.push(
      pdfLine(
        margin + labelWidth,
        headerTop,
        margin + labelWidth,
        headerTop - 16,
        0.35,
      ),
    );
    matrix.dateKeys.forEach((dateKey, index) => {
      const cellX = margin + labelWidth + index * dayWidth;
      if (index > 0)
        commands.push(pdfLine(cellX, headerTop, cellX, headerTop - 16, 0.25));
      commands.push(pdfText(cellX + 2, headerTop - 10, dayLabel(dateKey), 5.7));
    });
    commands.push(pdfLine(margin, 38, pageWidth - margin, 38));
    commands.push(pdfText(margin, 22, `Generated By: ${generatedBy}`, 7));
    commands.push(pdfText(pageWidth - 95, 22, "Page No", 7));
    commands.push(pdfText(pageWidth - 35, 22, String(pageNumber), 7));
    y = pageHeight - 148;
  };

  addHeader(1);
  let pageNumber = 1;
  for (const employee of employees) {
    const blockHeight = 84;
    if (y - blockHeight < 52) {
      pages.push(commands);
      commands = [];
      pageNumber += 1;
      addHeader(pageNumber);
    }
    commands.push(
      ...pdfAttendanceEmployeeBlock(
        employee,
        matrix.dateKeys,
        margin,
        y,
        labelWidth,
        dayWidth,
      ),
    );
    y -= 82;
  }
  pages.push(commands);

  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontRegularId = 3;
  const fontBoldId = 4;
  let nextId = 5;
  for (const pageCommands of pages) {
    const content = pageCommands.join("\n");
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`;
    objects[contentId] =
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
  }
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
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

export function buildHRReportPdf(
  data: HRReportData,
  generatedBy = DEFAULT_EXPORT_GENERATED_BY,
) {
  if (data.type === "attendance") return buildAttendancePdf(data, generatedBy);

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
