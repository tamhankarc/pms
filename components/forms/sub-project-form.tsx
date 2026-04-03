"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { SubProjectFormState } from "@/lib/actions/sub-project-actions";

type ProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
};

const initialState: SubProjectFormState = {};

export function SubProjectForm({
  mode,
  projects,
  action,
  initialValues,
}: {
  mode: "create" | "edit";
  projects: ProjectOption[];
  action: (state: SubProjectFormState, formData: FormData) => Promise<SubProjectFormState>;
  initialValues?: {
    id?: string;
    clientId?: string;
    projectId?: string;
    name?: string;
    description?: string | null;
    isActive?: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const defaultClientId =
    initialValues?.clientId ??
    (initialValues?.projectId ? projects.find((project) => project.id === initialValues.projectId)?.clientId : "") ??
    "";

  const [clientId, setClientId] = useState(defaultClientId);
  const [projectId, setProjectId] = useState(initialValues?.projectId ?? "");

  const filteredProjects = useMemo(() => {
    if (!clientId) return projects;
    return projects.filter((project) => project.clientId === clientId);
  }, [projects, clientId]);

  useEffect(() => {
    if (!filteredProjects.some((project) => project.id === projectId)) {
      setProjectId("");
    }
  }, [filteredProjects, projectId]);

  const uniqueClients = Array.from(
    new Map(projects.map((project) => [project.clientId, { id: project.clientId, name: project.clientName }])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <form action={formAction} className="card p-6">
      {mode === "edit" && initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}

      <h2 className="section-title">{mode === "create" ? "Create Sub Project" : "Edit Sub Project"}</h2>
      <p className="section-subtitle">
        Select client first, then choose the project. User assignment is handled separately.
      </p>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Sub Project saved successfully.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="clientId" required>
            Client
          </FormLabel>
          <SearchableCombobox
            id="clientId"
            name="clientId"
            value={clientId}
            onValueChange={setClientId}
            options={[{ value: "", label: "Select client" }, ...uniqueClients.map((client) => ({ value: client.id, label: client.name }))]}
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
            onValueChange={setProjectId}
            options={filteredProjects.map((project) => ({
              value: project.id,
              label: `${project.name} · ${project.clientName}`,
              keywords: `${project.name} ${project.clientName}`,
            }))}
            placeholder="Select project"
            searchPlaceholder="Search projects..."
            emptyLabel="No projects found."
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="name" required>
            Sub Project name
          </FormLabel>
          <input id="name" className="input" name="name" defaultValue={initialValues?.name ?? ""} required />
        </div>

        <div>
          <FormLabel htmlFor="description">Description</FormLabel>
          <textarea
            id="description"
            className="input min-h-24"
            name="description"
            defaultValue={initialValues?.description ?? ""}
          />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} />
          Active Sub Project
        </label>

        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create Sub Project" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
