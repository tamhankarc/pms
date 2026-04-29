"use client";

import { useActionState, useState } from "react";
import { updateProjectAction, type ProjectFormState } from "@/lib/actions/project-actions";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type ProjectType = {
  id: string;
  name: string;
  clientId: string;
};

type BillingModel = "HOURLY" | "FIXED_FULL" | "FIXED_MONTHLY";
type ProjectStatus = "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";

const initialState: ProjectFormState = {};

export function ProjectEditForm({
  projectId,
  lockedClientName,
  projectTypes,
  clientUsesProjectTypes,
  clientShowsCountriesInEntries,
  clientShowsMoviesInEntries,
  clientShowsAssetTypesInEntries,
  initialValues,
}: {
  projectId: string;
  lockedClientName: string;
  projectTypes: ProjectType[];
  clientUsesProjectTypes: boolean;
  clientShowsCountriesInEntries: boolean;
  clientShowsMoviesInEntries: boolean;
  clientShowsAssetTypesInEntries: boolean;
  initialValues: {
    projectTypeId: string | null;
    name: string;
    billingModel: BillingModel;
    fixedContractHours: number | null;
    fixedMonthlyHours: number | null;
    status: ProjectStatus;
    description: string | null;
    hideCountriesInEntries: boolean;
    hideMoviesInEntries: boolean;
    hideAssetTypesInEntries: boolean;
  };
}) {
  const [billingModel, setBillingModel] = useState<BillingModel>(initialValues.billingModel);
  const [projectTypeId, setProjectTypeId] = useState(initialValues.projectTypeId ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initialValues.status);
  const [hideCountriesInEntries, setHideCountriesInEntries] = useState(initialValues.hideCountriesInEntries);
  const [hideMoviesInEntries, setHideMoviesInEntries] = useState(initialValues.hideMoviesInEntries);
  const [hideAssetTypesInEntries, setHideAssetTypesInEntries] = useState(initialValues.hideAssetTypesInEntries);
  const boundAction = updateProjectAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="card p-6">
      <input type="hidden" name="projectTypeId" value={projectTypeId} />
      <input type="hidden" name="billingModel" value={billingModel} />
      <input type="hidden" name="status" value={status} />
      {hideCountriesInEntries ? <input type="hidden" name="hideCountriesInEntries" value="on" /> : null}
      {hideMoviesInEntries ? <input type="hidden" name="hideMoviesInEntries" value="on" /> : null}
      {hideAssetTypesInEntries ? <input type="hidden" name="hideAssetTypesInEntries" value="on" /> : null}

      <h2 className="section-title">Edit project</h2>
      <p className="section-subtitle">
        Client remains locked after creation. Fields marked <span className="text-red-600">*</span> are required.
      </p>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Project updated successfully.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormLabel htmlFor="lockedClient">Client</FormLabel>
          <input id="lockedClient" className="input bg-slate-50" value={lockedClientName} readOnly />
        </div>

        {clientUsesProjectTypes ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="projectTypeId" required>
              Project type
            </FormLabel>
            <SearchableCombobox
              id="projectTypeId"
              value={projectTypeId}
              onValueChange={setProjectTypeId}
              options={projectTypes.map((type) => ({ value: type.id, label: type.name }))}
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
          <input id="name" className="input" name="name" defaultValue={initialValues.name} required />
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

        {clientShowsCountriesInEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideCountriesInEntries}
              onChange={(event) => setHideCountriesInEntries(event.target.checked)}
            />
            Hide country dropdown in Time Entries and Estimates for this project
          </label>
        ) : null}


        {clientShowsMoviesInEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideMoviesInEntries}
              onChange={(event) => setHideMoviesInEntries(event.target.checked)}
            />
            Hide movie dropdown in Time Entries and Estimates for this project
          </label>
        ) : null}

        {clientShowsAssetTypesInEntries ? (
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
            <input id="fixedContractHours" className="input" name="fixedContractHours" type="number" min="0" step="0.25" defaultValue={initialValues.fixedContractHours ?? ""} required />
          </div>
        ) : null}

        {billingModel === "FIXED_MONTHLY" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedMonthlyHours" required>
              Fixed monthly hours
            </FormLabel>
            <input id="fixedMonthlyHours" className="input" name="fixedMonthlyHours" type="number" min="0" step="0.25" defaultValue={initialValues.fixedMonthlyHours ?? ""} required />
          </div>
        ) : null}

        <div className="md:col-span-2">
          <FormLabel htmlFor="description">Description</FormLabel>
          <textarea id="description" className="input min-h-24" name="description" defaultValue={initialValues.description ?? ""} />
        </div>

        <div className="md:col-span-2">
          <button className="btn-primary w-full md:w-auto" disabled={pending}>
            {pending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
