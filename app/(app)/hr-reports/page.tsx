import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { requireUser } from "@/lib/auth";
import { canViewHRReports } from "@/lib/permissions";
import {
  getHRReportData,
  getHRReportUserOptions,
  normalizeHRReportShift,
  normalizeHRReportType,
  normalizeHRReportUserIds,
  validateReportDateRange,
} from "@/lib/hr-reports";
import { getIstDateKey } from "@/lib/ist";

export default async function HRReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    type?: string;
    fromDate?: string;
    toDate?: string;
    shift?: string;
    userId?: string | string[];
    page?: string;
  }>;
}) {
  const user = await requireUser();
  if (!canViewHRReports(user)) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const type = normalizeHRReportType(params.type);
  const todayKey = getIstDateKey();
  const shift = normalizeHRReportShift(params.shift);
  const selectedUserIds = normalizeHRReportUserIds(params.userId);
  const isAttendanceReport = type === "attendance";
  const isLeaveCountsReport = type === "leave-counts";
  const effectiveFromDate = isLeaveCountsReport
    ? ""
    : params.fromDate || todayKey;
  const effectiveToDate = isLeaveCountsReport ? "" : params.toDate || todayKey;
  const pageSize = 20;
  const requestedPage = Math.max(1, Number(params.page ?? "1") || 1);
  let error = "";
  let data: Awaited<ReturnType<typeof getHRReportData>> | null = null;
  const userOptions = await getHRReportUserOptions();

  try {
    if (isLeaveCountsReport) {
      data = await getHRReportData(type, undefined, undefined, "BOTH", selectedUserIds);
    } else {
      const range = validateReportDateRange(
        effectiveFromDate,
        effectiveToDate,
      );
      data = await getHRReportData(
        type,
        range.fromDate,
        range.toDate,
        isAttendanceReport ? shift : "BOTH",
        selectedUserIds,
      );
    }
  } catch (caught) {
    error =
      caught instanceof Error ? caught.message : "Select a valid date range.";
  }

  const totalItems = data?.rows.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const paginatedRows = data
    ? data.rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : [];

  const exportParams = new URLSearchParams({ type });
  if (!isLeaveCountsReport) {
    exportParams.set("fromDate", effectiveFromDate);
    exportParams.set("toDate", effectiveToDate);
  }
  if (isAttendanceReport) exportParams.set("shift", shift);
  for (const selectedUserId of selectedUserIds) exportParams.append("userId", selectedUserId);

  const paginationSearchParams = {
    type,
    fromDate: isLeaveCountsReport ? undefined : effectiveFromDate,
    toDate: isLeaveCountsReport ? undefined : effectiveToDate,
    shift: isAttendanceReport ? shift : undefined,
    userId: selectedUserIds.length ? selectedUserIds : undefined,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Reports"
        description="Export attendance and leave reports for all leave-eligible employees."
      />
      <section className="card p-5">
        <AutoSubmitFilterForm className="grid gap-4 md:grid-cols-5" method="get">
          <div>
            <label className="label" htmlFor="type">
              Report
            </label>
            <SearchableCombobox
              id="type"
              name="type"
              defaultValue={type}
              options={[
                { value: "attendance", label: "Per Day Attendance" },
                { value: "leaves", label: "Leaves with Status" },
                { value: "leave-counts", label: "Casual, Earned & Unpaid Leave Counts" },
              ]}
              placeholder="Select report"
              searchPlaceholder="Search reports..."
              emptyLabel="No report found."
            />
          </div>
          <div>
            <label className="label" htmlFor="fromDate">
              From date
            </label>
            <input
              className="input"
              disabled={isLeaveCountsReport}
              id="fromDate"
              name="fromDate"
              type="date"
              defaultValue={isLeaveCountsReport ? "" : effectiveFromDate}
            />
          </div>
          <div>
            <label className="label" htmlFor="toDate">
              To date
            </label>
            <input
              className="input"
              disabled={isLeaveCountsReport}
              id="toDate"
              name="toDate"
              type="date"
              defaultValue={isLeaveCountsReport ? "" : effectiveToDate}
            />
          </div>
          <div>
            <label className="label" htmlFor="shift">
              Shift
            </label>
            <SearchableCombobox
              id="shift"
              name="shift"
              defaultValue={isAttendanceReport ? shift : "BOTH"}
              disabled={!isAttendanceReport}
              options={[
                { value: "BOTH", label: "All shifts" },
                { value: "DAY", label: "Day shift" },
                { value: "NIGHT", label: "Night shift" },
              ]}
              placeholder="Select shift"
              searchPlaceholder="Search shifts..."
              emptyLabel="No shift found."
            />
          </div>
          <div>
            <label className="label" htmlFor="userId">
              User
            </label>
            <SearchableMultiSelect
              id="userId"
              name="userId"
              defaultValue={selectedUserIds}
              options={userOptions.map((option) => ({
                value: option.id,
                label: option.employeeCode
                  ? `${option.fullName} (${option.employeeCode})`
                  : option.fullName,
                keywords: `${option.email ?? ""} ${option.employeeCode ?? ""}`,
              }))}
              placeholder="All users"
              searchPlaceholder="Search users..."
              emptyLabel="No user found."
            />
          </div>
        </AutoSubmitFilterForm>
        {isLeaveCountsReport ? (
          <p className="mt-4 text-sm text-slate-600">
            Date range does not apply to this report. It shows current leave-year
            remaining Casual and Earned balances, together with approved Unpaid
            leaves.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {data ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="btn-secondary inline-flex items-center gap-2"
              href={`/hr-reports/export?${exportParams.toString()}&format=xlsx`}
            >
              <Download className="h-4 w-4" /> Export Excel (xlsx)
            </Link>
            <Link
              className="btn-secondary inline-flex items-center gap-2"
              href={`/hr-reports/export?${exportParams.toString()}&format=pdf`}
            >
              <Download className="h-4 w-4" /> Export PDF
            </Link>
          </div>
        ) : null}
      </section>
      {data ? (
        <section className="table-wrap">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="section-title">{data.title}</h2>
            <p className="section-subtitle">
              {data.periodLabel} · {data.rows.length} records
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  {data.headers.map((header) => (
                    <th className="table-cell" key={header}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td
                        className="table-cell"
                        key={`${rowIndex}-${cellIndex}`}
                      >
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.rows.length === 0 ? (
                  <tr>
                    <td
                      className="table-cell text-center text-sm text-slate-500"
                      colSpan={data.headers.length}
                    >
                      No records found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <PaginationControls
            basePath="/hr-reports"
            currentPage={currentPage}
            pageSize={pageSize}
            searchParams={paginationSearchParams}
            totalItems={data.rows.length}
            totalPages={totalPages}
          />
        </section>
      ) : null}
    </div>
  );
}
