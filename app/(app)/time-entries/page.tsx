import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ListReportFilters } from "@/components/forms/list-report-filters";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";
import { formatMinutes } from "@/lib/utils";
import {
  canFullyModerateProject,
  isManager,
  isRoleScopedManager,
  canAccessMenuItem,
} from "@/lib/permissions";
import { deleteTimeEntryAction } from "@/lib/actions/time-actions";
import {
  getInvalidTimeEntryReasons,
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
  return `/time-entries/export${queryString ? `?${queryString}` : ""}`;
}

export default async function TimeEntriesPage({
  searchParams,
}: {
  searchParams?: Promise<TimeEntryListSearchParams & { page?: string }>;
}) {
  const user = await requireUser();
  if (!canAccessMenuItem(user, "time-entries")) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);
  const filterData = await getTimeEntryFilterData(user);
  const { entries, filters, scopedEmployeeIds } = await getTimeEntryRows({
    user,
    params,
    filterData,
  });
  const managedIds = new Set(scopedEmployeeIds);

  const { items: paginatedEntries, currentPage, totalPages, totalItems, pageSize } = paginateItems(
    entries,
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
        title="Time entries"
        description={
          isManager(user)
            ? "Employees, Team Leads, and Managers can submit time entries. Employees can edit their own entries, and submitted entries can also be edited by assigned Team Leads, Project Managers, Admins, or assigned Managers with the same functional role."
            : "Employees and Team Leads can submit time entries. Employees can edit their own entries, and submitted entries can also be edited by assigned Team Leads, Admins, or Managers."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {user.userType === "ADMIN" ? (
              <Link className="btn-secondary" href="/time-entries/invalid-entries">
                Invalid Entries
              </Link>
            ) : null}
            <Link className="btn-secondary" href={buildExportHref(exportParams)}>
              Export Excel
            </Link>
            <Link className="btn-primary" href="/time-entries/new">
              Add Time
            </Link>
          </div>
        }
      />

      <div className="card p-4">
        <ListReportFilters
          basePath="/time-entries"
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
          showTextSearch={user.userType === "ADMIN"}
          selectedTextSearch={filters.selectedTextSearch}
          textSearchLabel="Task Name / Notes"
          textSearchPlaceholder="Search task name or notes..."
        />
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="table-base w-full min-w-[1160px] xl:min-w-[1200px] text-[13px] xl:text-sm">
          <thead className="table-head">
            <tr>
              <th className="table-cell min-w-[165px] xl:min-w-[180px]">Employee</th>
              <th className="table-cell min-w-[145px] xl:min-w-[160px]">Client</th>
              <th className="table-cell min-w-[190px] xl:min-w-[220px]">Project / Task</th>
              <th className="table-cell min-w-[190px] xl:min-w-[220px]">Validation</th>
              <th className="table-cell min-w-[100px] xl:min-w-[110px] whitespace-nowrap">Work Date</th>
              <th className="table-cell min-w-[80px] xl:min-w-[90px] whitespace-nowrap">Time</th>
              <th className="table-cell min-w-[96px] xl:min-w-[110px] whitespace-nowrap">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {paginatedEntries.map((entry) => {
              const invalidReasons = getInvalidTimeEntryReasons(entry);
              const isInvalidEntry = invalidReasons.length > 0;
              const isBilledEntry = entry.movie?.status === "COMPLETED_BILLED";
              const canEdit =
                !isBilledEntry &&
                (canFullyModerateProject(user) ||
                  entry.employeeId === user.id ||
                  ((user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) &&
                    managedIds.has(entry.employeeId)));
              const canDelete =
                !isBilledEntry &&
                ["ADMIN", "MANAGER", "TEAM_LEAD"].includes(user.userType) &&
                (canFullyModerateProject(user) ||
                  ((user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) &&
                    managedIds.has(entry.employeeId)));

              return (
                <tr
                  key={entry.id}
                  className={isInvalidEntry ? "bg-red-50/70" : undefined}
                >
                  <td className="table-cell align-top min-w-[165px] xl:min-w-[180px] max-w-[165px] xl:max-w-[180px]">
                    <div className="font-medium text-slate-900 break-words text-[13px] xl:text-sm">
                      {entry.employee.fullName}
                    </div>
                    <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                      {entry.notes || "—"}
                    </div>
                  </td>

                  <td className="table-cell align-top min-w-[145px] xl:min-w-[160px] max-w-[145px] xl:max-w-[160px]">
                    <div className="break-words text-[13px] xl:text-sm">{entry.project.client.name}</div>
                  </td>

                  <td className="table-cell align-top min-w-[190px] xl:min-w-[220px]">
                    <div className="font-medium text-slate-900 break-words text-[13px] xl:text-sm">
                      {entry.project.name}
                    </div>
                    {entry.project.id !== "cmnijd30h0001l404y6i8tb2y" && (
                      <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                        {entry.subProject?.name ?? "No Sub Project"}
                      </div>
                    )}
                    {entry.assetName ? (
                      <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                        {entry.assetName.name}
                      </div>
                    ) : (
                      <div className="text-[11px] xl:text-xs text-slate-500 break-words">{entry.taskName}</div>
                    )}
                    {entry.project.client.showCountriesInTimeEntries && (
                      <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                        {entry.country?.name ?? "No specific country"}
                      </div>
                    )}
                    {entry.project.id === "cmnijd30h0001l404y6i8tb2y" ? (
                      <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                        {entry.newsletter?.newsletterType ?? "No Newsletter Type"}
                      </div>
                    ) : (
                      entry.project.client.showMoviesInEntries && (
                        <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                          {entry.movie?.title ?? "No specific title"}
                        </div>
                      )
                    )}
                    {entry.project.id === "cmnijd30h0001l404y6i8tb2y" && (
                      <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                        {entry.newsletter?.name ?? "No Newsletter Name"}
                      </div>
                    )}
                    {entry.language && (
                      <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                        {entry.language.name} ({entry.language.code})
                      </div>
                    )}
                  </td>

                  <td className="table-cell align-top min-w-[190px] xl:min-w-[220px]">
                    {isInvalidEntry ? (
                      <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                        <div className="font-semibold">Invalid entry</div>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                          {invalidReasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  <td className="table-cell align-top min-w-[100px] xl:min-w-[110px] whitespace-nowrap text-[13px] xl:text-sm">
                    {new Date(entry.workDate).toLocaleDateString()}
                  </td>

                  <td className="table-cell align-top min-w-[80px] xl:min-w-[90px] whitespace-nowrap text-[13px] xl:text-sm">
                    {formatMinutes(entry.minutesSpent)}
                  </td>

                  <td className="table-cell align-top min-w-[96px] xl:min-w-[110px] whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      {canEdit ? (
                        <Link
                          className="btn-secondary inline-flex min-w-[64px] xl:min-w-[68px] justify-center whitespace-nowrap text-[11px] xl:text-xs px-2 xl:px-3"
                          href={`/time-entries/${entry.id}`}
                        >
                          Edit
                        </Link>
                      ) : null}
                      {canDelete ? (
                        <form action={deleteTimeEntryAction}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button
                            className="btn-secondary inline-flex min-w-[64px] xl:min-w-[68px] justify-center whitespace-nowrap px-2 text-[11px] xl:px-3 xl:text-xs"
                            type="submit"
                          >
                            Delete
                          </button>
                        </form>
                      ) : null}
                      {isBilledEntry ? (
                        <Link
                          className="btn-secondary inline-flex min-w-[64px] xl:min-w-[68px] justify-center whitespace-nowrap text-[11px] xl:text-xs px-2 xl:px-3"
                          href={`/time-entries/${entry.id}`}
                        >
                          View
                        </Link>
                      ) : null}
                      {!canEdit && !canDelete && !isBilledEntry ? (
                        <span className="text-[11px] xl:text-xs text-slate-400 whitespace-nowrap">No action</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}

            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-cell text-center text-sm text-slate-500">
                  No time entries found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <PaginationControls
          basePath="/time-entries"
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
