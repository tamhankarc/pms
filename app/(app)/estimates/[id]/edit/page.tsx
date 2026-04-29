import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canFullyModerateProject } from "@/lib/permissions";
import { EstimateEditForm } from "@/components/forms/estimate-edit-form";

export default async function EditEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [estimate, countries, movies, assetTypes, languages, projects, subProjects] = await Promise.all([
    db.estimate.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            client: true,
          },
        },
        subProject: true,
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
    db.movie.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
    }),
    db.assetType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.language.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: { isActive: true, status: { in: ["ACTIVE", "ON_HOLD"] } },
      include: {
        client: true,
        assignedUsers: true,
      },
      orderBy: { name: "asc" },
    }),
    db.subProject.findMany({
      where: { isActive: true, project: { isActive: true, status: { in: ["ACTIVE", "ON_HOLD"] } } },
      include: { assignments: true },
      orderBy: { name: "asc" },
    })
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
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Employee</div>
              <div className="mt-1 text-sm text-slate-900">{estimate.employee.fullName}</div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Project</div>
              <div className="mt-1 text-sm text-slate-900">{estimate.project.name}</div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Sub Project</div>
              <div className="mt-1 text-sm text-slate-900">{estimate.subProject?.name ?? "No Sub Project"}</div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Current status</div>
              <div className="mt-1 text-sm text-slate-900">{estimate.status}</div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Current estimate</div>
              <div className="mt-1 text-sm text-slate-900">{estimate.estimatedMinutes} minutes</div>
            </div>
          </div>

          {latestReview?.remarks ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="font-medium">Latest review note:</span> {latestReview.remarks}
            </div>
          ) : null}
        </div>

        <EstimateEditForm
          estimate={{
            id: estimate.id,
            employeeId: estimate.employeeId,
            employeeName: estimate.employee.fullName,
            employeeUserType: estimate.employee.userType,
            clientId: estimate.project.clientId,
            projectId: estimate.projectId,
            subProjectId: estimate.subProjectId,
            countryId: estimate.countryId,
            movieId: estimate.movieId,
            assetTypeId: estimate.assetTypeId,
            languageId: estimate.languageId,
            workDate: estimate.workDate,
            estimatedMinutes: estimate.estimatedMinutes,
            notes: estimate.notes,
          }}
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
            clientName: project.client.name,
            showCountriesInTimeEntries: project.client.showCountriesInTimeEntries,
            hideCountriesInEntries: project.hideCountriesInEntries,
            showMoviesInEntries: project.client.showMoviesInEntries,
            hideMoviesInEntries: project.hideMoviesInEntries,
            showAssetTypesInEntries: project.client.showAssetTypesInEntries,
            hideAssetTypesInEntries: project.hideAssetTypesInEntries,
            showLanguagesInEntries: project.client.showLanguagesInEntries,
            assignedUserIds: project.assignedUsers.map((assignment) => assignment.userId),
          }))}
          subProjects={subProjects.map((subProject) => ({
            id: subProject.id,
            name: subProject.name,
            projectId: subProject.projectId,
            assignedUserIds: subProject.assignments.map((row) => row.userId),
            hideCountriesInEntries: subProject.hideCountriesInEntries,
            hideMoviesInEntries: subProject.hideMoviesInEntries,
            hideAssetTypesInEntries: subProject.hideAssetTypesInEntries,
          }))}
          countries={countries.map((country) => ({ id: country.id, name: country.name }))}
          movies={movies.map((movie) => ({ id: movie.id, title: movie.title, clientId: movie.clientId }))}
          assetTypes={assetTypes.map((assetType) => ({ id: assetType.id, name: assetType.name, clientId: assetType.clientId }))}
          languages={languages.map((language) => ({
            id: language.id,
            name: language.name,
            code: language.code,
          }))}
          allowUnassignedSubProjects
        />

        {estimate.reviews.length > 0 ? (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="section-title">Review History</h2>
            <div className="mt-4 space-y-3">
              {estimate.reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-900">{review.decisionStatus}</div>
                    <div className="text-xs text-slate-500">
                      {review.reviewer.fullName} · {new Date(review.reviewedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{review.remarks || "No remarks."}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}