import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ListReportFilters } from "@/components/forms/list-report-filters";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";
import { formatMinutes } from "@/lib/utils";
import { canFullyModerateProject, isManager, isRoleScopedManager } from "@/lib/permissions";

function normalizeDateInput(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function buildFromBoundary(value: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function buildToBoundary(value: string) {
  return value ? new Date(`${value}T23:59:59.999`) : undefined;
}

export default async function TimeEntriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ clientId?: string; projectId?: string; fromDate?: string; toDate?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const selectedClientId = params.clientId ?? "all";
  const selectedProjectId = params.projectId ?? "all";
  const selectedFromDate = normalizeDateInput(params.fromDate);
  const selectedToDate = normalizeDateInput(params.toDate);
  const page = parsePageParam(params.page);

  const [projects, countries, supervisorAssignments] = await Promise.all([
    getVisibleProjects(user, { allowedStatuses: ["ACTIVE"] }),
    db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
      ? db.employeeTeamLead.findMany({
          where: { teamLeadId: user.id },
          include: {
            employee: {
              select: { id: true, fullName: true, functionalRole: true, userType: true, isActive: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const filteredProjects = projects.filter((project) => {
    const matchesClient = selectedClientId === "all" ? true : project.clientId === selectedClientId;
    const matchesProject = selectedProjectId === "all" ? true : project.id === selectedProjectId;
    return matchesClient && matchesProject;
  });

  const visibleProjectIds = filteredProjects.map((project) => project.id);
  const safeProjectIds = visibleProjectIds.length ? visibleProjectIds : ["__none__"];
  const scopedEmployeeIds = supervisorAssignments
    .filter((row) => row.employee.functionalRole === user.functionalRole)
    .map((row) => row.employeeId);

  const fromBoundary = buildFromBoundary(selectedFromDate);
  const toBoundary = buildToBoundary(selectedToDate);
  const workDateFilter = {
    ...(fromBoundary ? { gte: fromBoundary } : {}),
    ...(toBoundary ? { lte: toBoundary } : {}),
  };
  const hasWorkDateFilter = Object.keys(workDateFilter).length > 0;

  const entries = await db.timeEntry.findMany({
    where:
      user.userType === "EMPLOYEE"
        ? {
            employeeId: user.id,
            projectId: { in: safeProjectIds },
            project: { is: { isActive: true, status: "ACTIVE" } },
            OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
            ...(hasWorkDateFilter ? { workDate: workDateFilter } : {}),
          }
        : user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
          ? {
              OR: [
                {
                  employeeId: user.id,
                  projectId: { in: safeProjectIds },
                  project: { is: { isActive: true, status: "ACTIVE" } },
                  OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
                  ...(hasWorkDateFilter ? { workDate: workDateFilter } : {}),
                },
                {
                  employeeId: { in: scopedEmployeeIds.length ? scopedEmployeeIds : ["__none__"] },
                  projectId: { in: safeProjectIds },
                  project: { is: { isActive: true, status: "ACTIVE" } },
                  OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
                  ...(hasWorkDateFilter ? { workDate: workDateFilter } : {}),
                },
              ],
            }
          : {
              projectId: { in: safeProjectIds },
              project: { is: { isActive: true, status: "ACTIVE" } },
              OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
              ...(hasWorkDateFilter ? { workDate: workDateFilter } : {}),
            },
    include: {
      employee: true,
      project: { include: { client: true } },
      subProject: true,
      movie: true,
      language: true,
    },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
  });

  const countryMap = new Map(countries.map((country) => [country.id, country.name]));
  const managedIds = new Set(scopedEmployeeIds);

  const clientOptions = Array.from(
    new Map(
      projects.map((project) => [
        project.client.id,
        { id: project.client.id, name: project.client.name },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const { items: paginatedEntries, currentPage, totalPages, totalItems, pageSize } = paginateItems(
    entries,
    page,
    DEFAULT_PAGE_SIZE,
  );

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
          <Link className="btn-primary" href="/time-entries/new">
            Add Time
          </Link>
        }
      />

      <div className="card p-4">
        <ListReportFilters
          basePath="/time-entries"
          selectedFromDate={selectedFromDate}
          selectedToDate={selectedToDate}
          selectedClientId={selectedClientId}
          selectedProjectId={selectedProjectId}
          clientOptions={clientOptions}
          projectOptions={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
          }))}
        />
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="table-base w-full min-w-[1040px] xl:min-w-[1080px] text-[13px] xl:text-sm">
          <thead className="table-head">
            <tr>
              <th className="table-cell min-w-[165px] xl:min-w-[180px]">Employee</th>
              <th className="table-cell min-w-[145px] xl:min-w-[160px]">Client</th>
              <th className="table-cell min-w-[190px] xl:min-w-[220px]">Project / Task</th>
              <th className="table-cell min-w-[100px] xl:min-w-[110px] whitespace-nowrap">Work Date</th>
              <th className="table-cell min-w-[80px] xl:min-w-[90px] whitespace-nowrap">Time</th>
              <th className="table-cell min-w-[96px] xl:min-w-[110px] whitespace-nowrap">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {paginatedEntries.map((entry) => {
              const canEdit =
                canFullyModerateProject(user) ||
                entry.employeeId === user.id ||
                ((user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) &&
                  managedIds.has(entry.employeeId));

              return (
                <tr key={entry.id}>
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
                    <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                      {entry.subProject?.name ?? "No Sub Project"}
                    </div>
                    <div className="text-[11px] xl:text-xs text-slate-500 break-words">{entry.taskName}</div>
                    <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                      {entry.countryId ? countryMap.get(entry.countryId) ?? "—" : "No specific country"}
                    </div>
                    <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                      {entry.movie?.title ?? "No specific movie"}
                    </div>
                    <div className="text-[11px] xl:text-xs text-slate-500 break-words">
                      {entry.language
                        ? `${entry.language.name} (${entry.language.code})`
                        : "No specific language"}
                    </div>
                  </td>

                  <td className="table-cell align-top min-w-[100px] xl:min-w-[110px] whitespace-nowrap text-[13px] xl:text-sm">
                    {new Date(entry.workDate).toLocaleDateString()}
                  </td>

                  <td className="table-cell align-top min-w-[80px] xl:min-w-[90px] whitespace-nowrap text-[13px] xl:text-sm">
                    {formatMinutes(entry.minutesSpent)}
                  </td>

                  <td className="table-cell align-top min-w-[96px] xl:min-w-[110px] whitespace-nowrap">
                    {canEdit ? (
                      <Link
                        className="btn-secondary inline-flex min-w-[64px] xl:min-w-[68px] justify-center whitespace-nowrap text-[11px] xl:text-xs px-2 xl:px-3"
                        href={`/time-entries/${entry.id}`}
                      >
                        Edit
                      </Link>
                    ) : (
                      <span className="text-[11px] xl:text-xs text-slate-400 whitespace-nowrap">No action</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-cell text-center text-sm text-slate-500">
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
            clientId: selectedClientId,
            projectId: selectedProjectId,
            fromDate: selectedFromDate || undefined,
            toDate: selectedToDate || undefined,
          }}
        />
      </div>
    </div>
  );
}
