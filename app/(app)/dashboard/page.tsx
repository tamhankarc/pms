import { FolderKanban, Hourglass, ClipboardList, TimerReset } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { StatCard } from "@/components/ui/stat-card";
import { requireUser } from "@/lib/auth";
import {
  getBillingDashboardData,
  getDashboardStats,
  getManagedEmployees,
  getVisibleProjects,
} from "@/lib/queries";
import { formatMinutes } from "@/lib/utils";
import { canSeeBillingDashboard } from "@/lib/permissions";
import type { BillingModel } from "@prisma/client";

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultBillingRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}

function normalizeDateInput(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    billingStartDate?: string;
    billingEndDate?: string;
    billingProjectId?: string;
    billingModel?: string;
  }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const defaultBillingRange = getDefaultBillingRange();
  const billingStartDate = normalizeDateInput(params.billingStartDate) ?? defaultBillingRange.startDate;
  const billingEndDate = normalizeDateInput(params.billingEndDate) ?? defaultBillingRange.endDate;
  const billingProjectId = params.billingProjectId ?? "";
  const billingModel = (params.billingModel ?? "") as BillingModel | "";

  const isEmployee = user.userType === "EMPLOYEE";
  const isTeamLead = user.userType === "TEAM_LEAD";
  const isAccountsBilling = user.userType === "ACCOUNTS" && user.functionalRole === "BILLING";
  const showBillingDashboard = canSeeBillingDashboard(user);

  const [stats, projects, managedEmployees, billingData] = await Promise.all([
    isAccountsBilling ? Promise.resolve(null) : getDashboardStats(user),
    isAccountsBilling ? Promise.resolve([]) : getVisibleProjects(user),
    user.userType === "TEAM_LEAD"
      ? getManagedEmployees(user.id)
      : Promise.resolve([]),
    showBillingDashboard
      ? getBillingDashboardData(user, billingStartDate, billingEndDate, billingProjectId || undefined, billingModel)
      : Promise.resolve({ rows: [], projectOptions: [] }),
  ]);

  if (isAccountsBilling) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Billing dashboard showing project hours by selected date range."
        />

        <section className="card p-6">
          <h2 className="section-title">Project billing hours</h2>
          <p className="section-subtitle">
            Filter by start date, end date, project, and billing type to review hours worked across projects.
          </p>

          <form className="mt-5 grid gap-3 md:grid-cols-[180px_180px_1fr_220px_auto]" method="get">
            <input className="input" type="date" name="billingStartDate" defaultValue={billingStartDate} />
            <input className="input" type="date" name="billingEndDate" defaultValue={billingEndDate} />
            <SearchableCombobox
              id="billingProjectId"
              name="billingProjectId"
              defaultValue={billingProjectId}
              options={[
                { value: "", label: "All projects" },
                ...billingData.projectOptions.map((project) => ({ value: project.id, label: project.name })),
              ]}
              placeholder="All projects"
              searchPlaceholder="Search projects..."
              emptyLabel="No projects found."
            />
            <select className="input" name="billingModel" defaultValue={billingModel}>
              <option value="">All billing types</option>
              <option value="HOURLY">Hourly</option>
              <option value="FIXED_FULL">Fixed - Full Project</option>
              <option value="FIXED_MONTHLY">Fixed - Monthly</option>
            </select>
            <button className="btn-secondary" type="submit">Apply</button>
          </form>

          <div className="mt-5 overflow-x-auto">
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  <th className="table-cell">Project name</th>
                  <th className="table-cell">Billing type</th>
                  <th className="table-cell">Hours worked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingData.rows.map((row) => (
                  <tr key={row.projectId}>
                    <td className="table-cell">{row.projectName}</td>
                    <td className="table-cell">{row.billingModel.replaceAll("_", " ")}</td>
                    <td className="table-cell">{row.workedHours}</td>
                  </tr>
                ))}
                {billingData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-cell text-center text-sm text-slate-500">
                      No projects found for the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

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
            value={String(stats?.projects ?? 0)}
            icon={<FolderKanban className="h-5 w-5" />}
          />
          <StatCard
            label="Approved effort"
            value={formatMinutes(stats?.approvedMinutes ?? 0)}
            icon={<Hourglass className="h-5 w-5" />}
          />
          <StatCard
            label="Approved billable effort"
            value={formatMinutes(stats?.approvedBillableMinutes ?? 0)}
            icon={<TimerReset className="h-5 w-5" />}
          />
          <StatCard
            label="Pending time entries"
            value={String(stats?.pendingEntries ?? 0)}
            icon={<ClipboardList className="h-5 w-5" />}
          />
        </div>
      ) : null}

      <div className={`${isEmployee ? "grid gap-6 xl:grid-cols-[1.4fr_1fr]" : "mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]"}`}>
        <section className="card p-6">
          <h2 className="section-title">Recent projects</h2>
          <p className="section-subtitle">
            Visibility respects direct project assignment, except for Admin, Manager, Team Lead, and Report Viewer accounts.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  <th className="table-cell">Project</th>
                  <th className="table-cell">Client</th>
                  <th className="table-cell">Billing</th>
                  <th className="table-cell">Assigned To</th>
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
                      {project.assignedUsers.map((row) => row.user.fullName).join(", ") || "—"}
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

      {showBillingDashboard ? (
        <section className="mt-8 card p-6">
          <h2 className="section-title">Project billing hours</h2>
          <p className="section-subtitle">
            Review project-level hours worked for a selected date range. This section is available to Admins, Project Managers, and Billing Accounts.
          </p>

          <form className="mt-5 grid gap-3 md:grid-cols-[180px_180px_1fr_220px_auto]" method="get">
            <input className="input" type="date" name="billingStartDate" defaultValue={billingStartDate} />
            <input className="input" type="date" name="billingEndDate" defaultValue={billingEndDate} />
            <SearchableCombobox
              id="billingProjectId"
              name="billingProjectId"
              defaultValue={billingProjectId}
              options={[
                { value: "", label: "All projects" },
                ...billingData.projectOptions.map((project) => ({ value: project.id, label: project.name })),
              ]}
              placeholder="All projects"
              searchPlaceholder="Search projects..."
              emptyLabel="No projects found."
            />
            <select className="input" name="billingModel" defaultValue={billingModel}>
              <option value="">All billing types</option>
              <option value="HOURLY">Hourly</option>
              <option value="FIXED_FULL">Fixed - Full Project</option>
              <option value="FIXED_MONTHLY">Fixed - Monthly</option>
            </select>
            <button className="btn-secondary" type="submit">Apply</button>
          </form>

          <div className="mt-5 overflow-x-auto">
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  <th className="table-cell">Project name</th>
                  <th className="table-cell">Billing type</th>
                  <th className="table-cell">Hours worked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingData.rows.map((row) => (
                  <tr key={row.projectId}>
                    <td className="table-cell">{row.projectName}</td>
                    <td className="table-cell">{row.billingModel.replaceAll("_", " ")}</td>
                    <td className="table-cell">{row.workedHours}</td>
                  </tr>
                ))}
                {billingData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-cell text-center text-sm text-slate-500">
                      No projects found for the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
