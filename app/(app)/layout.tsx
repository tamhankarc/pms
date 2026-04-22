import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth";
import { getGlobalApproverAssignmentIds } from "@/lib/ems-queries";
import { isAdmin, isHR } from "@/lib/permissions";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const selectedApproverIds = await getGlobalApproverAssignmentIds();
  const canAccessLeaveApprovals = isAdmin(user) || isHR(user) || selectedApproverIds.includes(user.id);

  return <AppShell user={user} canAccessLeaveApprovals={canAccessLeaveApprovals}>{children}</AppShell>;
}
