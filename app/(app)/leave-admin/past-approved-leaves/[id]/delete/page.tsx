import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessMenuItem, isAdmin, isHR } from "@/lib/permissions";
import { formatDateInIst } from "@/lib/ist";

export default async function LegacyDeletePastApprovedLeavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireUser();
  if (!isHR(actor) && !isAdmin(actor) && !canAccessMenuItem(actor, "leave-admin")) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Approved leave correction"
          description="You do not have access to Leave Administration."
        />
      </div>
    );
  }

  const { id } = await params;
  const request = await db.leaveRequest.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      startDate: true,
      endDate: true,
      user: { select: { fullName: true } },
    },
  });
  if (!request) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approved leave correction"
        description="Permanent deletion has been replaced by the audited cancellation and date-restoration workflow."
        actions={
          <Link className="btn-secondary" href="/leave-admin">
            Back to Leave Administration
          </Link>
        }
      />
      <section className="card p-6">
        <h2 className="section-title">{request.user.fullName}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {formatDateInIst(request.startDate)} to {formatDateInIst(request.endDate)}
        </p>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Approved leave is no longer deleted. Submit a cancellation request for
          this employee. HR will approve or reject it, cancel future scheduled
          dates, and explicitly select any processed dates that must be restored.
          Every balance reversal remains in the actual leave ledger.
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="btn-primary" href={`/leave-admin/${request.userId}`}>
            Open employee leave administration
          </Link>
          {isHR(actor) ? (
            <Link className="btn-secondary" href="/leave-admin/cancellations">
              Open cancellation reviews
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
