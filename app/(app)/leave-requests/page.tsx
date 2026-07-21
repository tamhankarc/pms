import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { canAccessLeaveRequests, canAccessMenuItem, isAdmin, isHR } from "@/lib/permissions";
import { getIstDateKey, formatDateInIst } from "@/lib/ist";
import {
  cancelLeaveRequestAction,
  deleteLeaveRequestAction,
} from "@/lib/actions/leave-actions";
import { getLeaveRequestsForUser } from "@/lib/ems-queries";
import { isLeaveStartWithinPastCancellationWindow } from "@/lib/leave-system";

type LeaveRequestsData = Awaited<ReturnType<typeof getLeaveRequestsForUser>>;
type LeaveRequestRow = LeaveRequestsData["current"][number];

function getLeaveBreakupLabel(row: {
  status: string;
  casualDaysUsed?: unknown;
  earnedDaysUsed?: unknown;
  unpaidDaysUsed?: unknown;
  totalLeaveDays?: unknown;
  projectedBreakup?: {
    casualDaysUsed: number;
    earnedDaysUsed: number;
    unpaidDaysUsed: number;
  } | null;
}) {
  if (row.status === "CANCELLED") return "-";
  if (row.status === "PENDING" || row.status === "RECONSIDER") {
    const projected = row.projectedBreakup;
    if (!projected) return "Projected breakup unavailable";
    const projectedParts: string[] = [];
    if (projected.casualDaysUsed > 0)
      projectedParts.push(`Casual ${projected.casualDaysUsed.toFixed(2)}`);
    if (projected.earnedDaysUsed > 0)
      projectedParts.push(`Earned ${projected.earnedDaysUsed.toFixed(2)}`);
    if (projected.unpaidDaysUsed > 0)
      projectedParts.push(`Unpaid ${projected.unpaidDaysUsed.toFixed(2)}`);
    return `Projected: ${projectedParts.join(" · ") || "No leave deduction"}`;
  }
  if (row.status === "REJECTED") return "No balance deducted";
  const casual = Number(row.casualDaysUsed ?? 0);
  const earned = Number(row.earnedDaysUsed ?? 0);
  const unpaid = Number(row.unpaidDaysUsed ?? 0);
  const parts: string[] = [];
  if (casual > 0) parts.push(`Casual ${casual.toFixed(2)}`);
  if (earned > 0) parts.push(`Earned ${earned.toFixed(2)}`);
  if (unpaid > 0) parts.push(`Unpaid ${unpaid.toFixed(2)}`);
  return parts.length
    ? parts.join(" · ")
    : `Working leave days ${Number(row.totalLeaveDays ?? 0).toFixed(2)}`;
}

function CancellationControl({
  row,
  allowNewCancellation = true,
}: {
  row: LeaveRequestRow;
  allowNewCancellation?: boolean;
}) {
  if (row.cancellationRequests?.length) {
    return (
      <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
        Cancellation awaiting HR review
      </span>
    );
  }
  if (
    !allowNewCancellation ||
    !["PENDING", "RECONSIDER", "APPROVED", "PARTIALLY_CANCELLED"].includes(
      row.status,
    )
  ) {
    return null;
  }
  return (
    <details className="min-w-56">
      <summary className="btn-secondary cursor-pointer list-none text-xs">Request cancellation</summary>
      <form action={cancelLeaveRequestAction} className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <input type="hidden" name="id" value={row.id} />
        <label className="label" htmlFor={`cancel-reason-${row.id}`}>Reason</label>
        <textarea
          id={`cancel-reason-${row.id}`}
          name="reason"
          className="input min-h-20 text-xs"
          rows={3}
          placeholder="Reason for cancellation"
          required
        />
        <p className="text-xs text-slate-500">Cancellation affects the leave only after HR approves it.</p>
        <button className="btn-primary text-xs">Submit to HR</button>
      </form>
    </details>
  );
}

