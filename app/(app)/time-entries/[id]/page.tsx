import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { canFullyModerateProject } from "@/lib/permissions";
import { TimeEntryEditForm } from "@/components/forms/time-entry-edit-form";

export default async function EditTimeEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [entry, countries, projects] = await Promise.all([
    db.timeEntry.findUnique({
      where: { id },
      include: {
        employee: true,
        project: true,
      },
    }),
    db.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    getVisibleProjects(user),
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
    (user.userType === "TEAM_LEAD" && Boolean(assignment));

  if (!canEdit) {
    redirect("/time-entries");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Edit time entry"
        description="Employees can edit their own time entries. Team Leads, Admins, and Managers can also correct submitted time entries where permitted."
        actions={<Link href="/time-entries" className="btn-secondary">Back to time entries</Link>}
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
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Current status</div>
              <div className="mt-1 text-sm text-slate-900">{entry.status}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Task name</div>
              <div className="mt-1 text-sm text-slate-900">{entry.taskName}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Current time</div>
              <div className="mt-1 text-sm text-slate-900">{entry.minutesSpent} minutes</div>
            </div>
          </div>
        </div>

        <TimeEntryEditForm
          entry={{
            id: entry.id,
            clientId: entry.project.clientId,
            projectId: entry.projectId,
            countryId: entry.countryId,
            workDate: entry.workDate,
            taskName: entry.taskName,
            minutesSpent: entry.minutesSpent,
            isBillable: entry.isBillable,
            notes: entry.notes,
          }}
          countries={countries.map((country) => ({ id: country.id, name: country.name }))}
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
            clientName: project.client.name,
          }))}
        />
      </div>
    </div>
  );
}
