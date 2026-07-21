import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import {
  canAccessLeaveRequests,
  canAccessMenuItem,
  isHR,
  isAdmin,
} from "@/lib/permissions";
import { getIstDateKey } from "@/lib/ist";
import { createLeaveRequestAction } from "@/lib/actions/leave-actions";
import { getLeaveRequestsForUser, isLeaveAllowedUser } from "@/lib/ems-queries";
import { LeaveRequestForm } from "@/components/ems/leave-request-form";
import { db } from "@/lib/db";

export default async function NewLeaveRequestPage() {
  const user = await requireUser();
  if (
    !canAccessLeaveRequests(user) &&
    !canAccessMenuItem(user, "leave-requests") &&
    !isAdmin(user) &&
    !isHR(user)
  ) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Create Leave Request"
          description="This account does not have access to leave requests."
        />
      </div>
    );
  }
  const todayKey = getIstDateKey();
  const data = await getLeaveRequestsForUser(user.id, todayKey);
  const canCreateOnBehalf = isHR(user) || isAdmin(user);
  const employeeContexts = canCreateOnBehalf
    ? await Promise.all(
        (
          await db.user.findMany({
            where: { isActive: true },
            select: {
              id: true,
              fullName: true,
              userType: true,
              functionalRole: true,
            },
            orderBy: { fullName: "asc" },
          })
        )
          .filter(isLeaveAllowedUser)
          .map(async (employee) => {
            const context = await getLeaveRequestsForUser(
              employee.id,
              todayKey,
            );
            return {
              id: employee.id,
              fullName: employee.fullName,
              approvers: context.approvers,
              leaveBalance: context.leaveBalance,
              blockedDateKeys: context.officialHolidays,
            };
          }),
      )
    : [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Leave Request"
        description="Create a new leave request for approval. Start and end dates cannot be weekends or official holidays."
        actions={
          <Link className="btn-secondary" href="/leave-requests">
            Back to Leave Requests
          </Link>
        }
      />
      <LeaveRequestForm
        action={createLeaveRequestAction}
        approvers={data.approvers}
        mode="create"
        minDate={todayKey}
        leaveBalance={data.leaveBalance}
        blockedDateKeys={data.officialHolidays}
        canCreateOnBehalf={canCreateOnBehalf}
        currentUserId={user.id}
        employeeContexts={employeeContexts}
        canManualOverride={isHR(user)}
      />
    </div>
  );
}
