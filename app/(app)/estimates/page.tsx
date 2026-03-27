import Link from "next/link";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import {
  createEstimateAction,
  reviewEstimateAction,
} from "@/lib/actions/estimate-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMinutes } from "@/lib/utils";
import { canFullyModerateProject, isRoleScopedManager } from "@/lib/permissions";
import { getVisibleProjects } from "@/lib/queries";

const estimateWithRelations = {
  include: {
    project: true,
    employee: true,
    reviews: {
      include: {
        reviewer: true,
      },
      orderBy: { reviewedAt: "desc" as const },
      take: 1,
    },
  },
  orderBy: { createdAt: "desc" as const },
} satisfies Prisma.EstimateFindManyArgs;

type EstimateRow = Prisma.EstimateGetPayload<{
  include: {
    project: true;
    employee: true;
    reviews: {
      include: {
        reviewer: true;
      };
    };
  };
}>;

export default async function EstimatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ create?: string }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const showCreate = params.create === "1";

  const [projects, countries, assignments] = await Promise.all([
    getVisibleProjects(user),
    db.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    (user.userType === "TEAM_LEAD" || isRoleScopedManager(user))
      ? db.employeeTeamLead.findMany({
          where: { teamLeadId: user.id },
          include: {
            employee: {
              select: { id: true, functionalRole: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const safeProjectIds = projects.length ? projects.map((p) => p.id) : ["__none__"];
  const assignedScopedEmployeeIds = assignments
    .filter((row) => row.employee.functionalRole === user.functionalRole)
    .map((row) => row.employeeId);

  const estimates = (await db.estimate.findMany({
    ...estimateWithRelations,
    where:
      user.userType === "EMPLOYEE"
        ? {
            employeeId: user.id,
            projectId: { in: safeProjectIds },
          }
        : user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
          ? {
              employeeId: { in: assignedScopedEmployeeIds.length ? assignedScopedEmployeeIds : ["__none__"] },
              projectId: { in: safeProjectIds },
            }
          : {
              projectId: { in: safeProjectIds },
            },
  })) as EstimateRow[];

  const countryMap = new Map(countries.map((country) => [country.id, country.name]));
  const managedIds = new Set(assignedScopedEmployeeIds);
  const canCreate = user.userType === "EMPLOYEE" || user.userType === "TEAM_LEAD" || isRoleScopedManager(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estimates"
        description={
          isRoleScopedManager(user)
            ? "Role-scoped Managers can review estimates only for assigned employees whose functional role matches their own. Team Leads can review only assigned employees whose functional role matches their own. Project Managers and Admins can review across visible projects."
            : "Team Leads can review only assigned employees whose functional role matches their own. Project Managers and Admins can review across visible projects."
        }
        actions={
          canCreate ? (
            <Link className="btn-primary" href="/estimates?create=1">
              Add Estimate
            </Link>
          ) : null
        }
      />

      {showCreate && canCreate ? (
        <form action={createEstimateAction} className="card p-6">
          <h2 className="section-title">Submit estimate</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">
                Project <span className="text-red-600">*</span>
              </label>
              <select className="input" name="projectId" required>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Country</label>
              <select className="input" name="countryId">
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
              <input className="input" type="date" name="workDate" required />
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
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input min-h-28" name="notes" />
            </div>

            <div className="md:col-span-2">
              <button className="btn-primary w-full md:w-auto">Submit estimate</button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Employee</th>
              <th className="table-cell">Project</th>
              <th className="table-cell">Minutes</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {estimates.map((estimate) => {
              const canReview =
                canFullyModerateProject(user) ||
                ((user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) &&
                  managedIds.has(estimate.employeeId) &&
                  estimate.employee.functionalRole === user.functionalRole);

              const canResubmit =
                estimate.employeeId === user.id && estimate.status === "REVISED";

              const latestReview = estimate.reviews[0];

              return (
                <tr key={estimate.id}>
                  <td className="table-cell align-top">
                    <div className="font-medium text-slate-900">
                      {estimate.employee.fullName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {estimate.countryId
                        ? countryMap.get(estimate.countryId) ?? "—"
                        : "No specific country"}
                    </div>
                    {latestReview?.remarks ? (
                      <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
                        Review note: {latestReview.remarks}
                      </div>
                    ) : null}
                  </td>
                  <td className="table-cell align-top">{estimate.project.name}</td>
                  <td className="table-cell align-top">
                    {formatMinutes(estimate.estimatedMinutes)}
                  </td>
                  <td className="table-cell align-top">
                    <span
                      className={
                        estimate.status === "APPROVED"
                          ? "badge-emerald"
                          : estimate.status === "REJECTED"
                            ? "badge-amber"
                            : estimate.status === "REVISED"
                              ? "badge-blue"
                              : "badge-slate"
                      }
                    >
                      {estimate.status}
                    </span>
                  </td>
                  <td className="table-cell align-top">
                    {canReview && estimate.status === "SUBMITTED" ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={reviewEstimateAction}>
                          <input type="hidden" name="estimateId" value={estimate.id} />
                          <input type="hidden" name="action" value="APPROVED" />
                          <button className="btn-secondary !px-3 !py-1.5 text-xs">
                            Approve
                          </button>
                        </form>
                        <form action={reviewEstimateAction}>
                          <input type="hidden" name="estimateId" value={estimate.id} />
                          <input type="hidden" name="action" value="REVISED" />
                          <input
                            type="hidden"
                            name="comment"
                            value="Please update and resubmit this estimate."
                          />
                          <button className="btn-secondary !px-3 !py-1.5 text-xs">
                            Revise
                          </button>
                        </form>
                      </div>
                    ) : canResubmit ? (
                      <a
                        href={`/estimates/${estimate.id}/edit`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Edit &amp; Resubmit
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {estimates.length === 0 ? (
              <tr>
                <td className="table-cell text-center text-sm text-slate-500" colSpan={5}>
                  No estimates found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
