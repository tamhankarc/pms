import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canAddManualAttendance,
  canManageManualAttendance,
  canViewAttendanceHistory,
  canViewAttendanceLocationComparison,
  isAdminProjectManager,
  isProjectManager,
  isRoleScopedManager,
} from "@/lib/permissions";
import {
  formatDateInIst,
  formatMarkOutTimeInIst,
  formatTimeInIst,
  getDayBoundsUtcFromIstDateKey,
  getIstDateKey,
} from "@/lib/ist";

function isDateKey(value?: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getMonthStart(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

function sanitizeFileSegment(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "attendance_history"
  );
}

function getTimestamp() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

function buildFileName(
  userName: string,
  fromDate: string,
  toDate: string,
  extension: "xlsx" | "pdf",
) {
  return `attendance_history_${sanitizeFileSegment(userName)}_${fromDate}_to_${toDate}_${getTimestamp()}.${extension}`;
}

function getActionLabel(value: string) {
  return value === "MARK_OUT" ? "Mark-Out" : "Mark-In";
}

function getCityDistrictLabel(city?: string | null, district?: string | null) {
  const normalizedCity = (city ?? "").trim();
  const normalizedDistrict = (district ?? "").trim();

  if (
    normalizedCity &&
    normalizedDistrict &&
    normalizedCity.toLowerCase() !== normalizedDistrict.toLowerCase()
  ) {
    return `${normalizedCity}, ${normalizedDistrict}`;
  }

  return normalizedCity || normalizedDistrict || "—";
}

function formatDecimalNumber(value: unknown, fractionDigits: number) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(fractionDigits) : null;
}

function formatMeters(value: unknown) {
  const formatted = formatDecimalNumber(value, 2);
  return formatted ? `${formatted} m` : "—";
}

function formatCoordinates(latitude: unknown, longitude: unknown) {
  const formattedLatitude = formatDecimalNumber(latitude, 7);
  const formattedLongitude = formatDecimalNumber(longitude, 7);
  return formattedLatitude && formattedLongitude
    ? `${formattedLatitude}, ${formattedLongitude}`
    : "—";
}

function getAddressDetails({
  city,
  district,
  town,
  village,
  state,
  address,
}: {
  city?: string | null;
  district?: string | null;
  town?: string | null;
  village?: string | null;
  state?: string | null;
  address?: string | null;
}) {
  return [
    `City: ${city || "—"}`,
    `District: ${district || "—"}`,
    `Town: ${town || "—"}`,
    `Village: ${village || "—"}`,
    `State: ${state || "—"}`,
    `Address: ${address || "—"}`,
  ].join(" | ");
}

