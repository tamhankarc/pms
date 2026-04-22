import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  Hourglass,
  MapPin,
  TimerReset,
} from "lucide-react";
import type { BillingModel } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { ApprovedLeaveCalendar } from "@/components/ems/approved-leave-calendar";
import { AttendanceActionsCard } from "@/components/ems/attendance-actions-card";
import { AttendanceCalendar } from "@/components/ems/attendance-calendar";
import { ApproverAssignmentForm } from "@/components/ems/approver-assignment-form";
import { DashboardBillingFilters } from "@/components/dashboard-billing-filters";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getBillingDashboardData,
  getDashboardStats,
  getManagedEmployees,
  getVisibleProjects,
} from "@/lib/queries";
import {
  canMarkAttendance,
  canSeeBillingDashboard,
  canViewEMSAdminDashboard,
  isAdmin,
  isHR,
} from "@/lib/permissions";
import {
  getApprovedLeaveMonthCalendar,
  getApproverOptions,
  getAttendanceCalendarData,
  getEmployeeDashboardSnapshot,
  getGlobalApproverAssignmentIds,
  getPendingLeaveApprovalInfoForUser,
} from "@/lib/ems-queries";
import {
  clampMonthKey,
  formatDateInIst,
  formatTimeInIst,
  getInitialCalendarStartMonth,
  getIstDateKey,
  isMarkInWindow,
  isMarkOutWindow,
} from "@/lib/ist";
import { formatMinutes } from "@/lib/utils";

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

function getLeaveBreakupLabel(row: {
  leaveType: string;
  casualDaysUsed?: unknown;
  earnedDaysUsed?: unknown;
  unpaidDaysUsed?: unknown;
}) {
  const casual = Number(row.casualDaysUsed ?? 0);
  const earned = Number(row.earnedDaysUsed ?? 0);
  const unpaid = Number(row.unpaidDaysUsed ?? 0);
  const parts: string[] = [];
  if (casual > 0) parts.push(`Casual ${casual.toFixed(2)}`);
  if (earned > 0) parts.push(`Earned ${earned.toFixed(2)}`);
  if (unpaid > 0) parts.push(`Unpaid ${unpaid.toFixed(2)}`);
  return parts.length ? parts.join(" · ") : row.leaveType.replaceAll("_", " ");
}

