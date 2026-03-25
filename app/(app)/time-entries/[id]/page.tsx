import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { updateTimeEntryAction } from "@/lib/actions/time-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canFullyModerateProject } from "@/lib/permissions";

export default async function EditTimeEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [entry, countries] = await Promise.all([
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
    (user.userType === "TEAM_LEAD" && Boolean(assignment));

  if (!canEdit) {
    redirect("/time-entries");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Edit time entry"
        description="Submitted time entries can be corrected only by assigned Team Leads, Admins, or Managers."
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
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Current time</div>
              <div className="mt-1 text-sm text-slate-900">{entry.minutesSpent} minutes</div>
            </div>
          </div>
        </div>

        <form action={updateTimeEntryAction} className="space-y-4">
          <input type="hidden" name="entryId" value={entry.id} />

          <div>
            <label className="label">Country</label>
            <select className="input" name="countryId" defaultValue={entry.countryId ?? ""}>
              <option value="">No specific country</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Work date <span className="text-red-600">*</span></label>
            <input
              className="input"
              type="date"
              name="workDate"
              defaultValue={new Date(entry.workDate).toISOString().slice(0, 10)}
              required
            />
          </div>

          <div>
            <label className="label">Minutes spent <span className="text-red-600">*</span></label>
            <input
              className="input"
              type="number"
              name="minutesSpent"
              min="15"
              step="15"
              defaultValue={entry.minutesSpent}
              required
            />
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input id="isBillable" type="checkbox" name="isBillable" value="true" defaultChecked={entry.isBillable} />
            <label htmlFor="isBillable" className="text-sm text-slate-700">Billable entry</label>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-28" name="notes" defaultValue={entry.notes ?? ""} />
          </div>

          <button className="btn-primary w-full">Save changes</button>
        </form>
      </div>
    </div>
  );
}
