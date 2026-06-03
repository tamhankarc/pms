import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { requireUser } from "@/lib/auth";
import { canViewHRReports } from "@/lib/permissions";
import {
  getHRReportData,
  normalizeHRReportType,
  validateReportDateRange,
} from "@/lib/hr-reports";

export default async function HRReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string; fromDate?: string; toDate?: string }>;
}) {
  const user = await requireUser();
  if (!canViewHRReports(user)) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const type = normalizeHRReportType(params.type);
  const isLeaveCountsReport = type === "leave-counts";
  let error = "";
  let data: Awaited<ReturnType<typeof getHRReportData>> | null = null;

  try {
    if (isLeaveCountsReport) {
      data = await getHRReportData(type);
    } else {
      const range = validateReportDateRange(params.fromDate, params.toDate);
      data = await getHRReportData(type, range.fromDate, range.toDate);
    }
  } catch (caught) {
    error =
      caught instanceof Error ? caught.message : "Select a valid date range.";
  }

  const exportParams = new URLSearchParams({ type });
  if (!isLeaveCountsReport) {
    exportParams.set("fromDate", params.fromDate ?? "");
    exportParams.set("toDate", params.toDate ?? "");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Reports"
        description="Export attendance and leave reports for all leave-eligible employees."
      />
      <section className="card p-5">
        <AutoSubmitFilterForm className="grid gap-4 md:grid-cols-3" method="get">
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
              defaultValue={isLeaveCountsReport ? "" : (params.fromDate ?? "")}
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
              defaultValue={isLeaveCountsReport ? "" : (params.toDate ?? "")}
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
                {data.rows.slice(0, 20).map((row, rowIndex) => (
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
          {data.rows.length > 20 ? (
            <p className="border-t border-slate-200 px-6 py-3 text-sm text-slate-500">
              Preview shows the first 20 records. The exported report includes
              all records.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
