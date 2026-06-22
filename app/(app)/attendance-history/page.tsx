import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { addManualAttendanceLogAction } from "@/lib/actions/manual-attendance-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
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
import {
  DEFAULT_PAGE_SIZE,
  paginateItems,
  parsePageParam,
} from "@/lib/pagination";

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

function formatDecimalNumber(value: unknown, fractionDigits: number) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(fractionDigits) : null;
}

function formatMeters(value: unknown) {
  const formatted = formatDecimalNumber(value, 2);
  return formatted ? `${formatted} m` : null;
}

function formatCoordinates(latitude: unknown, longitude: unknown) {
  const formattedLatitude = formatDecimalNumber(latitude, 7);
  const formattedLongitude = formatDecimalNumber(longitude, 7);
  return formattedLatitude && formattedLongitude
    ? `${formattedLatitude}, ${formattedLongitude}`
    : null;
}

function formatGoogleAddressDetails(log: {
  googleCity: string | null;
  googleDistrict: string | null;
  googleTown: string | null;
  googleVillage: string | null;
  googleState: string | null;
  googleFormattedAddress: string | null;
}) {
  const details = [
    log.googleCity ? `City: ${log.googleCity}` : null,
    log.googleDistrict ? `District: ${log.googleDistrict}` : null,
    log.googleTown ? `Town: ${log.googleTown}` : null,
    log.googleVillage ? `Village: ${log.googleVillage}` : null,
    log.googleState ? `State: ${log.googleState}` : null,
  ].filter((detail): detail is string => Boolean(detail));

  if (details.length === 0 && !log.googleFormattedAddress) return null;

  return { details, formattedAddress: log.googleFormattedAddress };
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
  if (!canViewAttendanceHistory(currentUser)) redirect("/dashboard");
  const canSelectAttendanceUser = canManageManualAttendance(currentUser);
  const canAddManualLog = canAddManualAttendance(currentUser);
  const canSeeLocationComparison =
    canViewAttendanceLocationComparison(currentUser);

  const params = (await searchParams) ?? {};
  const todayKey = getIstDateKey();

  const fromDate = isDateKey(params.fromDate)
    ? params.fromDate!
    : getMonthStart(todayKey);
  const toDate = isDateKey(params.toDate) ? params.toDate! : todayKey;
  const currentPage = parsePageParam(params.page);

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

  const userSelect = {
    id: true,
    fullName: true,
    username: true,
    email: true,
    employeeCode: true,
    userType: true,
    functionalRole: true,
  };

  const scopedUserOptions = canSelectAttendanceUser
    ? canAddManualLog ||
      isAdminProjectManager(currentUser) ||
      isProjectManager(currentUser)
      ? await db.user.findMany({
          where: attendanceEligibleUserWhere,
          select: userSelect,
          orderBy: [{ fullName: "asc" }],
        })
      : await db.employeeTeamLead
          .findMany({
            where: {
              teamLeadId: currentUser.id,
              employee: attendanceEligibleUserWhere,
            },
            include: {
              employee: {
                select: userSelect,
              },
            },
            orderBy: {
              employee: {
                fullName: "asc",
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
              select: userSelect,
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
                  select: userSelect,
                  orderBy: [{ fullName: "asc" }],
                })
              : [];

            const usersById = new Map<
              string,
              | (typeof assignedUsers)[number]
              | (typeof sameRoleTeamLeads)[number]
            >();

            if (selfUser) {
              usersById.set(selfUser.id, selfUser);
            }

            for (const user of assignedUsers) {
              usersById.set(user.id, user);
            }

            for (const user of sameRoleTeamLeads) {
              usersById.set(user.id, user);
            }

            return Array.from(usersById.values()).sort((a, b) =>
              a.fullName.localeCompare(b.fullName),
            );
          })
    : [];

  const allowedUserIds = new Set(scopedUserOptions.map((user) => user.id));

  const selectedUserId = canSelectAttendanceUser
    ? params.userId && allowedUserIds.has(params.userId)
      ? params.userId
      : canAddManualLog ||
          isAdminProjectManager(currentUser) ||
          isProjectManager(currentUser)
        ? ""
        : (scopedUserOptions[0]?.id ?? "")
    : currentUser.id;

  const selectedUser = selectedUserId
    ? await db.user.findFirst({
        where: {
          AND: [
            {
              id: selectedUserId,
              isActive: true,
            },
            canSelectAttendanceUser
              ? {
                  id: {
                    in: Array.from(allowedUserIds),
                  },
                }
              : { id: currentUser.id },
          ],
        },
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

  const paginatedLogs = paginateItems(
    attendanceLogs,
    currentPage,
    DEFAULT_PAGE_SIZE,
  );
  const currentYear = Number(todayKey.slice(0, 4));
  const currentShift =
    selectedUser?.leaveYearProfiles.find(
      (profile) => profile.year === currentYear,
    )?.shift ??
    selectedUser?.leaveYearProfiles[0]?.shift ??
    "DAY";

  const shiftByYear = new Map(
    (selectedUser?.leaveYearProfiles ?? []).map((profile) => [
      profile.year,
      profile.shift,
    ]),
  );

  function getShiftForLog(date: Date) {
    const year = Number(getIstDateKey(date).slice(0, 4));
    return shiftByYear.get(year) ?? currentShift;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Attendance History"
        description="Review attendance logs. Users with attendance-history access can choose a user; all other users can view their own history only."
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
        <h2 className="section-title">
          {canSelectAttendanceUser
            ? "Select user and date range"
            : "Select date range"}
        </h2>
        <p className="section-subtitle">
          {canSelectAttendanceUser
            ? "Only active attendance-eligible users are listed."
            : "You can view your own attendance history for the selected range."}
        </p>

        <form
          data-auto-submit-filter="true"
          className={
            canSelectAttendanceUser
              ? "mt-5 grid gap-4 md:grid-cols-[minmax(260px,1.4fr)_repeat(2,minmax(150px,0.6fr))_auto] md:items-end"
              : "mt-5 grid gap-4 md:grid-cols-[repeat(2,minmax(150px,0.6fr))_auto] md:items-end"
          }
        >
          {canSelectAttendanceUser ? (
            <div>
              <label htmlFor="attendance-user" className="form-label">
                User
              </label>
              <SearchableCombobox
                id="attendance-user"
                name="userId"
                options={scopedUserOptions.map((option) => ({
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
          ) : null}

          <div>
            <label htmlFor="fromDate" className="form-label">
              From date
            </label>
            <input
              id="fromDate"
              name="fromDate"
              type="date"
              defaultValue={fromDate}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="toDate" className="form-label">
              To date
            </label>
            <input
              id="toDate"
              name="toDate"
              type="date"
              defaultValue={toDate}
              className="input-field"
            />
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
          <div className="flex flex-wrap gap-2">
            {selectedUser ? (
              <>
                <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Current shift: {getShiftLabel(currentShift)}
                </span>
                <Link
                  className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap"
                  href={`/attendance-history/export?${new URLSearchParams({
                    ...(canSelectAttendanceUser && selectedUserId
                      ? { userId: selectedUserId }
                      : {}),
                    fromDate,
                    toDate,
                    format: "xlsx",
                  }).toString()}`}
                >
                  <Download className="h-4 w-4" /> Export Excel (xlsx)
                </Link>
                <Link
                  className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap"
                  href={`/attendance-history/export?${new URLSearchParams({
                    ...(canSelectAttendanceUser && selectedUserId
                      ? { userId: selectedUserId }
                      : {}),
                    fromDate,
                    toDate,
                    format: "pdf",
                  }).toString()}`}
                >
                  <Download className="h-4 w-4" /> Export PDF
                </Link>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Attendance date</th>
                <th className="table-cell">Shift</th>
                <th className="table-cell">Action</th>
                <th className="table-cell">Marked at</th>
                <th className="table-cell">City/District</th>
                <th className="table-cell">State</th>
                {canSeeLocationComparison ? (
                  <th className="table-cell">Browser Coordinates</th>
                ) : null}
                {canSeeLocationComparison ? (
                  <th className="table-cell">Location Comparison</th>
                ) : null}
                {canAddManualLog ? (
                  <th className="table-cell text-right">Edit</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.items.map((log) => (
                <tr key={log.id}>
                  <td className="table-cell">
                    {formatDateInIst(log.attendanceDate)}
                  </td>
                  <td className="table-cell">
                    {getShiftLabel(getShiftForLog(log.attendanceDate))}
                  </td>
                  <td className="table-cell">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {getActionLabel(log.type)}
                    </span>
                  </td>
                  <td className="table-cell">
                    {formatDateInIst(log.markedAt)} ·{" "}
                    {log.type === "MARK_OUT"
                      ? formatMarkOutTimeInIst(
                          log.markedAt,
                          log.attendanceDate,
                          getShiftForLog(log.attendanceDate),
                        )
                      : formatTimeInIst(log.markedAt)}
                  </td>
                  <td className="table-cell">
                    {[log.city].filter(Boolean).join(", ") ||
                      [log.town, log.village, log.stateDistrict]
                        .filter(Boolean)
                        .join(", ") ||
                      "—"}
                  </td>
                  <td className="table-cell">
                    {[log.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  {canSeeLocationComparison ? (
                    <td className="table-cell">
                      <div>
                        {formatCoordinates(log.latitude, log.longitude) ?? "—"}
                      </div>
                      {formatMeters(log.browserAccuracy) ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Accuracy: {formatMeters(log.browserAccuracy)}
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                  {canSeeLocationComparison ? (
                    <td className="table-cell min-w-64 text-sm text-slate-700">
                      {formatCoordinates(
                        log.googleLatitude,
                        log.googleLongitude,
                      ) ? (
                        <div className="space-y-1">
                          <div>
                            Google:{" "}
                            {formatCoordinates(
                              log.googleLatitude,
                              log.googleLongitude,
                            )}
                          </div>
                          {formatMeters(log.googleAccuracy) ? (
                            <div>
                              Google accuracy:{" "}
                              {formatMeters(log.googleAccuracy)}
                            </div>
                          ) : null}
                          {formatGoogleAddressDetails(log) ? (
                            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                              <div className="font-semibold text-slate-700">
                                Google address details
                              </div>
                              {formatGoogleAddressDetails(log)?.details
                                .length ? (
                                <div className="mt-1 space-y-0.5">
                                  {formatGoogleAddressDetails(log)?.details.map(
                                    (detail) => (
                                      <div key={detail}>{detail}</div>
                                    ),
                                  )}
                                </div>
                              ) : null}
                              {formatGoogleAddressDetails(log)
                                ?.formattedAddress ? (
                                <div className="mt-1">
                                  Address:{" "}
                                  {
                                    formatGoogleAddressDetails(log)
                                      ?.formattedAddress
                                  }
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {formatMeters(log.locationDistanceMeters) ? (
                            <div>
                              Difference:{" "}
                              {formatMeters(log.locationDistanceMeters)}
                            </div>
                          ) : null}
                        </div>
                      ) : log.googleError ? (
                        <div className="text-xs text-amber-700">
                          Google error: {log.googleError}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  {canAddManualLog ? (
                    <td className="table-cell text-right">
                      <Link
                        className="btn-secondary inline-flex px-3 py-1.5 text-xs"
                        href={`/attendance-history/${log.id}/edit?${new URLSearchParams(
                          {
                            userId: selectedUserId,
                            fromDate,
                            toDate,
                            ...(currentPage > 1
                              ? { page: String(currentPage) }
                              : {}),
                          },
                        ).toString()}`}
                      >
                        Edit
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
              {paginatedLogs.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      6 +
                      (canSeeLocationComparison ? 2 : 0) +
                      (canAddManualLog ? 1 : 0)
                    }
                    className="table-cell text-center text-sm text-slate-500"
                  >
                    {selectedUser
                      ? "No attendance logs found for the selected range."
                      : "Select a user to view logs."}
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
          searchParams={{
            ...(canSelectAttendanceUser
              ? { userId: selectedUserId || undefined }
              : {}),
            fromDate,
            toDate,
          }}
        />
      </section>

      {canAddManualLog ? (
        <section className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="section-title">Add manual attendance log</h2>
              <p className="section-subtitle">
                Add either Mark-In or Mark-Out. The form does not add both
                together.
              </p>
            </div>
          </div>

          <form
            action={addManualAttendanceLogAction}
            className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <input type="hidden" name="userId" value={selectedUserId} />
            <input type="hidden" name="fromDate" value={fromDate} />
            <input type="hidden" name="toDate" value={toDate} />

            <div className="xl:col-span-2">
              <label className="form-label">Selected user</label>
              <div className="input-field flex items-center bg-slate-50 text-slate-700">
                {selectedUser
                  ? `${selectedUser.fullName} (${selectedUser.username})`
                  : "Select a user above first"}
              </div>
            </div>

            <div>
              <label htmlFor="actionType" className="form-label">
                Action
              </label>
              <SearchableCombobox
                id="actionType"
                name="actionType"
                required
                disabled={!selectedUser}
                defaultValue="MARK_IN"
                options={[
                  { value: "MARK_IN", label: "Mark-In" },
                  { value: "MARK_OUT", label: "Mark-Out" },
                ]}
                placeholder="Select action"
                searchPlaceholder="Search actions..."
                emptyLabel="No action found."
                buttonClassName="input-field"
              />
            </div>

            <div>
              <label htmlFor="attendanceDate" className="form-label">
                Attendance/work date
              </label>
              <input
                id="attendanceDate"
                name="attendanceDate"
                type="date"
                required
                defaultValue={todayKey}
                className="input-field"
                disabled={!selectedUser}
              />
            </div>

            <div>
              <label htmlFor="markedAtDate" className="form-label">
                Marked-at date (IST)
              </label>
              <input
                id="markedAtDate"
                name="markedAtDate"
                type="date"
                required
                defaultValue={todayKey}
                className="input-field"
                disabled={!selectedUser}
              />
            </div>

            <div>
              <label htmlFor="markedAtTime" className="form-label">
                Marked-at time (IST)
              </label>
              <input
                id="markedAtTime"
                name="markedAtTime"
                type="time"
                required
                className="input-field"
                disabled={!selectedUser}
              />
            </div>

            <div>
              <label htmlFor="city" className="form-label">
                City
              </label>
              <input
                id="city"
                name="city"
                type="text"
                className="input-field"
                placeholder="Optional"
                disabled={!selectedUser}
              />
            </div>

            <div>
              <label htmlFor="state" className="form-label">
                State
              </label>
              <input
                id="state"
                name="state"
                type="text"
                className="input-field"
                placeholder="Optional"
                disabled={!selectedUser}
              />
            </div>

            <div>
              <label htmlFor="latitude" className="form-label">
                Latitude
              </label>
              <input
                id="latitude"
                name="latitude"
                type="number"
                step="0.0000001"
                className="input-field"
                placeholder="0.0000000"
                disabled={!selectedUser}
              />
            </div>

            <div>
              <label htmlFor="longitude" className="form-label">
                Longitude
              </label>
              <input
                id="longitude"
                name="longitude"
                type="number"
                step="0.0000001"
                className="input-field"
                placeholder="0.0000000"
                disabled={!selectedUser}
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <p className="text-xs text-slate-500">
                For night-shift Mark-Out after midnight, keep Attendance/work
                date as the shift start date and set Marked-at date to the next
                calendar date.
              </p>
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <button
                type="submit"
                className="btn-primary"
                disabled={!selectedUser}
              >
                Add attendance log
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
