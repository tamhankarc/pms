"use client";

import { useActionState, useMemo, useState } from "react";
import {
  updateTimeEntryAction,
  type TimeEntryFormState,
} from "@/lib/actions/time-actions";

type TimeEntryProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
};

const initialState: TimeEntryFormState = {};

export function TimeEntryEditForm({
  entry,
  countries,
  projects,
}: {
  entry: {
    id: string;
    clientId: string;
    projectId: string;
    countryId: string | null;
    workDate: Date;
    taskName: string;
    minutesSpent: number;
    isBillable: boolean;
    notes: string | null;
  };
  countries: { id: string; name: string }[];
  projects: TimeEntryProjectOption[];
}) {
  const [state, formAction, pending] = useActionState(updateTimeEntryAction, initialState);
  const clientOptions = useMemo(
    () =>
      Array.from(
        new Map(projects.map((project) => [project.clientId, { id: project.clientId, name: project.clientName }])).values(),
      ),
    [projects],
  );
  const [selectedClientId, setSelectedClientId] = useState(entry.clientId);
  const [selectedProjectId, setSelectedProjectId] = useState(entry.projectId);

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.clientId === selectedClientId),
    [projects, selectedClientId],
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Time entry updated successfully.
        </div>
      ) : null}

      <input type="hidden" name="entryId" value={entry.id} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Client <span className="text-red-600">*</span></label>
          <select
            className="input"
            name="clientId"
            required
            value={selectedClientId}
            onChange={(event) => {
              const nextClientId = event.target.value;
              setSelectedClientId(nextClientId);
              setSelectedProjectId(
                projects.find((project) => project.clientId === nextClientId)?.id ?? "",
              );
            }}
          >
            <option value="" disabled>Select client</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Project <span className="text-red-600">*</span></label>
          <select
            className="input"
            name="projectId"
            required
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            {filteredProjects.length === 0 ? <option value="">No projects available</option> : null}
            {filteredProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

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
          <label className="label">Task name <span className="text-red-600">*</span></label>
          <input className="input" name="taskName" defaultValue={entry.taskName} required />
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
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <input id="isBillable" type="checkbox" name="isBillable" value="true" defaultChecked={entry.isBillable} />
        <label htmlFor="isBillable" className="text-sm text-slate-700">Billable entry</label>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-28" name="notes" defaultValue={entry.notes ?? ""} />
      </div>

      <button className="btn-primary w-full" disabled={pending || filteredProjects.length === 0 || !selectedProjectId}>
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
