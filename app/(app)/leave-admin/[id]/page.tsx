import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateLeaveYearProfile } from "@/lib/ems-queries";
import { formatDateInIst, getDayBoundsUtcFromIstDateKey, getIstDateKey } from "@/lib/ist";
import { canAccessMenuItem, isHR } from "@/lib/permissions";
import { formatUserTypeLabel } from "@/lib/display-labels";
import { updateLeaveAdminUserAction } from "@/lib/actions/hr-leave-admin-actions";
import { cancelLeaveRequestAction } from "@/lib/actions/leave-actions";
import { getProjectedLeaveBalanceForUser } from "@/lib/leave-system";

export default async function LeaveAdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const user = await requireUser();
  if (!isHR(user) && !canAccessMenuItem(user, "leave-admin")) {
    return <div className="space-y-6"><PageHeader title="Leave Administration" description="Only Administration/HR can access this page." /></div>;
  }
  const routeParams = await params;
  const query = (await searchParams) ?? {};
  const returnTo = query.returnTo || "/leave-admin";
  const target = await db.user.findUnique({
    where: { id: routeParams.id },
    select: { id: true, fullName: true, userType: true, functionalRole: true },
  });
  if (!target) notFound();
  const todayKey = getIstDateKey();
  const year = Number(todayKey.slice(0, 4));
  const [profile, balance, cancellableLeaves] = await Promise.all([
    getOrCreateLeaveYearProfile(target.id, year),
    getProjectedLeaveBalanceForUser(target.id, year, todayKey),
    db.leaveRequest.findMany({
      where: {
        userId: target.id,
        status: { in: ["PENDING", "RECONSIDER", "APPROVED", "PARTIALLY_CANCELLED"] },
      },
      include: {
        cancellationRequests: { where: { status: "PENDING" }, select: { id: true }, take: 1 },
      },
      orderBy: { startDate: "desc" },
      take: 100,
    }),
  ]);
  if (!profile) notFound();
  const tomorrowStart = getDayBoundsUtcFromIstDateKey(todayKey).endUtc;
  const activeFutureLeaves = cancellableLeaves.filter(
    (leave) => leave.endDate >= tomorrowStart,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Leave Administration · ${target.fullName}`}
        description="Update actual balances, shift, and employment status. Shift or employment-status changes are blocked until all active future leave is cancelled or resolved."
        actions={<Link className="btn-secondary" href={returnTo}>Back to Leave Administration</Link>}
      />

      <section className="card p-5">
        <h2 className="section-title">Actual and projected balance</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">Actual Casual <strong>{balance.casualLeaves.toFixed(2)}</strong></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">Actual Earned <strong>{balance.earnedLeaves.toFixed(2)}</strong></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">Future Unpaid <strong>{balance.futureApproved.unpaidLeaves.toFixed(2)}</strong></div>
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm">Projected Casual <strong>{balance.projected.casualLeaves.toFixed(2)}</strong></div>
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm">Projected Earned <strong>{balance.projected.earnedLeaves.toFixed(2)}</strong></div>
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm">Scheduled Casual credits <strong>{balance.futureApproved.scheduledCasualCredits.toFixed(2)}</strong></div>
        </div>
      </section>

      {cancellableLeaves.length ? (
        <section className="table-wrap">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="section-title">Employee leave requests</h2>
            <p className="section-subtitle">HR can request cancellation for pending, approved, ongoing, or past leave. There are {activeFutureLeaves.length} active future request(s) that must be resolved before changing shift or employment status.</p>
          </div>
          <table className="table-base">
            <thead className="table-head"><tr><th className="table-cell">Dates</th><th className="table-cell">Status</th><th className="table-cell">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {cancellableLeaves.map((leave) => (
                <tr key={leave.id}>
                  <td className="table-cell">{formatDateInIst(leave.startDate)} to {formatDateInIst(leave.endDate)}</td>
                  <td className="table-cell">{leave.cancellationRequests.length ? "CANCELLATION PENDING" : leave.status.replaceAll("_", " ")}</td>
                  <td className="table-cell">
                    {isHR(user) && !leave.cancellationRequests.length ? (
                      <details>
                        <summary className="btn-secondary cursor-pointer list-none text-xs">Request cancellation</summary>
                        <form action={cancelLeaveRequestAction} className="mt-2 min-w-64 space-y-2">
                          <input type="hidden" name="id" value={leave.id} />
                          <textarea className="input min-h-20 text-xs" name="reason" placeholder="HR cancellation reason" required />
                          <button className="btn-primary text-xs">Send for HR review</button>
                        </form>
                      </details>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <form action={updateLeaveAdminUserAction} className="card space-y-5 p-6">
        <input type="hidden" name="userId" value={target.id} />
        <input type="hidden" name="year" value={String(year)} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label">User</label><input className="input" value={target.fullName} readOnly /></div>
          <div><label className="label">Role</label><input className="input" value={`${formatUserTypeLabel(target.userType)} · ${(target.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}`} readOnly /></div>
          <div><label className="label" htmlFor="casualLeaves">Actual Casual leaves</label><input className="input" id="casualLeaves" name="casualLeaves" type="number" min="0" step="0.01" defaultValue={Number(profile.casualLeaves).toFixed(2)} required /></div>
          <div><label className="label" htmlFor="earnedLeaves">Actual Earned leaves</label><input className="input" id="earnedLeaves" name="earnedLeaves" type="number" min="0" step="0.01" defaultValue={Number(profile.earnedLeaves).toFixed(2)} required /></div>
          <div><label className="label" htmlFor="shift">Shift</label><SearchableCombobox id="shift" name="shift" defaultValue={profile.shift} options={[{ value: "DAY", label: "Day" }, { value: "NIGHT", label: "Night" }]} placeholder="Select shift" searchPlaceholder="Search shifts..." emptyLabel="No shift found." /></div>
          <div>
            <label className="label" htmlFor="employmentStatus">Employment status</label>
            <SearchableCombobox id="employmentStatus" name="employmentStatus" defaultValue={profile.employmentStatus} options={[{ value: "PROBATION", label: "Probation" }, { value: "PERMANENT", label: "Permanent" }, { value: "CONSULTANT", label: "Consultant" }]} placeholder="Select employment status" searchPlaceholder="Search employment statuses..." emptyLabel="No employment status found." />
            <p className="mt-1 text-xs text-slate-500">Probation and Consultant users always use unpaid leave.</p>
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="adjustmentNote">HR change note</label>
            <textarea className="input min-h-24" id="adjustmentNote" name="adjustmentNote" placeholder="Required when changing balances, shift, or employment status. Balance changes are stored in the leave ledger." />
          </div>
        </div>
        <button className="btn-primary" type="submit">Save details</button>
      </form>
    </div>
  );
}
