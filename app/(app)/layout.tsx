import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth";
import { getGlobalApproverAssignmentIds } from "@/lib/ems-queries";
import { canViewBillingReports, isAdmin, isHR } from "@/lib/permissions";
import { db } from "@/lib/db";
import { billingReportClientVisibilityWhere } from "@/lib/billing-reports/config";
import { getBillingReportCatalogForClient } from "@/lib/billing-reports/amazon";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const selectedApproverIds = await getGlobalApproverAssignmentIds();
  const canAccessLeaveApprovals = isAdmin(user) || isHR(user) || selectedApproverIds.includes(user.id);
  const visibleBillingReportClients = canViewBillingReports(user)
    ? await db.client.findMany({
        where: billingReportClientVisibilityWhere,
        select: {
          id: true,
          name: true,
          showMoviesInEntries: true,
          projects: { select: { id: true, _count: { select: { timeEntries: true } } } },
          movies: { select: { id: true, isActive: true, _count: { select: { timeEntries: true } } } },
        },
        orderBy: { name: "asc" },
      })
    : [];
  const billingReportClients = visibleBillingReportClients.filter((client) => {
    if (getBillingReportCatalogForClient(client.name, client.id) || !client.showMoviesInEntries) return true;
    return client.projects.some((project) => project._count.timeEntries > 0) || client.movies.some((movie) => movie.isActive);
  }).map(({ id, name }) => ({ id, name }));

  return <AppShell user={user} canAccessLeaveApprovals={canAccessLeaveApprovals} billingReportClients={billingReportClients}>{children}</AppShell>;
}
