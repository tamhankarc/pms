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
    getVisibleProjects(user),
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
          }
        : user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
          ? {
              OR: [
                { employeeId: user.id, projectId: { in: safeProjectIds } },
                {
                  employeeId: { in: scopedEmployeeIds.length ? scopedEmployeeIds : ["__none__"] },
                  projectId: { in: safeProjectIds },
                },
              ],
            }
          : {
              projectId: { in: safeProjectIds },
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
            <select className="input" name="clientId" defaultValue={selectedClientId}>
              <option value="all">All clients</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
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

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Employee</th>
              <th className="table-cell">Client</th>
              <th className="table-cell">Project / Task</th>
              <th className="table-cell">Work Date</th>
              <th className="table-cell">Time</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const canEdit =
                canFullyModerateProject(user) ||
                entry.employeeId === user.id ||
                (user.userType === "TEAM_LEAD" && managedIds.has(entry.employeeId));

              return (
                <tr key={entry.id}>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">{entry.employee.fullName}</div>
                    <div className="text-xs text-slate-500">{entry.notes || "—"}</div>
                  </td>
                  <td className="table-cell">{entry.project.client.name}</td>
                  <td className="table-cell">
                    {entry.project.name}
                    <div className="text-xs text-slate-500">{entry.subProject?.name ?? "No Sub Project"}</div>
                    <div className="text-xs text-slate-500">{entry.taskName}</div>
                    <div className="text-xs text-slate-500">
                      {entry.countryId ? countryMap.get(entry.countryId) ?? "—" : "No specific country"}
                    </div>
                    <div className="text-xs text-slate-500">{entry.movie?.title ?? "No specific movie"}</div>
                    <div className="text-xs text-slate-500">
                      {entry.language ? `${entry.language.name} (${entry.language.code})` : "No specific language"}
                    </div>
                  </td>
                  <td className="table-cell">{new Date(entry.workDate).toLocaleDateString()}</td>
                  <td className="table-cell">{formatMinutes(entry.minutesSpent)}</td>
                  <td className="table-cell">
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
                  <td className="table-cell">
                    {canEdit ? (
                      <Link className="btn-secondary text-xs" href={`/time-entries/${entry.id}`}>
                        Edit
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">No action</span>
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
