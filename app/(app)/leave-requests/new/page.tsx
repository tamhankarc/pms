import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { canAccessLeaveRequests } from "@/lib/permissions";
import { getIstDateKey } from "@/lib/ist";
import { createLeaveRequestAction } from "@/lib/actions/leave-actions";
import { getLeaveRequestsForUser } from "@/lib/ems-queries";
import { LeaveRequestForm } from "@/components/ems/leave-request-form";

export default async function NewLeaveRequestPage() {
  const user = await requireUser();

  if (!canAccessLeaveRequests(user)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Create Leave Request" description="This account does not have access to leave requests." />
      </div>
    );
  }

  const todayKey = getIstDateKey();
  const data = await getLeaveRequestsForUser(user.id, todayKey);

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
      />
    </div>
  );
}
