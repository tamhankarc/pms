import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { isHR } from "@/lib/permissions";
import { getLeaveAdminList } from "@/lib/ems-queries";
import { createOfficialHolidayAction, deleteOfficialHolidayAction } from "@/lib/actions/hr-leave-admin-actions";
import { formatDateInIst } from "@/lib/ist";

const functionalRoleOptions = ["", "DEVELOPER", "QA", "DESIGNER", "LOCALIZATION", "DEVOPS", "PROJECT_MANAGER", "DIRECTOR", "OTHER", "BILLING"];

export default async function LeaveAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; functionalRole?: string; userId?: string }>;
}) {
  const user = await requireUser();
  if (!isHR(user)) {
    return <div className="space-y-6"><PageHeader title="Leave Administration" description="Only HR can access this page." /></div>;
  }
  const params = (await searchParams) ?? {};
  const page = Number(params.page || 1);
  const data = await getLeaveAdminList({ functionalRole: params.functionalRole || "", userId: params.userId || "", page, pageSize: 10 });

  return (
    <div className="space-y-6">
      <PageHeader title="Leave Administration" description="Manage leave balances, shift, employment status, and official holidays for leave allowed users." />

      <section className="card p-5">
        <form className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="functionalRole">Functional role</label>
            <select className="input" id="functionalRole" name="functionalRole" defaultValue={params.functionalRole || ""}>
              {functionalRoleOptions.map((role) => <option key={role || "all"} value={role}>{role ? role.replaceAll("_", " ") : "All functional roles"}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="userId">User</label>
            <select className="input" id="userId" name="userId" defaultValue={params.userId || ""}>
              <option value="">All users</option>
              {data.nameOptions.map((row) => <option key={row.id} value={row.id}>{row.fullName}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <button className="btn-secondary" type="submit">Apply</button>
            <Link className="btn-secondary" href="/leave-admin">Reset</Link>
          </div>
        </form>
      </section>

      <section className="table-wrap" id="leave-admin-users-list">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="section-title">Leave allowed users</h2>
          <p className="section-subtitle">Casual and earned leaves, shift, and employment status for year {data.year}.</p>
        </div>
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">User</th>
              <th className="table-cell">User type</th>
              <th className="table-cell">Functional role</th>
              <th className="table-cell">Casual leaves</th>
              <th className="table-cell">Earned leaves</th>
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
                <td className="table-cell">{row.userType.replaceAll("_", " ")}</td>
                <td className="table-cell">{(row.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}</td>
                <td className="table-cell">{Number(row.profile.casualLeaves).toFixed(2)}</td>
                <td className="table-cell">{Number(row.profile.earnedLeaves).toFixed(2)}</td>
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
        <form action={createOfficialHolidayAction} className="mt-4 grid gap-4 md:grid-cols-[1fr_220px_auto]">
          <input className="input" name="name" placeholder="Holiday name" required />
          <input className="input" name="holidayDate" type="date" min={`${data.year}-01-01`} max={`${data.year}-12-31`} required />
          <button className="btn-primary" type="submit">Add holiday</button>
        </form>
        <div className="mt-5 overflow-x-auto">
          <table className="table-base">
            <thead className="table-head"><tr><th className="table-cell">Date</th><th className="table-cell">Holiday</th><th className="table-cell">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.holidays.map((holiday) => (
                <tr key={holiday.id}>
                  <td className="table-cell">{formatDateInIst(holiday.holidayDate)}</td>
                  <td className="table-cell">{holiday.name}</td>
                  <td className="table-cell">
                    <form action={deleteOfficialHolidayAction}>
                      <input type="hidden" name="id" value={holiday.id} />
                      <button className="btn-secondary text-xs" type="submit">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
              {data.holidays.length === 0 ? <tr><td colSpan={3} className="table-cell text-center text-sm text-slate-500">No official holidays added yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
