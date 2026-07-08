import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ListReportFilters } from "@/components/forms/list-report-filters";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";
import { formatMinutes } from "@/lib/utils";
import {
  filterInvalidTimeEntries,
  getTimeEntryFilterData,
  getTimeEntryRows,
  type TimeEntryListSearchParams,
} from "@/lib/time-entry-reporting";

function buildExportHref(params: TimeEntryListSearchParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") query.set(key, value);
  });
  const queryString = query.toString();
  return `/time-entries/invalid-entries/export${queryString ? `?${queryString}` : ""}`;
}

export default async function InvalidTimeEntriesPage({
  searchParams,
}: {
  searchParams?: Promise<TimeEntryListSearchParams & { page?: string }>;
}) {
  const user = await requireUser();
  if (user.userType !== "ADMIN") redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);
  const filterData = await getTimeEntryFilterData(user);
  const { entries, filters } = await getTimeEntryRows({ user, params, filterData });
  const invalidRows = filterInvalidTimeEntries(entries);
  const { items: paginatedRows, currentPage, totalPages, totalItems, pageSize } = paginateItems(
    invalidRows,
    page,
    DEFAULT_PAGE_SIZE,
  );

  const exportParams: TimeEntryListSearchParams = {
    clientId: filters.selectedClientId,
    projectId: filters.selectedProjectId,
    subProjectId: filters.effectiveSubProjectId,
    fromDate: filters.selectedFromDate || undefined,
    toDate: filters.selectedToDate || undefined,
    userId: filters.effectiveUserId !== "all" ? filters.effectiveUserId : undefined,
    search: filters.selectedTextSearch || undefined,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invalid time entries"
        description="Admin-only list of existing time entries that do not satisfy current project mandatory dropdown rules."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-secondary" href="/time-entries">
              Back to Time Entries
            </Link>
            <Link className="btn-secondary" href={buildExportHref(exportParams)}>
              Export Excel
            </Link>
          </div>
        }
      />

      <div className="card p-4">
        <ListReportFilters
          basePath="/time-entries/invalid-entries"
          selectedFromDate={filters.selectedFromDate}
          selectedToDate={filters.selectedToDate}
          selectedClientId={filters.selectedClientId}
          selectedProjectId={filters.selectedProjectId}
          selectedSubProjectId={filters.effectiveSubProjectId}
          clientOptions={filterData.clientOptions}
          projectOptions={filterData.projectOptions}
          subProjectOptions={filterData.subProjectOptions}
          selectedUserId={filters.effectiveUserId}
          userOptions={filterData.adminUserOptions.map((option) => ({
            id: option.id,
            name: `${option.fullName}${option.functionalRole ? ` (${option.functionalRole.replace("_", " ")})` : ""}`,
          }))}
          showTextSearch
          selectedTextSearch={filters.selectedTextSearch}
          textSearchLabel="Task Name / Notes"
          textSearchPlaceholder="Search task name or notes..."
        />
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="table-base w-full min-w-[1120px] text-[13px] xl:text-sm">
          <thead className="table-head">
            <tr>
              <th className="table-cell min-w-[160px]">Employee</th>
              <th className="table-cell min-w-[160px]">Client</th>
              <th className="table-cell min-w-[220px]">Project / Task</th>
              <th className="table-cell min-w-[105px] whitespace-nowrap">Work Date</th>
              <th className="table-cell min-w-[80px] whitespace-nowrap">Time</th>
              <th className="table-cell min-w-[260px]">Invalid reason(s)</th>
              <th className="table-cell min-w-[80px] whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRows.map(({ entry, reasons }) => (
              <tr key={entry.id}>
                <td className="table-cell align-top">
                  <div className="font-medium text-slate-900">{entry.employee.fullName}</div>
                  <div className="text-xs text-slate-500">{entry.notes || "—"}</div>
                </td>
                <td className="table-cell align-top">{entry.project.client.name}</td>
                <td className="table-cell align-top">
                  <div className="font-medium text-slate-900">{entry.project.name}</div>
                  <div className="text-xs text-slate-500">{entry.subProject?.name ?? "No Sub Project"}</div>
                  <div className="text-xs text-slate-500">{entry.assetName?.name ?? entry.taskName}</div>
                  {entry.country ? <div className="text-xs text-slate-500">{entry.country.name}</div> : null}
                  {entry.movie ? <div className="text-xs text-slate-500">{entry.movie.title}</div> : null}
                  {entry.newsletter ? <div className="text-xs text-slate-500">{entry.newsletter.newsletterType} - {entry.newsletter.name}</div> : null}
                  {entry.language ? <div className="text-xs text-slate-500">{entry.language.name} ({entry.language.code})</div> : null}
                </td>
                <td className="table-cell align-top whitespace-nowrap">{new Date(entry.workDate).toLocaleDateString()}</td>
                <td className="table-cell align-top whitespace-nowrap">{formatMinutes(entry.minutesSpent)}</td>
                <td className="table-cell align-top">
                  <ul className="list-disc space-y-1 pl-4 text-xs text-red-700">
                    {reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </td>
                <td className="table-cell align-top whitespace-nowrap">
                  <Link className="btn-secondary text-xs" href={`/time-entries/${entry.id}`}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {invalidRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-cell text-center text-sm text-slate-500">
                  No invalid time entries found for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <PaginationControls
          basePath="/time-entries/invalid-entries"
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          searchParams={{
            clientId: filters.selectedClientId,
            projectId: filters.selectedProjectId,
            subProjectId: filters.effectiveSubProjectId !== "all" ? filters.effectiveSubProjectId : undefined,
            fromDate: filters.selectedFromDate || undefined,
            toDate: filters.selectedToDate || undefined,
            userId: filters.effectiveUserId !== "all" ? filters.effectiveUserId : undefined,
            search: filters.selectedTextSearch || undefined,
          }}
        />
      </div>
    </div>
  );
}
