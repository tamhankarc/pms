"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { BillingContactFormState } from "@/lib/actions/billing-contact-actions";

const initialState: BillingContactFormState = {};
type Client = { id: string; name: string };
type ContactPerson = { id: string; clientId: string; name: string; email: string };
type Project = { id: string; clientId: string; name: string };
type ReportOption = { value: string; label: string };
type Level = "CLIENT" | "CLIENT_PROJECT" | "CLIENT_BILLING_REPORT";

export function BillingContactForm({ clients, contactPersons, projects, reports, action }: {
  clients: Client[];
  contactPersons: ContactPerson[];
  projects: Project[];
  reports: ReportOption[];
  action: (state: BillingContactFormState, formData: FormData) => Promise<BillingContactFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [clientId, setClientId] = useState("");
  const [contactPersonId, setContactPersonId] = useState("");
  const [assignmentLevel, setAssignmentLevel] = useState<Level>("CLIENT");
  const [projectId, setProjectId] = useState("");
  const [billingReportType, setBillingReportType] = useState("");
  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);
  const contactOptions = useMemo(() => contactPersons.filter((person) => person.clientId === clientId).map((person) => ({ value: person.id, label: person.name, keywords: person.email })), [contactPersons, clientId]);
  const projectOptions = useMemo(() => projects.filter((project) => project.clientId === clientId).map((project) => ({ value: project.id, label: project.name })), [projects, clientId]);

  function handleClientChange(value: string) {
    setClientId(value);
    setContactPersonId("");
    setProjectId("");
    setBillingReportType("");
  }

  return (
    <form action={formAction} className="card p-6">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="contactPersonId" value={contactPersonId} />
      <input type="hidden" name="assignmentLevel" value={assignmentLevel} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="billingReportType" value={billingReportType} />
      <h2 className="section-title">Assign Billing Contact</h2>
      <p className="section-subtitle">Assign one contact as Bill To for client, project, or billing report level.</p>
      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Billing Contact saved successfully.</div> : null}
      <div className="mt-5 space-y-4">
        <div><FormLabel htmlFor="clientId" required>Client</FormLabel><SearchableCombobox id="clientId" value={clientId} onValueChange={handleClientChange} options={clientOptions} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No client found." /></div>
        <div><FormLabel htmlFor="contactPersonId" required>Billing Contact</FormLabel><SearchableCombobox id="contactPersonId" value={contactPersonId} onValueChange={setContactPersonId} options={contactOptions} placeholder={clientId ? "Select contact person" : "Select client first"} searchPlaceholder="Search contact persons..." emptyLabel="No contact person found." disabled={!clientId} /></div>
        <div className="rounded-xl border border-slate-200 p-4"><FormLabel required>Assign To</FormLabel><div className="mt-2 grid gap-3 md:grid-cols-3">{[["CLIENT","Client"],["CLIENT_PROJECT","Client + Project"],["CLIENT_BILLING_REPORT","Client + Billing Report"]].map(([value,label]) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${assignmentLevel === value ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 bg-white text-slate-700"}`}><input type="radio" checked={assignmentLevel === value} onChange={() => { setAssignmentLevel(value as Level); setProjectId(""); setBillingReportType(""); }} /><span className="font-medium">{label}</span></label>)}</div></div>
        {assignmentLevel === "CLIENT_PROJECT" ? <div><FormLabel htmlFor="projectId" required>Project</FormLabel><SearchableCombobox id="projectId" value={projectId} onValueChange={setProjectId} options={projectOptions} placeholder={clientId ? "Select project" : "Select client first"} searchPlaceholder="Search projects..." emptyLabel="No project found." disabled={!clientId} /></div> : null}
        {assignmentLevel === "CLIENT_BILLING_REPORT" ? <div><FormLabel htmlFor="billingReportType" required>Billing Report</FormLabel><SearchableCombobox id="billingReportType" value={billingReportType} onValueChange={setBillingReportType} options={reports} placeholder="Select billing report" searchPlaceholder="Search reports..." emptyLabel="No billing report found." /></div> : null}
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving..." : "Save Billing Contact"}</button>
      </div>
    </form>
  );
}
