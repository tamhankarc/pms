"use client";

import { useActionState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import type { FilmikResourceFormState } from "@/lib/actions/filmik-resource-actions";

const initialState: FilmikResourceFormState = {};

export function FilmikResourceForm({
  action,
  initialValues,
  submitLabel,
  title,
}: {
  action: (state: FilmikResourceFormState, formData: FormData) => Promise<FilmikResourceFormState>;
  initialValues?: { id?: string; name: string; cost: string | number; isActive: boolean };
  submitLabel: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">
        Add Filmik resource types and their per-resource monthly cost. Fields marked <span className="text-red-600">*</span> are required.
      </p>
      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Resource type saved successfully.</div> : null}
      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="name" required>Resource type</FormLabel>
          <input id="name" name="name" className="input" defaultValue={initialValues?.name ?? ""} required />
        </div>
        <div>
          <FormLabel htmlFor="cost" required>Per Resource Cost (USD)</FormLabel>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span>
            <input id="cost" name="cost" type="number" min="0" step="0.01" className="input currency-input" defaultValue={initialValues?.cost ?? "0.00"} required />
          </div>
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} />
          Active Resource Type
        </label>
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </form>
  );
}