function joinCoordinatesAndAddress({
  coordinates,
  accuracy,
  difference,
  error,
  addressDetails,
}: {
  coordinates: string;
  accuracy?: string;
  difference?: string;
  error?: string | null;
  addressDetails: string;
}) {
  return [
    `Co-Ordinates: ${coordinates}`,
    accuracy && accuracy !== "—" ? `Accuracy: ${accuracy}` : null,
    difference && difference !== "—" ? `Difference: ${difference}` : null,
    addressDetails,
    error ? `Note: ${error}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ");
}

function escapePdfText(value: string | number) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[^ -~]/g, "-");
}

async function buildExcelBuffer(rows: string[][], title: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS";
  const sheet = workbook.addWorksheet("Attendance History");
  sheet.addRow([title]);
  sheet.addRow([]);
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(3).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 3 }];
  sheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value =
        cell.value === null || cell.value === undefined
          ? ""
          : String(cell.value);
      maxLength = Math.max(maxLength, value.length + 2);
    });
    column.width = Math.min(Math.max(maxLength, 12), 45);
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function buildSimplePdf(rows: string[][], title: string) {
  const lines = [title, "", ...rows.map((row) => row.join(" | "))];
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 42) {
    pages.push(lines.slice(index, index + 42));
  }
  if (pages.length === 0) pages.push([]);

  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3;
  let nextId = 4;
  for (const pageLines of pages) {
    const content = [
      "BT",
      "/F1 6 Tf",
      "24 805 Td",
      ...pageLines.flatMap((line, index) =>
        index === 0
          ? [`(${escapePdfText(line.slice(0, 230))}) Tj`]
          : ["0 -14 Td", `(${escapePdfText(line.slice(0, 230))}) Tj`],
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
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

export async function GET(request: Request) {
  const currentUser = await getSession();
  if (!currentUser) return new Response("Unauthorized", { status: 401 });
  if (!canViewAttendanceHistory(currentUser))
    return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(request.url);
  const todayKey = getIstDateKey();
  const fromDate = isDateKey(searchParams.get("fromDate"))
    ? searchParams.get("fromDate")!
    : getMonthStart(todayKey);
  const toDate = isDateKey(searchParams.get("toDate"))
    ? searchParams.get("toDate")!
    : todayKey;
  const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const canSelectAttendanceUser = canManageManualAttendance(currentUser);
  const canSeeLocationComparison =
    canViewAttendanceLocationComparison(currentUser);

  const attendanceEligibleUserWhere: Prisma.UserWhereInput = {
    isActive: true,
    OR: [
      { userType: "EMPLOYEE" },
      { userType: "TEAM_LEAD" },
      {
        userType: "MANAGER",
        functionalRole: {
          notIn: ["PROJECT_MANAGER", "GENERAL_MANAGER"],
        },
      },
    ],
  };

  const requestedUserId = searchParams.get("userId") ?? "";
  const canAddManualLog = canAddManualAttendance(currentUser);

  const scopedUserOptions = canSelectAttendanceUser
    ? canAddManualLog ||
      isAdminProjectManager(currentUser) ||
      isProjectManager(currentUser)
      ? await db.user.findMany({
          where: attendanceEligibleUserWhere,
          select: { id: true },
        })
      : await db.employeeTeamLead
          .findMany({
            where: {
              teamLeadId: currentUser.id,
              employee: attendanceEligibleUserWhere,
            },
            include: {
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  username: true,
                  email: true,
                  employeeCode: true,
                  userType: true,
                  functionalRole: true,
                },
              },
            },
          })
          .then(async (assignments) => {
            const assignedUsers = assignments.map(
              (assignment) => assignment.employee,
            );

            const selfUser = await db.user.findFirst({
              where: {
                AND: [{ id: currentUser.id }, attendanceEligibleUserWhere],
              },
              select: {
                id: true,
                fullName: true,
                username: true,
                email: true,
                employeeCode: true,
                userType: true,
                functionalRole: true,
              },
            });

            const currentUserFunctionalRole =
              isRoleScopedManager(currentUser) &&
              currentUser.functionalRole &&
              currentUser.functionalRole !== "UNASSIGNED"
                ? currentUser.functionalRole
                : null;

            const sameRoleTeamLeads = currentUserFunctionalRole
              ? await db.user.findMany({
                  where: {
                    AND: [
                      attendanceEligibleUserWhere,
                      {
                        userType: "TEAM_LEAD",
                        functionalRole: currentUserFunctionalRole,
                      },
                    ],
                  },
                  select: {
                    id: true,
                    fullName: true,
                    username: true,
                    email: true,
                    employeeCode: true,
                    userType: true,
                    functionalRole: true,
                  },
                  orderBy: [{ fullName: "asc" }],
                })
              : [];

            const usersById = new Map<string, { id: string }>();
            if (selfUser) usersById.set(selfUser.id, selfUser);
            for (const user of assignedUsers) usersById.set(user.id, user);
            for (const user of sameRoleTeamLeads) usersById.set(user.id, user);
            return Array.from(usersById.values());
          })
    : [];

  const allowedUserIds = new Set(scopedUserOptions.map((user) => user.id));
  const selectedUserId = canSelectAttendanceUser
    ? requestedUserId && allowedUserIds.has(requestedUserId)
      ? requestedUserId
      : canAddManualLog ||
          isAdminProjectManager(currentUser) ||
          isProjectManager(currentUser)
        ? ""
        : (scopedUserOptions[0]?.id ?? "")
    : currentUser.id;

  if (!selectedUserId)
    return new Response("Select a user before exporting.", { status: 400 });

  const selectedUser = await db.user.findFirst({
    where: {
      AND: [
        { id: selectedUserId, isActive: true },
        canSelectAttendanceUser
          ? { id: { in: Array.from(allowedUserIds) } }
          : { id: currentUser.id },
      ],
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      employeeCode: true,
      leaveYearProfiles: {
        select: { year: true, shift: true },
        orderBy: { year: "desc" },
      },
    },
  });

  if (!selectedUser)
    return new Response("User was not found or is outside your access scope.", {
      status: 404,
    });

  const rangeStart = getDayBoundsUtcFromIstDateKey(fromDate).startUtc;
  const rangeEnd = getDayBoundsUtcFromIstDateKey(toDate).endUtc;
  const logs = await db.attendanceLog.findMany({
    where: {
      userId: selectedUser.id,
      attendanceDate: { gte: rangeStart, lt: rangeEnd },
    },
    orderBy: [{ attendanceDate: "desc" }, { markedAt: "desc" }],
  });

  const currentYear = Number(todayKey.slice(0, 4));
  const currentShift =
    selectedUser.leaveYearProfiles.find(
      (profile) => profile.year === currentYear,
    )?.shift ??
    selectedUser.leaveYearProfiles[0]?.shift ??
    "DAY";
  const shiftByYear = new Map(
    selectedUser.leaveYearProfiles.map((profile) => [
      profile.year,
      profile.shift,
    ]),
  );
  const getShiftForLog = (date: Date) => {
    const year = Number(getIstDateKey(date).slice(0, 4));
    return shiftByYear.get(year) ?? currentShift;
  };

  const rows: string[][] = [
    [
      "Attendance date",
      "Action",
      "Marked at",
      ...(canSeeLocationComparison
        ? [
            "Browser Co-Ordinates & Address",
            "Geocoding API Co-Ordinates & Address",
          ]
        : ["City/District", "State", "Coordinates"]),
    ],
    ...logs.map((log) => {
      const shift = getShiftForLog(log.attendanceDate);
      const markedAt = `${formatDateInIst(log.markedAt)} · ${
        log.type === "MARK_OUT"
          ? formatMarkOutTimeInIst(log.markedAt, log.attendanceDate, shift)
          : formatTimeInIst(log.markedAt)
      }`;

      const baseColumns = [
        formatDateInIst(log.attendanceDate),
        getActionLabel(log.type),
        markedAt,
      ];

      if (!canSeeLocationComparison) {
        return [
          ...baseColumns,
          getCityDistrictLabel(log.googleCity, log.googleDistrict),
          log.googleState || "—",
          formatCoordinates(log.latitude, log.longitude),
        ];
      }

      return [
        ...baseColumns,
        joinCoordinatesAndAddress({
          coordinates: formatCoordinates(log.latitude, log.longitude),
          accuracy: formatMeters(log.browserAccuracy),
          addressDetails: getAddressDetails({
            city: log.city,
            district: log.stateDistrict,
            town: log.town,
            village: log.village,
            state: log.state,
            address: log.browserFormattedAddress,
          }),
        }),
        joinCoordinatesAndAddress({
          coordinates: formatCoordinates(
            log.googleLatitude,
            log.googleLongitude,
          ),
          accuracy: formatMeters(log.googleAccuracy),
          difference: formatMeters(log.locationDistanceMeters),
          error: log.googleError,
          addressDetails: getAddressDetails({
            city: log.googleCity,
            district: log.googleDistrict,
            town: log.googleTown,
            village: log.googleVillage,
            state: log.googleState,
            address: log.googleFormattedAddress,
          }),
        }),
      ];
    }),
  ];

  const title = `Attendance History - ${selectedUser.fullName} - ${fromDate} to ${toDate}`;
  const fileName = buildFileName(
    selectedUser.fullName,
    fromDate,
    toDate,
    format,
  );

  if (format === "pdf") {
    return new Response(buildSimplePdf(rows, title), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }

  const buffer = await buildExcelBuffer(rows, title);
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
