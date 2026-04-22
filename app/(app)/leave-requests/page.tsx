import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { canAccessLeaveRequests } from "@/lib/permissions";
import { getIstDateKey, formatDateInIst } from "@/lib/ist";
import { cancelLeaveRequestAction, deleteLeaveRequestAction } from "@/lib/actions/leave-actions";
import { getLeaveRequestsForUser } from "@/lib/ems-queries";

function getLeaveBreakupLabel(row: {
  casualDaysUsed?: unknown;
  earnedDaysUsed?: unknown;
  unpaidDaysUsed?: unknown;
  totalLeaveDays?: unknown;
}) {
  const casual = Number(row.casualDaysUsed ?? 0);
  const earned = Number(row.earnedDaysUsed ?? 0);
  const unpaid = Number(row.unpaidDaysUsed ?? 0);
  const parts = [] as string[];
  if (casual > 0) parts.push(`Casual ${casual.toFixed(2)}`);
  if (earned > 0) parts.push(`Earned ${earned.toFixed(2)}`);
  if (unpaid > 0) parts.push(`Unpaid ${unpaid.toFixed(2)}`);
  return parts.length ? parts.join(" · ") : `Working leave days ${Number(row.totalLeaveDays ?? 0).toFixed(2)}`;
}

export default async function LeaveRequestsPage() {
  const user = await requireUser();

  if (!canAccessLeaveRequests(user)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Leave Requests" description="This account does not have access to leave requests." />
      </div>
    );
  }

  const data = await getLeaveRequestsForUser(user.id, getIstDateKey());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Requests"
        description="Manage your current and past leave requests. Edit is available only when an approver asks you to reconsider."
        actions={
          <Link className="btn-primary" href="/leave-requests/new">
            Create leave request
          </Link>
        }
      />

      <section className="card p-5">
        <h2 className="section-title">Leaves remaining</h2>
        <p className="section-subtitle">Current year balance available for paid leave deduction.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">Casual leaves remaining <span className="ml-2 font-semibold text-slate-900">{data.leaveBalance.casualLeaves.toFixed(2)}</span></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">Earned leaves remaining <span className="ml-2 font-semibold text-slate-900">{data.leaveBalance.earnedLeaves.toFixed(2)}</span></div>
        </div>
      </section>

      <section className="table-wrap">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="section-title">Current requests</h2>
          <p className="section-subtitle">Current includes active dates and all requests that are still actionable.</p>
        </div>
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Leave breakup</th>
              <th className="table-cell">Date range</th>
              <th className="table-cell">Approver</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Notes</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.current.map((row) => (
              <tr key={row.id}>
                <td className="table-cell">{getLeaveBreakupLabel(row)}</td>
                <td className="table-cell">{formatDateInIst(row.startDate)} - {formatDateInIst(row.endDate)}</td>
                <td className="table-cell">{row.approver?.fullName || "—"}</td>
                <td className="table-cell"><span className="badge-blue">{row.status.replaceAll("_", " ")}</span></td>
                <td className="table-cell whitespace-pre-line">
                  {row.reconsiderNote || row.approverComment || row.reason || "—"}
                </td>
                <td className="table-cell">
                  <div className="flex flex-wrap gap-2">
                    {row.status === "RECONSIDER" ? (
                      <Link className="btn-secondary text-xs" href={`/leave-requests/${row.id}/edit`}>Edit</Link>
                    ) : null}
                    {row.status !== "APPROVED" ? (
                      <form action={deleteLeaveRequestAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button className="btn-secondary text-xs">Delete</button>
                      </form>
                    ) : null}
                    {row.status === "APPROVED" ? (
                      <form action={cancelLeaveRequestAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button className="btn-secondary text-xs">Cancel</button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {data.current.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-cell text-center text-sm text-slate-500">No current leave requests found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="table-wrap">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="section-title">Past requests</h2>
          <p className="section-subtitle">Past includes inactive requests whose dates have passed or which are no longer actionable.</p>
        </div>
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Leave breakup</th>
              <th className="table-cell">Date range</th>
              <th className="table-cell">Approver</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.past.map((row) => (
              <tr key={row.id}>
                <td className="table-cell">{getLeaveBreakupLabel(row)}</td>
                <td className="table-cell">{formatDateInIst(row.startDate)} - {formatDateInIst(row.endDate)}</td>
                <td className="table-cell">{row.approver?.fullName || "—"}</td>
                <td className="table-cell"><span className="badge-slate">{row.status.replaceAll("_", " ")}</span></td>
                <td className="table-cell whitespace-pre-line">
                  {row.reconsiderNote || row.approverComment || row.reason || "—"}
                </td>
              </tr>
            ))}
            {data.past.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-cell text-center text-sm text-slate-500">No past leave requests found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
