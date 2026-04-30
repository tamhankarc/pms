"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { ContactPersonFormState } from "@/lib/actions/contact-person-actions";

const initialState: ContactPersonFormState = {};

type Client = { id: string; name: string };
type Project = { id: string; name: string; clientId: string; clientName?: string };

export function ContactPersonForm({ clients, projects, action, initialValues, submitLabel, title }: {
  clients: Client[];
  projects: Project[];
  action: (state: ContactPersonFormState, formData: FormData) => Promise<ContactPersonFormState>;
  initialValues?: { id?: string; clientId: string; projectId: string; name: string; email: string; contactNumber: string | null; };
  submitLabel: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedClientId, setSelectedClientId] = useState(initialValues?.clientId ?? "");
  const [selectedProjectId, setSelectedProjectId] = useState(initialValues?.projectId ?? "");

  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);
  const projectOptions = useMemo(
    () => projects
      .filter((project) => !selectedClientId || project.clientId === selectedClientId)
      .map((project) => ({ value: project.id, label: project.name, keywords: project.clientName ?? "" })),
    [projects, selectedClientId],
  );

  function handleClientChange(nextClientId: string) {
    setSelectedClientId(nextClientId);
    const currentProject = projects.find((project) => project.id === selectedProjectId);
    if (!currentProject || currentProject.clientId !== nextClientId) {
      setSelectedProjectId("");
    }
  }

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="clientId" value={selectedClientId} />
      <input type="hidden" name="projectId" value={selectedProjectId} />

      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">Fields marked <span className="text-red-600">*</span> are required. Contact Persons are project specific.</p>

      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Contact Person saved successfully.</div> : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="clientId" required>Client</FormLabel>
          <SearchableCombobox id="clientId" options={clientOptions} value={selectedClientId} onValueChange={handleClientChange} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No client found." />
        </div>

        <div>
          <FormLabel htmlFor="projectId" required>Project</FormLabel>
          <SearchableCombobox id="projectId" options={projectOptions} value={selectedProjectId} onValueChange={setSelectedProjectId} placeholder={selectedClientId ? "Select project" : "Select client first"} searchPlaceholder="Search projects..." emptyLabel="No project found." disabled={!selectedClientId} />
        </div>

        <div>
          <FormLabel htmlFor="name" required>Name</FormLabel>
          <input id="name" name="name" className="input" defaultValue={initialValues?.name ?? ""} required />
        </div>

        <div>
          <FormLabel htmlFor="email" required>Email</FormLabel>
          <input id="email" name="email" type="email" className="input" defaultValue={initialValues?.email ?? ""} required />
        </div>

        <div>
          <FormLabel htmlFor="contactNumber">Contact Number</FormLabel>
          <input id="contactNumber" name="contactNumber" className="input" defaultValue={initialValues?.contactNumber ?? ""} />
        </div>

        <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </form>
  );
}
