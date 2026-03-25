import { notFound, redirect } from "next/navigation";
import { updateEstimateAction } from "@/lib/actions/estimate-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canFullyModerateProject } from "@/lib/permissions";

export default async function EditEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [estimate, countries] = await Promise.all([
    db.estimate.findUnique({
      where: { id },
      include: {
        project: true,
        employee: true,
        reviews: {
          include: {
            reviewer: true,
          },
          orderBy: { reviewedAt: "desc" },
          take: 5,
        },
      },
    }),
    db.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!estimate) {
    notFound();
  }

  const isOwner = estimate.employeeId === user.id;
  const canOverride = canFullyModerateProject(user);

  if (!isOwner && !canOverride) {
    redirect("/estimates");
  }

  if (!["DRAFT", "REVISED"].includes(estimate.status)) {
    redirect("/estimates");
  }

  const latestReview = estimate.reviews[0];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-6">
        <div className="mb-6">
          <h1 className="section-title">Edit &amp; Resubmit Estimate</h1>
          <p className="section-subtitle">
            Update the estimate and resubmit it for review.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Employee
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {estimate.employee.fullName}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Project
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {estimate.project.name}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current status
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {estimate.status}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current estimate
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {estimate.estimatedMinutes} minutes
              </div>
            </div>
          </div>

          {latestReview?.remarks ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="font-medium">Latest review note:</span>{" "}
              {latestReview.remarks}
            </div>
          ) : null}
        </div>

        <form action={updateEstimateAction} className="space-y-4">
          <input type="hidden" name="estimateId" value={estimate.id} />

          <div>
            <label className="label">Country</label>
            <select
              className="input"
              name="countryId"
              defaultValue={estimate.countryId ?? ""}
            >
              <option value="">No specific country</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">
              Work date <span className="text-red-600">*</span>
            </label>
            <input
              className="input"
              type="date"
              name="workDate"
              defaultValue={new Date(estimate.workDate).toISOString().slice(0, 10)}
              required
            />
          </div>

          <div>
            <label className="label">
              Estimated minutes <span className="text-red-600">*</span>
            </label>
            <input
              className="input"
              type="number"
              name="estimatedMinutes"
              min="15"
              step="15"
              defaultValue={estimate.estimatedMinutes}
              required
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-28"
              name="notes"
              defaultValue={estimate.notes ?? ""}
            />
          </div>

          <div className="flex gap-3">
            <a href="/estimates" className="btn-secondary">
              Cancel
            </a>
            <button className="btn-primary" type="submit">
              Resubmit estimate
            </button>
          </div>
        </form>

        {estimate.reviews.length > 0 ? (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="section-title">Review History</h2>
            <div className="mt-4 space-y-3">
              {estimate.reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-900">
                      {review.decisionStatus}
                    </div>
                    <div className="text-xs text-slate-500">
                      {review.reviewer.fullName} ·{" "}
                      {new Date(review.reviewedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">
                    {review.remarks || "No remarks."}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}