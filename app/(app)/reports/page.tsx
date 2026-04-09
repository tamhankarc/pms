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

function getDefaultRange() {
  const now = new Date();
  return {
    fromDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function normalizeDateInput(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function buildDateRange(fromDate: string, toDate: string) {
  return {
    fromBoundary: new Date(`${fromDate}T00:00:00`),
    toBoundary: new Date(`${toDate}T23:59:59.999`),
  };
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

type EmployeeHoursRow = {
  employeeId: string;
  employeeName: string;
  clientName: string;
  projectName: string;
  subProjectName: string;
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
    employeeFromDate?: string;
    employeeToDate?: string;
    employeeClientId?: string;
    employeeProjectId?: string;
    employeeId?: string;
    employeePage?: string;
  }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const defaultRange = getDefaultRange();

  const clientFromDate = normalizeDateInput(params.clientFromDate) ?? defaultRange.fromDate;
  const clientToDate = normalizeDateInput(params.clientToDate) ?? defaultRange.toDate;
  const clientClientId = params.clientClientId ?? "all";
  const clientPage = parsePageParam(params.clientPage);

  const projectFromDate = normalizeDateInput(params.projectFromDate) ?? defaultRange.fromDate;
  const projectToDate = normalizeDateInput(params.projectToDate) ?? defaultRange.toDate;
  const projectClientId = params.projectClientId ?? "all";
  const projectProjectId = params.projectProjectId ?? "all";
  const projectPage = parsePageParam(params.projectPage);

  const employeeFromDate = normalizeDateInput(params.employeeFromDate) ?? defaultRange.fromDate;
  const employeeToDate = normalizeDateInput(params.employeeToDate) ?? defaultRange.toDate;
  const employeeClientId = params.employeeClientId ?? "all";
  const employeeProjectId = params.employeeProjectId ?? "all";
  const employeeId = params.employeeId ?? "all";
  const employeePage = parsePageParam(params.employeePage);

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

  const projectFilterOptions = projectOptions.filter((project) =>
    projectClientId === "all" ? true : project.clientId === projectClientId,
  );

  const employeeProjectFilterOptions = projectOptions.filter((project) =>
    employeeClientId === "all" ? true : project.clientId === employeeClientId,
  );

  const supervisorAssignments =
    user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
      ? await db.employeeTeamLead.findMany({
          where: { teamLeadId: user.id },
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
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

  const [{ fromBoundary: clientFromBoundary, toBoundary: clientToBoundary }, { fromBoundary: projectFromBoundary, toBoundary: projectToBoundary }, { fromBoundary: employeeFromBoundary, toBoundary: employeeToBoundary }] = [
    buildDateRange(clientFromDate, clientToDate),
    buildDateRange(projectFromDate, projectToDate),
    buildDateRange(employeeFromDate, employeeToDate),
  ];

  const [clientEntries, projectEntries, employeeEntries, employeeUsers] = await Promise.all([
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
        workDate: { gte: employeeFromBoundary, lte: employeeToBoundary },
        ...(employeeClientId !== "all" ? { project: { is: { clientId: employeeClientId } } } : {}),
        ...(employeeProjectId !== "all" ? { projectId: employeeProjectId } : {}),
        ...(employeeId !== "all" ? { employeeId } : {}),
        ...employeeWhereClause,
      },
      include: {
        employee: true,
        project: { include: { client: true } },
        subProject: true,
      },
      orderBy: [{ workDate: "desc" }],
    }),
    db.user.findMany({
      where: {
        isActive: true,
        ...(visibleEmployeeIds ? { id: { in: visibleEmployeeIds.length ? visibleEmployeeIds : ["__none__"] } } : {}),
      },
      select: {
        id: true,
        fullName: true,
      },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const clientMap = new Map<string, ClientHoursRow>();
  const projectMap = new Map<string, ProjectHoursRow>();
  const employeeMap = new Map<string, EmployeeHoursRow>();

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

  for (const entry of employeeEntries) {
    const employeeKey = `${entry.employeeId}__${entry.project.client.name}__${entry.project.name}__${entry.subProject?.name ?? "-"}`;
    const employeeRow = employeeMap.get(employeeKey) ?? {
      employeeId: entry.employeeId,
      employeeName: entry.employee.fullName,
      clientName: entry.project.client.name,
      projectName: entry.project.name,
      subProjectName: entry.subProject?.name ?? "-",
      totalMinutes: 0,
    };
    employeeRow.totalMinutes += entry.minutesSpent;
    employeeMap.set(employeeKey, employeeRow);
  }

  const clientRows = Array.from(clientMap.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  const projectRows = Array.from(projectMap.values()).sort((a, b) => {
    if (a.clientName !== b.clientName) return a.clientName.localeCompare(b.clientName);
    if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
    return a.subProjectName.localeCompare(b.subProjectName);
  });
  const employeeRows = Array.from(employeeMap.values()).sort((a, b) => {
    if (a.employeeName !== b.employeeName) return a.employeeName.localeCompare(b.employeeName);
    if (a.clientName !== b.clientName) return a.clientName.localeCompare(b.clientName);
    if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
    return a.subProjectName.localeCompare(b.subProjectName);
  });

  const paginatedClientRows = paginateItems(clientRows, clientPage, DEFAULT_PAGE_SIZE);
  const paginatedProjectRows = paginateItems(projectRows, projectPage, DEFAULT_PAGE_SIZE);
  const paginatedEmployeeRows = paginateItems(employeeRows, employeePage, DEFAULT_PAGE_SIZE);

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

  const employeeSearch = {
    employeeFromDate,
    employeeToDate,
    employeeClientId: employeeClientId === "all" ? undefined : employeeClientId,
    employeeProjectId: employeeProjectId === "all" ? undefined : employeeProjectId,
    employeeId: employeeId === "all" ? undefined : employeeId,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Time-entry reporting with report-specific filters and grouped hour summaries."
      />

      <section className="table-wrap">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="section-title">Client-wise hours</h2>
          <p className="section-subtitle">Grouped by client for the selected date range.</p>
        </div>
        <div className="border-b border-slate-100 px-4 py-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
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
              <button className="btn-secondary" type="submit">Apply</button>
              <a className="btn-secondary" href="/reports#client-wise-hours">Reset</a>
            </div>
          </form>
        </div>
        <div id="client-wise-hours" className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Client</th>
                <th className="table-cell">Hours</th>
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
          searchParams={clientSearch}
          pageParam="clientPage"
        />
      </section>

      <section className="table-wrap">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="section-title">Project / Sub-Project-wise hours</h2>
          <p className="section-subtitle">Grouped by client, project, and sub-project for the selected date range.</p>
        </div>
        <div className="border-b border-slate-100 px-4 py-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="w-full sm:w-[180px]">
              <input className="input w-full" type="date" name="projectFromDate" defaultValue={projectFromDate} />
            </div>
            <div className="w-full sm:w-[180px]">
              <input className="input w-full" type="date" name="projectToDate" defaultValue={projectToDate} />
            </div>
            <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
            <SearchableCombobox
              id="projectClientId"
              name="projectClientId"
              defaultValue={projectClientId}
              options={[
                { value: "all", label: "All clients" },
                ...clientOptions.map((client) => ({ value: client.id, label: client.name })),
              ]}
              placeholder="All clients"
              searchPlaceholder="Search clients..."
              emptyLabel="No clients found."
            />
            </div>
            <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
            <SearchableCombobox
              id="projectProjectId"
              name="projectProjectId"
              defaultValue={projectProjectId}
              options={[
                { value: "all", label: "All projects" },
                ...projectFilterOptions.map((project) => ({ value: project.id, label: project.name })),
              ]}
              placeholder="All projects"
              searchPlaceholder="Search projects..."
              emptyLabel="No projects found."
            />
            </div>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <button className="btn-secondary" type="submit">Apply</button>
              <a className="btn-secondary" href="/reports#project-wise-hours">Reset</a>
            </div>
          </form>
        </div>
        <div id="project-wise-hours" className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Client</th>
                <th className="table-cell">Project Name</th>
                <th className="table-cell">Sub-Project Name</th>
                <th className="table-cell">Hours</th>
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
          searchParams={projectSearch}
          pageParam="projectPage"
        />
      </section>

      <section className="table-wrap">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="section-title">Employee-wise hours</h2>
          <p className="section-subtitle">Grouped by employee with client, project, and sub-project context.</p>
        </div>
        <div className="border-b border-slate-100 px-4 py-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="w-full sm:w-[180px]">
              <input className="input w-full" type="date" name="employeeFromDate" defaultValue={employeeFromDate} />
            </div>
            <div className="w-full sm:w-[180px]">
              <input className="input w-full" type="date" name="employeeToDate" defaultValue={employeeToDate} />
            </div>
            <div className="w-full sm:w-[220px] md:w-[240px] lg:w-[260px]">
            <SearchableCombobox
              id="employeeClientId"
              name="employeeClientId"
              defaultValue={employeeClientId}
              options={[
                { value: "all", label: "All clients" },
                ...clientOptions.map((client) => ({ value: client.id, label: client.name })),
              ]}
              placeholder="All clients"
              searchPlaceholder="Search clients..."
              emptyLabel="No clients found."
            />
            </div>
            <div className="w-full sm:w-[220px] md:w-[240px] lg:w-[260px]">
            <SearchableCombobox
              id="employeeProjectId"
              name="employeeProjectId"
              defaultValue={employeeProjectId}
              options={[
                { value: "all", label: "All projects" },
                ...employeeProjectFilterOptions.map((project) => ({ value: project.id, label: project.name })),
              ]}
              placeholder="All projects"
              searchPlaceholder="Search projects..."
              emptyLabel="No projects found."
            />
            </div>
            <div className="w-full sm:w-[220px] md:w-[240px] lg:w-[260px]">
            <SearchableCombobox
              id="employeeId"
              name="employeeId"
              defaultValue={employeeId}
              options={[
                { value: "all", label: "All employees" },
                ...employeeUsers.map((employee) => ({ value: employee.id, label: employee.fullName })),
              ]}
              placeholder="All employees"
              searchPlaceholder="Search employees..."
              emptyLabel="No employees found."
            />
            </div>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <button className="btn-secondary" type="submit">Apply</button>
              <a className="btn-secondary" href="/reports#employee-wise-hours">Reset</a>
            </div>
          </form>
        </div>
        <div id="employee-wise-hours" className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Employee</th>
                <th className="table-cell">Client</th>
                <th className="table-cell">Project Name</th>
                <th className="table-cell">Sub-Project Name</th>
                <th className="table-cell">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEmployeeRows.items.map((row) => (
                <tr key={`${row.employeeId}-${row.clientName}-${row.projectName}-${row.subProjectName}`}>
                  <td className="table-cell">{row.employeeName}</td>
                  <td className="table-cell">{row.clientName}</td>
                  <td className="table-cell">{row.projectName}</td>
                  <td className="table-cell">{row.subProjectName}</td>
                  <td className="table-cell">{formatHours(row.totalMinutes)}</td>
                </tr>
              ))}
              {employeeRows.length === 0 ? (
                <tr><td colSpan={5} className="table-cell text-center text-sm text-slate-500">No records found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          basePath="/reports"
          currentPage={paginatedEmployeeRows.currentPage}
          totalPages={paginatedEmployeeRows.totalPages}
          totalItems={paginatedEmployeeRows.totalItems}
          pageSize={paginatedEmployeeRows.pageSize}
          searchParams={employeeSearch}
          pageParam="employeePage"
        />
      </section>
    </div>
  );
}
