"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  saveUserAssignmentAction,
  type UserAssignmentState,
} from "@/lib/actions/user-assignment-actions";

const initialState: UserAssignmentState = {};

export function UserAssignmentForm({
  clients,
  projects,
  subProjects,
  users,
  initialValues,
}: {
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; clientId: string }[];
  subProjects: { id: string; name: string; projectId: string }[];
  users: { id: string; fullName: string; userType: string; functionalRole: string | null }[];
  initialValues?: { clientId?: string; projectId?: string; subProjectId?: string; userIds?: string[] };
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveUserAssignmentAction, initialState);

  const [clientId, setClientId] = useState(initialValues?.clientId ?? "");
  const [projectId, setProjectId] = useState(initialValues?.projectId ?? "");
  const [subProjectId, setSubProjectId] = useState(initialValues?.subProjectId ?? "");
  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(initialValues?.userIds ?? []);

  useEffect(() => {
    setClientId(initialValues?.clientId ?? "");
    setProjectId(initialValues?.projectId ?? "");
    setSubProjectId(initialValues?.subProjectId ?? "");
    setSelectedUserIds(initialValues?.userIds ?? []);
  }, [initialValues?.clientId, initialValues?.projectId, initialValues?.subProjectId, initialValues?.userIds]);

  useEffect(() => {
    if (state?.success) {
      router.replace("/user-assignments");
      router.refresh();
    }
  }, [state?.success, router]);

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.clientId === clientId),
    [projects, clientId],
  );

  const filteredSubProjects = useMemo(
    () => subProjects.filter((subProject) => subProject.projectId === projectId),
    [subProjects, projectId],
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(q) ||
        user.userType.toLowerCase().includes(q) ||
        (user.functionalRole ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  function toggleUser(userId: string, checked: boolean) {
    setSelectedUserIds((prev) => {
      if (checked) {
        return prev.includes(userId) ? prev : [...prev, userId];
      }
      return prev.filter((id) => id !== userId);
    });
  }

  return (
    <form action={formAction} className="card p-6">
      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          User assignment saved successfully.
        </div>
      ) : null}

      {selectedUserIds.map((userId) => (
        <input key={userId} type="hidden" name="userIds" value={userId} />
      ))}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="clientId" required>
            Client
          </FormLabel>
          <SearchableCombobox
            id="clientId"
            name="clientId"
            value={clientId}
            onValueChange={(nextValue) => {
              setClientId(nextValue);
              setProjectId("");
              setSubProjectId("");
            }}
            options={[{ value: "", label: "Select client" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]}
            placeholder="Select client"
            searchPlaceholder="Search clients..."
            emptyLabel="No clients found."
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="projectId" required>
            Project
          </FormLabel>
          <SearchableCombobox
            id="projectId"
            name="projectId"
            value={projectId}
            onValueChange={(nextValue) => {
              setProjectId(nextValue);
              setSubProjectId("");
            }}
            options={filteredProjects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
            placeholder="Select project"
            searchPlaceholder="Search projects..."
            emptyLabel="No projects found."
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="subProjectId">Sub Project</FormLabel>
          <SearchableCombobox
            id="subProjectId"
            name="subProjectId"
            value={subProjectId}
            onValueChange={setSubProjectId}
            options={[{ value: "", label: "Project-level assignment" }, ...filteredSubProjects.map((subProject) => ({ value: subProject.id, label: subProject.name }))]}
            placeholder="Project-level assignment"
            searchPlaceholder="Search sub projects..."
            emptyLabel="No sub projects found."
          />
        </div>

        <div>
          <FormLabel htmlFor="userSearch">Users</FormLabel>
          <input
            id="userSearch"
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, or user type"
          />

          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
            {filteredUsers.map((user) => (
              <label
                key={user.id}
                className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(user.id)}
                  onChange={(e) => toggleUser(user.id, e.target.checked)}
                />
                <span>
                  <span className="font-medium text-slate-900">{user.fullName}</span>
                  <span className="block text-xs text-slate-500">
                    {user.userType.replaceAll("_", " ")}
                    {user.functionalRole ? ` · ${user.functionalRole.replaceAll("_", " ")}` : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Saving..." : "Save assignment"}
        </button>
      </div>
    </form>
  );
}