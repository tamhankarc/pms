import Link from "next/link";
import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  canAccessMenuItem,
  canViewEMSAdminDashboard,
  isAdmin,
  isAdminProjectManager,
  isHR,
} from "@/lib/permissions";
import {
  getLeaveApprovalsForUser,
  getLeaveApprovalUserOptionsForUser,
  getGlobalApproverAssignmentIds,
} from "@/lib/ems-queries";
import { formatDateInIst } from "@/lib/ist";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { LeaveReviewActions } from "./leave-review-actions";

type SearchParams = {
  page?: string;
  requestId?: string;
  fromDate?: string;
  toDate?: string;
  userId?: string;
};

function hasValidDateFormat(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export default async function LeaveApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const selectedApproverIds = await getGlobalApproverAssignmentIds();
  const isDesignatedApprover = selectedApproverIds.includes(user.id);
  const isAdminPmApprover = isAdminProjectManager(user) && isDesignatedApprover;
  const canAccessPage =
    isAdmin(user) ||
    isHR(user) ||
    isDesignatedApprover ||
    canAccessMenuItem(user, "leave-approvals");

  if (!canAccessPage) {
    redirect("/dashboard");
  }

  const params = (await searchParams) ?? {};
  const canAct = isDesignatedApprover;
  const canViewAll = canViewEMSAdminDashboard(user);
  const showAppliedOnColumn = isHR(user);
  const filters = {
    fromDateKey: hasValidDateFormat(params.fromDate)
      ? params.fromDate
      : undefined,
    toDateKey: hasValidDateFormat(params.toDate) ? params.toDate : undefined,
    userId: params.userId || undefined,
  };
  const [rows, userOptions] = await Promise.all([
    getLeaveApprovalsForUser(user.id, !canViewAll, filters),
    getLeaveApprovalUserOptionsForUser(user.id, !canViewAll),
  ]);
  const visibleRows = params.requestId
    ? rows.filter((row) => row.id === params.requestId)
    : rows;
  const pagination = paginateItems(
    visibleRows,
    parsePageParam(params.page),
    10,
  );
  const paginationSearchParams = {
    requestId: params.requestId,
    fromDate: params.fromDate,
    toDate: params.toDate,
    userId: params.userId,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Approvals"
        description={
          canAct
            ? "Review leave requests assigned to you as a designated approver."
            : "Admins and Administration/HR users can view leave requests. Only the selected approver and Admin users with functional role Project Manager who are included in the approver list can take approval actions."
        }
      />

      <section className="card p-5">
        <AutoSubmitFilterForm className="grid gap-4 md:grid-cols-[180px_180px_minmax(220px,1fr)_auto]">
          <div>
            <label className="label" htmlFor="fromDate">
              From date
            </label>
            <input
              className="input"
              id="fromDate"
              name="fromDate"
              type="date"
              defaultValue={params.fromDate || ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="toDate">
              To date
            </label>
            <input
              className="input"
              id="toDate"
              name="toDate"
              type="date"
              defaultValue={params.toDate || ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="userId">
              User
            </label>
            <SearchableCombobox
              id="userId"
              name="userId"
              defaultValue={params.userId || ""}
              options={[
                { value: "", label: "All visible users" },
                ...userOptions.map((option) => ({
                  value: option.id,
                  label: option.email
                    ? `${option.fullName} (${option.email})`
                    : option.fullName,
                })),
              ]}
              placeholder="All visible users"
              searchPlaceholder="Search users..."
              emptyLabel="No user found."
            />
          </div>
          <div className="flex items-end">
            <Link className="btn-secondary" href="/leave-approvals">
              Reset
            </Link>
          </div>
          <p className="text-sm text-slate-500 md:col-span-4">
            Date range filter is based on the leave application date, not the
            leave start/end date.
          </p>
        </AutoSubmitFilterForm>
      </section>

      <section className="table-wrap" id="leave-approvals-list">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Employee</th>
              {showAppliedOnColumn ? (
                <th className="table-cell">Applied on</th>
              ) : null}
              <th className="table-cell">User type</th>
              <th className="table-cell">Functional role</th>
              <th className="table-cell">Leave breakup</th>
              <th className="table-cell">Date range</th>
              <th className="table-cell">Days</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Reason / Comment</th>
              <th className="table-cell">Approver</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagination.items.map((row) => {
              const showActions =
                row.status === "PENDING" &&
                ((row.selectedApprovers?.some(
                  (item) => item.approver.id === user.id,
                ) ?? false) ||
                  row.approverId === user.id ||
                  isAdminPmApprover);

              return (
                <tr key={row.id}>
                  <td className="table-cell font-medium text-slate-900">
                    {row.user.fullName}
                  </td>
                  {showAppliedOnColumn ? (
                    <td className="table-cell">
                      {formatDateInIst(row.createdAt)}
                    </td>
                  ) : null}
                  <td className="table-cell">
                    {row.user.userType === "HR"
                      ? "Administration/HR"
                      : row.user.userType.replaceAll("_", " ")}
                  </td>
                  <td className="table-cell">
                    {(row.user.functionalRole ?? "UNASSIGNED").replaceAll(
                      "_",
                      " ",
                    )}
                  </td>
                  <td className="table-cell">
                    {row.status === "APPROVED" || row.status === "CANCELLED"
                      ? row.leaveType.replaceAll("_", " ")
                      : row.status === "REJECTED"
                        ? "No balance deducted"
                        : "Calculated on approval"}
                  </td>
                  <td className="table-cell">
                    {formatDateInIst(row.startDate)} -{" "}
                    {formatDateInIst(row.endDate)}
                  </td>
                  <td className="table-cell">
                    {Number(row.totalLeaveDays ?? 0).toFixed(2)}
                  </td>
                  <td className="table-cell">
                    <span className="badge-blue">
                      {row.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="table-cell whitespace-pre-line">
                    {row.approverComment ||
                      row.reconsiderNote ||
                      row.reason ||
                      "—"}
                  </td>
                  <td className="table-cell">
                    {row.selectedApprovers?.length
                      ? row.selectedApprovers
                          .map((item) => item.approver.fullName)
                          .join(", ")
                      : row.approver?.fullName || "—"}
                  </td>
                  <td className="table-cell">
                    {showActions ? (
                      <LeaveReviewActions id={row.id} />
                    ) : (
                      <span className="text-sm text-slate-500">
                        Status only
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {pagination.totalItems === 0 ? (
              <tr>
                <td
                  colSpan={showAppliedOnColumn ? 11 : 10}
                  className="table-cell text-center text-sm text-slate-500"
                >
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
          searchParams={paginationSearchParams}
          anchor="#leave-approvals-list"
        />
      </section>
    </div>
  );
}
