import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth";
import { getGlobalApproverAssignmentIds } from "@/lib/ems-queries";
import { canViewBillingReports, isAdmin, isHR } from "@/lib/permissions";
import { db } from "@/lib/db";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const selectedApproverIds = await getGlobalApproverAssignmentIds();
  const canAccessLeaveApprovals = isAdmin(user) || isHR(user) || selectedApproverIds.includes(user.id);
  const billingReportClients = canViewBillingReports(user)
    ? await db.client.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return <AppShell user={user} canAccessLeaveApprovals={canAccessLeaveApprovals} billingReportClients={billingReportClients}>{children}</AppShell>;
}
