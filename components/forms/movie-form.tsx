"use client";

import { useActionState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import type { MovieFormState } from "@/lib/actions/movie-actions";

const initialState: MovieFormState = {};

type Client = { id: string; name: string };

export function MovieForm({
  clients,
  action,
  initialValues,
  submitLabel,
  title,
}: {
  clients: Client[];
  action: (state: MovieFormState, formData: FormData) => Promise<MovieFormState>;
  initialValues?: {
    clientId: string;
    title: string;
    code: string | null;
    description: string | null;
    isActive: boolean;
  };
  submitLabel: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card p-6">
      <h2 className="section-title">{title}</h2>
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
          Movie saved successfully.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="clientId" required>Client</FormLabel>
          <select id="clientId" name="clientId" className="input" defaultValue={initialValues?.clientId ?? ""} required>
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FormLabel htmlFor="title" required>Movie title</FormLabel>
          <input id="title" name="title" className="input" defaultValue={initialValues?.title ?? ""} required />
        </div>

        <div>
          <FormLabel htmlFor="code">Movie code</FormLabel>
          <input id="code" name="code" className="input" defaultValue={initialValues?.code ?? ""} />
        </div>

        <div>
          <FormLabel htmlFor="description">Description</FormLabel>
          <textarea id="description" name="description" className="input min-h-28" defaultValue={initialValues?.description ?? ""} />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} />
          Active movie
        </label>

        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
