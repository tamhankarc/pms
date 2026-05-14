"use client";

import { useActionState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import type { AssetNameFormState } from "@/lib/actions/asset-name-actions";

const initialState: AssetNameFormState = {};

export function AssetNameForm({ action, initialValues, title, submitLabel }: {
  action: (state: AssetNameFormState, formData: FormData) => Promise<AssetNameFormState>;
  initialValues?: { id?: string; name: string; isActive: boolean };
  title: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">Fields marked <span className="text-red-600">*</span> are required.</p>
      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Asset name saved successfully.</div> : null}
      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="name" required>Asset name</FormLabel>
          <input id="name" name="name" className="input" defaultValue={initialValues?.name ?? ""} required />
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} />
          Active Asset Name
        </label>
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </form>
  );
}
