import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { canAccessLeaveRequests } from "@/lib/permissions";
import { getIstDateKey } from "@/lib/ist";
import { updateLeaveRequestAction } from "@/lib/actions/leave-actions";
import { getLeaveRequestsForUser } from "@/lib/ems-queries";
import { LeaveRequestForm } from "@/components/ems/leave-request-form";

function parseStoredReason(reason: string | null | undefined) {
  const raw = (reason ?? "").trim();
  if (!raw) {
    return { diwaliLeave: false, reason: "" };
  }
  if (raw.startsWith("Diwali Leave: Yes\n")) {
    return {
      diwaliLeave: true,
      reason: raw.replace(/^Diwali Leave: Yes\n/, ""),
    };
  }
  return { diwaliLeave: false, reason: raw };
}

export default async function EditLeaveRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const routeParams = await params;

  if (!canAccessLeaveRequests(user)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Leave Request" description="This account does not have access to leave requests." />
      </div>
    );
  }

  const todayKey = getIstDateKey();
  const data = await getLeaveRequestsForUser(user.id, todayKey);
  const editRequest = data.current.find((row) => row.id === routeParams.id && row.status === "RECONSIDER");

  if (!editRequest) {
    notFound();
  }

  const parsed = parseStoredReason(editRequest.reason);
  const minDate = parsed.reason && getIstDateKey(editRequest.startDate) > todayKey
    ? getIstDateKey(editRequest.startDate)
    : todayKey;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Leave Request"
        description="Update and resubmit the leave request marked for reconsideration. Start and end dates cannot be weekends or official holidays."
        actions={
          <Link className="btn-secondary" href="/leave-requests">
            Back to Leave Requests
          </Link>
        }
      />

      <LeaveRequestForm
        action={updateLeaveRequestAction}
        approvers={data.approvers}
        mode="edit"
        minDate={minDate}
        leaveBalance={data.leaveBalance}
        blockedDateKeys={data.officialHolidays}
        initialValues={{
          id: editRequest.id,
          startDate: getIstDateKey(editRequest.startDate),
          endDate: getIstDateKey(editRequest.endDate),
          reason: parsed.reason,
          approverId: editRequest.approverId,
          diwaliLeave: parsed.diwaliLeave,
        }}
      />
    </div>
  );
}
