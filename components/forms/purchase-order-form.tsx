"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import type { PurchaseOrderFormState } from "@/lib/actions/purchase-order-actions";

type Client = {
  id: string;
  name: string;
  poAssignmentMode?: string;
  showMoviesInEntries?: boolean;
};
type Title = {
  id: string;
  title: string;
  clientId: string;
  clientName?: string;
};
type Project = {
  id: string;
  name: string;
  clientId: string;
  clientName?: string;
  newsletterType?: string | null;
  newsletterTypes?: string[];
  showNewslettersInEntries?: boolean;
  hideNewslettersInEntries?: boolean;
  billingCycle?: string;
};
type BillingReportOption = {
  value: string;
  label: string;
  clientIds?: string[];
};
type AssignmentMode =
  | "TITLE"
  | "TITLE_BILLING_REPORT"
  | "TITLE_PROJECT"
  | "PROJECT"
  | "BILLING_REPORT";

const initialState: PurchaseOrderFormState = {};
const defaultReportTypeOptions: BillingReportOption[] = [
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
  billingReports = defaultReportTypeOptions,
  action,
  submitLabel,
  title,
  initialValues,
}: {
  clients: Client[];
  titles: Title[];
  projects: Project[];
  billingReports?: BillingReportOption[];
  action: (
    state: PurchaseOrderFormState,
    formData: FormData,
  ) => Promise<PurchaseOrderFormState>;
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
    billingMonth?: string;
    newsletterType?: string;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [clientId, setClientId] = useState(initialValues?.clientId ?? "");
  const initialClient = clients.find(
    (client) => client.id === (initialValues?.clientId ?? ""),
  );
  const normalizeAssignmentMode = (mode?: string): AssignmentMode => {
    if (
      mode === "TITLE" ||
      mode === "TITLE_BILLING_REPORT" ||
      mode === "TITLE_PROJECT" ||
      mode === "PROJECT" ||
      mode === "BILLING_REPORT"
    )
      return mode;
    return "PROJECT";
  };
  const isTitleBasedAssignmentMode = (mode: AssignmentMode) =>
    mode === "TITLE" ||
    mode === "TITLE_BILLING_REPORT" ||
    mode === "TITLE_PROJECT";
  const normalizeAvailableAssignmentMode = (
    mode: AssignmentMode,
    usesTitleDropdown: boolean,
  ): AssignmentMode =>
    !usesTitleDropdown && isTitleBasedAssignmentMode(mode) ? "PROJECT" : mode;
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(
    normalizeAvailableAssignmentMode(
      normalizeAssignmentMode(
        initialValues?.assignmentMode ?? initialClient?.poAssignmentMode,
      ),
      initialClient?.showMoviesInEntries ?? true,
    ),
  );
  const [movieIds, setTitleIds] = useState<string[]>(
    initialValues?.movieIds ?? [],
  );
  const [projectId, setProjectId] = useState(initialValues?.projectId ?? "");
  const [billingReportType, setBillingReportType] = useState(
    initialValues?.billingReportType ?? "",
  );
  const [billingMonth, setBillingMonth] = useState(
    initialValues?.billingMonth ?? new Date().toISOString().slice(0, 7),
  );
  const [newsletterType, setNewsletterType] = useState(
    initialValues?.newsletterType ?? "",
  );

  const clientOptions = useMemo(
    () => clients.map((client) => ({ value: client.id, label: client.name })),
    [clients],
  );
  const selectedClient = clients.find((client) => client.id === clientId);
  const clientUsesTitleDropdown = selectedClient?.showMoviesInEntries ?? true;
  const clientDefaultAssignmentMode = normalizeAssignmentMode(
    selectedClient?.poAssignmentMode,
  );
  const effectiveAssignmentMode = normalizeAvailableAssignmentMode(
    assignmentMode,
    clientUsesTitleDropdown,
  );
  const assignmentModeOptions = [
    ...(clientUsesTitleDropdown
      ? [
          { value: "TITLE", label: "Title only" },
          { value: "TITLE_BILLING_REPORT", label: "Title + Billing Report" },
          { value: "TITLE_PROJECT", label: "Title + Project" },
        ]
      : []),
    { value: "PROJECT", label: "Project only" },
    { value: "BILLING_REPORT", label: "Billing Report only" },
  ];
  const titleOptions = useMemo(
    () =>
      titles
        .filter((movie) => !clientId || movie.clientId === clientId)
        .map((movie) => ({
          value: movie.id,
          label: movie.title,
          keywords: movie.clientName ?? "",
        })),
    [titles, clientId],
  );
  const projectOptions = useMemo(
    () =>
      projects
        .filter((project) => !clientId || project.clientId === clientId)
        .map((project) => ({
          value: project.id,
          label:
            clientId === "cmn66d3q40002l104n6wvefvl" &&
            project.id === "cmnijd30h0001l404y6i8tb2y" &&
            project.newsletterType
              ? `Newsletters - ${project.newsletterType}`
              : project.name,
          keywords: project.clientName ?? "",
        })),
    [projects, clientId],
  );
  const billingReportOptions = useMemo(
    () =>
      billingReports
        .filter(
          (report) =>
            !report.clientIds?.length || report.clientIds.includes(clientId),
        )
        .map((report) => ({ value: report.value, label: report.label })),
    [billingReports, clientId],
  );
  const selectedProject = projects.find((project) => project.id === projectId);
  const needsBillingMonth = selectedProject?.billingCycle === "MONTHLY";
  const showNewsletterType = Boolean(
    selectedProject?.showNewslettersInEntries &&
    !selectedProject?.hideNewslettersInEntries &&
    selectedProject.newsletterTypes?.length,
  );
  const newsletterTypeOptions = (selectedProject?.newsletterTypes ?? []).map(
    (value) => ({
      value,
      label: value === "AFFIRM" ? "Affirm" : value,
    }),
  );
  // const poKindLabel = effectiveAssignmentMode === "TITLE" && movieIds.length > 1 ? "Residual" : effectiveAssignmentMode === "TITLE" && movieIds.length === 1 ? "Normal" : "Configured by selected mode";

  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    setTitleIds([]);
    setProjectId("");
    setBillingReportType("");
    setNewsletterType("");
    if (nextClientId) {
      const nextClient = clients.find((client) => client.id === nextClientId);
      if (nextClient) {
        setAssignmentMode(
          normalizeAvailableAssignmentMode(
            normalizeAssignmentMode(nextClient.poAssignmentMode),
            nextClient.showMoviesInEntries ?? true,
          ),
        );
      }
    } else {
      setAssignmentMode("PROJECT");
    }
  }

  function handleAssignmentModeChange(nextAssignmentMode: string) {
    const nextMode = normalizeAvailableAssignmentMode(
      normalizeAssignmentMode(nextAssignmentMode),
      clientUsesTitleDropdown,
    );
    setAssignmentMode(nextMode);
    setTitleIds([]);
    setProjectId("");
    setBillingReportType("");
    setNewsletterType("");
  }

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? (
        <input type="hidden" name="id" value={initialValues.id} />
      ) : null}
      <input type="hidden" name="clientId" value={clientId} />
      <input
        type="hidden"
        name="assignmentMode"
        value={effectiveAssignmentMode}
      />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="billingReportType" value={billingReportType} />
      <input type="hidden" name="billingMonth" value={billingMonth} />
      <input type="hidden" name="newsletterType" value={newsletterType} />

      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">
        Create the PO once, then assign it using the client default or a
        PO-specific assignment override.
      </p>
      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Purchase Order saved successfully.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="clientId" required>
            Client
          </FormLabel>
          <SearchableCombobox
            id="clientId"
            options={clientOptions}
            value={clientId}
            onValueChange={handleClientChange}
            placeholder="Select client"
            searchPlaceholder="Search clients..."
            emptyLabel="No client found."
          />
        </div>
        <div>
          <FormLabel htmlFor="assignmentMode" required>
            PO Assignment Mode
          </FormLabel>
          <SearchableCombobox
            id="assignmentMode"
            options={assignmentModeOptions}
            value={effectiveAssignmentMode}
            onValueChange={handleAssignmentModeChange}
            placeholder={
              clientId ? "Select PO assignment mode" : "Select client first"
            }
            searchPlaceholder="Search PO assignment modes..."
            emptyLabel="No assignment mode found."
            disabled={!clientId}
          />
          <p className="mt-1 text-xs text-slate-500">
            Client default:{" "}
            {selectedClient
              ? clientDefaultAssignmentMode.replaceAll("_", " ")
              : "Select client first"}
            . Change this field to override the default for this PO only.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FormLabel htmlFor="poNumber" required>
              PO Number
            </FormLabel>
            <input
              id="poNumber"
              name="poNumber"
              className="input"
              defaultValue={initialValues?.poNumber ?? ""}
              required
            />
          </div>
          <div>
            <FormLabel htmlFor="status" required>
              Status
            </FormLabel>
            <SearchableCombobox
              id="status"
              name="status"
              defaultValue={initialValues?.status ?? "ACTIVE"}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "PROCESSED", label: "Processed" },
                { value: "EXHAUSTED", label: "Exhausted" },
                { value: "EXPIRED", label: "Expired" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
              placeholder="Select status"
              searchPlaceholder="Search statuses..."
              emptyLabel="No status found."
            />
          </div>
          <div>
            <FormLabel htmlFor="amount">PO Amount</FormLabel>
            <div className="flex gap-2">
              <SearchableCombobox
                id="currency"
                name="currency"
                defaultValue={initialValues?.currency ?? "USD"}
                options={[
                  { value: "USD", label: "$ USD" },
                  { value: "GBP", label: "£ Pound" },
                  { value: "EUR", label: "€ Euro" },
                  { value: "INR", label: "₹ Rupee" },
                ]}
                placeholder="Currency"
                searchPlaceholder="Search currency..."
                emptyLabel="No currency found."
              />
              <input
                id="amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                className="input"
                defaultValue={initialValues?.amount ?? "0.00"}
              />
            </div>
          </div>
          <div>
            <FormLabel htmlFor="poDate">PO Date</FormLabel>
            <input
              id="poDate"
              name="poDate"
              type="date"
              className="input"
              defaultValue={initialValues?.poDate ?? ""}
            />
          </div>
          <div>
            <FormLabel htmlFor="validFrom">Valid From</FormLabel>
            <input
              id="validFrom"
              name="validFrom"
              type="date"
              className="input"
              defaultValue={initialValues?.validFrom ?? ""}
            />
          </div>
          <div>
            <FormLabel htmlFor="validTo">Valid To</FormLabel>
            <input
              id="validTo"
              name="validTo"
              type="date"
              className="input"
              defaultValue={initialValues?.validTo ?? ""}
            />
          </div>
          <div>
            <FormLabel htmlFor="documentUrl">Document URL</FormLabel>
            <input
              id="documentUrl"
              name="documentUrl"
              className="input"
              defaultValue={initialValues?.documentUrl ?? ""}
            />
          </div>
        </div>
        <div>
          <FormLabel htmlFor="notes">Notes</FormLabel>
          <textarea
            id="notes"
            name="notes"
            className="input min-h-24"
            defaultValue={initialValues?.notes ?? ""}
          />
        </div>

        {effectiveAssignmentMode !== "PROJECT" &&
        effectiveAssignmentMode !== "BILLING_REPORT" ? (
          <div>
            <FormLabel htmlFor="movieIds" required>
              Title(s)
            </FormLabel>
            <SearchableMultiSelect
              id="movieIds"
              name="movieIds"
              options={titleOptions}
              value={movieIds}
              onValueChange={setTitleIds}
              placeholder={clientId ? "Select title(s)" : "Select client first"}
              searchPlaceholder="Search titles..."
              emptyLabel="No titles found."
              disabled={!clientId}
              required
            />
          </div>
        ) : null}
        {effectiveAssignmentMode === "TITLE_BILLING_REPORT" ||
        effectiveAssignmentMode === "BILLING_REPORT" ? (
          <div>
            <FormLabel htmlFor="billingReportType" required>
              Billing Report
            </FormLabel>
            <SearchableCombobox
              id="billingReportType"
              options={billingReportOptions}
              value={billingReportType}
              onValueChange={setBillingReportType}
              placeholder={
                clientId ? "Select billing report" : "Select client first"
              }
              searchPlaceholder="Search reports..."
              emptyLabel="No billing report found."
              disabled={!clientId}
            />
          </div>
        ) : null}
        {effectiveAssignmentMode === "TITLE_PROJECT" ||
        effectiveAssignmentMode === "PROJECT" ? (
          <div>
            <FormLabel htmlFor="projectId" required>
              Project
            </FormLabel>
            <SearchableCombobox
              id="projectId"
              options={projectOptions}
              value={projectId}
              onValueChange={(value) => {
                setProjectId(value);
                setNewsletterType("");
              }}
              placeholder={clientId ? "Select project" : "Select client first"}
              searchPlaceholder="Search projects..."
              emptyLabel="No project found."
              disabled={!clientId}
            />
          </div>
        ) : null}
        {showNewsletterType ? (
          <div>
            <FormLabel htmlFor="newsletterType" required>
              Newsletter Type
            </FormLabel>
            <SearchableCombobox
              id="newsletterType"
              options={newsletterTypeOptions}
              value={newsletterType}
              onValueChange={setNewsletterType}
              placeholder="Select newsletter type"
              searchPlaceholder="Search newsletter types..."
              emptyLabel="No newsletter type found."
            />
            <p className="mt-1 text-xs text-slate-500">
              This PO will be matched to the selected Newsletter type for this
              project.
            </p>
          </div>
        ) : null}

        {needsBillingMonth ? (
          <div>
            <FormLabel htmlFor="billingMonth" required>
              Billing Month
            </FormLabel>
            <input
              id="billingMonth"
              type="month"
              className="input"
              value={billingMonth}
              onChange={(event) => setBillingMonth(event.target.value)}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Monthly projects can have a separate PO for each billing month.
            </p>
          </div>
        ) : null}

        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
