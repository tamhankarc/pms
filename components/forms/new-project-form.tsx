"use client";

import { useActionState, useMemo, useState } from "react";
import { createProjectAction, type ProjectFormState } from "@/lib/actions/project-actions";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type Client = {
  id: string;
  name: string;
  enableProjectTypes: boolean;
  showCountriesInTimeEntries: boolean;
  showMoviesInEntries: boolean;
  showAssetTypesInEntries: boolean;
};

type ProjectType = {
  id: string;
  name: string;
  clientId: string;
};

type BillingModel = "HOURLY" | "FIXED_FULL" | "FIXED_MONTHLY";
type ProjectStatus = "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";

const initialState: ProjectFormState = {};

export function NewProjectForm({
  clients,
  projectTypes,
}: {
  clients: Client[];
  projectTypes: ProjectType[];
}) {
  const [billingModel, setBillingModel] = useState<BillingModel>("HOURLY");
  const [clientId, setClientId] = useState("");
  const [projectTypeId, setProjectTypeId] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("DRAFT");
  const [hideCountriesInEntries, setHideCountriesInEntries] = useState(false);
  const [hideMoviesInEntries, setHideMoviesInEntries] = useState(false);
  const [hideAssetTypesInEntries, setHideAssetTypesInEntries] = useState(false);
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);

  const selectedClient = clients.find((client) => client.id === clientId);

  const filteredProjectTypes = useMemo(
    () => projectTypes.filter((type) => type.clientId === clientId),
    [projectTypes, clientId],
  );

  return (
    <form action={formAction} className="card p-6">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="projectTypeId" value={projectTypeId} />
      <input type="hidden" name="billingModel" value={billingModel} />
      <input type="hidden" name="status" value={status} />
      {hideCountriesInEntries ? <input type="hidden" name="hideCountriesInEntries" value="on" /> : null}
      {hideMoviesInEntries ? <input type="hidden" name="hideMoviesInEntries" value="on" /> : null}
      {hideAssetTypesInEntries ? <input type="hidden" name="hideAssetTypesInEntries" value="on" /> : null}

      <h2 className="section-title">Create project</h2>
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
          Project created successfully.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormLabel htmlFor="clientId" required>
            Client
          </FormLabel>
          <SearchableCombobox
            id="clientId"
            value={clientId}
            onValueChange={(value) => {
              setClientId(value);
              setProjectTypeId("");
              setHideCountriesInEntries(false);
              setHideMoviesInEntries(false);
              setHideAssetTypesInEntries(false);
            }}
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
            placeholder="Select client"
            searchPlaceholder="Search clients..."
            emptyLabel="No client found."
            required
          />
        </div>

        {selectedClient?.enableProjectTypes ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="projectTypeId" required>
              Project type
            </FormLabel>
            <SearchableCombobox
              id="projectTypeId"
              value={projectTypeId}
              onValueChange={setProjectTypeId}
              options={filteredProjectTypes.map((type) => ({ value: type.id, label: type.name }))}
              placeholder="Select project type"
              searchPlaceholder="Search project types..."
              emptyLabel="No project type found."
              required
            />
          </div>
        ) : null}

        <div className="md:col-span-2">
          <FormLabel htmlFor="name" required>
            Project name
          </FormLabel>
          <input id="name" className="input" name="name" required />
        </div>

        <div>
          <FormLabel htmlFor="billingModel" required>
            Billing model
          </FormLabel>
          <SearchableCombobox
            id="billingModel"
            value={billingModel}
            onValueChange={(value) => setBillingModel(value as BillingModel)}
            options={[
              { value: "HOURLY", label: "Hourly" },
              { value: "FIXED_FULL", label: "Fixed - Full Project" },
              { value: "FIXED_MONTHLY", label: "Fixed - Monthly" },
            ]}
            placeholder="Select billing model"
            searchPlaceholder="Search billing models..."
            emptyLabel="No billing model found."
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="status" required>
            Status
          </FormLabel>
          <SearchableCombobox
            id="status"
            value={status}
            onValueChange={(value) => setStatus(value as ProjectStatus)}
            options={[
              { value: "DRAFT", label: "Draft" },
              { value: "ACTIVE", label: "Active" },
              { value: "ON_HOLD", label: "On Hold" },
              { value: "COMPLETED", label: "Completed" },
              { value: "ARCHIVED", label: "Archived" },
            ]}
            placeholder="Select status"
            searchPlaceholder="Search statuses..."
            emptyLabel="No status found."
            required
          />
        </div>

        {selectedClient?.showCountriesInTimeEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideCountriesInEntries}
              onChange={(event) => setHideCountriesInEntries(event.target.checked)}
            />
            Hide country dropdown in Time Entries and Estimates for this project
          </label>
        ) : null}


        {selectedClient?.showMoviesInEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideMoviesInEntries}
              onChange={(event) => setHideMoviesInEntries(event.target.checked)}
            />
            Hide movie dropdown in Time Entries and Estimates for this project
          </label>
        ) : null}

        {selectedClient?.showAssetTypesInEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideAssetTypesInEntries}
              onChange={(event) => setHideAssetTypesInEntries(event.target.checked)}
            />
            Hide asset type dropdown in Time Entries and Estimates for this project
          </label>
        ) : null}

        {billingModel === "FIXED_FULL" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedContractHours" required>
              Fixed contract hours
            </FormLabel>
            <input id="fixedContractHours" className="input" name="fixedContractHours" type="number" min="0" step="0.25" required />
          </div>
        ) : null}

        {billingModel === "FIXED_MONTHLY" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedMonthlyHours" required>
              Fixed monthly hours
            </FormLabel>
            <input id="fixedMonthlyHours" className="input" name="fixedMonthlyHours" type="number" min="0" step="0.25" required />
          </div>
        ) : null}

        <div className="md:col-span-2">
          <FormLabel htmlFor="description">Description</FormLabel>
          <textarea id="description" className="input min-h-24" name="description" />
        </div>

        <div className="md:col-span-2">
          <button className="btn-primary w-full md:w-auto" disabled={pending}>
            {pending ? "Saving..." : "Create project"}
          </button>
        </div>
      </div>
    </form>
  );
}