function BillingDashboardSection({
  title,
  description,
  billingStartDate,
  billingEndDate,
  billingClientId,
  billingProjectId,
  billingModel,
  billingPage,
  leaveMonth,
  month,
  billingData,
}: {
  title: string;
  description: string;
  billingStartDate: string;
  billingEndDate: string;
  billingClientId: string;
  billingProjectId: string;
  billingModel: BillingModel | "";
  billingPage: string;
  leaveMonth?: string;
  month?: string;
  billingData: Awaited<ReturnType<typeof getBillingDashboardData>>;
}) {
  return (
    <section className="card p-6">
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">{description}</p>

      <DashboardBillingFilters
        billingStartDate={billingStartDate}
        billingEndDate={billingEndDate}
        billingClientId={billingClientId}
        billingProjectId={billingProjectId}
        billingModel={billingModel}
        leaveMonth={leaveMonth}
        month={month}
        clientOptions={billingData.clientOptions}
        projectOptions={billingData.projectOptions}
      />

      <div className="mt-5 overflow-x-auto">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Client name</th>
              <th className="table-cell">Project name</th>
              <th className="table-cell">Billing type</th>
              <th className="table-cell">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {billingData.rows.map((row) => (
              <tr key={row.projectId}>
                <td className="table-cell">{row.clientName}</td>
                <td className="table-cell">{row.projectName}</td>
                <td className="table-cell">{row.billingModel.replaceAll("_", " ")}</td>
                <td className="table-cell">{row.workedTime}</td>
              </tr>
            ))}
            {billingData.rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="table-cell text-center text-sm text-slate-500">
                  No projects found for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50/70">
              <td className="table-cell font-semibold text-slate-900" colSpan={3}>Total time</td>
              <td className="table-cell font-semibold text-slate-900">{formatMinutes(billingData.totalWorkedMinutes)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <PaginationControls
        basePath="/dashboard"
        currentPage={billingData.currentPage}
        totalPages={billingData.totalPages}
        totalItems={billingData.totalCount}
        pageSize={billingData.pageSize}
        pageParam="billingPage"
        searchParams={{
          billingStartDate,
          billingEndDate,
          billingClientId,
          billingProjectId,
          billingModel: billingModel || undefined,
          billingPage,
          leaveMonth,
          month,
        }}
        anchor="#project-billing-hours"
      />
    </section>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    billingStartDate?: string;
    billingEndDate?: string;
    billingClientId?: string;
    billingProjectId?: string;
    billingModel?: string;
    billingPage?: string;
    leaveMonth?: string;
    month?: string;
  }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const todayKey = getIstDateKey();
  const leaveMonth =
    params.leaveMonth && /^\d{4}-\d{2}$/.test(params.leaveMonth)
      ? params.leaveMonth
      : todayKey.slice(0, 7);

  const defaultBillingRange = getDefaultBillingRange();
  const billingStartDate = normalizeDateInput(params.billingStartDate) ?? defaultBillingRange.startDate;
  const billingEndDate = normalizeDateInput(params.billingEndDate) ?? defaultBillingRange.endDate;
  const billingClientId = params.billingClientId ?? "";
  const billingProjectId = params.billingProjectId ?? "";
  const billingModel = (params.billingModel ?? "") as BillingModel | "";
  const billingPageNumber = Number.parseInt(params.billingPage ?? "1", 10);
  const billingPage = Number.isFinite(billingPageNumber) && billingPageNumber > 0 ? billingPageNumber : 1;

  const isEmployee = user.userType === "EMPLOYEE";
  const isTeamLead = user.userType === "TEAM_LEAD";
  const isManager = user.userType === "MANAGER";
  const isAccountsBilling = user.userType === "ACCOUNTS" && user.functionalRole === "BILLING";

  const showBillingDashboard = canSeeBillingDashboard(user);
  const showAttendanceCard = canMarkAttendance(user);
  const showEMSAdminPanel = canViewEMSAdminDashboard(user);
  const userIsHR = isHR(user);
  const showApprovedLeaveBlock = isAdmin(user) || userIsHR || isManager || isTeamLead;
  const showManagementSummary = !isEmployee && !isTeamLead && !isManager && !userIsHR;
  const showProjectOverviewSection = !userIsHR;

  const resolvedJoiningDate = showAttendanceCard
    ? (
        await db.user.findUnique({
          where: { id: user.id },
          select: { joiningDate: true },
        })
      )?.joiningDate ?? null
    : null;

  const currentMonth = todayKey.slice(0, 7);
  const minMonth = getInitialCalendarStartMonth(resolvedJoiningDate);
  const focusMonth = showAttendanceCard
    ? clampMonthKey(
        params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth,
        minMonth,
        currentMonth,
      )
    : currentMonth;

  const [
    stats,
    projects,
    managedEmployees,
    billingData,
    pendingApprovalInfo,
    approvers,
    selectedApproverIds,
    leaveCalendarData,
    employeeSnapshot,
    focusCalendarData,
  ] = await Promise.all([
    isAccountsBilling ? Promise.resolve(null) : getDashboardStats(user),
    isAccountsBilling ? Promise.resolve([]) : getVisibleProjects(user),
    user.userType === "TEAM_LEAD" ? getManagedEmployees(user.id) : Promise.resolve([]),
    showBillingDashboard
      ? getBillingDashboardData(
          user,
          billingStartDate,
          billingEndDate,
          billingClientId || undefined,
          billingProjectId || undefined,
          billingModel,
          billingPage,
          10,
        )
      : Promise.resolve({
          rows: [],
          totalWorkedMinutes: 0,
          totalCount: 0,
          currentPage: 1,
          totalPages: 1,
          pageSize: 10,
          clientOptions: [],
          projectOptions: [],
        }),
    showAttendanceCard || showEMSAdminPanel ? getPendingLeaveApprovalInfoForUser(user) : Promise.resolve(null),
    showEMSAdminPanel ? getApproverOptions() : Promise.resolve([]),
    showAttendanceCard || showEMSAdminPanel ? getGlobalApproverAssignmentIds() : Promise.resolve([]),
    showApprovedLeaveBlock ? getApprovedLeaveMonthCalendar(leaveMonth) : Promise.resolve(null),
    showAttendanceCard ? getEmployeeDashboardSnapshot(user.id) : Promise.resolve(null),
    showAttendanceCard ? getAttendanceCalendarData(user.id, focusMonth, resolvedJoiningDate) : Promise.resolve(null),
  ]);

  const canOpenLeaveApprovals = isAdmin(user) || userIsHR || selectedApproverIds.includes(user.id);
  const pendingCount = pendingApprovalInfo?.count ?? 0;
  const pendingLabel = pendingApprovalInfo
    ? pendingApprovalInfo.mode === "total"
      ? `There ${pendingCount === 1 ? "is" : "are"} ${pendingCount} pending leave ${pendingCount === 1 ? "request" : "requests"} awaiting approver action.`
      : `There ${pendingCount === 1 ? "is" : "are"} ${pendingCount} pending leave ${pendingCount === 1 ? "request" : "requests"} assigned to you as approver.`
    : "";

  const hasMarkIn = Boolean(employeeSnapshot?.attendanceStatus.markIn);
  const hasMarkOut = Boolean(employeeSnapshot?.attendanceStatus.markOut);
  const shift = employeeSnapshot?.leaveBalance.shift ?? "DAY";
  const canMarkInNow = showAttendanceCard ? !hasMarkIn && isMarkInWindow(new Date(), shift) : false;
  const canMarkOutNow = showAttendanceCard ? hasMarkIn && !hasMarkOut && isMarkOutWindow(new Date(), shift) : false;

  if (isAccountsBilling) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Billing dashboard showing project hours by selected date range." />
        <div id="project-billing-hours">
          <BillingDashboardSection
            title="Project billing hours"
            description="Filter by start date, end date, client, project, and billing type to review time worked across projects."
            billingStartDate={billingStartDate}
            billingEndDate={billingEndDate}
            billingClientId={billingClientId}
            billingProjectId={billingProjectId}
            billingModel={billingModel}
            billingPage={String(billingPage)}
            billingData={billingData}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Combined delivery, billing, attendance, and leave overview for the current workspace."
        actions={
          showAttendanceCard ? (
            <Link className="btn-secondary" href="/leave-requests">
              Manage leave requests
            </Link>
          ) : undefined
        }
      />

      {pendingCount > 0 && canOpenLeaveApprovals ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">Pending Leave Approvals</p>
                <p className="mt-1 text-sm text-amber-800">
                  <span className="font-semibold">{pendingLabel}</span>
                </p>
              </div>
            </div>
            <Link className="btn-secondary" href="/leave-approvals">
              Open Leave Approvals
            </Link>
          </div>
        </section>
      ) : null}

      {showAttendanceCard && employeeSnapshot ? (
        <div className="space-y-6">
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Casual leaves remaining"
              value={employeeSnapshot.leaveBalance.casualLeaves.toFixed(2)}
              icon={<CalendarDays className="h-5 w-5" />}
            />
            <StatCard
              label="Earned leaves remaining"
              value={employeeSnapshot.leaveBalance.earnedLeaves.toFixed(2)}
              icon={<CalendarDays className="h-5 w-5" />}
            />
            <StatCard
              label="Today mark-in"
              value={formatTimeInIst(employeeSnapshot.attendanceStatus.markIn?.markedAt ?? null) || "Not marked"}
              icon={<TimerReset className="h-5 w-5" />}
            />
            <StatCard
              label="Today mark-out"
              value={formatTimeInIst(employeeSnapshot.attendanceStatus.markOut?.markedAt ?? null) || "Not marked"}
              icon={<TimerReset className="h-5 w-5" />}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <MapPin className="h-4 w-4" />
              Geo Detection rule
            </div>
            <p className="mt-2">
              Attendance actions work only when browser geolocation is enabled. Any attendance attempt without valid
              geolocation will sign you out.
            </p>
          </section>

          <AttendanceActionsCard
            canMarkIn={canMarkInNow}
            canMarkOut={canMarkOutNow}
            markInAt={formatTimeInIst(employeeSnapshot.attendanceStatus.markIn?.markedAt ?? null)}
            markOutAt={formatTimeInIst(employeeSnapshot.attendanceStatus.markOut?.markedAt ?? null)}
            city={employeeSnapshot.attendanceStatus.markOut?.city ?? employeeSnapshot.attendanceStatus.markIn?.city ?? null}
            shift={shift}
          />

          {focusCalendarData ? (
            <AttendanceCalendar
              focusMonthKey={focusMonth}
              focusData={focusCalendarData}
              todayKey={todayKey}
              queryParams={{
                billingStartDate,
                billingEndDate,
                billingProjectId,
                billingModel,
                leaveMonth,
              }}
            />
          ) : null}

          <section className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="section-title">Current leave snapshot</h2>
                <p className="section-subtitle">Recent active leave requests and their latest status.</p>
              </div>
              <Link className="btn-primary" href="/leave-requests/new">
                Create leave request
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {employeeSnapshot.leaveSummary.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{getLeaveBreakupLabel(row as never)}</p>
                      <p className="text-sm text-slate-500">
                        {formatDateInIst(row.startDate)} - {formatDateInIst(row.endDate)}
                      </p>
                    </div>
                    <span className="badge-blue">{row.status.replaceAll("_", " ")}</span>
                  </div>
                  {row.reason ? <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{row.reason}</p> : null}
                </div>
              ))}
              {employeeSnapshot.leaveSummary.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No current leave requests found.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {showApprovedLeaveBlock && leaveCalendarData ? (
        <ApprovedLeaveCalendar
          title="Employees on approved leave"
          subtitle="Select any date to see the employees on approved leave for that day."
          data={leaveCalendarData}
          basePath="/dashboard"
          extraSearchParams={{
            billingStartDate,
            billingEndDate,
            billingProjectId,
            billingModel,
            month: params.month,
          }}
        />
      ) : null}

      {showManagementSummary ? (
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
            label="Pending estimates"
            value={String(stats?.pendingEstimates ?? 0)}
            icon={<ClipboardList className="h-5 w-5" />}
          />
        </div>
      ) : null}

      {showProjectOverviewSection ? (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section className="card p-6">
            <h2 className="section-title">Recent projects</h2>
            <p className="section-subtitle">
              Visibility respects direct project assignment, except for Admin, Manager, Team Lead, Report Viewer, and HR accounts.
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
            <h2 className="section-title">Role overview</h2>
            <p className="section-subtitle">
              {isEmployee
                ? "You can add time entries and estimates only for projects assigned to you, and you can also manage your leave requests and attendance from this merged platform."
                : isTeamLead
                  ? "You can work on assigned projects, moderate employee effort within your scope, and act on leave approvals when assigned as approver."
                  : isManager
                    ? "Managers can comprehensively moderate project operations. EMS approval access depends on approver assignment rules."
                    : "This account can access broader project and employee management capabilities based on permissions."}
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
                  ? "Use Time Entries and Estimates for delivery work, and Leave Requests for attendance-related self-service."
                  : "This account can perform moderation and management actions based on its configured role permissions."}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {showEMSAdminPanel ? (
        <ApproverAssignmentForm approvers={approvers} selectedApproverIds={selectedApproverIds} />
      ) : null}

      {showBillingDashboard ? (
        <div id="project-billing-hours">
          <BillingDashboardSection
            title="Project billing hours"
            description="Review project-level time worked for a selected date range. This section is available to Admins, Project Managers, and Billing Accounts."
            billingStartDate={billingStartDate}
            billingEndDate={billingEndDate}
            billingClientId={billingClientId}
            billingProjectId={billingProjectId}
            billingModel={billingModel}
            billingPage={String(billingPage)}
            leaveMonth={leaveMonth}
            month={params.month}
            billingData={billingData}
          />
        </div>
      ) : null}
    </div>
  );
}
