"use client";

import { useActionState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import type { ClientFormState } from "@/lib/actions/client-actions";

type ClientFormProps = {
  mode: "create" | "edit";
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  initialValues?: {
    id?: string;
    name?: string;
    code?: string | null;
    isActive?: boolean;
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
          <FormLabel htmlFor="name" required>Client name</FormLabel>
          <input id="name" className="input" name="name" defaultValue={initialValues?.name ?? ""} required />
        </div>

        <div>
          <FormLabel htmlFor="code">Client code</FormLabel>
          <input
            id="code"
            className="input"
            name="code"
            defaultValue={initialValues?.code ?? ""}
            placeholder="WB, ACME, SONY..."
          />
        </div>

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
