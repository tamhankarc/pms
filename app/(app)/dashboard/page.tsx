import { FolderKanban, Hourglass, ClipboardList, TimerReset } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireUser } from "@/lib/auth";
import { getDashboardStats, getManagedEmployees, getVisibleProjects } from "@/lib/queries";
import { formatMinutes } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();

  const [stats, projects, managedEmployees] = await Promise.all([
    getDashboardStats(user),
    getVisibleProjects(user),
    user.userType === "TEAM_LEAD"
      ? getManagedEmployees(user.id)
      : Promise.resolve([]),
  ]);

  const isEmployee = user.userType === "EMPLOYEE";
  const isTeamLead = user.userType === "TEAM_LEAD";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Delivery, effort, and moderation overview for the current workspace."
      />

      {!isEmployee ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Visible projects"
            value={String(stats.projects)}
            icon={<FolderKanban className="h-5 w-5" />}
          />
          <StatCard
            label="Approved effort"
            value={formatMinutes(stats.approvedMinutes)}
            icon={<Hourglass className="h-5 w-5" />}
          />
          <StatCard
            label="Approved billable effort"
            value={formatMinutes(stats.approvedBillableMinutes)}
            icon={<TimerReset className="h-5 w-5" />}
          />
          <StatCard
            label="Pending time entries"
            value={String(stats.pendingEntries)}
            icon={<ClipboardList className="h-5 w-5" />}
          />
        </div>
      ) : null}

      <div className={`${isEmployee ? "grid gap-6 xl:grid-cols-[1.4fr_1fr]" : "mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]"}`}>
        <section className="card p-6">
          <h2 className="section-title">Recent projects</h2>
          <p className="section-subtitle">
            Visibility respects employee groups, except for Admin, Manager, Team Lead, and Report Viewer accounts.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  <th className="table-cell">Project</th>
                  <th className="table-cell">Client</th>
                  <th className="table-cell">Billing</th>
                  <th className="table-cell">Countries</th>
                  <th className="table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.slice(0, 8).map((project) => (
                  <tr key={project.id}>
                    <td className="table-cell">
                      <div className="font-medium text-slate-900">{project.name}</div>
                      <div className="text-xs text-slate-500">{project.code}</div>
                    </td>
                    <td className="table-cell">{project.client.name}</td>
                    <td className="table-cell">{project.billingModel.replaceAll("_", " ")}</td>
                    <td className="table-cell">
                      {project.countries.map((c) => c.country.name).join(", ")}
                    </td>
                    <td className="table-cell">
                      <span className="badge-blue">{project.status.replaceAll("_", " ")}</span>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-cell text-center text-sm text-slate-500">
                      No visible projects found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="section-title">{isEmployee ? "Your access" : "Moderation scope"}</h2>
          <p className="section-subtitle">
            {isEmployee
              ? "You can add time entries and estimates only for projects assigned to you. Submitted time entries can be edited only by your assigned Team Leads, Managers, or Admins. Estimates marked Revised can be corrected and resubmitted by you."
              : isTeamLead
                ? "You can add time entries for your assigned projects. You can review estimates only for employees assigned to you whose functional role matches your own, and you can edit submitted time entries only for employees assigned to you. Admins and Managers can comprehensively moderate any project."
                : "Admins and Managers can comprehensively moderate any project."}
          </p>

          {isTeamLead ? (
            <ul className="mt-5 space-y-3">
              {managedEmployees.map((row) => (
                <li key={row.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">{row.employee.fullName}</p>
                  <p className="text-sm text-slate-500">
                    {(row.employee.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Groups: {row.employee.employeeGroups.map((g) => g.employeeGroup.name).join(", ") || "—"}
                  </p>
                </li>
              ))}
              {managedEmployees.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No employees are currently assigned to you.
                </li>
              ) : null}
            </ul>
          ) : (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              {isEmployee
                ? "Use Time Entries and Estimates to work on your assigned projects. Your profile lets you manage contact and address details."
                : "This account can perform full project-level moderation based on role permissions."}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
