import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { SessionUser } from "@/lib/auth";

export function AppShell({
  user,
  canAccessLeaveApprovals,
  children,
}: {
  user: SessionUser;
  canAccessLeaveApprovals: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar user={user} canAccessLeaveApprovals={canAccessLeaveApprovals} />
      <div className="min-w-0 flex-1">
        <Topbar user={user} canAccessLeaveApprovals={canAccessLeaveApprovals} />
        <main className="container-page py-8">{children}</main>
      </div>
    </div>
  );
}
