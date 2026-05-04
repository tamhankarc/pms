import type { ReactNode } from "react";
import { Sidebar, type BillingReportClientNavItem } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { SessionUser } from "@/lib/auth";

export function AppShell({
  user,
  canAccessLeaveApprovals,
  billingReportClients = [],
  children,
}: {
  user: SessionUser;
  canAccessLeaveApprovals: boolean;
  billingReportClients?: BillingReportClientNavItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar user={user} canAccessLeaveApprovals={canAccessLeaveApprovals} billingReportClients={billingReportClients} />
      <div className="min-w-0 flex-1">
        <Topbar user={user} canAccessLeaveApprovals={canAccessLeaveApprovals} billingReportClients={billingReportClients} />
        <main className="container-page py-8">{children}</main>
      </div>
    </div>
  );
}
