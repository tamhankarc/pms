import type { SessionUser } from "@/lib/auth";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { logoutAction } from "@/lib/actions/auth-actions";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="container-page flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <MobileSidebar user={user} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">PMS</p>
            <h1 className="text-lg font-semibold text-slate-900">Internal Delivery &amp; Billing</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
          {user.designation ? (
            <p className="text-xs tracking-wide text-slate-500">{user.designation}</p>
          ) : null}
          <form action={logoutAction} className="pt-2">
            <button className="btn-secondary w-full border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
