import type { SessionUser } from "@/lib/auth";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { logoutAction } from "@/lib/actions/auth-actions";

export function Topbar({
  user,
  canAccessLeaveApprovals,
}: {
  user: SessionUser;
  canAccessLeaveApprovals: boolean;
}) {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="container-page flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <MobileSidebar user={user} canAccessLeaveApprovals={canAccessLeaveApprovals} />
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Project &amp; Leave Management Suite</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
          <p className="text-xs tracking-wide text-slate-500">
            {user.designation ? `${user.designation}` : ""}
          </p>
          <form action={logoutAction} className="pt-2 flex justify-end">
            <button className="btn-secondary w-full max-w-[224px] border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white sm:w-auto sm:min-w-[160px]">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
