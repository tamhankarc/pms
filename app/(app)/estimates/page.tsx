import Link from "next/link";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMinutes } from "@/lib/utils";
import { reviewEstimateAction } from "@/lib/actions/estimate-actions";
import { canFullyModerateProject, isManager, isRoleScopedManager } from "@/lib/permissions";
import { getVisibleProjects } from "@/lib/queries";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

function normalizeDateInput(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function buildFromBoundary(value: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function buildToBoundary(value: string) {
  return value ? new Date(`${value}T23:59:59.999`) : undefined;
}

const estimateWithRelations = {
  include: {
    project: { include: { client: true } },
    subProject: true,
    employee: true,
    movie: true,
    language: true,
    reviews: {
      include: {
        reviewer: true,
      },
      orderBy: { reviewedAt: "desc" as const },
      take: 1,
    },
  },
  orderBy: [{ workDate: "desc" as const }, { createdAt: "desc" as const }],
} satisfies Prisma.EstimateFindManyArgs;

type EstimateRow = Prisma.EstimateGetPayload<{
  include: {
    project: { include: { client: true } };
    subProject: true;
    employee: true;
    movie: true;
    language: true;
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
  searchParams?: Promise<{ clientId?: string; projectId?: string; fromDate?: string; toDate?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const selectedClientId = params.clientId ?? "all";
  const selectedProjectId = params.projectId ?? "all";
  const selectedFromDate = normalizeDateInput(params.fromDate);
  const selectedToDate = normalizeDateInput(params.toDate);
  const page = parsePageParam(params.page);

  const [projects, countries, assignments] = await Promise.all([
    getVisibleProjects(user, { allowedStatuses: ["ACTIVE", "ON_HOLD"] }),
    db.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
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

  const filteredProjects = projects.filter((project) => {
    const matchesClient = selectedClientId === "all" ? true : project.clientId === selectedClientId;
    const matchesProject = selectedProjectId === "all" ? true : project.id === selectedProjectId;
    return matchesClient && matchesProject;
  });

  const safeProjectIds = filteredProjects.length ? filteredProjects.map((p) => p.id) : ["__none__"];
  const assignedScopedEmployeeIds = assignments
    .filter((row) => row.employee.functionalRole === user.functionalRole)
    .map((row) => row.employeeId);

  const fromBoundary = buildFromBoundary(selectedFromDate);
  const toBoundary = buildToBoundary(selectedToDate);
  const workDateFilter = {
    ...(fromBoundary ? { gte: fromBoundary } : {}),
    ...(toBoundary ? { lte: toBoundary } : {}),
  };
  const hasWorkDateFilter = Object.keys(workDateFilter).length > 0;

  const estimates = (await db.estimate.findMany({
    ...estimateWithRelations,
    where:
      user.userType === "EMPLOYEE"
        ? {
            employeeId: user.id,
            projectId: { in: safeProjectIds },
            project: { is: { isActive: true, status: { in: ["ACTIVE", "ON_HOLD"] } } },
            OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
            ...(hasWorkDateFilter ? { workDate: workDateFilter } : {}),
          }
        : user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
          ? {
              OR: [
                {
                  employeeId: user.id,
                  projectId: { in: safeProjectIds },
                  project: { is: { isActive: true, status: { in: ["ACTIVE", "ON_HOLD"] } } },
                  OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
                  ...(hasWorkDateFilter ? { workDate: workDateFilter } : {}),
                },
                {
                  employeeId: {
                    in: assignedScopedEmployeeIds.length ? assignedScopedEmployeeIds : ["__none__"],
                  },
                  projectId: { in: safeProjectIds },
                  project: { is: { isActive: true, status: { in: ["ACTIVE", "ON_HOLD"] } } },
                  OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
                  ...(hasWorkDateFilter ? { workDate: workDateFilter } : {}),
                },
              ],
            }
          : {
              projectId: { in: safeProjectIds },
              project: { is: { isActive: true, status: { in: ["ACTIVE", "ON_HOLD"] } } },
              OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }],
              ...(hasWorkDateFilter ? { workDate: workDateFilter } : {}),
            },
  })) as EstimateRow[];

  const countryMap = new Map(countries.map((country) => [country.id, country.name]));
  const managedIds = new Set(assignedScopedEmployeeIds);
  const canCreate = user.userType === "EMPLOYEE" || user.userType === "TEAM_LEAD" || isRoleScopedManager(user);

  const clientOptions = Array.from(
    new Map(projects.map((project) => [project.client.id, { id: project.client.id, name: project.client.name }])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const projectOptions = projects.filter((project) =>
    selectedClientId === "all" ? true : project.clientId === selectedClientId,
  );

  const { items: paginatedEstimates, currentPage, totalPages, totalItems, pageSize } = paginateItems(estimates, page, DEFAULT_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estimates"
        description={
          isManager(user)
            ? "Role-scoped Managers can review estimates only for assigned employees whose functional role matches their own. Team Leads can review only assigned employees whose functional role matches their own. Project Managers and Admins can review across visible projects."
            : "Team Leads can review only assigned employees whose functional role matches their own. Project Managers and Admins can review across visible projects."
        }
        actions={
          canCreate ? (
            <Link className="btn-primary" href="/estimates/new">
              Add Estimate
            </Link>
          ) : null
        }
      />

      <div className="card p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-[180px]">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="fromDate">
              Date from
            </label>
            <input
              id="fromDate"
              name="fromDate"
              type="date"
              defaultValue={selectedFromDate}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="w-full sm:w-[180px]">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="toDate">
              Date to
            </label>
            <input
              id="toDate"
              name="toDate"
              type="date"
              defaultValue={selectedToDate}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="w-full min-w-0 sm:w-[260px] lg:w-[300px]">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="clientId">
              Client
            </label>
            <SearchableCombobox
              id="clientId"
              name="clientId"
              defaultValue={selectedClientId}
              options={[{ value: "all", label: "All clients" }, ...clientOptions.map((client) => ({ value: client.id, label: client.name }))]}
              placeholder="All clients"
              searchPlaceholder="Search clients..."
              emptyLabel="No clients found."
            />
          </div>

          <div className="w-full min-w-0 sm:w-[260px] lg:w-[300px]">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="projectId">
              Project
            </label>
            <SearchableCombobox
              id="projectId"
              name="projectId"
              defaultValue={selectedProjectId}
              options={[
                { value: "all", label: "All projects" },
                ...projectOptions.map((project) => ({ value: project.id, label: project.name })),
              ]}
              placeholder="All projects"
              searchPlaceholder="Search projects..."
              emptyLabel="No projects found."
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary" type="submit">
              Apply
            </button>
            <Link className="btn-secondary" href="/estimates">
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Employee</th>
              <th className="table-cell">Client</th>
              <th className="table-cell">Project</th>
              <th className="table-cell">Minutes</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedEstimates.map((estimate) => {
              const canReview =
                canFullyModerateProject(user) ||
                ((user.userType === "TEAM_LEAD" || isManager(user)) &&
                  managedIds.has(estimate.employeeId) &&
                  estimate.employee.functionalRole === user.functionalRole);

              const canResubmit = (estimate.employeeId === user.id || canFullyModerateProject(user)) && ["REVISED", "DRAFT"].includes(estimate.status);

              const latestReview = estimate.reviews[0];

              return (
                <tr key={estimate.id}>
                  <td className="table-cell align-top">
                    <div className="font-medium text-slate-900">{estimate.employee.fullName}</div>
                    <div className="text-xs text-slate-500">
                      {estimate.countryId ? countryMap.get(estimate.countryId) ?? "—" : "No specific country"}
                    </div>
                    <div className="text-xs text-slate-500">{estimate.movie?.title ?? "No specific movie"}</div>
                    <div className="text-xs text-slate-500">
                      {estimate.language ? `${estimate.language.name} (${estimate.language.code})` : "No specific language"}
                    </div>
                    {latestReview?.remarks ? (
                      <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
                        Review note: {latestReview.remarks}
                      </div>
                    ) : null}
                  </td>
                  <td className="table-cell align-top">{estimate.project.client.name}</td>
                  <td className="table-cell align-top">
                    {estimate.project.name}
                    <div className="text-xs text-slate-500">{estimate.subProject?.name ?? "No Sub Project"}</div>
                  </td>
                  <td className="table-cell align-top">{formatMinutes(estimate.estimatedMinutes)}</td>
                  <td className="table-cell align-top">
                    <span
                      className={
                        estimate.status === "APPROVED"
                          ? "badge-emerald"
                          : estimate.status === "REJECTED"
                            ? "badge-rose"
                            : estimate.status === "REVISED"
                              ? "badge-amber"
                              : "badge-slate"
                      }
                    >
                      {estimate.status}
                    </span>
                  </td>
                  <td className="table-cell align-top">
                    <div className="flex flex-wrap gap-2">
                      {canReview && estimate.status === "SUBMITTED" ? (
                        <>
                          <form action={reviewEstimateAction}>
                            <input type="hidden" name="estimateId" value={estimate.id} />
                            <input type="hidden" name="action" value="APPROVED" />
                            <button className="btn-secondary text-xs">Approve</button>
                          </form>
                          <form action={reviewEstimateAction}>
                            <input type="hidden" name="estimateId" value={estimate.id} />
                            <input type="hidden" name="action" value="REJECTED" />
                            <button className="btn-secondary text-xs">Reject</button>
                          </form>
                        </>
                      ) : null}
                      {canResubmit ? (
                        <Link className="btn-secondary text-xs" href={`/estimates/${estimate.id}/edit`}>
                          Edit &amp; Resubmit
                        </Link>
                      ) : null}
                      {!canReview && !canResubmit ? <span className="text-xs text-slate-400">No action</span> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {estimates.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-cell text-center text-sm text-slate-500">
                  No estimates found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <PaginationControls
          basePath="/estimates"
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          searchParams={{
            clientId: selectedClientId,
            projectId: selectedProjectId,
            fromDate: selectedFromDate || undefined,
            toDate: selectedToDate || undefined,
          }}
        />
      </div>
    </div>
  );
}
