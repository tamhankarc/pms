import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import {
  canFullyModerateProject,
  isManager,
  canAccessMenuItem,
} from "@/lib/permissions";
import { TimeEntryEditForm } from "@/components/forms/time-entry-edit-form";

export default async function EditTimeEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!canAccessMenuItem(user, "time-entries")) redirect("/dashboard");

  const [
    entry,
    countries,
    movies,
    assetTypes,
    lensTypes,
    assetNames,
    newsletters,
    languages,
    projects,
    allSubProjects,
  ] = await Promise.all([
    db.timeEntry.findUnique({
      where: { id },
      include: {
        employee: true,
        project: { include: { client: true } },
        subProject: true,
        movie: true,
        country: true,
        assetType: true,
        lensType: true,
        assetName: true,
        newsletter: true,
        language: true,
      },
    }),
    db.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.movie.findMany({
      where: { isActive: true, status: { not: "COMPLETED_BILLED" } },
      orderBy: { title: "asc" },
    }),
    db.assetType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.lensType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.assetName.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.newsletter.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.language.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    getVisibleProjects(user, { allowedStatuses: ["ACTIVE"] }),
    db.subProject.findMany({
      where: { isActive: true, project: { isActive: true, status: "ACTIVE" } },
      include: { assignments: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!entry) notFound();

  const assignment = await db.employeeTeamLead.findFirst({
    where: {
      teamLeadId: user.id,
      employeeId: entry.employeeId,
    },
  });

  const canEdit =
    canFullyModerateProject(user) ||
    entry.employeeId === user.id ||
    ((user.userType === "TEAM_LEAD" || isManager(user)) && Boolean(assignment));

  if (!canEdit) {
    redirect("/time-entries");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Edit time entry"
        description="Employees can edit their own time entries. Team Leads, Admins, and Managers can also correct submitted time entries where permitted."
        actions={
          <Link href="/time-entries" className="btn-secondary">
            Back to time entries
          </Link>
        }
      />

      <div className="card p-6">
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Employee
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {entry.employee.fullName}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Project
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {entry.project.name}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Sub Project
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {entry.subProject?.name ?? "No Sub Project"}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current status
              </div>
              <div className="mt-1 text-sm text-slate-900">{entry.status}</div>
            </div>
          </div>
        </div>

        {entry.movie?.status === "COMPLETED_BILLED" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            This time entry belongs to the billed title{" "}
            <strong>{entry.movie.title}</strong>. It is viewable but cannot be
            edited.
          </div>
        ) : (
          <TimeEntryEditForm
            entry={{
              id: entry.id,
              employeeId: entry.employeeId,
              employeeName: entry.employee.fullName,
              employeeUserType: entry.employee.userType,
              clientId: entry.project.clientId,
              projectId: entry.projectId,
              subProjectId: entry.subProjectId,
              countryId: entry.countryId,
              movieId: entry.movieId,
              assetTypeId: entry.assetTypeId,
              lensTypeId: entry.lensTypeId,
              assetNameId: entry.assetNameId,
              newsletterId: entry.newsletterId,
              languageId: entry.languageId,
              workDate: entry.workDate,
              taskName: entry.taskName,
              minutesSpent: entry.minutesSpent,
              isBillable: entry.isBillable,
              notes: entry.notes,
            }}
            countries={countries.map((country) => ({
              id: country.id,
              name: country.name,
            }))}
            movies={movies.map((movie) => ({
              id: movie.id,
              title: movie.title,
              clientId: movie.clientId,
            }))}
            assetTypes={assetTypes.map((assetType) => ({
              id: assetType.id,
              name: assetType.name,
              clientId: assetType.clientId,
            }))}
            lensTypes={lensTypes.map((lensType) => ({
              id: lensType.id,
              name: lensType.name,
            }))}
            assetNames={assetNames.map((assetName) => ({
              id: assetName.id,
              name: assetName.name,
              clientId: assetName.clientId,
              movieId: assetName.movieId,
            }))}
            newsletters={newsletters.map((newsletter) => ({
              id: newsletter.id,
              name: newsletter.name,
              clientId: newsletter.clientId,
            }))}
            languages={languages.map((language) => ({
              id: language.id,
              name: language.name,
              code: language.code,
            }))}
            projects={projects.map((project) => ({
              id: project.id,
              name: project.name,
              clientId: project.clientId,
              clientName: project.client.name,
              showCountriesInTimeEntries:
                project.client.showCountriesInTimeEntries,
              hideCountriesInEntries: project.hideCountriesInEntries,
              showMoviesInEntries: project.client.showMoviesInEntries,
              hideMoviesInEntries: project.hideMoviesInEntries,
              showAssetTypesInEntries: project.client.showAssetTypesInEntries,
              hideAssetTypesInEntries: project.hideAssetTypesInEntries,
              showLensTypesInEntries: project.client.showLensTypesInEntries,
              hideLensTypesInEntries: project.hideLensTypesInEntries,
              showAssetNamesInEntries: project.client.showAssetNamesInEntries,
              hideAssetNamesInEntries: project.hideAssetNamesInEntries,
              showNewslettersInEntries: project.client.showNewslettersInEntries,
              hideNewslettersInEntries: project.hideNewslettersInEntries,
              showLanguagesInEntries: project.client.showLanguagesInEntries,
              assignedUserIds: project.assignedUsers.map(
                (assignment) => assignment.userId,
              ),
            }))}
            subProjects={allSubProjects.map((subProject) => ({
              id: subProject.id,
              name: subProject.name,
              projectId: subProject.projectId,
              assignedUserIds: subProject.assignments.map((row) => row.userId),
              hideCountriesInEntries: subProject.hideCountriesInEntries,
              hideMoviesInEntries: subProject.hideMoviesInEntries,
              hideAssetTypesInEntries: subProject.hideAssetTypesInEntries,
              hideLensTypesInEntries: subProject.hideLensTypesInEntries,
              hideAssetNamesInEntries: subProject.hideAssetNamesInEntries,
              hideNewslettersInEntries: subProject.hideNewslettersInEntries,
            }))}
            allowUnassignedSubProjects
          />
        )}
      </div>
    </div>
  );
}
