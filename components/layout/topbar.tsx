import type { SessionUser } from "@/lib/auth";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="container-page flex items-center justify-between py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">PMS</p>
          <h1 className="text-lg font-semibold text-slate-900">Internal Delivery &amp; Billing</h1>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
          {user.designation ? (
            <p className="text-xs tracking-wide text-slate-500">{user.designation}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
