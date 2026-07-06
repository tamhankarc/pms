import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { formatDateInIst, formatTimeInIst } from "@/lib/ist";
import { getPastApprovedLeaveDeletePreview } from "@/lib/leave-admin-ledger";
import { deletePastApprovedLeaveAction } from "@/lib/actions/past-leave-admin-actions";

function numberText(value: number) {
  return value.toFixed(2);
}

export default async function DeletePastApprovedLeavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!isAdmin(user) || user.functionalRole !== "OTHER") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Delete old approved leave"
          description="Only Admin users with functional role Other can access this page."
        />
      </div>
    );
  }

  const { id } = await params;
  const preview = await getPastApprovedLeaveDeletePreview(id);
  if (!preview) notFound();

  const selectedApprovers = preview.request.selectedApprovers
    .map((row) => row.approver.fullName)
    .join(", ");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Confirm old approved leave deletion"
        description="Review the balance restoration and deletion impact before processing this correction."
        actions={<Link className="btn-secondary" href="/leave-admin#past-approved-leaves">Back to Leave Administration</Link>}
      />

      <section className="card p-6 space-y-5">
        <div>
          <h2 className="section-title">Leave request being deleted</h2>
          <p className="section-subtitle mt-1">
            This action permanently deletes the approved leave request and its selected approver rows. Use this only for correction cases.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Employee</label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
              {preview.request.user.fullName}
            </div>
          </div>
          <div>
            <label className="label">Leave dates</label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {formatDateInIst(preview.request.startDate)} to {formatDateInIst(preview.request.endDate)}
            </div>
          </div>
          <div>
            <label className="label">Approved by</label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {preview.request.approver?.fullName ?? "—"}
            </div>
          </div>
          <div>
            <label className="label">Approved at</label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {preview.request.approvedAt
                ? `${formatDateInIst(preview.request.approvedAt)} ${formatTimeInIst(preview.request.approvedAt)}`
                : "—"}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="label">Selected approvers</label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {selectedApprovers || "—"}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="label">Reason</label>
            <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {preview.request.reason || "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-5">
        <div>
          <h2 className="section-title">What will happen in background</h2>
          <p className="section-subtitle mt-1">
            The system will reverse paid leave deductions from this approved request before deleting it.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Item</th>
                <th className="table-cell">Current</th>
                <th className="table-cell">Change</th>
                <th className="table-cell">After deletion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="table-cell font-medium text-slate-900">Casual leaves</td>
                <td className="table-cell">{numberText(preview.currentCasualBalance)}</td>
                <td className="table-cell">+{numberText(preview.casualToRestore)}</td>
                <td className="table-cell">{numberText(preview.resultingCasualBalance)}</td>
              </tr>
              <tr>
                <td className="table-cell font-medium text-slate-900">Earned leaves</td>
                <td className="table-cell">{numberText(preview.currentEarnedBalance)}</td>
                <td className="table-cell">+{numberText(preview.earnedToRestore)}</td>
                <td className="table-cell">{numberText(preview.resultingEarnedBalance)}</td>
              </tr>
              <tr>
                <td className="table-cell font-medium text-slate-900">Unpaid days</td>
                <td className="table-cell">Recorded on request</td>
                <td className="table-cell">Request unpaid value {numberText(preview.unpaidDays)} will be removed with deleted request</td>
                <td className="table-cell">HR reports will no longer count this request</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Important:</strong> this does not create a separate audit ledger entry because the current site does not yet have a real leave ledger. The predictive ledger page will stop showing this deleted leave because the request itself will be removed.
        </div>
      </section>

      <form action={deletePastApprovedLeaveAction} className="card p-6 space-y-4">
        <input type="hidden" name="id" value={preview.request.id} />
        <div>
          <label className="label" htmlFor="confirmText">Type DELETE to confirm</label>
          <input className="input" id="confirmText" name="confirmText" placeholder="DELETE" required />
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" type="submit">Delete old approved leave and restore balance</button>
          <Link className="btn-secondary" href="/leave-admin#past-approved-leaves">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
