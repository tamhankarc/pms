import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { createTimeEntryAction } from "@/lib/actions/time-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { formatMinutes } from "@/lib/utils";
import { canFullyModerateProject, isRoleScopedManager } from "@/lib/permissions";

export default async function TimeEntriesPage() {
  const user = await requireUser();

  const [projects, countries, supervisorEmployeeIds] = await Promise.all([
    getVisibleProjects(user),
    db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    (user.userType === "TEAM_LEAD" || isRoleScopedManager(user))
      ? db.employeeTeamLead.findMany({
          where: { teamLeadId: user.id },
          include: {
            employee: {
              select: { id: true, functionalRole: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const visibleProjectIds = projects.map((project) => project.id);
  const safeProjectIds = visibleProjectIds.length ? visibleProjectIds : ["__none__"];
  const scopedEmployeeIds = supervisorEmployeeIds
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
              employeeId: { in: scopedEmployeeIds.length ? scopedEmployeeIds : ["__none__"] },
              projectId: { in: safeProjectIds },
            }
          : {
              projectId: { in: safeProjectIds },
            },
    include: {
      employee: true,
      project: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const countryMap = new Map(countries.map((country) => [country.id, country.name]));
  const managedIds = new Set(scopedEmployeeIds);
  const canCreate = user.userType === "EMPLOYEE" || user.userType === "TEAM_LEAD";

  return (
    <div>
      <PageHeader
        title="Time entries"
        description={
          isRoleScopedManager(user)
            ? "Employees and Team Leads can submit time entries. Submitted entries can be edited by assigned Team Leads, Project Managers, Admins, or assigned Managers with the same functional role."
            : "Employees and Team Leads can submit time entries. Submitted entries can be edited only by assigned Team Leads, Admins, or Managers."
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        {canCreate ? (
          <form action={createTimeEntryAction} className="card p-6">
            <h2 className="section-title">Submit time entry</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="label">Project <span className="text-red-600">*</span></label>
                <select className="input" name="projectId" required>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Country</label>
                <select className="input" name="countryId">
                  <option value="">No specific country</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Work date <span className="text-red-600">*</span></label>
                <input className="input" type="date" name="workDate" required />
              </div>

              <div>
                <label className="label">Task name <span className="text-red-600">*</span></label>
                <input className="input" name="taskName" required />
              </div>

              <div>
                <label className="label">Minutes spent <span className="text-red-600">*</span></label>
                <input className="input" type="number" name="minutesSpent" min="5" required />
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input min-h-28" name="notes" />
              </div>

              <input type="hidden" name="isBillable" value="true" />
              <button className="btn-primary w-full">Submit entry</button>
            </div>
          </form>
        ) : (
          <div className="card p-6">
            <h2 className="section-title">Time entry moderation</h2>
            <p className="section-subtitle">
              Submitted time entries can be edited by Project Managers, Admins, assigned Team Leads, and assigned Managers with matching functional roles.
            </p>
          </div>
        )}

        <div className="table-wrap">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Employee</th>
                <th className="table-cell">Project / Task</th>
                <th className="table-cell">Time</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => {
                const canEdit =
                  canFullyModerateProject(user) ||
                  ((user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) && managedIds.has(entry.employeeId));

                return (
                  <tr key={entry.id}>
                    <td className="table-cell">
                      <div className="font-medium text-slate-900">{entry.employee.fullName}</div>
                      <div className="text-xs text-slate-500">{entry.notes || "—"}</div>
                    </td>
                    <td className="table-cell">
                      {entry.project.name}
                      <div className="text-xs text-slate-500">{entry.taskName}</div>
                      <div className="text-xs text-slate-500">
                        {entry.countryId ? countryMap.get(entry.countryId) ?? "—" : "No specific country"}
                      </div>
                    </td>
                    <td className="table-cell">{formatMinutes(entry.minutesSpent)}</td>
                    <td className="table-cell">
                      <span className="badge-slate">{entry.status}</span>
                    </td>
                    <td className="table-cell">
                      {canEdit ? (
                        <Link href={`/time-entries/${entry.id}`} className="text-sm font-medium text-blue-600 hover:underline">
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
                  <td colSpan={5} className="table-cell text-center text-sm text-slate-500">
                    No time entries found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
