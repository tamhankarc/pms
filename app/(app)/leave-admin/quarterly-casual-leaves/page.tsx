import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import {
  formatDateInIst,
  formatTimeInIst,
  getIstDateKey,
} from "@/lib/ist";
import {
  getCurrentQuarterStartDateKey,
  getQuarterlyCasualLeaveAdjustmentCandidates,
  getQuarterForDateKey,
} from "@/lib/quarterly-casual-leaves";
import {
  runQuarterlyCasualLeaveCreditAction,
  rectifyAllApprovedLeaveAction,
  rectifySingleApprovedLeaveAction,
} from "@/lib/actions/quarterly-casual-leave-actions";

type SearchParams = {
  fromDate?: string;
  toDate?: string;
};

function numberCell(value: number) {
  return value.toFixed(2);
}

export default async function QuarterlyCasualLeavePage({
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
          description="Only Admin + Other can access this page."
        />
      </div>
    );
  }

  const params = (await searchParams) ?? {};
  const todayKey = getIstDateKey();
  const fromDateKey =
    params.fromDate || getCurrentQuarterStartDateKey(todayKey);
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
        description="Apply a missed scheduled quarterly credit and recalculate approved future leave reservations chronologically."
        actions={
          <Link className="btn-secondary" href="/leave-admin">
            Back to Leave Administration
          </Link>
        }
      />

      <section className="card p-6">
        <h2 className="section-title">
          Step 1: Quarter {getQuarterForDateKey(todayKey)} credit
        </h2>
        <p className="section-subtitle mt-1">
          This action is idempotent. It applies the selected quarter&apos;s two
          Casual Leaves only for eligible users who have not already received
          that quarter&apos;s credit, then recalculates their future reservations.
        </p>
        <form
          action={runQuarterlyCasualLeaveCreditAction}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="label" htmlFor="asOfDateKey">
              As-of date
            </label>
            <input
              className="input"
              id="asOfDateKey"
              name="asOfDateKey"
              type="date"
              defaultValue={todayKey}
              required
            />
          </div>
          <button className="btn-primary">Run quarterly credit</button>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="section-title">
          Step 2: Review approved future reservations
        </h2>
        <p className="section-subtitle mt-1">
          Filter by request application date. Recalculation uses today&apos;s
          actual balances and guaranteed quarterly credits in leave-date order;
          it does not deduct future leave immediately.
        </p>
        <form className="mt-4 grid gap-4 md:grid-cols-[180px_180px_auto]">
          <div>
            <label className="label" htmlFor="fromDate">
              Applied from
            </label>
            <input
              className="input"
              id="fromDate"
              name="fromDate"
              type="date"
              defaultValue={fromDateKey}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="toDate">
              Applied to
            </label>
            <input
              className="input"
              id="toDate"
              name="toDate"
              type="date"
              defaultValue={toDateKey}
              required
            />
          </div>
          <div className="flex items-end gap-3">
            <button className="btn-secondary" type="submit">
              Apply
            </button>
            <Link
              className="btn-secondary"
              href="/leave-admin/quarterly-casual-leaves"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="table-wrap">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="section-title">Approved future reservations</h2>
            <p className="section-subtitle">
              Showing approved requests applied from {fromDateKey} to {toDateKey}.
            </p>
          </div>
          {actionableIds.length ? (
            <form action={rectifyAllApprovedLeaveAction}>
              <input
                type="hidden"
                name="ids"
                value={actionableIds.join(",")}
              />
              <button className="btn-primary">Recalculate all shown</button>
            </form>
          ) : null}
        </div>
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Employee</th>
              <th className="table-cell">Applied</th>
              <th className="table-cell">Leave dates</th>
              <th className="table-cell">Request aggregate</th>
              <th className="table-cell">Future scheduled reservation</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.candidates.map((row) => (
              <tr key={row.id}>
                <td className="table-cell font-medium text-slate-900">
                  {row.userName}
                </td>
                <td className="table-cell">
                  <div>{formatDateInIst(row.createdAt)}</div>
                  <div className="text-xs text-slate-500">
                    {formatTimeInIst(row.createdAt)}
                  </div>
                </td>
                <td className="table-cell">
                  {formatDateInIst(row.startDate)} to{" "}
                  {formatDateInIst(row.endDate)}
                </td>
                <td className="table-cell text-sm">
                  <div>Total: {numberCell(row.oldBreakup.totalLeaveDays)}</div>
                  <div>Casual: {numberCell(row.oldBreakup.casualDaysUsed)}</div>
                  <div>Earned: {numberCell(row.oldBreakup.earnedDaysUsed)}</div>
                  <div>Unpaid: {numberCell(row.oldBreakup.unpaidDaysUsed)}</div>
                </td>
                <td className="table-cell text-sm">
                  <div>Total: {numberCell(row.newBreakup.totalLeaveDays)}</div>
                  <div>Casual: {numberCell(row.newBreakup.casualDaysUsed)}</div>
                  <div>Earned: {numberCell(row.newBreakup.earnedDaysUsed)}</div>
                  <div>Unpaid: {numberCell(row.newBreakup.unpaidDaysUsed)}</div>
                </td>
                <td className="table-cell">
                  <form action={rectifySingleApprovedLeaveAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button className="btn-secondary text-xs">
                      Recalculate
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!data.candidates.length ? (
              <tr>
                <td
                  colSpan={6}
                  className="table-cell text-center text-slate-500"
                >
                  No approved future reservations found for this application-date
                  range.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
