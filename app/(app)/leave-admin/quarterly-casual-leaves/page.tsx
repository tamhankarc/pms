import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { formatDateInIst, formatTimeInIst, getIstDateKey } from "@/lib/ist";
import {
  getCurrentQuarterStartDateKey,
  getQuarterlyCasualLeaveAdjustmentCandidates,
} from "@/lib/quarterly-casual-leaves";
import {
  rectifyAllApprovedLeaveAction,
  rectifySingleApprovedLeaveAction,
  runQuarterlyCasualLeaveCreditAction,
} from "@/lib/actions/quarterly-casual-leave-actions";

type SearchParams = {
  fromDate?: string;
  toDate?: string;
};

function numberCell(value: number) {
  return value.toFixed(2);
}

export default async function QuarterlyCasualLeavesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireUser();
  if (!isAdmin(user) || user.functionalRole !== "OTHER") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Quarterly Casual Leave Maintenance"
          description="Only Admin users with functional role Other can access this page."
        />
      </div>
    );
  }

  const params = (await searchParams) ?? {};
  const todayKey = getIstDateKey();
  const fromDateKey = params.fromDate || getCurrentQuarterStartDateKey(todayKey);
  const toDateKey = params.toDate || todayKey;
  const data = await getQuarterlyCasualLeaveAdjustmentCandidates({
    fromDateKey,
    toDateKey,
  });
  const actionableIds = data.candidates
    .filter((row) => row.hasUsefulAdjustment)
    .map((row) => row.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quarterly Casual Leave Maintenance"
        description="Credit quarterly casual leaves and fix approved requests that were calculated before the quarter credit was applied."
      />

      <div className="flex flex-wrap gap-3">
        <Link className="btn-secondary" href="/leave-admin">
          Back to Leave Administration
        </Link>
      </div>

      <section className="card p-6">
        <h2 className="section-title">Step 1: credit quarterly casual leaves</h2>
        <p className="section-subtitle mt-1">
          This is safe to run more than once. The system adds exactly 2 casual leaves
          for the selected quarter and records that credit. If the same quarter
          was already credited for a user, that user is skipped.
        </p>
        <form action={runQuarterlyCasualLeaveCreditAction} className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="label" htmlFor="asOfDateKey">As of date</label>
            <input
              className="input"
              id="asOfDateKey"
              name="asOfDateKey"
              type="date"
              defaultValue={todayKey}
              required
            />
          </div>
          <button className="btn-primary" type="submit">
            Run quarterly credit
          </button>
        </form>
        <p className="mt-3 text-sm text-slate-600">
          For 2 July rectification, use <strong>2026-07-02</strong>. This will add exactly
          2 casual leaves for the July quarter only where that quarter has not already been credited.
        </p>
      </section>

      <section className="card p-6">
        <h2 className="section-title">Step 2: find already-approved requests to adjust</h2>
        <p className="section-subtitle mt-1">
          Use this for requests applied after the quarter started but approved before the
          casual credit was available. Existing deductions are reversed internally and then
          recalculated using the normal rule: casual leaves first, then earned leaves, then unpaid.
        </p>
        <form className="mt-4 grid gap-4 md:grid-cols-[180px_180px_auto]">
          <div>
            <label className="label" htmlFor="fromDate">Applied from</label>
            <input className="input" id="fromDate" name="fromDate" type="date" defaultValue={fromDateKey} required />
          </div>
          <div>
            <label className="label" htmlFor="toDate">Applied to</label>
            <input className="input" id="toDate" name="toDate" type="date" defaultValue={toDateKey} required />
          </div>
          <div className="flex items-end gap-3">
            <button className="btn-secondary" type="submit">Apply</button>
            <Link className="btn-secondary" href="/leave-admin/quarterly-casual-leaves">Reset</Link>
          </div>
        </form>
      </section>

      <section className="table-wrap">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="section-title">Approved leave requests needing review</h2>
            <p className="section-subtitle">
              Showing approved requests applied from {fromDateKey} to {toDateKey}.
            </p>
          </div>
          {actionableIds.length ? (
            <form action={rectifyAllApprovedLeaveAction}>
              <input type="hidden" name="ids" value={actionableIds.join(",")} />
              <button className="btn-primary" type="submit">
                Adjust all shown actionable rows
              </button>
            </form>
          ) : null}
        </div>
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Employee</th>
              <th className="table-cell">Applied</th>
              <th className="table-cell">Leave dates</th>
              <th className="table-cell">Current breakup</th>
              <th className="table-cell">After adjustment</th>
              <th className="table-cell">Impact</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.candidates.map((row) => (
              <tr key={row.id}>
                <td className="table-cell font-medium text-slate-900">{row.userName}</td>
                <td className="table-cell">
                  <div>{formatDateInIst(row.createdAt)}</div>
                  <div className="text-xs text-slate-500">{formatTimeInIst(row.createdAt)}</div>
                </td>
                <td className="table-cell">
                  {formatDateInIst(row.startDate)} to {formatDateInIst(row.endDate)}
                </td>
                <td className="table-cell text-sm">
                  <div>Casual: {numberCell(row.oldBreakup.casualDaysUsed)}</div>
                  <div>Earned: {numberCell(row.oldBreakup.earnedDaysUsed)}</div>
                  <div>Unpaid: {numberCell(row.oldBreakup.unpaidDaysUsed)}</div>
                </td>
                <td className="table-cell text-sm">
                  <div>Casual: {numberCell(row.newBreakup.casualDaysUsed)}</div>
                  <div>Earned: {numberCell(row.newBreakup.earnedDaysUsed)}</div>
                  <div>Unpaid: {numberCell(row.newBreakup.unpaidDaysUsed)}</div>
                </td>
                <td className="table-cell text-sm">
                  <div>Casual used +{numberCell(Math.max(0, row.casualIncreaseInRequest))}</div>
                  <div>Earned restored {numberCell(Math.max(0, row.earnedReductionInRequest))}</div>
                  <div>Unpaid reduced {numberCell(Math.max(0, row.unpaidReductionInRequest))}</div>
                </td>
                <td className="table-cell">
                  {row.hasUsefulAdjustment ? (
                    <form action={rectifySingleApprovedLeaveAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button className="btn-secondary text-xs" type="submit">Adjust</button>
                    </form>
                  ) : (
                    <span className="text-xs text-slate-500">No change needed</span>
                  )}
                </td>
              </tr>
            ))}
            {data.candidates.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-cell text-center text-sm text-slate-500">
                  No approved requests found for this applied-date range.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
