"use client";

import { useActionState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import type { EmployeeGroupFormState } from "@/lib/actions/group-actions";

type EmployeeGroupFormProps = {
  mode: "create" | "edit";
  users: { id: string; fullName: string; email: string; userType: string }[];
  action: (state: EmployeeGroupFormState, formData: FormData) => Promise<EmployeeGroupFormState>;
  initialValues?: {
    id?: string;
    name?: string;
    description?: string | null;
    isActive?: boolean;
    userIds?: string[];
  };
};

const initialState: EmployeeGroupFormState = {};

export function EmployeeGroupForm({
  mode,
  users,
  action,
  initialValues,
}: EmployeeGroupFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card p-6">
      {mode === "edit" && initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}

      <h2 className="section-title">{mode === "create" ? "Create employee group" : "Edit employee group"}</h2>
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
          Employee group saved successfully.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="name" required>Group name</FormLabel>
          <input id="name" className="input" name="name" defaultValue={initialValues?.name ?? ""} required />
        </div>

        <div>
          <FormLabel htmlFor="description">Description</FormLabel>
          <textarea id="description" className="input min-h-28" name="description" defaultValue={initialValues?.description ?? ""} />
        </div>

        <div>
          <FormLabel htmlFor="userIds">Assign users</FormLabel>
          <select id="userIds" className="input min-h-40" name="userIds" multiple defaultValue={initialValues?.userIds ?? []}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName} ({user.userType.replaceAll("_", " ")})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Only Employees and Team Leads are available here. Hold Ctrl/Cmd to select multiple users.
          </p>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} />
          Active group
        </label>

        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create group" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
