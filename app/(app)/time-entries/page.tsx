import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { formatMinutes } from "@/lib/utils";
import { TimeEntryCreateForm } from "@/components/forms/time-entry-create-form";
import { canFullyModerateProject, isManager } from "@/lib/permissions";

export default async function TimeEntriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ create?: string }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const showCreate = params.create === "1";

  const [projects, countries, movies, languages, supervisorAssignments, allActiveEmployees, allSubProjects] =
    await Promise.all([
      getVisibleProjects(user),
      db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      db.movie.findMany({ where: { isActive: true }, orderBy: { title: "asc" } }),
      db.language.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      user.userType === "TEAM_LEAD"
        ? db.employeeTeamLead.findMany({
            where: { teamLeadId: user.id },
            include: {
              employee: {
                select: { id: true, fullName: true, functionalRole: true, userType: true, isActive: true },
              },
            },
          })
        : Promise.resolve([]),
      isManager(user)
        ? db.user.findMany({
            where: { isActive: true, userType: "EMPLOYEE" },
            select: { id: true, fullName: true, userType: true },
            orderBy: { fullName: "asc" },
          })
        : Promise.resolve([]),
      db.subProject.findMany({
        where: { isActive: true },
        include: { assignments: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const visibleProjectIds = projects.map((project) => project.id);
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
        : user.userType === "TEAM_LEAD"
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
  const canCreate = user.userType === "EMPLOYEE" || user.userType === "TEAM_LEAD" || isManager(user);

  const assignableEmployees =
    user.userType === "TEAM_LEAD"
      ? [
          { id: user.id, fullName: user.fullName, userType: user.userType },
          ...supervisorAssignments
            .filter((row) => row.employee.functionalRole === user.functionalRole)
            .map((row) => ({
              id: row.employee.id,
              fullName: row.employee.fullName,
              userType: row.employee.userType,
            })),
        ]
      : isManager(user)
        ? [
            { id: user.id, fullName: user.fullName, userType: user.userType },
            ...allActiveEmployees.map((employee) => ({
              id: employee.id,
              fullName: employee.fullName,
              userType: employee.userType,
            })),
          ]
        : [{ id: user.id, fullName: user.fullName, userType: user.userType }];

  const dedupedAssignableEmployees = Array.from(
    new Map(assignableEmployees.map((employee) => [employee.id, employee])).values(),
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
          canCreate ? (
            <Link className="btn-primary" href="/time-entries?create=1">
              Add Time
            </Link>
          ) : null
        }
      />

      {showCreate && canCreate ? (
        <TimeEntryCreateForm
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
            clientName: project.client.name,
            showCountriesInTimeEntries: project.client.showCountriesInTimeEntries,
            showMoviesInEntries: project.client.showMoviesInEntries,
            showLanguagesInEntries: project.client.showLanguagesInEntries,
          }))}
          subProjects={allSubProjects.map((subProject) => ({
            id: subProject.id,
            name: subProject.name,
            projectId: subProject.projectId,
            assignedUserIds: subProject.assignments.map((row) => row.userId),
          }))}
          countries={countries.map((country) => ({ id: country.id, name: country.name }))}
          movies={movies.map((movie) => ({ id: movie.id, title: movie.title, clientId: movie.clientId }))}
          languages={languages.map((language) => ({
            id: language.id,
            name: language.name,
            code: language.code,
          }))}
          assignableEmployees={dedupedAssignableEmployees}
          defaultEmployeeId={user.id}
        />
      ) : null}

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Employee</th>
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
                ((user.userType === "TEAM_LEAD" || isManager(user)) && managedIds.has(entry.employeeId));

              return (
                <tr key={entry.id}>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">{entry.employee.fullName}</div>
                    <div className="text-xs text-slate-500">{entry.notes || "—"}</div>
                  </td>
                  <td className="table-cell">
                    {entry.project.name}
                    <div className="text-xs text-slate-500">{entry.subProject?.name ?? "No Sub Project"}</div>
                    <div className="text-xs text-slate-500">
                      {entry.countryId ? countryMap.get(entry.countryId) ?? "—" : "No specific country"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {entry.movie?.title ?? "No specific movie"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {entry.language ? `${entry.language.name} (${entry.language.code})` : "No specific language"}
                    </div>
                  </td>
                  <td className="table-cell">
                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(entry.workDate)}
                  </td>
                  <td className="table-cell">{formatMinutes(entry.minutesSpent)}</td>
                  <td className="table-cell">
                    <span className="badge-blue">{entry.status}</span>
                  </td>
                  <td className="table-cell">
                    {canEdit ? (
                      <Link href={`/time-entries/${entry.id}`} className="btn-secondary text-xs">
                        Edit
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 ? (
              <tr>
                <td className="table-cell text-center text-sm text-slate-500" colSpan={6}>
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