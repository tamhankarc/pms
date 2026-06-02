import { redirect } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { addManualAttendanceLogAction } from "@/lib/actions/manual-attendance-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageManualAttendance } from "@/lib/permissions";
import {
  formatDateInIst,
  formatTimeInIst,
  getDayBoundsUtcFromIstDateKey,
  getIstDateKey,
} from "@/lib/ist";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

function isDateKey(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getMonthStart(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

function getShiftLabel(value?: string | null) {
  return value === "NIGHT" ? "Night" : "Day";
}

function getActionLabel(value: string) {
  return value === "MARK_OUT" ? "Mark-Out" : "Mark-In";
}

export default async function AttendanceHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{
    userId?: string;
    fromDate?: string;
    toDate?: string;
    page?: string;
    success?: string;
    error?: string;
  }>;
}) {
  const currentUser = await requireUser();
  if (!canManageManualAttendance(currentUser)) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const todayKey = getIstDateKey();
  const selectedUserId = params.userId ?? "";
  const fromDate = isDateKey(params.fromDate) ? params.fromDate! : getMonthStart(todayKey);
  const toDate = isDateKey(params.toDate) ? params.toDate! : todayKey;
  const currentPage = parsePageParam(params.page);

  const userOptions = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { userType: "EMPLOYEE" },
        { userType: "TEAM_LEAD" },
        {
          userType: "MANAGER",
          functionalRole: { notIn: ["PROJECT_MANAGER", "GENERAL_MANAGER"] },
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
  });

  const selectedUser = selectedUserId
    ? await db.user.findFirst({
        where: { id: selectedUserId, isActive: true },
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          employeeCode: true,
          leaveYearProfiles: {
            select: { year: true, shift: true },
            orderBy: { year: "desc" },
          },
        },
      })
    : null;

  const rangeStart = getDayBoundsUtcFromIstDateKey(fromDate).startUtc;
  const rangeEnd = getDayBoundsUtcFromIstDateKey(toDate).endUtc;

  const attendanceLogs = selectedUser
    ? await db.attendanceLog.findMany({
        where: {
          userId: selectedUser.id,
          attendanceDate: { gte: rangeStart, lt: rangeEnd },
        },
        orderBy: [{ attendanceDate: "desc" }, { markedAt: "desc" }],
      })
    : [];

  const paginatedLogs = paginateItems(attendanceLogs, currentPage, DEFAULT_PAGE_SIZE);
  const currentYear = Number(todayKey.slice(0, 4));
  const currentShift =
    selectedUser?.leaveYearProfiles.find((profile) => profile.year === currentYear)?.shift ??
    selectedUser?.leaveYearProfiles[0]?.shift ??
    "DAY";

  const shiftByYear = new Map(
    (selectedUser?.leaveYearProfiles ?? []).map((profile) => [profile.year, profile.shift]),
  );

  function getShiftForLog(date: Date) {
    const year = Number(getIstDateKey(date).slice(0, 4));
    return shiftByYear.get(year) ?? currentShift;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Attendance History"
        description="Review selected user attendance logs and manually add one Mark-In or Mark-Out entry when correction is required."
      />

      {params.success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {params.success}
        </div>
      ) : null}

      {params.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {params.error}
        </div>
      ) : null}

      <section className="card p-6">
        <h2 className="section-title">Select user and date range</h2>
        <p className="section-subtitle">Only active attendance-eligible users are listed.</p>

        <form data-auto-submit-filter="true" className="mt-5 grid gap-4 md:grid-cols-[minmax(260px,1.4fr)_repeat(2,minmax(150px,0.6fr))_auto] md:items-end">
          <div>
            <label htmlFor="attendance-user" className="form-label">
              User
            </label>
            <SearchableCombobox
              id="attendance-user"
              name="userId"
              options={userOptions.map((option) => ({
                value: option.id,
                label: `${option.fullName}${option.employeeCode ? ` (${option.employeeCode})` : ""}`,
                keywords: `${option.username} ${option.email} ${option.employeeCode ?? ""} ${option.userType} ${option.functionalRole ?? ""}`,
              }))}
              defaultValue={selectedUserId}
              placeholder="Search and select user"
              searchPlaceholder="Search by name, username, email, employee code"
              emptyLabel="No matching users found."
            />
          </div>

          <div>
            <label htmlFor="fromDate" className="form-label">
              From date
            </label>
            <input id="fromDate" name="fromDate" type="date" defaultValue={fromDate} className="input-field" />
          </div>

          <div>
            <label htmlFor="toDate" className="form-label">
              To date
            </label>
            <input id="toDate" name="toDate" type="date" defaultValue={toDate} className="input-field" />
          </div>

          <button type="submit" className="btn-primary">
            View history
          </button>
        </form>
      </section>

      <section className="card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="section-title">Attendance log history</h2>
            <p className="section-subtitle">
              {selectedUser
                ? `${selectedUser.fullName} · ${selectedUser.email}`
                : "Select a user to view attendance logs."}
            </p>
          </div>
          {selectedUser ? (
            <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Current shift: {getShiftLabel(currentShift)}
            </span>
          ) : null}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Attendance date</th>
                <th className="table-cell">Shift</th>
                <th className="table-cell">Action</th>
                <th className="table-cell">Marked at</th>
                <th className="table-cell">Location</th>
                <th className="table-cell">Coordinates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.items.map((log) => (
                <tr key={log.id}>
                  <td className="table-cell">{formatDateInIst(log.attendanceDate)}</td>
                  <td className="table-cell">{getShiftLabel(getShiftForLog(log.attendanceDate))}</td>
                  <td className="table-cell">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {getActionLabel(log.type)}
                    </span>
                  </td>
                  <td className="table-cell">
                    {formatDateInIst(log.markedAt)} · {formatTimeInIst(log.markedAt)}
                  </td>
                  <td className="table-cell">
                    {[log.city, log.town, log.village, log.stateDistrict, log.state]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="table-cell">
                    {Number(log.latitude).toFixed(7)}, {Number(log.longitude).toFixed(7)}
                  </td>
                </tr>
              ))}
              {paginatedLogs.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-sm text-slate-500">
                    {selectedUser ? "No attendance logs found for the selected range." : "Select a user to view logs."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <PaginationControls
          basePath="/attendance-history"
          currentPage={paginatedLogs.currentPage}
          totalPages={paginatedLogs.totalPages}
          totalItems={paginatedLogs.totalItems}
          pageSize={paginatedLogs.pageSize}
          searchParams={{ userId: selectedUserId || undefined, fromDate, toDate }}
        />
      </section>

      <section className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="section-title">Add manual attendance log</h2>
            <p className="section-subtitle">Add either Mark-In or Mark-Out. The form does not add both together.</p>
          </div>
        </div>

        <form action={addManualAttendanceLogAction} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="userId" value={selectedUserId} />
          <input type="hidden" name="fromDate" value={fromDate} />
          <input type="hidden" name="toDate" value={toDate} />

          <div className="xl:col-span-2">
            <label className="form-label">Selected user</label>
            <div className="input-field flex items-center bg-slate-50 text-slate-700">
              {selectedUser ? `${selectedUser.fullName} (${selectedUser.username})` : "Select a user above first"}
            </div>
          </div>

          <div>
            <label htmlFor="actionType" className="form-label">
              Action
            </label>
            <select id="actionType" name="actionType" required className="input-field" disabled={!selectedUser} defaultValue="MARK_IN">
              <option value="MARK_IN">Mark-In</option>
              <option value="MARK_OUT">Mark-Out</option>
            </select>
          </div>

          <div>
            <label htmlFor="attendanceDate" className="form-label">
              Attendance/work date
            </label>
            <input id="attendanceDate" name="attendanceDate" type="date" required defaultValue={todayKey} className="input-field" disabled={!selectedUser} />
          </div>

          <div>
            <label htmlFor="markedAtDate" className="form-label">
              Marked-at date (IST)
            </label>
            <input id="markedAtDate" name="markedAtDate" type="date" required defaultValue={todayKey} className="input-field" disabled={!selectedUser} />
          </div>

          <div>
            <label htmlFor="markedAtTime" className="form-label">
              Marked-at time (IST)
            </label>
            <input id="markedAtTime" name="markedAtTime" type="time" required className="input-field" disabled={!selectedUser} />
          </div>

          <div>
            <label htmlFor="city" className="form-label">
              City
            </label>
            <input id="city" name="city" type="text" className="input-field" placeholder="Optional" disabled={!selectedUser} />
          </div>

          <div>
            <label htmlFor="state" className="form-label">
              State
            </label>
            <input id="state" name="state" type="text" className="input-field" placeholder="Optional" disabled={!selectedUser} />
          </div>

          <div>
            <label htmlFor="latitude" className="form-label">
              Latitude
            </label>
            <input id="latitude" name="latitude" type="number" step="0.0000001" className="input-field" placeholder="0.0000000" disabled={!selectedUser} />
          </div>

          <div>
            <label htmlFor="longitude" className="form-label">
              Longitude
            </label>
            <input id="longitude" name="longitude" type="number" step="0.0000001" className="input-field" placeholder="0.0000000" disabled={!selectedUser} />
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <p className="text-xs text-slate-500">
              For night-shift Mark-Out after midnight, keep Attendance/work date as the shift start date and set Marked-at date to the next calendar date.
            </p>
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <button type="submit" className="btn-primary" disabled={!selectedUser}>
              Add attendance log
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
