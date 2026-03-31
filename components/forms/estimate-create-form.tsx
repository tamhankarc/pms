"use client";

import { useActionState } from "react";
import {
  createEstimateAction,
  type EstimateFormState,
} from "@/lib/actions/estimate-actions";

const initialState: EstimateFormState = {};

export function EstimateCreateForm({
  projects,
  countries,
}: {
  projects: { id: string; name: string }[];
  countries: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createEstimateAction, initialState);

  return (
    <form action={formAction} className="card p-6">
      <h2 className="section-title">Submit estimate</h2>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Estimate submitted successfully.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">
            Project <span className="text-red-600">*</span>
          </label>
          <select className="input" name="projectId" required defaultValue={projects[0]?.id ?? ""}>
            {projects.map((project) => (
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
          <label className="label">
            Work date <span className="text-red-600">*</span>
          </label>
          <input className="input" type="date" name="workDate" required />
        </div>

        <div>
          <label className="label">
            Estimated minutes <span className="text-red-600">*</span>
          </label>
          <input
            className="input"
            type="number"
            name="estimatedMinutes"
            min="15"
            step="15"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input min-h-28" name="notes" />
        </div>

        <div className="md:col-span-2">
          <button className="btn-primary w-full md:w-auto" disabled={pending}>
            {pending ? "Submitting..." : "Submit estimate"}
          </button>
        </div>
      </div>
    </form>
  );
}
