import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { canAccessMenuItem, isAdmin, isHR } from "@/lib/permissions";
import { getIstDateKey } from "@/lib/ist";
import { getLeaveBalanceTransitionPreview } from "@/lib/leave-migration";
import { applyLeaveBalanceTransitionAction } from "@/lib/actions/leave-migration-actions";

export default async function LeaveBalanceTransitionPage({ searchParams }: { searchParams?: Promise<{ cutoverDateKey?: string; affected?: string }> }) {
  const user = await requireUser();
  if (!isHR(user) && !canAccessMenuItem(user, "leave-admin") && !isAdmin(user)) {
    return <div className="space-y-6"><PageHeader title="Leave Balance Transition" description="You do not have access to this page." /></div>;
  }
  const params = (await searchParams) ?? {};
  const cutoverDateKey = params.cutoverDateKey || getIstDateKey();
  const data = await getLeaveBalanceTransitionPreview(cutoverDateKey);
  const rows = params.affected === "1" ? data.rows.filter((row) => row.affected) : data.rows;
  const canApply = isAdmin(user) && user.functionalRole === "OTHER" && !data.appliedRun;
  return (
    <div className="space-y-6">
      <PageHeader title="Leave Balance Transition" description="Preview before/after actual balances for every leave-eligible user and convert legacy approved future deductions into scheduled date-level allocations." actions={<Link className="btn-secondary" href="/leave-admin">Back</Link>} />
      {data.appliedRun ? <section className="card border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">Migration already applied on {data.appliedRun.appliedAt?.toISOString() ?? data.appliedRun.createdAt.toISOString()} by {data.appliedRun.createdBy.fullName}. This page remains available as the transition record.</section> : null}
      <section className="card p-5">
        <form className="flex flex-wrap items-end gap-3">
          <div><label className="label" htmlFor="cutoverDateKey">IST cutover date</label><input className="input" id="cutoverDateKey" name="cutoverDateKey" type="date" defaultValue={cutoverDateKey} required /></div>
          <label className="inline-flex items-center gap-2 pb-3 text-sm"><input type="checkbox" name="affected" value="1" defaultChecked={params.affected === "1"} />Affected users only</label>
          <button className="btn-secondary">Refresh preview</button>
        </form>
        <p className="mt-3 text-sm text-slate-600">Legacy approved requests found: <strong>{data.legacyRequestCount}</strong></p>
      </section>
      <section className="table-wrap overflow-x-auto">
        <table className="table-base min-w-[1200px]"><thead className="table-head"><tr><th className="table-cell">Employee</th><th className="table-cell">Casual Before</th><th className="table-cell">Earned Before</th><th className="table-cell">Restore Casual</th><th className="table-cell">Restore Earned</th><th className="table-cell">Actual Casual After</th><th className="table-cell">Actual Earned After</th><th className="table-cell">Future Casual</th><th className="table-cell">Future Earned</th><th className="table-cell">Future Unpaid</th><th className="table-cell">Projected Casual</th><th className="table-cell">Projected Earned</th><th className="table-cell">Warnings</th></tr></thead><tbody className="divide-y divide-slate-100">
          {rows.map((row) => <tr key={row.userId}><td className="table-cell font-medium">{row.fullName}</td><td className="table-cell">{row.beforeCasual.toFixed(2)}</td><td className="table-cell">{row.beforeEarned.toFixed(2)}</td><td className="table-cell">{row.restoredCasual.toFixed(2)}</td><td className="table-cell">{row.restoredEarned.toFixed(2)}</td><td className="table-cell">{row.afterCasual.toFixed(2)}</td><td className="table-cell">{row.afterEarned.toFixed(2)}</td><td className="table-cell">{row.futureCasual.toFixed(2)}</td><td className="table-cell">{row.futureEarned.toFixed(2)}</td><td className="table-cell">{row.futureUnpaid.toFixed(2)}</td><td className="table-cell">{row.projectedCasual.toFixed(2)}</td><td className="table-cell">{row.projectedEarned.toFixed(2)}</td><td className="table-cell text-xs">{row.warnings.join(" ") || "—"}</td></tr>)}
        </tbody></table>
      </section>
      {canApply ? (
        <section className="card border-amber-200 bg-amber-50 p-6">
          <h2 className="section-title">Apply transition</h2>
          <p className="section-subtitle">Run once after reviewing the full preview and taking a database backup.</p>
          <form action={applyLeaveBalanceTransitionAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="cutoverDateKey" value={cutoverDateKey} />
            <div className="md:col-span-2"><label className="label" htmlFor="note">Required migration note</label><textarea className="input min-h-24" id="note" name="note" required /></div>
            <div><label className="label" htmlFor="confirmation">Type MIGRATE</label><input className="input" id="confirmation" name="confirmation" required /></div>
            <div className="flex items-end"><button className="btn-primary">Apply migration</button></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
