"use client";

import { useActionState, useMemo, useState } from "react";
import {
  updateTimeEntryAction,
  type TimeEntryFormState,
} from "@/lib/actions/time-actions";
import { FormLabel } from "@/components/ui/form-label";

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
    employeeId: string;
    employeeName: string;
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
        new Map(
          projects.map((project) => [project.clientId, { id: project.clientId, name: project.clientName }]),
        ).values(),
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
      <input type="hidden" name="employeeId" value={entry.employeeId} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormLabel htmlFor="employeeName">Employee</FormLabel>
          <input
            id="employeeName"
            className="input bg-slate-50"
            value={entry.employeeName}
            readOnly
          />
        </div>

        <div>
          <FormLabel htmlFor="clientId" required>
            Client
          </FormLabel>
          <select
            id="clientId"
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
            <option value="" disabled>
              Select client
            </option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FormLabel htmlFor="projectId" required>
            Project
          </FormLabel>
          <select
            id="projectId"
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
          <FormLabel htmlFor="countryId">Country</FormLabel>
          <select id="countryId" className="input" name="countryId" defaultValue={entry.countryId ?? ""}>
            <option value="">No specific country</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FormLabel htmlFor="workDate" required>
            Work date
          </FormLabel>
          <input
            id="workDate"
            className="input"
            type="date"
            name="workDate"
            defaultValue={new Date(entry.workDate).toISOString().slice(0, 10)}
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="taskName" required>
            Task name
          </FormLabel>
          <input id="taskName" className="input" name="taskName" defaultValue={entry.taskName} required />
        </div>

        <div>
          <FormLabel htmlFor="minutesSpent" required>
            Minutes spent
          </FormLabel>
          <input
            id="minutesSpent"
            className="input"
            type="number"
            name="minutesSpent"
            min="5"
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
        <FormLabel htmlFor="notes">Notes</FormLabel>
        <textarea id="notes" className="input min-h-28" name="notes" defaultValue={entry.notes ?? ""} />
      </div>

      <button className="btn-primary w-full" disabled={pending || filteredProjects.length === 0 || !selectedProjectId}>
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
