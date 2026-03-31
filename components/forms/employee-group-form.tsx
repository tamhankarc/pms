"use client";

import { useActionState, useMemo, useState } from "react";
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
  const [memberSearch, setMemberSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      user.fullName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.userType.toLowerCase().includes(q.replaceAll(" ", "_")),
    );
  }, [memberSearch, users]);

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
          <FormLabel htmlFor="memberSearch">Assign users</FormLabel>
          <input
            id="memberSearch"
            className="input"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search users by name, email, or type"
          />
          <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
            <div className="grid gap-2 md:grid-cols-2">
              {filteredUsers.map((user) => {
                const checked = (initialValues?.userIds ?? []).includes(user.id);
                return (
                  <label
                    key={user.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"
                  >
                    <input type="checkbox" name="userIds" value={user.id} defaultChecked={checked} className="mt-1" />
                    <span>
                      <span className="block font-medium text-slate-900">{user.fullName}</span>
                      <span className="block text-xs text-slate-500">{user.email}</span>
                      <span className="mt-1 block text-xs text-slate-500">{user.userType.replaceAll("_", " ")}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {filteredUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                No users match your search.
              </div>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Only Employees and Team Leads are available here. Use the checkboxes to pick members quickly.
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
