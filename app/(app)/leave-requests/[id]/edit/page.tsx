import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import {
  canAccessLeaveRequests,
  canAccessMenuItem,
  isHR,
} from "@/lib/permissions";
import { getIstDateKey } from "@/lib/ist";
import { updateLeaveRequestAction } from "@/lib/actions/leave-actions";
import { getLeaveRequestsForUser } from "@/lib/ems-queries";
import { LeaveRequestForm } from "@/components/ems/leave-request-form";
import { db } from "@/lib/db";

function parseStoredReason(reason: string | null | undefined) {
  const raw = (reason ?? "").trim();
  if (!raw) return { diwaliLeave: false, reason: "" };
  if (raw.startsWith("Diwali Leave: Yes\n"))
    return {
      diwaliLeave: true,
      reason: raw.replace(/^Diwali Leave: Yes\n/, ""),
    };
  return { diwaliLeave: false, reason: raw };
}

export default async function EditLeaveRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const routeParams = await params;
  if (
    !canAccessLeaveRequests(user) &&
    !canAccessMenuItem(user, "leave-requests")
  )
    return (
      <div className="space-y-6">
        <PageHeader
          title="Edit Leave Request"
          description="This account does not have access to leave requests."
        />
      </div>
    );
  const editRequest = await db.leaveRequest.findUnique({
    where: { id: routeParams.id },
    include: {
      user: { select: { id: true, fullName: true } },
      selectedApprovers: { select: { approverId: true } },
    },
  });
  if (
    !editRequest ||
    editRequest.status !== "RECONSIDER" ||
    (editRequest.userId !== user.id && !isHR(user))
  )
    notFound();
  const todayKey = getIstDateKey();
  const data = await getLeaveRequestsForUser(editRequest.userId, todayKey);
  const parsed = parseStoredReason(editRequest.reason);
  const minDate =
    parsed.reason && getIstDateKey(editRequest.startDate) > todayKey
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
          requestedForUserId: editRequest.userId,
          requestedForUserName: editRequest.user.fullName,
          startDate: getIstDateKey(editRequest.startDate),
          endDate: getIstDateKey(editRequest.endDate),
          reason: parsed.reason,
          approverId: editRequest.approverId,
          approverIds: editRequest.selectedApprovers.length
            ? editRequest.selectedApprovers.map((row) => row.approverId)
            : editRequest.approverId
              ? [editRequest.approverId]
              : [],
          diwaliLeave: parsed.diwaliLeave,
          daySelectionMode: editRequest.daySelectionMode,
          leaveDayTypesJson: editRequest.leaveDayTypesJson,
        }}
      />
    </div>
  );
}
