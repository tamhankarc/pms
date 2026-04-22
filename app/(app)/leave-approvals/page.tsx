import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canViewEMSAdminDashboard, isAdmin, isAdminProjectManager, isHR } from "@/lib/permissions";
import { getLeaveApprovalsForUser, getGlobalApproverAssignmentIds } from "@/lib/ems-queries";
import { formatDateInIst } from "@/lib/ist";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { LeaveReviewActions } from "./leave-review-actions";

export default async function LeaveApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const selectedApproverIds = await getGlobalApproverAssignmentIds();
  const isDesignatedApprover = selectedApproverIds.includes(user.id);
  const isAdminPmApprover = isAdminProjectManager(user) && isDesignatedApprover;
  const canAccessPage = isAdmin(user) || isHR(user) || isDesignatedApprover;

  if (!canAccessPage) {
    redirect("/dashboard");
  }

  const canAct = isDesignatedApprover;
  const canViewAll = canViewEMSAdminDashboard(user);
  const rows = await getLeaveApprovalsForUser(user.id, !canViewAll);
  const params = (await searchParams) ?? {};
  const pagination = paginateItems(rows, parsePageParam(params.page), 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Approvals"
        description={
          canAct
            ? "Review leave requests assigned to you as a designated approver."
            : "Admins and HR can view leave requests. Only the selected approver and Admin users with functional role Project Manager who are included in the approver list can take approval actions."
        }
      />

      <section className="table-wrap" id="leave-approvals-list">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Employee</th>
              <th className="table-cell">User type</th>
              <th className="table-cell">Functional role</th>
              <th className="table-cell">Leave type</th>
              <th className="table-cell">Date range</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Reason / Comment</th>
              <th className="table-cell">Approver</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagination.items.map((row) => {
              const showActions = row.status === "PENDING" && (row.approverId === user.id || isAdminPmApprover);

              return (
                <tr key={row.id}>
                  <td className="table-cell font-medium text-slate-900">{row.user.fullName}</td>
                  <td className="table-cell">{row.user.userType.replaceAll("_", " ")}</td>
                  <td className="table-cell">
                    {(row.user.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}
                  </td>
                  <td className="table-cell">{row.leaveType.replaceAll("_", " ")}</td>
                  <td className="table-cell">
                    {formatDateInIst(row.startDate)} - {formatDateInIst(row.endDate)}
                  </td>
                  <td className="table-cell">
                    <span className="badge-blue">{row.status.replaceAll("_", " ")}</span>
                  </td>
                  <td className="table-cell whitespace-pre-line">
                    {row.approverComment || row.reconsiderNote || row.reason || "—"}
                  </td>
                  <td className="table-cell">{row.approver?.fullName || "—"}</td>
                  <td className="table-cell">
                    {showActions ? (
                      <LeaveReviewActions id={row.id} />
                    ) : (
                      <span className="text-sm text-slate-500">Status only</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {pagination.totalItems === 0 ? (
              <tr>
                <td colSpan={9} className="table-cell text-center text-sm text-slate-500">
                  No leave requests found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <PaginationControls
          basePath="/leave-approvals"
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          searchParams={{ page: params.page }}
          anchor="#leave-approvals-list"
        />
      </section>
    </div>
  );
}