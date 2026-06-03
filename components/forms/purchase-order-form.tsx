"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import type { PurchaseOrderFormState } from "@/lib/actions/purchase-order-actions";

type Client = { id: string; name: string; poAssignmentMode?: string };
type Title = { id: string; title: string; clientId: string; clientName?: string };
type Project = { id: string; name: string; clientId: string; clientName?: string };
type AssignmentMode = "TITLE" | "TITLE_BILLING_REPORT" | "TITLE_PROJECT" | "PROJECT";

const initialState: PurchaseOrderFormState = {};
const reportTypeOptions = [
  { value: "social-assets", label: "Social Assets" },
  { value: "localization", label: "Localization" },
  { value: "domestic-deliverable", label: "Domestic Deliverable" },
  { value: "intl-deliverable", label: "INTL Deliverable" },
  { value: "other-deliverable", label: "Other Deliverable" },
  { value: "filmik", label: "Filmik Billing Report" },
  { value: "generic", label: "Generic Billing Report" },
];

export function PurchaseOrderForm({
  clients,
  titles,
  projects,
  action,
  submitLabel,
  title,
  initialValues,
}: {
  clients: Client[];
  titles: Title[];
  projects: Project[];
  action: (state: PurchaseOrderFormState, formData: FormData) => Promise<PurchaseOrderFormState>;
  submitLabel: string;
  title: string;
  initialValues?: {
    id?: string;
    clientId: string;
    poNumber: string;
    amount: string;
    currency: string;
    poDate?: string;
    validFrom?: string;
    validTo?: string;
    status: string;
    documentUrl?: string;
    notes?: string;
    assignmentMode: AssignmentMode;
    movieIds: string[];
    projectId?: string;
    billingReportType?: string;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [clientId, setClientId] = useState(initialValues?.clientId ?? "");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(initialValues?.assignmentMode ?? "TITLE");
  const [movieIds, setTitleIds] = useState<string[]>(initialValues?.movieIds ?? []);
  const [projectId, setProjectId] = useState(initialValues?.projectId ?? "");
  const [billingReportType, setBillingReportType] = useState(initialValues?.billingReportType ?? "");

  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);
  const titleOptions = useMemo(() => titles.filter((movie) => !clientId || movie.clientId === clientId).map((movie) => ({ value: movie.id, label: movie.title, keywords: movie.clientName ?? "" })), [titles, clientId]);
  const projectOptions = useMemo(() => projects.filter((project) => !clientId || project.clientId === clientId).map((project) => ({ value: project.id, label: project.name, keywords: project.clientName ?? "" })), [projects, clientId]);
  const poKindLabel = assignmentMode === "TITLE" && movieIds.length > 1 ? "Residual" : assignmentMode === "TITLE" && movieIds.length === 1 ? "Normal" : "Configured by selected mode";

  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    setTitleIds([]);
    setProjectId("");
  }

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="assignmentMode" value={assignmentMode} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="billingReportType" value={billingReportType} />

      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">Create the PO once, then assign it using the client-specific PO mode.</p>
      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Purchase Order saved successfully.</div> : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="clientId" required>Client</FormLabel>
          <SearchableCombobox id="clientId" options={clientOptions} value={clientId} onValueChange={handleClientChange} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No client found." />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><FormLabel htmlFor="poNumber" required>PO Number</FormLabel><input id="poNumber" name="poNumber" className="input" defaultValue={initialValues?.poNumber ?? ""} required /></div>
          <div>
            <FormLabel htmlFor="status" required>Status</FormLabel>
            <SearchableCombobox
              id="status"
              name="status"
              defaultValue={initialValues?.status ?? "ACTIVE"}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "EXHAUSTED", label: "Exhausted" },
                { value: "EXPIRED", label: "Expired" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
              placeholder="Select status"
              searchPlaceholder="Search statuses..."
              emptyLabel="No status found."
            />
          </div>
          <div><FormLabel htmlFor="amount">PO Amount</FormLabel><input id="amount" name="amount" type="number" min="0" step="0.01" className="input" defaultValue={initialValues?.amount ?? "0.00"} /></div>
          <div><FormLabel htmlFor="currency">Currency</FormLabel><input id="currency" name="currency" className="input" defaultValue={initialValues?.currency ?? "USD"} /></div>
          <div><FormLabel htmlFor="poDate">PO Date</FormLabel><input id="poDate" name="poDate" type="date" className="input" defaultValue={initialValues?.poDate ?? ""} /></div>
          <div><FormLabel htmlFor="validFrom">Valid From</FormLabel><input id="validFrom" name="validFrom" type="date" className="input" defaultValue={initialValues?.validFrom ?? ""} /></div>
          <div><FormLabel htmlFor="validTo">Valid To</FormLabel><input id="validTo" name="validTo" type="date" className="input" defaultValue={initialValues?.validTo ?? ""} /></div>
          <div><FormLabel htmlFor="documentUrl">Document URL</FormLabel><input id="documentUrl" name="documentUrl" className="input" defaultValue={initialValues?.documentUrl ?? ""} /></div>
        </div>
        <div><FormLabel htmlFor="notes">Notes</FormLabel><textarea id="notes" name="notes" className="input min-h-24" defaultValue={initialValues?.notes ?? ""} /></div>

        <div className="rounded-xl border border-slate-200 p-4">
          <FormLabel htmlFor="assignmentMode" required>PO Assignment</FormLabel>
          <div className="mt-2 grid gap-3 md:grid-cols-4">
            {[
              ["TITLE", "Title"],
              ["TITLE_BILLING_REPORT", "Title + Billing Report"],
              ["TITLE_PROJECT", "Title + Project"],
              ["PROJECT", "Project"],
            ].map(([value, label]) => (
              <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${assignmentMode === value ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 bg-white text-slate-700"}`}>
                <input type="radio" checked={assignmentMode === value} onChange={() => setAssignmentMode(value as AssignmentMode)} />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Title mode labels itself automatically: 1 PO + 1 Title = Normal, 1 PO + multiple Titles = Residual. Current: <strong>{poKindLabel}</strong>.</p>
        </div>

        {assignmentMode !== "PROJECT" ? <div><FormLabel htmlFor="movieIds" required>Title(s)</FormLabel><SearchableMultiSelect id="movieIds" name="movieIds" options={titleOptions} value={movieIds} onValueChange={setTitleIds} placeholder={clientId ? "Select title(s)" : "Select client first"} searchPlaceholder="Search titles..." emptyLabel="No titles found." disabled={!clientId} required /></div> : null}
        {assignmentMode === "TITLE_BILLING_REPORT" ? <div><FormLabel htmlFor="billingReportType" required>Billing Report</FormLabel><SearchableCombobox id="billingReportType" options={reportTypeOptions} value={billingReportType} onValueChange={setBillingReportType} placeholder="Select billing report" searchPlaceholder="Search reports..." emptyLabel="No billing report found." /></div> : null}
        {(assignmentMode === "TITLE_PROJECT" || assignmentMode === "PROJECT") ? <div><FormLabel htmlFor="projectId" required>Project</FormLabel><SearchableCombobox id="projectId" options={projectOptions} value={projectId} onValueChange={setProjectId} placeholder={clientId ? "Select project" : "Select client first"} searchPlaceholder="Search projects..." emptyLabel="No project found." disabled={!clientId} /></div> : null}

        <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </form>
  );
}
