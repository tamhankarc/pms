"use client";

import { useActionState } from "react";
import {
  updateEstimateAction,
  type EstimateFormState,
} from "@/lib/actions/estimate-actions";

const initialState: EstimateFormState = {};

export function EstimateEditForm({
  estimate,
  countries,
}: {
  estimate: {
    id: string;
    countryId: string | null;
    workDate: Date;
    estimatedMinutes: number;
    notes: string | null;
  };
  countries: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateEstimateAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Estimate updated successfully.
        </div>
      ) : null}

      <input type="hidden" name="estimateId" value={estimate.id} />

      <div>
        <label className="label">Country</label>
        <select
          className="input"
          name="countryId"
          defaultValue={estimate.countryId ?? ""}
        >
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
        <input
          className="input"
          type="date"
          name="workDate"
          defaultValue={new Date(estimate.workDate).toISOString().slice(0, 10)}
          required
        />
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
          defaultValue={estimate.estimatedMinutes}
          required
        />
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input min-h-28"
          name="notes"
          defaultValue={estimate.notes ?? ""}
        />
      </div>

      <div className="flex gap-3">
        <a href="/estimates" className="btn-secondary">
          Cancel
        </a>
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Resubmit estimate"}
        </button>
      </div>
    </form>
  );
}
