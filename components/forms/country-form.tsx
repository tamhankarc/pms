"use client";

import { useActionState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import type { CountryFormState } from "@/lib/actions/country-actions";

type CountryFormProps = {
  mode: "create" | "edit";
  action: (state: CountryFormState, formData: FormData) => Promise<CountryFormState>;
  initialValues?: {
    id?: string;
    name?: string;
    isoCode?: string | null;
    isActive?: boolean;
  };
};

const initialState: CountryFormState = {};

export function CountryForm({ mode, action, initialValues }: CountryFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card p-6">
      {mode === "edit" && initialValues?.id ? (
        <input type="hidden" name="id" value={initialValues.id} />
      ) : null}

      <h2 className="section-title">{mode === "create" ? "Create country" : "Edit country"}</h2>
      <p className="section-subtitle">
        Fields marked <span className="text-red-600">*</span> are required.
      </p>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Country saved successfully.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="name" required>Country name</FormLabel>
          <input id="name" className="input" name="name" defaultValue={initialValues?.name ?? ""} required />
        </div>

        <div>
          <FormLabel htmlFor="isoCode">ISO code</FormLabel>
          <input
            id="isoCode"
            className="input"
            name="isoCode"
            defaultValue={initialValues?.isoCode ?? ""}
            placeholder="IN, US, GB..."
            maxLength={10}
          />
          <p className="mt-1 text-xs text-slate-500">Optional, but recommended. Will be saved in uppercase.</p>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} />
          Active country
        </label>

        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create country" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
