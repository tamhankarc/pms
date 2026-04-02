import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { canFullyModerateProject, isManager } from "@/lib/permissions";
import { TimeEntryEditForm } from "@/components/forms/time-entry-edit-form";

export default async function EditTimeEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [entry, countries, movies, languages, projects, allSubProjects] = await Promise.all([
    db.timeEntry.findUnique({
      where: { id },
      include: {
        employee: true,
        project: { include: { client: true } },
        subProject: true,
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
    db.language.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    getVisibleProjects(user),
    db.subProject.findMany({
      where: { isActive: true },
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
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Employee</div>
              <div className="mt-1 text-sm text-slate-900">{entry.employee.fullName}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Project</div>
              <div className="mt-1 text-sm text-slate-900">{entry.project.name}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Sub Project</div>
              <div className="mt-1 text-sm text-slate-900">{entry.subProject?.name ?? "No Sub Project"}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Current status</div>
              <div className="mt-1 text-sm text-slate-900">{entry.status}</div>
            </div>
          </div>
        </div>

        <TimeEntryEditForm
          entry={{
            id: entry.id,
            employeeId: entry.employeeId,
            employeeName: entry.employee.fullName,
            clientId: entry.project.clientId,
            projectId: entry.projectId,
            subProjectId: entry.subProjectId,
            countryId: entry.countryId,
            movieId: entry.movieId,
            languageId: entry.languageId,
            workDate: entry.workDate,
            taskName: entry.taskName,
            minutesSpent: entry.minutesSpent,
            isBillable: entry.isBillable,
            notes: entry.notes,
          }}
          countries={countries.map((country) => ({ id: country.id, name: country.name }))}
          movies={movies.map((movie) => ({ id: movie.id, title: movie.title, clientId: movie.clientId }))}
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
        />
      </div>
    </div>
  );
}