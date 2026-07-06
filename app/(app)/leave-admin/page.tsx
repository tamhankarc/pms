import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { canAccessMenuItem, isAdmin, isHR } from "@/lib/permissions";
import { formatUserTypeLabel } from "@/lib/display-labels";
import { getLeaveAdminList } from "@/lib/ems-queries";
import { createOfficialHolidayAction, deleteOfficialHolidayAction } from "@/lib/actions/hr-leave-admin-actions";
import { formatDateInIst } from "@/lib/ist";
import { getPastApprovedLeaveDeletionCandidates } from "@/lib/leave-admin-ledger";

const functionalRoleOptions = ["", "DEVELOPER", "QA", "DESIGNER", "LOCALIZATION", "DEVOPS", "PROJECT_MANAGER", "DIRECTOR", "GENERAL_MANAGER", "OTHER", "BILLING"];

export default async function LeaveAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; functionalRole?: string; userId?: string; oldLeavePage?: string }>;
}) {
  const user = await requireUser();
  if (!isHR(user) && !canAccessMenuItem(user, "leave-admin")) {
    return <div className="space-y-6"><PageHeader title="Leave Administration" description="Only Administration/HR can access this page." /></div>;
  }
  const params = (await searchParams) ?? {};
  const page = Number(params.page || 1);
  const data = await getLeaveAdminList({ functionalRole: params.functionalRole || "", userId: params.userId || "", page, pageSize: 10 });
  const oldLeavePage = Number(params.oldLeavePage || 1);
  const pastLeaves = isAdmin(user) && user.functionalRole === "OTHER"
    ? await getPastApprovedLeaveDeletionCandidates({ page: oldLeavePage, pageSize: 10 })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Leave Administration" description="Manage leave balances, shift, employment status, and official holidays for leave allowed users." />

      {isAdmin(user) && user.functionalRole === "OTHER" ? (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Quarterly casual leave maintenance</h2>
              <p className="section-subtitle">Credit quarterly casual leaves and adjust approved requests affected by a missed quarter credit.</p>
            </div>
            <Link className="btn-primary" href="/leave-admin/quarterly-casual-leaves">Open maintenance</Link>
          </div>
        </section>
      ) : null}



      {isAdmin(user) && user.functionalRole === "OTHER" && pastLeaves ? (
        <section className="table-wrap" id="past-approved-leaves">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="section-title">Old approved leaves deletion</h2>
              <p className="section-subtitle">
                Admin + Other only. These are approved leave requests from 1 June 2026 onward whose leave dates are already in the past. Use delete only for HR correction cases.
              </p>
            </div>
            <Link className="btn-secondary" href="/leave-admin/leave-ledger">Open predictive leave ledger</Link>
          </div>
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Employee</th>
                <th className="table-cell">Leave dates</th>
                <th className="table-cell">Approved by</th>
                <th className="table-cell">Total</th>
                <th className="table-cell">Casual</th>
                <th className="table-cell">Earned</th>
                <th className="table-cell">Unpaid</th>
                <th className="table-cell">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pastLeaves.rows.map((leave) => (
                <tr key={leave.id}>
                  <td className="table-cell font-medium text-slate-900">{leave.user.fullName}</td>
                  <td className="table-cell">{formatDateInIst(leave.startDate)} to {formatDateInIst(leave.endDate)}</td>
                  <td className="table-cell">{leave.approver?.fullName ?? ""}</td>
                  <td className="table-cell">{Number(leave.totalLeaveDays ?? 0).toFixed(2)}</td>
                  <td className="table-cell">{Number(leave.casualDaysUsed ?? 0).toFixed(2)}</td>
                  <td className="table-cell">{Number(leave.earnedDaysUsed ?? 0).toFixed(2)}</td>
                  <td className="table-cell">{Number(leave.unpaidDaysUsed ?? 0).toFixed(2)}</td>
                  <td className="table-cell">
                    <Link className="btn-secondary text-xs" href={`/leave-admin/past-approved-leaves/${leave.id}/delete`}>
                      Delete
                    </Link>
                  </td>
                </tr>
              ))}
              {pastLeaves.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center text-sm text-slate-500">No old approved leaves available for deletion.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <PaginationControls
            basePath="/leave-admin"
            currentPage={pastLeaves.currentPage}
            totalPages={pastLeaves.totalPages}
            totalItems={pastLeaves.totalItems}
            pageSize={pastLeaves.pageSize}
            searchParams={{ functionalRole: params.functionalRole, userId: params.userId, page: params.page, oldLeavePage: params.oldLeavePage }}
            pageParam="oldLeavePage"
            anchor="#past-approved-leaves"
          />
        </section>
      ) : null}

      <section className="card p-5">
        <AutoSubmitFilterForm className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="functionalRole">Functional role</label>
            <SearchableCombobox
              id="functionalRole"
              name="functionalRole"
              defaultValue={params.functionalRole || ""}
              options={functionalRoleOptions.map((role) => ({
                value: role,
                label: role ? role.replaceAll("_", " ") : "All functional roles",
              }))}
              placeholder="All functional roles"
              searchPlaceholder="Search functional roles..."
              emptyLabel="No functional role found."
            />
          </div>
          <div>
            <label className="label" htmlFor="userId">User</label>
            <SearchableCombobox
              id="userId"
              name="userId"
              defaultValue={params.userId || ""}
              options={[{ value: "", label: "All users" }, ...data.nameOptions.map((row) => ({ value: row.id, label: row.fullName }))]}
              placeholder="All users"
              searchPlaceholder="Search users..."
              emptyLabel="No user found."
            />
          </div>
          <div className="flex items-end gap-3">
            <Link className="btn-secondary" href="/leave-admin">Reset</Link>
          </div>
        </AutoSubmitFilterForm>
      </section>

      <section className="table-wrap" id="leave-admin-users-list">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="section-title">Leave allowed users</h2>
          <p className="section-subtitle">Casual, earned and approved unpaid leaves, shift, and employment status for year {data.year}.</p>
        </div>
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">User</th>
              <th className="table-cell">User type</th>
              <th className="table-cell">Functional role</th>
              <th className="table-cell">Casual leaves</th>
              <th className="table-cell">Earned leaves</th>
              <th className="table-cell">Unpaid leaves</th>
              <th className="table-cell">Shift</th>
              <th className="table-cell">Employment status</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.users.map((row) => {
              const returnTo = `/leave-admin?${new URLSearchParams({
                ...(params.functionalRole ? { functionalRole: params.functionalRole } : {}),
                ...(params.userId ? { userId: params.userId } : {}),
                ...(params.page ? { page: params.page } : {}),
              }).toString()}#leave-admin-users-list`;

              return (
              <tr key={row.id}>
                <td className="table-cell font-medium text-slate-900">{row.fullName}</td>
                <td className="table-cell">{formatUserTypeLabel(row.userType)}</td>
                <td className="table-cell">{(row.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}</td>
                <td className="table-cell">{Number(row.profile.casualLeaves).toFixed(2)}</td>
                <td className="table-cell">{Number(row.profile.earnedLeaves).toFixed(2)}</td>
                <td className="table-cell">{Number(row.totalUnpaidLeaves).toFixed(2)}</td>
                <td className="table-cell">{row.profile.shift}</td>
                <td className="table-cell">{row.profile.employmentStatus}</td>
                <td className="table-cell"><Link className="btn-secondary text-xs" href={`/leave-admin/${row.id}?returnTo=${encodeURIComponent(returnTo)}`}>Edit</Link></td>
              </tr>
              );
            })}
          </tbody>
        </table>
        <PaginationControls
          basePath="/leave-admin"
          currentPage={data.currentPage}
          totalPages={data.totalPages}
          totalItems={data.totalItems}
          pageSize={data.pageSize}
          searchParams={{ functionalRole: params.functionalRole, userId: params.userId, page: params.page }}
          anchor="#leave-admin-users-list"
        />
      </section>

      <section className="card p-6">
        <h2 className="section-title">Official holidays</h2>
        <p className="section-subtitle">Add official holidays for year {data.year}. These days are excluded from paid leave calculation.</p>
        <form action={createOfficialHolidayAction} className="mt-4 grid gap-4 md:grid-cols-[1fr_180px_220px_auto]">
          <input className="input" name="name" placeholder="Holiday name" required />
          <SearchableCombobox
            id="holidayShift"
            name="shift"
            defaultValue="DAY"
            options={[
              { value: "DAY", label: "Day shift" },
              { value: "NIGHT", label: "Night shift" },
              { value: "BOTH", label: "Both shifts" },
            ]}
            placeholder="Select holiday shift"
            searchPlaceholder="Search shifts..."
            emptyLabel="No shift found."
          />
          <input className="input" name="holidayDate" type="date" min={`${data.year}-01-01`} max={`${data.year}-12-31`} required />
          <button className="btn-primary" type="submit">Add holiday</button>
        </form>
        <div className="mt-5 overflow-x-auto">
          <table className="table-base">
            <thead className="table-head"><tr><th className="table-cell">Date</th><th className="table-cell">Holiday</th><th className="table-cell">Shift</th><th className="table-cell">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.holidays.map((holiday) => (
                <tr key={holiday.id}>
                  <td className="table-cell">{formatDateInIst(holiday.holidayDate)}</td>
                  <td className="table-cell">{holiday.name}</td>
                  <td className="table-cell">{holiday.shift === "BOTH" ? "Both" : holiday.shift === "NIGHT" ? "Night" : "Day"}</td>
                  <td className="table-cell">
                    <form action={deleteOfficialHolidayAction}>
                      <input type="hidden" name="id" value={holiday.id} />
                      <button className="btn-secondary text-xs" type="submit">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
              {data.holidays.length === 0 ? <tr><td colSpan={4} className="table-cell text-center text-sm text-slate-500">No official holidays added yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
