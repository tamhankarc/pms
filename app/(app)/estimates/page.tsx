import Link from "next/link";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMinutes } from "@/lib/utils";
import { reviewEstimateAction } from "@/lib/actions/estimate-actions";
import { canFullyModerateProject, isManager } from "@/lib/permissions";
import { getVisibleProjects } from "@/lib/queries";
import { EstimateCreateForm } from "@/components/forms/estimate-create-form";

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
  orderBy: { createdAt: "desc" as const },
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
  searchParams?: Promise<{ create?: string; clientId?: string; projectId?: string }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const showCreate = params.create === "1";
  const selectedClientId = params.clientId ?? "all";
  const selectedProjectId = params.projectId ?? "all";

  const [projects, countries, movies, languages, assignments, allSubProjects] = await Promise.all([
    getVisibleProjects(user),
    db.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.movie.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
    }),
    db.language.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    user.userType === "TEAM_LEAD" || isManager(user)
      ? db.employeeTeamLead.findMany({
          where: { teamLeadId: user.id },
          include: {
            employee: {
              select: { id: true, functionalRole: true },
            },
          },
        })
      : Promise.resolve([]),
    db.subProject.findMany({
      where: { isActive: true },
      include: { assignments: true },
      orderBy: { name: "asc" },
    }),
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

  const estimates = (await db.estimate.findMany({
    ...estimateWithRelations,
    where:
      user.userType === "EMPLOYEE"
        ? {
            employeeId: user.id,
            projectId: { in: safeProjectIds },
          }
        : user.userType === "TEAM_LEAD"
          ? {
              employeeId: {
                in: assignedScopedEmployeeIds.length ? assignedScopedEmployeeIds : ["__none__"],
              },
              projectId: { in: safeProjectIds },
            }
          : {
              projectId: { in: safeProjectIds },
            },
  })) as EstimateRow[];

  const countryMap = new Map(countries.map((country) => [country.id, country.name]));
  const managedIds = new Set(assignedScopedEmployeeIds);
  const canCreate = user.userType === "EMPLOYEE" || user.userType === "TEAM_LEAD" || isManager(user);

  const clientOptions = Array.from(
    new Map(projects.map((project) => [project.client.id, { id: project.client.id, name: project.client.name }])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const projectOptions = projects.filter((project) =>
    selectedClientId === "all" ? true : project.clientId === selectedClientId,
  );

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
            <Link className="btn-primary" href="/estimates?create=1">
              Add Estimate
            </Link>
          ) : null
        }
      />

      <div className="card p-4">
        <form method="get" className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div className="grid gap-3 md:grid-cols-2">
            <select className="input" name="clientId" defaultValue={selectedClientId}>
              <option value="all">All clients</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <select className="input" name="projectId" defaultValue={selectedProjectId}>
              <option value="all">All projects</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            {showCreate ? <input type="hidden" name="create" value="1" /> : null}
            <button className="btn-secondary" type="submit">
              Apply
            </button>
            <Link className="btn-secondary" href="/estimates">
              Reset
            </Link>
          </div>
        </form>
      </div>

      {showCreate && canCreate ? (
        <EstimateCreateForm
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
            clientName: project.client.name,
            showCountriesInTimeEntries: project.client.showCountriesInTimeEntries,
            showMoviesInEntries: project.client.showMoviesInEntries,
            showLanguagesInEntries: project.client.showLanguagesInEntries,
          }))}
          subProjects={allSubProjects.map((subProject) => ({
            id: subProject.id,
            name: subProject.name,
            projectId: subProject.projectId,
            assignedUserIds: subProject.assignments.map((row) => row.userId),
          }))}
          countries={countries.map((country) => ({ id: country.id, name: country.name }))}
          movies={movies.map((movie) => ({ id: movie.id, title: movie.title, clientId: movie.clientId }))}
          languages={languages.map((language) => ({
            id: language.id,
            name: language.name,
            code: language.code,
          }))}
          currentUserId={user.id}
        />
      ) : null}

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
            {estimates.map((estimate) => {
              const canReview =
                canFullyModerateProject(user) ||
                ((user.userType === "TEAM_LEAD" || isManager(user)) &&
                  managedIds.has(estimate.employeeId) &&
                  estimate.employee.functionalRole === user.functionalRole);

              const canResubmit = estimate.employeeId === user.id && estimate.status === "REVISED";

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
                          <button className="btn-secondary !px-3 !py-1.5 text-xs">Approve</button>
                        </form>
                        <form action={reviewEstimateAction}>
                          <input type="hidden" name="estimateId" value={estimate.id} />
                          <input type="hidden" name="action" value="REVISED" />
                          <input
                            type="hidden"
                            name="comment"
                            value="Please update and resubmit this estimate."
                          />
                          <button className="btn-secondary !px-3 !py-1.5 text-xs">Revise</button>
                        </form>
                      </div>
                    ) : canResubmit ? (
                      <Link
                        href={`/estimates/${estimate.id}/edit`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Edit &amp; Resubmit
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {estimates.length === 0 ? (
              <tr>
                <td className="table-cell text-center text-sm text-slate-500" colSpan={6}>
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
