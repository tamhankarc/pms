import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { formatMinutes } from "@/lib/utils";
import { canFullyModerateProject, isManager, isRoleScopedManager } from "@/lib/permissions";

export default async function TimeEntriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ clientId?: string; projectId?: string }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const selectedClientId = params.clientId ?? "all";
  const selectedProjectId = params.projectId ?? "all";

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

  const entries = await db.timeEntry.findMany({
    where:
      user.userType === "EMPLOYEE"
        ? {
            employeeId: user.id,
            projectId: { in: safeProjectIds },
            project: { is: { isActive: true, status: "ACTIVE" } },
            OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
          }
        : user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
          ? {
              OR: [
                {
                  employeeId: user.id,
                  projectId: { in: safeProjectIds },
                  project: { is: { isActive: true, status: "ACTIVE" } },
                  OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
                },
                {
                  employeeId: { in: scopedEmployeeIds.length ? scopedEmployeeIds : ["__none__"] },
                  projectId: { in: safeProjectIds },
                  project: { is: { isActive: true, status: "ACTIVE" } },
                  OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
                },
              ],
            }
          : {
              projectId: { in: safeProjectIds },
              project: { is: { isActive: true, status: "ACTIVE" } },
              OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
            },
    include: {
      employee: true,
      project: { include: { client: true } },
      subProject: true,
      movie: true,
      language: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const countryMap = new Map(countries.map((country) => [country.id, country.name]));
  const managedIds = new Set(scopedEmployeeIds);

  const clientOptions = Array.from(
    new Map(projects.map((project) => [project.client.id, { id: project.client.id, name: project.client.name }])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const projectOptions = projects.filter((project) =>
    selectedClientId === "all" ? true : project.clientId === selectedClientId,
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
        <form method="get" className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div className="grid gap-3 md:grid-cols-2">
            <SearchableCombobox
              id="clientId"
              name="clientId"
              defaultValue={selectedClientId}
              options={[
                { value: "all", label: "All clients" },
                ...clientOptions.map((client) => ({ value: client.id, label: client.name })),
              ]}
              placeholder="All clients"
              searchPlaceholder="Search clients..."
              emptyLabel="No clients found."
            />
            <SearchableCombobox
              id="projectId"
              name="projectId"
              defaultValue={selectedProjectId}
              options={[
                { value: "all", label: "All projects" },
                ...projectOptions.map((project) => ({ value: project.id, label: project.name })),
              ]}
              placeholder="All projects"
              searchPlaceholder="Search projects..."
              emptyLabel="No projects found."
            />
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary" type="submit">
              Apply
            </button>
            <Link className="btn-secondary" href="/time-entries">
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="table-base w-max min-w-[1450px]">
          <thead className="table-head">
            <tr>
              <th className="table-cell min-w-[240px] whitespace-nowrap">Employee</th>
              <th className="table-cell min-w-[190px] whitespace-nowrap">Client</th>
              <th className="table-cell min-w-[420px]">Project / Task</th>
              <th className="table-cell min-w-[120px] whitespace-nowrap">Work Date</th>
              <th className="table-cell min-w-[100px] whitespace-nowrap">Time</th>
              <th className="table-cell min-w-[130px] whitespace-nowrap">Status</th>
              <th className="table-cell min-w-[130px] whitespace-nowrap">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const canEdit =
                canFullyModerateProject(user) ||
                entry.employeeId === user.id ||
                ((user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) && managedIds.has(entry.employeeId));

              return (
                <tr key={entry.id}>
                  <td className="table-cell align-top min-w-[240px]">
                    <div className="font-medium text-slate-900">{entry.employee.fullName}</div>
                    <div className="break-words text-xs text-slate-500">{entry.notes || "—"}</div>
                  </td>

                  <td className="table-cell align-top min-w-[190px]">
                    <div className="break-words">{entry.project.client.name}</div>
                  </td>

                  <td className="table-cell align-top min-w-[420px]">
                    <div className="font-medium text-slate-900 break-words">{entry.project.name}</div>
                    <div className="break-words text-xs text-slate-500">{entry.subProject?.name ?? "No Sub Project"}</div>
                    <div className="break-words text-xs text-slate-500">{entry.taskName}</div>
                    <div className="break-words text-xs text-slate-500">
                      {entry.countryId ? countryMap.get(entry.countryId) ?? "—" : "No specific country"}
                    </div>
                    <div className="break-words text-xs text-slate-500">{entry.movie?.title ?? "No specific movie"}</div>
                    <div className="break-words text-xs text-slate-500">
                      {entry.language ? `${entry.language.name} (${entry.language.code})` : "No specific language"}
                    </div>
                  </td>

                  <td className="table-cell align-top min-w-[120px] whitespace-nowrap">
                    {new Date(entry.workDate).toLocaleDateString()}
                  </td>

                  <td className="table-cell align-top min-w-[100px] whitespace-nowrap">
                    {formatMinutes(entry.minutesSpent)}
                  </td>

                  <td className="table-cell align-top min-w-[130px] whitespace-nowrap">
                    <span
                      className={
                        entry.status === "APPROVED"
                          ? "badge-emerald"
                          : entry.status === "REJECTED"
                            ? "badge-rose"
                            : entry.status === "REVISED"
                              ? "badge-amber"
                              : "badge-slate"
                      }
                    >
                      {entry.status}
                    </span>
                  </td>

                  <td className="table-cell align-top min-w-[130px] whitespace-nowrap">
                    {canEdit ? (
                      <Link
                        className="btn-secondary inline-flex min-w-[72px] justify-center whitespace-nowrap text-xs"
                        href={`/time-entries/${entry.id}`}
                      >
                        Edit
                      </Link>
                    ) : (
                      <span className="whitespace-nowrap text-xs text-slate-400">No action</span>
                    )}
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
      </div>
    </div>
  );
}