"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import type { ClientFormState } from "@/lib/actions/client-actions";

type ClientFormProps = {
  mode: "create" | "edit";
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  initialValues?: {
    id?: string;
    name?: string;
    isActive?: boolean;
    showCountriesInTimeEntries?: boolean;
    showMoviesInEntries?: boolean;
    showAssetTypesInEntries?: boolean;
    showLanguagesInEntries?: boolean;
    enableProjectTypes?: boolean;
    hourlyCost?: string | number;
  };
};

const initialState: ClientFormState = {};

export function ClientForm({ mode, action, initialValues }: ClientFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card p-6">
      {mode === "edit" && initialValues?.id ? (
        <input type="hidden" name="id" value={initialValues.id} />
      ) : null}

      <h2 className="section-title">{mode === "create" ? "Create client" : "Edit client"}</h2>
      <p className="section-subtitle">
        Fields marked <span className="text-red-600">*</span> are required.
        Client code is generated automatically.
      </p>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Client saved successfully.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="name" required>
            Client name
          </FormLabel>
          <input id="name" className="input" name="name" defaultValue={initialValues?.name ?? ""} required />
        </div>

        <div>
          <FormLabel htmlFor="hourlyCost">Per hour cost (USD)</FormLabel>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span>
            <input id="hourlyCost" name="hourlyCost" type="number" min="0" step="0.01" className="input pl-7" defaultValue={initialValues?.hourlyCost ?? "0.00"} />
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="showCountriesInTimeEntries"
            defaultChecked={initialValues?.showCountriesInTimeEntries ?? false}
          />
          Show Countries dropdown in Time Entries and Estimates and make it mandatory
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="showLanguagesInEntries"
            defaultChecked={initialValues?.showLanguagesInEntries ?? false}
          />
          Show Language dropdown in Time Entries and Estimates and make it mandatory
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="showMoviesInEntries"
            defaultChecked={initialValues?.showMoviesInEntries ?? false}
          />
          Show Movie dropdown in Time Entries and Estimates (optional)
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="showAssetTypesInEntries"
            defaultChecked={initialValues?.showAssetTypesInEntries ?? false}
          />
          Show Asset Type dropdown in Time Entries and Estimates (optional)
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="enableProjectTypes"
            defaultChecked={initialValues?.enableProjectTypes ?? false}
          />
          Enable client-specific Project Types
        </label>

        {mode === "edit" && initialValues?.id ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Need to manage project types for this client?{" "}
            <Link href={`/clients/${initialValues.id}/project-types`} className="font-medium text-blue-600 hover:underline">
              Open Project Types
            </Link>
          </div>
        ) : null}

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} />
          Active client
        </label>

        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create client" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
