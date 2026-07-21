import Link from "next/link";
import type { LeaveCancellationStatus } from "@prisma/client";
import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isHR } from "@/lib/permissions";
import { formatDateInIst, formatTimeInIst } from "@/lib/ist";
import { DEFAULT_PAGE_SIZE, parsePageParam } from "@/lib/pagination";

const statusOptions: Array<{
  value: "" | LeaveCancellationStatus;
  label: string;
}> = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function statusClass(status: LeaveCancellationStatus) {
  if (status === "PENDING") return "bg-amber-100 text-amber-800";
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800";
  return "bg-rose-100 text-rose-800";
}

export default async function LeaveCancellationRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; status?: string }>;
}) {
  const user = await requireUser();
  if (!isHR(user)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Leave Cancellation Requests"
          description="Only Administration/HR can review leave cancellation requests."
        />
      </div>
    );
  }

  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);
  const requestedStatus = statusOptions.some(
    (option) => option.value && option.value === params.status,
  )
    ? (params.status as LeaveCancellationStatus)
    : undefined;
  const where = requestedStatus ? { status: requestedStatus } : {};

  const [totalItems, pendingCount] = await Promise.all([
    db.leaveCancellationRequest.count({ where }),
    db.leaveCancellationRequest.count({ where: { status: "PENDING" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / DEFAULT_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = await db.leaveCancellationRequest.findMany({
    where,
    include: {
      requestedBy: { select: { fullName: true } },
      reviewedBy: { select: { fullName: true } },
      leaveRequest: {
        include: {
          user: { select: { fullName: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (currentPage - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Cancellation Requests"
        description={`${pendingCount} request${pendingCount === 1 ? " is" : "s are"} awaiting HR review. Open an individual request to review it or view its completed decision.`}
        actions={
          <Link className="btn-secondary" href="/leave-admin">
            Back to Leave Administration
          </Link>
        }
      />

      <section className="card p-5">
        <AutoSubmitFilterForm className="grid gap-4 md:grid-cols-[minmax(220px,360px)_auto]">
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <SearchableCombobox
              id="status"
              name="status"
              defaultValue={requestedStatus ?? ""}
              options={statusOptions}
              placeholder="All statuses"
              searchPlaceholder="Search statuses..."
              emptyLabel="No status found."
            />
          </div>
          <div className="flex items-end">
            <Link className="btn-secondary" href="/leave-admin/cancellations">
              Reset
            </Link>
          </div>
        </AutoSubmitFilterForm>
      </section>

      <section className="table-wrap" id="leave-cancellation-list">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="section-title">Cancellation request history</h2>
          <p className="section-subtitle">
            Pending, approved, and rejected cancellation requests are retained for audit.
          </p>
        </div>
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Employee</th>
              <th className="table-cell">Leave dates</th>
              <th className="table-cell">Requested by</th>
              <th className="table-cell">Requested on</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Reviewed by</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="table-cell font-medium text-slate-900">
                  {row.leaveRequest.user.fullName}
                </td>
                <td className="table-cell">
                  {formatDateInIst(row.leaveRequest.startDate)} to{" "}
                  {formatDateInIst(row.leaveRequest.endDate)}
                </td>
                <td className="table-cell">{row.requestedBy.fullName}</td>
                <td className="table-cell">
                  {formatDateInIst(row.createdAt)} · {formatTimeInIst(row.createdAt)}
                </td>
                <td className="table-cell">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="table-cell">
                  {row.reviewedBy?.fullName ?? "Not reviewed"}
                </td>
                <td className="table-cell">
                  <Link
                    className="btn-secondary text-xs"
                    href={`/leave-admin/cancellations/${row.id}`}
                  >
                    {row.status === "PENDING" ? "Review" : "View"}
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  className="table-cell text-center text-sm text-slate-500"
                  colSpan={7}
                >
                  No cancellation requests match the selected status.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <PaginationControls
          basePath="/leave-admin/cancellations"
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={DEFAULT_PAGE_SIZE}
          searchParams={{ status: requestedStatus }}
          anchor="#leave-cancellation-list"
        />
      </section>
    </div>
  );
}