function RequestRows({
  rows,
  showActions,
  restrictPastCancellationWindow = false,
  todayDateKey,
}: {
  rows: LeaveRequestRow[];
  showActions: boolean;
  restrictPastCancellationWindow?: boolean;
  todayDateKey: string;
}) {
  return (
    <>
      {rows.map((row) => (
        <tr key={row.id} id={`leave-request-${row.id}`}>
          <td className="table-cell hidden md:table-cell">{getLeaveBreakupLabel(row)}</td>
          <td className="table-cell">
            {formatDateInIst(row.startDate)} - {formatDateInIst(row.endDate)}
            <div className="mt-1 text-xs text-slate-500">{Number(row.totalLeaveDays ?? 0).toFixed(2)} day(s)</div>
          </td>
          <td className="table-cell hidden md:table-cell">
            {row.selectedApprovers?.length
              ? row.selectedApprovers.map((item) => item.approver.fullName).join(", ")
              : row.approver?.fullName || "—"}
          </td>
          <td className="table-cell">
            <span className={showActions ? "badge-blue" : "badge-slate"}>{row.status.replaceAll("_", " ")}</span>
          </td>
          <td className="table-cell hidden whitespace-pre-line md:table-cell">
            {row.reconsiderNote || row.approverComment || row.reason || "—"}
          </td>
          <td className="table-cell">
            <div className="flex flex-wrap gap-2">
              {showActions && row.status === "RECONSIDER" ? (
                <Link className="btn-secondary text-xs" href={`/leave-requests/${row.id}/edit`}>Edit</Link>
              ) : null}
              {showActions && row.status === "REJECTED" ? (
                <form action={deleteLeaveRequestAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <button className="btn-secondary text-xs">Delete</button>
                </form>
              ) : null}
              <CancellationControl
                row={row}
                allowNewCancellation={
                  !restrictPastCancellationWindow ||
                  isLeaveStartWithinPastCancellationWindow(
                    row.startDate,
                    todayDateKey,
                  )
                }
              />
            </div>
          </td>
        </tr>
      ))}
      {rows.length === 0 ? (
        <tr><td colSpan={6} className="table-cell text-center text-sm text-slate-500">No leave requests found.</td></tr>
      ) : null}
    </>
  );
}

export default async function LeaveRequestsPage() {
  const user = await requireUser();
  if (!canAccessLeaveRequests(user) && !canAccessMenuItem(user, "leave-requests") && !isAdmin(user) && !isHR(user)) {
    return <div className="space-y-6"><PageHeader title="Leave Requests" description="This account does not have access to leave requests." /></div>;
  }

  const todayDateKey = getIstDateKey();
  const data = await getLeaveRequestsForUser(user.id, todayDateKey);
  const future = data.leaveBalance.futureApproved;
  const projected = data.leaveBalance.projected;
  const hasFuture = future.casualLeaves > 0 || future.earnedLeaves > 0 || future.unpaidLeaves > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Requests"
        description="Manage current and past requests. Approved future leave is reserved now and deducted only when its leave date arrives."
        actions={
          <>
            <Link className="btn-secondary" href="/leave-requests/leave-ledger">
              Leave Ledger
            </Link>
            <Link className="btn-primary" href="/leave-requests/new">
              Create leave request
            </Link>
          </>
        }
      />

      <section className="card p-5">
        <h2 className="section-title">Today&apos;s Actual Balance</h2>
        <p className="section-subtitle">These balances include only leave deductions processed through today.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">Casual leaves <span className="ml-2 font-semibold text-slate-900">{data.leaveBalance.casualLeaves.toFixed(2)}</span></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">Earned leaves <span className="ml-2 font-semibold text-slate-900">{data.leaveBalance.earnedLeaves.toFixed(2)}</span></div>
        </div>
        {hasFuture ? (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <h3 className="font-semibold text-slate-900">Projected Balance After Approved Future Leaves</h3>
            <p className="mt-1 text-sm text-slate-600">Calculated chronologically and including scheduled quarterly Casual Leave credits due before those leave dates.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm">Projected Casual <strong>{projected.casualLeaves.toFixed(2)}</strong></div>
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm">Projected Earned <strong>{projected.earnedLeaves.toFixed(2)}</strong></div>
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm">Future Unpaid <strong>{future.unpaidLeaves.toFixed(2)}</strong></div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="table-wrap">
        <div className="border-b border-slate-200 px-6 py-5"><h2 className="section-title">Current requests</h2><p className="section-subtitle">Active dates and requests that are still actionable.</p></div>
        <table className="table-base"><thead className="table-head"><tr><th className="table-cell hidden md:table-cell">Leave breakup</th><th className="table-cell">Date range</th><th className="table-cell hidden md:table-cell">Approver</th><th className="table-cell">Status</th><th className="table-cell hidden md:table-cell">Notes</th><th className="table-cell">Action</th></tr></thead><tbody className="divide-y divide-slate-100"><RequestRows rows={data.current} showActions todayDateKey={todayDateKey} /></tbody></table>
      </section>

      <section className="table-wrap">
        <div className="border-b border-slate-200 px-6 py-5"><h2 className="section-title">Past requests</h2><p className="section-subtitle">Processed past leave remains auditable. Cancellation can be requested only when the leave start date is within the last 10 days and requires HR approval.</p></div>
        <table className="table-base"><thead className="table-head"><tr><th className="table-cell hidden md:table-cell">Leave breakup</th><th className="table-cell">Date range</th><th className="table-cell hidden md:table-cell">Approver</th><th className="table-cell">Status</th><th className="table-cell hidden md:table-cell">Notes</th><th className="table-cell">Action</th></tr></thead><tbody className="divide-y divide-slate-100"><RequestRows
            rows={data.past}
            showActions={false}
            restrictPastCancellationWindow
            todayDateKey={todayDateKey}
          /></tbody></table>
      </section>
    </div>
  );
}
