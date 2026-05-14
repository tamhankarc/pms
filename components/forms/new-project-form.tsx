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
  showAssetNamesInEntries: boolean;
  showNewslettersInEntries: boolean;
};

type ProjectType = {
  id: string;
  name: string;
  clientId: string;
};

type FilmikResourceType = {
  id: string;
  name: string;
};

type BillingModel = "HOURLY" | "FIXED_FULL" | "FIXED_MONTHLY" | "FIXED_PER_COUNTRY" | "FIXED_COST";
type ProjectStatus = "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";

const FILMIK_CLIENT_ID = "cmne6ed2o0000jo04t3363pqz";
const SONY_PICTURES_CLIENT_ID = "cmn66d3q40002l104n6wvefvl";

const initialState: ProjectFormState = {};

export function NewProjectForm({
  clients,
  projectTypes,
  filmikResourceTypes,
  isAdmin = false,
}: {
  clients: Client[];
  projectTypes: ProjectType[];
  filmikResourceTypes: FilmikResourceType[];
  isAdmin?: boolean;
}) {
  const [billingModel, setBillingModel] = useState<BillingModel>("HOURLY");
  const [clientId, setClientId] = useState("");
  const [projectTypeId, setProjectTypeId] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("DRAFT");
  const [hideCountriesInEntries, setHideCountriesInEntries] = useState(false);
  const [hideMoviesInEntries, setHideMoviesInEntries] = useState(false);
  const [hideAssetTypesInEntries, setHideAssetTypesInEntries] = useState(false);
  const [hideAssetNamesInEntries, setHideAssetNamesInEntries] = useState(false);
  const [hideNewslettersInEntries, setHideNewslettersInEntries] = useState(false);
  const [addToBilling, setAddToBilling] = useState(false);
  const [monthlyAdditionalRows, setMonthlyAdditionalRows] = useState([{ month: new Date().toISOString().slice(0, 7), hours: "" }]);
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);

  const selectedClient = clients.find((client) => client.id === clientId);
  const isFilmikClient = clientId === FILMIK_CLIENT_ID;
  const isSonyPicturesClient = clientId === SONY_PICTURES_CLIENT_ID;
  const currentMonth = new Date().toISOString().slice(0, 7);

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
      {hideAssetNamesInEntries ? <input type="hidden" name="hideAssetNamesInEntries" value="on" /> : null}
      {hideNewslettersInEntries ? <input type="hidden" name="hideNewslettersInEntries" value="on" /> : null}
      {addToBilling ? <input type="hidden" name="addToBilling" value="on" /> : null}

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
              setHideAssetNamesInEntries(false);
              setHideNewslettersInEntries(false);
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
              { value: "FIXED_PER_COUNTRY", label: "Fixed Per Country" },
              { value: "FIXED_COST", label: "Fixed Cost" },
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

        {selectedClient?.showAssetNamesInEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideAssetNamesInEntries}
              onChange={(event) => setHideAssetNamesInEntries(event.target.checked)}
            />
            Hide asset name dropdown in Time Entries and Estimates for this project
          </label>
        ) : null}


        {selectedClient?.showNewslettersInEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideNewslettersInEntries}
              onChange={(event) => setHideNewslettersInEntries(event.target.checked)}
            />
            Hide newsletter dropdown in Time Entries and Estimates for this project
          </label>
        ) : null}
        <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" checked={addToBilling} onChange={(event) => setAddToBilling(event.target.checked)} />
          Add to Billing
        </label>

        {isAdmin && billingModel === "FIXED_FULL" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="additionalCharges">Additional Charges (USD)</FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span>
              <input id="additionalCharges" className="input currency-input" name="additionalCharges" type="number" min="0" step="0.01" defaultValue="0.00" />
            </div>
          </div>
        ) : null}



        {isAdmin && billingModel === "FIXED_FULL" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="partialBillingCost">Partial Billing cost (USD)</FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span>
              <input id="partialBillingCost" className="input currency-input" name="partialBillingCost" type="number" min="0" step="0.01" defaultValue="0.00" />
            </div>
          </div>
        ) : null}


        {isAdmin && billingModel === "FIXED_COST" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="projectCost">Project Cost (USD)</FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span>
              <input id="projectCost" className="input currency-input" name="projectCost" type="number" min="0" step="0.01" defaultValue="0.00" />
            </div>
          </div>
        ) : null}


        {isAdmin && isSonyPicturesClient ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="projectCostOtherMovieBillingRegion">Project Cost - Other Movie Billing Region (USD)</FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span>
              <input id="projectCostOtherMovieBillingRegion" className="input currency-input" name="projectCostOtherMovieBillingRegion" type="number" min="0" step="0.01" defaultValue="0.00" />
            </div>
          </div>
        ) : null}
        {isFilmikClient ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Resources</h3>
            <p className="mt-1 text-xs text-slate-500">Add count per Filmik resource type and the month from which that count is applicable. These entries are saved as monthly history for billing.</p>
            {filmikResourceTypes.length ? (
              <div className="mt-4 space-y-3">
                {filmikResourceTypes.map((resource) => (
                  <div key={resource.id} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_160px_180px] md:items-end">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{resource.name}</div>
                    </div>
                    <div>
                      <FormLabel htmlFor={`filmikResourceCount__${resource.id}`}>Count</FormLabel>
                      <input id={`filmikResourceCount__${resource.id}`} className="input" name={`filmikResourceCount__${resource.id}`} type="number" min="0" step="1" defaultValue="0" />
                    </div>
                    <div>
                      <FormLabel htmlFor={`filmikResourceMonth__${resource.id}`}>Applicable from</FormLabel>
                      <input id={`filmikResourceMonth__${resource.id}`} className="input" name={`filmikResourceMonth__${resource.id}`} type="month" defaultValue={currentMonth} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Create Filmik resource types from the Filmik Resources menu before assigning resource counts.</div>
            )}
          </div>
        ) : null}

        {isAdmin && billingModel === "FIXED_PER_COUNTRY" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="perCountryCharges">Per Country Charges (USD)</FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span>
              <input id="perCountryCharges" className="input currency-input" name="perCountryCharges" type="number" min="0" step="0.01" defaultValue="0.00" />
            </div>
          </div>
        ) : null}

        {isAdmin && billingModel === "FIXED_FULL" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedContractHours" required>
              Fixed contract hours
            </FormLabel>
            <input id="fixedContractHours" className="input" name="fixedContractHours" type="number" min="0" step="0.25" required />
          </div>
        ) : null}

        {isAdmin && billingModel === "FIXED_MONTHLY" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedMonthlyHours" required>
              Fixed monthly hours
            </FormLabel>
            <input id="fixedMonthlyHours" className="input" name="fixedMonthlyHours" type="number" min="0" step="0.25" required />
          </div>
        ) : null}


        {isAdmin && billingModel === "FIXED_MONTHLY" ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Monthly Additional Hours</h3>
            <p className="mt-1 text-xs text-slate-500">Add extra fixed monthly hours for specific months. Leave blank if no extra hours apply.</p>
            <div className="mt-4 space-y-3">
              {monthlyAdditionalRows.map((row, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[180px_1fr_auto] md:items-end">
                  <div>
                    <FormLabel htmlFor={`monthlyAdditionalHourMonth_${index}`}>Month</FormLabel>
                    <input id={`monthlyAdditionalHourMonth_${index}`} className="input" name="monthlyAdditionalHourMonth" type="month" value={row.month} onChange={(event) => setMonthlyAdditionalRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, month: event.target.value } : item))} />
                  </div>
                  <div>
                    <FormLabel htmlFor={`monthlyAdditionalHourHours_${index}`}>Additional hours</FormLabel>
                    <input id={`monthlyAdditionalHourHours_${index}`} className="input" name="monthlyAdditionalHourHours" type="number" min="0" step="0.25" value={row.hours} onChange={(event) => setMonthlyAdditionalRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, hours: event.target.value } : item))} />
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => setMonthlyAdditionalRows((rows) => rows.filter((_, itemIndex) => itemIndex !== index))} disabled={monthlyAdditionalRows.length === 1}>Remove</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-secondary mt-3" onClick={() => setMonthlyAdditionalRows((rows) => [...rows, { month: currentMonth, hours: "" }])}>Add month</button>
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
