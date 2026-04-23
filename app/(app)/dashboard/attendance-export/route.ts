import { getSession } from "@/lib/auth";
import { canViewEMSAdminDashboard } from "@/lib/permissions";
import { getAdminDashboardData } from "@/lib/ems-queries";
import { formatTimeInIst, isWeekendDateKey } from "@/lib/ist";

function normalizeDateInput(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function sanitizeFileSegment(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "report"
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

function escapeCsvValue(value: string) {
  const normalized = value.replace(/\r?\n|\r/g, " ");
  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")).join("\n");
}

function buildFileName(mode: "present" | "absent", attendanceDate: string) {
  const weekendSegment = isWeekendDateKey(attendanceDate) ? "_weekend_working" : "";
  const modeSegment = mode === "absent" ? "absentee_list" : "presentee_list";
  return `${sanitizeFileSegment(modeSegment)}${weekendSegment}_${attendanceDate}_${getTimestamp()}.csv`;
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canViewEMSAdminDashboard(user)) return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(request.url);
  const attendanceDate = normalizeDateInput(searchParams.get("attendanceDate"));
  if (!attendanceDate) return new Response("Invalid attendanceDate", { status: 400 });
  const attendanceMode = searchParams.get("attendanceMode") === "absent" ? "absent" : "present";

  const dashboardData = await getAdminDashboardData(attendanceDate);
  const rows = dashboardData.attendanceRows.filter((row) =>
    attendanceMode === "present" ? Boolean(row.markIn) : !row.markIn,
  );

  const csvRows: string[][] = [
    ["Employee", "Functional Role", "In-Time", "Out-Time", "City"],
    ...rows.map((row) => [
      row.fullName,
      (row.functionalRole ?? "UNASSIGNED").replaceAll("_", " "),
      formatTimeInIst(row.markIn?.markedAt ?? null),
      formatTimeInIst(row.markOut?.markedAt ?? null),
      row.city || "—",
    ]),
  ];

  const csv = toCsv(csvRows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildFileName(attendanceMode, attendanceDate)}"`,
    },
  });
}
