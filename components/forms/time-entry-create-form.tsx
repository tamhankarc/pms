"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createTimeEntryAction,
  type TimeEntryFormState,
} from "@/lib/actions/time-actions";

type TimeEntryProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
};

const initialState: TimeEntryFormState = {};

export function TimeEntryCreateForm({
  projects,
  countries,
}: {
  projects: TimeEntryProjectOption[];
  countries: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createTimeEntryAction, initialState);

  const clientOptions = useMemo(
    () =>
      Array.from(
        new Map(projects.map((project) => [project.clientId, { id: project.clientId, name: project.clientName }])).values(),
      ),
    [projects],
  );

  const defaultClientId = clientOptions[0]?.id ?? "";
  const [selectedClientId, setSelectedClientId] = useState(defaultClientId);
  const [selectedProjectId, setSelectedProjectId] = useState(
    projects.find((project) => project.clientId === defaultClientId)?.id ?? "",
  );

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.clientId === selectedClientId),
    [projects, selectedClientId],
  );

  return (
    <form action={formAction} className="card p-6">
      <h2 className="section-title">Submit time entry</h2>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Time entry submitted successfully.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
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
          <select className="input" name="countryId" defaultValue="">
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
          <input className="input" type="date" name="workDate" required />
        </div>

        <div>
          <label className="label">Task name <span className="text-red-600">*</span></label>
          <input className="input" name="taskName" required />
        </div>

        <div>
          <label className="label">Minutes spent <span className="text-red-600">*</span></label>
          <input className="input" type="number" name="minutesSpent" min="5" required />
        </div>

        <div className="md:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input min-h-28" name="notes" />
        </div>

        <div className="md:col-span-2">
          <input type="hidden" name="isBillable" value="true" />
          <button className="btn-primary w-full md:w-auto" disabled={pending || filteredProjects.length === 0 || !selectedProjectId}>
            {pending ? "Submitting..." : "Submit entry"}
          </button>
        </div>
      </div>
    </form>
  );
}
