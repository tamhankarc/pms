import Link from "next/link";
import { notFound } from "next/navigation";
import { LeaveCancellationReviewButton } from "@/components/ems/leave-cancellation-review-button";
import { PageHeader } from "@/components/ui/page-header";
import { reviewLeaveCancellationAction } from "@/lib/actions/leave-cancellation-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateInIst, formatTimeInIst, getIstDateKey } from "@/lib/ist";
import { isHR } from "@/lib/permissions";

function parseRestoredDateKeys(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function statusClass(status: string) {
  if (status === "PENDING") return "bg-amber-100 text-amber-800";
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800";
  return "bg-rose-100 text-rose-800";
}

export default async function LeaveCancellationRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!isHR(user)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Leave Cancellation Request"
          description="Only Administration/HR can review leave cancellation requests."
        />
      </div>
    );
  }

  const { id } = await params;
  const row = await db.leaveCancellationRequest.findUnique({
    where: { id },
    include: {
      requestedBy: { select: { fullName: true } },
      reviewedBy: { select: { fullName: true } },
      leaveRequest: {
        include: {
          user: { select: { fullName: true } },
          dateAllocations: { orderBy: { leaveDate: "asc" } },
        },
      },
    },
  });
  if (!row) notFound();

  const todayKey = getIstDateKey();
  const processed = row.leaveRequest.dateAllocations.filter(
    (allocation) => allocation.status === "PROCESSED",
  );
  const scheduled = row.leaveRequest.dateAllocations.filter(
    (allocation) => allocation.status === "SCHEDULED",
  );
  const nonSandwichAllocations = row.leaveRequest.dateAllocations.filter(
    (allocation) => !allocation.isSandwichDay,
  );
  const isSingleDateLeave =
    nonSandwichAllocations.length === 1 &&
    Number(nonSandwichAllocations[0]?.duration ?? 0) <= 1;
  const autoRestoreSingleDate =
    isSingleDateLeave &&
    processed.length === 1 &&
    processed[0]?.id === nonSandwichAllocations[0]?.id;
  const restoredDateKeys = parseRestoredDateKeys(
    row.restoredProcessedDateKeysJson,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Cancellation Request · ${row.leaveRequest.user.fullName}`}
        description="Review the request or inspect the completed cancellation decision and restored leave dates."
        actions={
          <Link className="btn-secondary" href="/leave-admin/cancellations">
            Back to Cancellation Requests
          </Link>
        }
      />

      <section className="card p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">Employee</p>
            <p className="font-semibold text-slate-900">
              {row.leaveRequest.user.fullName}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Leave range</p>
            <p className="font-semibold text-slate-900">
              {formatDateInIst(row.leaveRequest.startDate)} to{" "}
              {formatDateInIst(row.leaveRequest.endDate)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Current leave status</p>
            <p className="font-semibold text-slate-900">
              {row.leaveRequest.status.replaceAll("_", " ")}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Requested by</p>
            <p className="font-semibold text-slate-900">
              {row.requestedBy.fullName}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Requested on</p>
            <p className="font-semibold text-slate-900">
              {formatDateInIst(row.createdAt)} · {formatTimeInIst(row.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Cancellation status</p>
            <span
              className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}
            >
              {row.status}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Cancellation reason</p>
          <p className="mt-1 whitespace-pre-line">{row.reason}</p>
        </div>
      </section>

      <section className="table-wrap">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="section-title">Leave-date allocation status</h2>
          <p className="section-subtitle">
            Processed dates remain leave unless HR restores them. Scheduled dates are released when cancellation is approved.
          </p>
        </div>
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Date</th>
              <th className="table-cell">Duration</th>
              <th className="table-cell">Allocation status</th>
              <th className="table-cell">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {row.leaveRequest.dateAllocations.map((allocation) => (
              <tr key={allocation.id}>
                <td className="table-cell">
                  {getIstDateKey(allocation.leaveDate)}
                  {getIstDateKey(allocation.leaveDate) === todayKey
                    ? " · Today"
                    : ""}
                </td>
                <td className="table-cell">
                  {Number(allocation.duration).toFixed(2)}
                </td>
                <td className="table-cell">
                  {allocation.status.replaceAll("_", " ")}
                </td>
                <td className="table-cell">
                  {allocation.isSandwichDay ? "Sandwich" : allocation.dayPart.replaceAll("_", " ")}
                </td>
              </tr>
            ))}
            {row.leaveRequest.dateAllocations.length === 0 ? (
              <tr>
                <td className="table-cell text-center text-sm text-slate-500" colSpan={4}>
                  No date-level allocations are available for this request.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {row.status === "PENDING" ? (
        <section className="card p-6">
          <h2 className="section-title">HR review</h2>
          <p className="section-subtitle">
            Future scheduled dates are cancelled automatically. Select only processed dates that HR has verified should be restored as non-leave dates.
          </p>

          <form action={reviewLeaveCancellationAction} className="mt-5 space-y-4">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="decision" />
            <input type="hidden" name="confirmKeepProcessedDates" value="" />
            {processed.length ? (
              autoRestoreSingleDate ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">
                    Processed date will be restored automatically
                  </p>
                  <p className="mt-1">
                    This is a half-day or single-day leave. Approving the cancellation will restore {getIstDateKey(processed[0].leaveDate)}
                    {getIstDateKey(processed[0].leaveDate) === todayKey
                      ? " (today)"
                      : ""} as a non-leave date. No date selection is required.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Processed dates to restore as non-leave
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Leave dates stay deducted unless HR explicitly selects them. If no date is selected, HR will be asked to confirm that the processed dates should remain leave.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {processed.map((allocation) => {
                      const key = getIstDateKey(allocation.leaveDate);
                      return (
                        <label
                          key={allocation.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            name="restoreDateKeys"
                            value={key}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span>
                            {key}
                            {key === todayKey ? " · Today" : ""}
                            {allocation.isSandwichDay ? " · Sandwich" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )
            ) : null}
            <div>
              <label className="label" htmlFor="reviewNote">
                HR review note
              </label>
              <textarea
                className="input min-h-24"
                id="reviewNote"
                name="reviewNote"
                placeholder={
                  autoRestoreSingleDate
                    ? "Required because this processed date will be restored automatically."
                    : "Required when restoring processed dates; otherwise optional."
                }
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <LeaveCancellationReviewButton
                decision="APPROVED"
                processedDateCount={processed.length}
                scheduledDateCount={scheduled.length}
                autoRestoreSingleDate={autoRestoreSingleDate}
              />
              <LeaveCancellationReviewButton
                decision="REJECTED"
                processedDateCount={processed.length}
                scheduledDateCount={scheduled.length}
              />
            </div>
          </form>
        </section>
      ) : (
        <section className="card p-6">
          <h2 className="section-title">HR decision</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Decision</p>
              <p className="font-semibold text-slate-900">{row.status}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Reviewed by</p>
              <p className="font-semibold text-slate-900">
                {row.reviewedBy?.fullName ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Reviewed on</p>
              <p className="font-semibold text-slate-900">
                {row.reviewedAt
                  ? `${formatDateInIst(row.reviewedAt)} · ${formatTimeInIst(row.reviewedAt)}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Restored processed dates</p>
              <p className="font-semibold text-slate-900">
                {restoredDateKeys.length ? restoredDateKeys.join(", ") : "None"}
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">HR review note</p>
            <p className="mt-1 whitespace-pre-line">{row.reviewNote || "No review note entered."}</p>
          </div>
        </section>
      )}
    </div>
  );
}
