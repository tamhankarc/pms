import Link from "next/link";
import type { FunctionalRoleCode } from "@prisma/client";
import { ProjectHoursFilterForm, TaskDetailFilterForm } from "@/components/reports/report-filter-forms";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { isRoleScopedManager } from "@/lib/permissions";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultMonthRange() {
  const now = new Date();
  return {
    fromDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function getTodayRange() {
  const today = toDateInputValue(new Date());
  return { fromDate: today, toDate: today };
}

function normalizeDateInput(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function buildDateRange(fromDate: string, toDate: string) {
  return {
    fromBoundary: new Date(`${fromDate}T00:00:00`),
    toBoundary: new Date(`${toDate}T23:59:59.999`),
  };
}

function formatHours(minutes: number) {
  //return (minutes / 60).toFixed(2);
  return minutes;
}

function formatRole(role?: FunctionalRoleCode | "UNASSIGNED" | null) {
  if (!role || role === "UNASSIGNED") return "-";
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildExportHref(type: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams({ type });
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return `/reports/export?${search.toString()}`;
}

type ClientHoursRow = {
  clientId: string;
  clientName: string;
  totalMinutes: number;
};

type ProjectHoursRow = {
  clientName: string;
  projectName: string;
  subProjectName: string;
  totalMinutes: number;
};

type TaskDetailRow = {
  id: string;
  clientName: string;
  projectName: string;
  subProjectName: string;
  taskName: string;
  taskDescription: string;
  countryName: string;
  countryCode: string;
  employeeRole: string;
  totalMinutes: number;
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    clientFromDate?: string;
    clientToDate?: string;
    clientClientId?: string;
    clientPage?: string;
    projectFromDate?: string;
    projectToDate?: string;
    projectClientId?: string;
    projectProjectId?: string;
    projectPage?: string;
    taskFromDate?: string;
    taskToDate?: string;
    taskClientId?: string;
    taskProjectId?: string;
    taskSubProjectId?: string;
    taskCountryId?: string;
    taskPage?: string;
  }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const defaultMonthRange = getDefaultMonthRange();
  const defaultTodayRange = getTodayRange();

  const clientFromDate = normalizeDateInput(params.clientFromDate) ?? defaultMonthRange.fromDate;
  const clientToDate = normalizeDateInput(params.clientToDate) ?? defaultMonthRange.toDate;
  const clientClientId = params.clientClientId ?? "all";
  const clientPage = parsePageParam(params.clientPage);

  const projectFromDate = normalizeDateInput(params.projectFromDate) ?? defaultMonthRange.fromDate;
  const projectToDate = normalizeDateInput(params.projectToDate) ?? defaultMonthRange.toDate;
  const projectClientId = params.projectClientId ?? "all";
  const projectProjectId = params.projectProjectId ?? "all";
  const projectPage = parsePageParam(params.projectPage);

  const taskFromDate = normalizeDateInput(params.taskFromDate) ?? defaultTodayRange.fromDate;
  const taskToDate = normalizeDateInput(params.taskToDate) ?? defaultTodayRange.toDate;
  const taskClientId = params.taskClientId ?? "all";
  const taskProjectId = params.taskProjectId ?? "all";
  const taskSubProjectId = params.taskSubProjectId ?? "all";
  const taskCountryId = params.taskCountryId ?? "all";
  const taskPage = parsePageParam(params.taskPage);

  const visibleProjects = await getVisibleProjects(user);
  const visibleProjectIds = visibleProjects.map((project) => project.id);
  const safeProjectIds = visibleProjectIds.length ? visibleProjectIds : ["__none__"];

  const clientOptions = Array.from(
    new Map(
      visibleProjects.map((project) => [project.client.id, { id: project.client.id, name: project.client.name }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const projectOptions = visibleProjects
    .map((project) => ({ id: project.id, name: project.name, clientId: project.clientId }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const [subProjectOptions, countryOptions] = await Promise.all([
    db.subProject.findMany({
      where: {
        isActive: true,
        projectId: { in: safeProjectIds },
      },
      select: {
        id: true,
        name: true,
        projectId: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    db.country.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        isoCode: true,
      },
      orderBy: [{ isoCode: "asc" }, { name: "asc" }],
    }),
  ]);

  const normalizedSubProjectOptions = subProjectOptions.sort((a, b) => a.name.localeCompare(b.name));
  const normalizedCountryOptions = countryOptions
    .map((country) => ({ id: country.id, name: country.name, isoCode: country.isoCode ?? "-" }))
    .sort((a, b) => {
      if (a.isoCode !== b.isoCode) return a.isoCode.localeCompare(b.isoCode);
      return a.name.localeCompare(b.name);
    });

  const supervisorAssignments =
    user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
      ? await db.employeeTeamLead.findMany({
          where: { teamLeadId: user.id },
          include: {
            employee: {
              select: {
                id: true,
                functionalRole: true,
                isActive: true,
              },
            },
          },
        })
      : [];

  const scopedEmployeeIds = supervisorAssignments
    .filter((row) => row.employee.isActive && row.employee.functionalRole === user.functionalRole)
    .map((row) => row.employeeId);

  const visibleEmployeeIds =
    user.userType === "EMPLOYEE"
      ? [user.id]
      : user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
        ? Array.from(new Set([user.id, ...scopedEmployeeIds]))
        : undefined;

  const employeeWhereClause = visibleEmployeeIds
    ? { employeeId: { in: visibleEmployeeIds.length ? visibleEmployeeIds : ["__none__"] } }
    : {};

  const [{ fromBoundary: clientFromBoundary, toBoundary: clientToBoundary }, { fromBoundary: projectFromBoundary, toBoundary: projectToBoundary }, { fromBoundary: taskFromBoundary, toBoundary: taskToBoundary }] = [
    buildDateRange(clientFromDate, clientToDate),
    buildDateRange(projectFromDate, projectToDate),
    buildDateRange(taskFromDate, taskToDate),
  ];

  const [clientEntries, projectEntries, taskEntries] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: clientFromBoundary, lte: clientToBoundary },
        ...(clientClientId !== "all" ? { project: { is: { clientId: clientClientId } } } : {}),
        ...employeeWhereClause,
      },
      include: {
        project: { include: { client: true } },
      },
      orderBy: [{ workDate: "desc" }],
    }),
    db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: projectFromBoundary, lte: projectToBoundary },
        ...(projectClientId !== "all" ? { project: { is: { clientId: projectClientId } } } : {}),
        ...(projectProjectId !== "all" ? { projectId: projectProjectId } : {}),
        ...employeeWhereClause,
      },
      include: {
        project: { include: { client: true } },
        subProject: true,
      },
      orderBy: [{ workDate: "desc" }],
    }),
    db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: taskFromBoundary, lte: taskToBoundary },
        ...(taskClientId !== "all" ? { project: { is: { clientId: taskClientId } } } : {}),
        ...(taskProjectId !== "all" ? { projectId: taskProjectId } : {}),
        ...(taskSubProjectId !== "all" ? { subProjectId: taskSubProjectId } : {}),
        ...(taskCountryId !== "all" ? { countryId: taskCountryId } : {}),
        ...employeeWhereClause,
      },
      include: {
        employee: {
          select: {
            functionalRole: true,
          },
        },
        project: {
          include: {
            client: true,
          },
        },
        subProject: true,
        country: true,
      },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const clientMap = new Map<string, ClientHoursRow>();
  const projectMap = new Map<string, ProjectHoursRow>();

  for (const entry of clientEntries) {
    const clientKey = entry.project.clientId;
    const clientRow = clientMap.get(clientKey) ?? {
      clientId: entry.project.clientId,
      clientName: entry.project.client.name,
      totalMinutes: 0,
    };
    clientRow.totalMinutes += entry.minutesSpent;
    clientMap.set(clientKey, clientRow);
  }

  for (const entry of projectEntries) {
    const projectKey = `${entry.project.client.name}__${entry.project.name}__${entry.subProject?.name ?? "-"}`;
    const projectRow = projectMap.get(projectKey) ?? {
      clientName: entry.project.client.name,
      projectName: entry.project.name,
      subProjectName: entry.subProject?.name ?? "-",
      totalMinutes: 0,
    };
    projectRow.totalMinutes += entry.minutesSpent;
    projectMap.set(projectKey, projectRow);
  }

  const clientRows = Array.from(clientMap.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  const projectRows = Array.from(projectMap.values()).sort((a, b) => {
    if (a.clientName !== b.clientName) return a.clientName.localeCompare(b.clientName);
    if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
    return a.subProjectName.localeCompare(b.subProjectName);
  });
  const taskRows: TaskDetailRow[] = taskEntries.map((entry) => ({
    id: entry.id,
    clientName: entry.project.client.name,
    projectName: entry.project.name,
    subProjectName: entry.subProject?.name ?? "-",
    taskName: entry.taskName,
    taskDescription: entry.notes?.trim() ? entry.notes : "-",
    countryName: entry.country?.name ?? "-",
    countryCode: entry.country?.isoCode ?? "-",
    employeeRole: formatRole(entry.employee.functionalRole),
    totalMinutes: entry.minutesSpent,
  }));

  const paginatedClientRows = paginateItems(clientRows, clientPage, DEFAULT_PAGE_SIZE);
  const paginatedProjectRows = paginateItems(projectRows, projectPage, DEFAULT_PAGE_SIZE);
  const paginatedTaskRows = paginateItems(taskRows, taskPage, DEFAULT_PAGE_SIZE);

  const clientSearch = {
    clientFromDate,
    clientToDate,
    clientClientId: clientClientId === "all" ? undefined : clientClientId,
  };

  const projectSearch = {
    projectFromDate,
    projectToDate,
    projectClientId: projectClientId === "all" ? undefined : projectClientId,
    projectProjectId: projectProjectId === "all" ? undefined : projectProjectId,
  };

  const taskSearch = {
    taskFromDate,
    taskToDate,
    taskClientId: taskClientId === "all" ? undefined : taskClientId,
    taskProjectId: taskProjectId === "all" ? undefined : taskProjectId,
    taskSubProjectId: taskSubProjectId === "all" ? undefined : taskSubProjectId,
    taskCountryId: taskCountryId === "all" ? undefined : taskCountryId,
  };

  const allReportSearch = {
    ...clientSearch,
    ...(clientPage > 1 ? { clientPage: String(clientPage) } : {}),
    ...projectSearch,
    ...(projectPage > 1 ? { projectPage: String(projectPage) } : {}),
    ...taskSearch,
    ...(taskPage > 1 ? { taskPage: String(taskPage) } : {}),
  };

  const clientPreservedParams = {
    ...projectSearch,
    ...(projectPage > 1 ? { projectPage: String(projectPage) } : {}),
    ...taskSearch,
    ...(taskPage > 1 ? { taskPage: String(taskPage) } : {}),
  };

  const projectPreservedParams = {
    ...clientSearch,
    ...(clientPage > 1 ? { clientPage: String(clientPage) } : {}),
    ...taskSearch,
    ...(taskPage > 1 ? { taskPage: String(taskPage) } : {}),
  };

  const taskPreservedParams = {
    ...clientSearch,
    ...(clientPage > 1 ? { clientPage: String(clientPage) } : {}),
    ...projectSearch,
    ...(projectPage > 1 ? { projectPage: String(projectPage) } : {}),
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Time-entry reporting with report-specific filters and grouped hour summaries."
      />

      <section id="client-wise-hours" className="table-wrap">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="section-title">Client-wise hours</h2>
            <p className="section-subtitle">Grouped by client for the selected date range.</p>
          </div>
          <Link
            className="btn-secondary whitespace-nowrap"
            href={buildExportHref("client", {
              clientFromDate,
              clientToDate,
              clientClientId: clientClientId === "all" ? undefined : clientClientId,
            })}
          >
            Export CSV
          </Link>
        </div>
        <div className="relative z-20 border-b border-slate-100 px-4 py-4">
          <form className="flex flex-wrap items-end gap-3" method="get" action="/reports#client-wise-hours">
            <div className="w-full sm:w-[180px]">
              <input className="input w-full" type="date" name="clientFromDate" defaultValue={clientFromDate} />
            </div>
            <div className="w-full sm:w-[180px]">
              <input className="input w-full" type="date" name="clientToDate" defaultValue={clientToDate} />
            </div>
            <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
              <SearchableCombobox
                id="clientClientId"
                name="clientClientId"
                defaultValue={clientClientId}
                options={[
                  { value: "all", label: "All clients" },
                  ...clientOptions.map((client) => ({ value: client.id, label: client.name })),
                ]}
                placeholder="All clients"
                searchPlaceholder="Search clients..."
                emptyLabel="No clients found."
              />
            </div>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              {Object.entries(clientPreservedParams).map(([key, value]) =>
                value ? <input key={key} type="hidden" name={key} value={value} /> : null,
              )}
              <button className="btn-secondary" type="submit">Apply</button>
              <a
                className="btn-secondary"
                href={(() => {
                  const search = new URLSearchParams();
                  Object.entries(clientPreservedParams).forEach(([key, value]) => { if (value) search.set(key, value); });
                  const query = search.toString();
                  return query ? `/reports?${query}#client-wise-hours` : "/reports#client-wise-hours";
                })()}
              >
                Reset
              </a>
            </div>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Client</th>
                <th className="table-cell">Mins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedClientRows.items.map((row) => (
                <tr key={row.clientId}>
                  <td className="table-cell">{row.clientName}</td>
                  <td className="table-cell">{formatHours(row.totalMinutes)}</td>
                </tr>
              ))}
              {clientRows.length === 0 ? (
                <tr><td colSpan={2} className="table-cell text-center text-sm text-slate-500">No records found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          basePath="/reports"
          currentPage={paginatedClientRows.currentPage}
          totalPages={paginatedClientRows.totalPages}
          totalItems={paginatedClientRows.totalItems}
          pageSize={paginatedClientRows.pageSize}
          searchParams={allReportSearch}
          pageParam="clientPage"
        />
      </section>

      <section id="project-wise-hours" className="table-wrap">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="section-title">Project / Sub-Project-wise hours</h2>
            <p className="section-subtitle">Grouped by client, project, and sub-project for the selected date range.</p>
          </div>
          <Link
            className="btn-secondary whitespace-nowrap"
            href={buildExportHref("project", {
              projectFromDate,
              projectToDate,
              projectClientId: projectClientId === "all" ? undefined : projectClientId,
              projectProjectId: projectProjectId === "all" ? undefined : projectProjectId,
            })}
          >
            Export CSV
          </Link>
        </div>
        <div className="relative z-20 border-b border-slate-100 px-4 py-4">
          <ProjectHoursFilterForm
            action="/reports"
            anchor="#project-wise-hours"
            fromDate={projectFromDate}
            toDate={projectToDate}
            clientId={projectClientId}
            projectId={projectProjectId}
            clientOptions={clientOptions}
            projectOptions={projectOptions}
            preservedParams={projectPreservedParams}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Client</th>
                <th className="table-cell">Project Name</th>
                <th className="table-cell">Sub-Project Name</th>
                <th className="table-cell">Mins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProjectRows.items.map((row) => (
                <tr key={`${row.clientName}-${row.projectName}-${row.subProjectName}`}>
                  <td className="table-cell">{row.clientName}</td>
                  <td className="table-cell">{row.projectName}</td>
                  <td className="table-cell">{row.subProjectName}</td>
                  <td className="table-cell">{formatHours(row.totalMinutes)}</td>
                </tr>
              ))}
              {projectRows.length === 0 ? (
                <tr><td colSpan={4} className="table-cell text-center text-sm text-slate-500">No records found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          basePath="/reports"
          currentPage={paginatedProjectRows.currentPage}
          totalPages={paginatedProjectRows.totalPages}
          totalItems={paginatedProjectRows.totalItems}
          pageSize={paginatedProjectRows.pageSize}
          searchParams={allReportSearch}
          pageParam="projectPage"
        />
      </section>

      <section id="task-wise-hours" className="table-wrap">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="section-title">Task-wise detailed hours</h2>
            <p className="section-subtitle">Detailed task entries for the selected date range, project, and sub-project.</p>
          </div>
          <Link
            className="btn-secondary whitespace-nowrap"
            href={buildExportHref("task", {
              taskFromDate,
              taskToDate,
              taskClientId: taskClientId === "all" ? undefined : taskClientId,
              taskProjectId: taskProjectId === "all" ? undefined : taskProjectId,
              taskSubProjectId: taskSubProjectId === "all" ? undefined : taskSubProjectId,
              taskCountryId: taskCountryId === "all" ? undefined : taskCountryId,
            })}
          >
            Export CSV
          </Link>
        </div>
        <div className="relative z-20 border-b border-slate-100 px-4 py-4">
          <TaskDetailFilterForm
            action="/reports"
            anchor="#task-wise-hours"
            fromDate={taskFromDate}
            toDate={taskToDate}
            clientId={taskClientId}
            projectId={taskProjectId}
            subProjectId={taskSubProjectId}
            countryId={taskCountryId}
            clientOptions={clientOptions}
            projectOptions={projectOptions}
            subProjectOptions={normalizedSubProjectOptions}
            countryOptions={normalizedCountryOptions}
            preservedParams={taskPreservedParams}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell max-w-48 break-normal">Client Name</th>
                <th className="table-cell">Project Name</th>
                <th className="table-cell">Sub-Project Name</th>
                <th className="table-cell max-w-48 break-normal">Task Name</th>
                <th className="table-cell max-w-48 break-all">Task Description</th>
                <th className="table-cell">Country</th>
                <th className="table-cell">Employee Role</th>
                <th className="table-cell">Mins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTaskRows.items.map((row) => (
                <tr key={row.id}>
                  <td className="table-cell max-w-48 break-normal">{row.clientName}</td>
                  <td className="table-cell">{row.projectName}</td>
                  <td className="table-cell">{row.subProjectName}</td>
                  <td className="table-cell max-w-48 break-normal">{row.taskName}</td>
                  <td className="table-cell max-w-48 break-all">{row.taskDescription}</td>
                  <td className="table-cell">{row.countryCode}</td>
                  <td className="table-cell">{row.employeeRole}</td>
                  <td className="table-cell">{formatHours(row.totalMinutes)}</td>
                </tr>
              ))}
              {taskRows.length === 0 ? (
                <tr><td colSpan={8} className="table-cell text-center text-sm text-slate-500">No records found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          basePath="/reports"
          currentPage={paginatedTaskRows.currentPage}
          totalPages={paginatedTaskRows.totalPages}
          totalItems={paginatedTaskRows.totalItems}
          pageSize={paginatedTaskRows.pageSize}
          searchParams={allReportSearch}
          pageParam="taskPage"
        />
      </section>
    </div>
  );
}
