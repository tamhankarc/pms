"use client";

import { useActionState, useState } from "react";
import {
  updateProjectAction,
  type ProjectFormState,
} from "@/lib/actions/project-actions";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type ProjectType = {
  id: string;
  name: string;
  clientId: string;
};

type FilmikResourceType = {
  id: string;
  name: string;
  latestCount: number;
  latestMonth: string;
};

type ContactPerson = {
  id: string;
  name: string;
  email: string;
  clientId: string;
};

type BillingModel =
  | "HOURLY"
  | "FIXED_FULL"
  | "FIXED_MONTHLY"
  | "FIXED_PER_COUNTRY"
  | "FIXED_COST";
type BillingCycle = "ONE_TIME" | "MONTHLY";
type WarnerProjectType = "OTHER" | "PORTAL";
type ProjectStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "COMPLETED_BILLED"
  | "ARCHIVED";
const FILMIK_CLIENT_ID = "cmne6ed2o0000jo04t3363pqz";
const SONY_PICTURES_CLIENT_ID = "cmn66d3q40002l104n6wvefvl";
const UNIVERSAL_PICTURES_CLIENT_ID = "cmnh2xr1s0004l204ia5u5zj3";
const WARNER_BROS_CLIENT_ID = "cmn66av4j0001l104077m5vxz";

const initialState: ProjectFormState = {};

export function ProjectEditForm({
  projectId,
  lockedClientName,
  projectTypes,
  clientId,
  clientUsesProjectTypes,
  clientShowsCountriesInEntries,
  clientShowsMoviesInEntries,
  clientShowsAssetTypesInEntries,
  clientShowsLensTypesInEntries,
  clientShowsAssetNamesInEntries,
  clientShowsNewslettersInEntries,
  initialValues,
  filmikResourceTypes,
  contactPersons = [],
  monthlyAdditionalHours = [],
  isAdmin = false,
}: {
  projectId: string;
  lockedClientName: string;
  clientId: string;
  projectTypes: ProjectType[];
  clientUsesProjectTypes: boolean;
  clientShowsCountriesInEntries: boolean;
  clientShowsMoviesInEntries: boolean;
  clientShowsAssetTypesInEntries: boolean;
  clientShowsLensTypesInEntries: boolean;
  clientShowsAssetNamesInEntries: boolean;
  clientShowsNewslettersInEntries: boolean;
  filmikResourceTypes: FilmikResourceType[];
  contactPersons?: ContactPerson[];
  monthlyAdditionalHours?: { month: string; hours: number }[];
  initialValues: {
    projectTypeId: string | null;
    contactPersonId: string | null;
    name: string;
    billingModel: BillingModel;
    billingCycle: BillingCycle;
    warnerProjectType: WarnerProjectType;
    fixedContractHours: number | null;
    fixedMonthlyHours: number | null;
    status: ProjectStatus;
    description: string | null;
    hideCountriesInEntries: boolean;
    hideMoviesInEntries: boolean;
    hideAssetTypesInEntries: boolean;
    hideLensTypesInEntries: boolean;
    hideAssetNamesInEntries: boolean;
    hideNewslettersInEntries: boolean;
    addToBilling: boolean;
    additionalCharges: number | null;
    partialBillingCost: number | null;
    perCountryCharges: number | null;
    projectCost: number | null;
    projectCostOtherMovieBillingRegion: number | null;
    universalSmallCost: number | null;
    universalMediumCost: number | null;
    universalLargeCost: number | null;
    universalExtraLargeCost: number | null;
    developerCount: number | null;
    perDeveloperCost: number | null;
  };
  isAdmin: boolean;
}) {
  const [billingModel, setBillingModel] = useState<BillingModel>(
    initialValues.billingModel,
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    initialValues.billingCycle ?? "ONE_TIME",
  );
  const [warnerProjectType, setWarnerProjectType] = useState<WarnerProjectType>(
    initialValues.warnerProjectType ?? "OTHER",
  );
  const [projectTypeId, setProjectTypeId] = useState(
    initialValues.projectTypeId ?? "",
  );
  const [contactPersonId, setContactPersonId] = useState(
    initialValues.contactPersonId ?? "",
  );
  const [status, setStatus] = useState<ProjectStatus>(initialValues.status);
  const [hideCountriesInEntries, setHideCountriesInEntries] = useState(
    initialValues.hideCountriesInEntries,
  );
  const [hideMoviesInEntries, setHideTitlesInEntries] = useState(
    initialValues.hideMoviesInEntries,
  );
  const [hideAssetTypesInEntries, setHideAssetTypesInEntries] = useState(
    initialValues.hideAssetTypesInEntries,
  );
  const [hideLensTypesInEntries, setHideLensTypesInEntries] = useState(
    initialValues.hideLensTypesInEntries,
  );
  const [hideAssetNamesInEntries, setHideAssetNamesInEntries] = useState(
    initialValues.hideAssetNamesInEntries,
  );
  const [hideNewslettersInEntries, setHideNewslettersInEntries] = useState(
    initialValues.hideNewslettersInEntries,
  );
  const [addToBilling, setAddToBilling] = useState(initialValues.addToBilling);
  const contactPersonOptions = contactPersons
    .filter((person) => person.clientId === clientId)
    .map((person) => ({
      value: person.id,
      label: person.name,
      keywords: person.email,
    }));
  const isFilmikClient = clientId === FILMIK_CLIENT_ID;
  const isSonyPicturesClient = clientId === SONY_PICTURES_CLIENT_ID;
  const isUniversalPicturesClient = clientId === UNIVERSAL_PICTURES_CLIENT_ID;
  const isWarnerClient = clientId === WARNER_BROS_CLIENT_ID;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [monthlyAdditionalRows, setMonthlyAdditionalRows] = useState(
    monthlyAdditionalHours.length
      ? monthlyAdditionalHours.map((row) => ({
          month: row.month,
          hours: String(row.hours),
        }))
      : [{ month: currentMonth, hours: "" }],
  );
  const boundAction = updateProjectAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState,
  );

  return (
    <form action={formAction} className="card p-6">
      <input type="hidden" name="projectTypeId" value={projectTypeId} />
      <input type="hidden" name="contactPersonId" value={contactPersonId} />
      <input type="hidden" name="billingModel" value={billingModel} />
      <input type="hidden" name="billingCycle" value={billingCycle} />
      <input type="hidden" name="warnerProjectType" value={warnerProjectType} />
      <input type="hidden" name="status" value={status} />
      {hideCountriesInEntries ? (
        <input type="hidden" name="hideCountriesInEntries" value="on" />
      ) : null}
      {hideMoviesInEntries ? (
        <input type="hidden" name="hideMoviesInEntries" value="on" />
      ) : null}
      {hideAssetTypesInEntries ? (
        <input type="hidden" name="hideAssetTypesInEntries" value="on" />
      ) : null}
      {hideLensTypesInEntries ? (
        <input type="hidden" name="hideLensTypesInEntries" value="on" />
      ) : null}
      {hideAssetNamesInEntries ? (
        <input type="hidden" name="hideAssetNamesInEntries" value="on" />
      ) : null}
      {hideNewslettersInEntries ? (
        <input type="hidden" name="hideNewslettersInEntries" value="on" />
      ) : null}
      {addToBilling ? (
        <input type="hidden" name="addToBilling" value="on" />
      ) : null}

      <h2 className="section-title">Edit project</h2>
      <p className="section-subtitle">
        Client remains locked after creation. Fields marked{" "}
        <span className="text-red-600">*</span> are required.
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
          <input
            id="lockedClient"
            className="input bg-slate-50"
            value={lockedClientName}
            readOnly
          />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="contactPersonId">Contact Person</FormLabel>
          <SearchableCombobox
            id="contactPersonId"
            value={contactPersonId}
            onValueChange={setContactPersonId}
            options={contactPersonOptions}
            placeholder="Select contact person"
            searchPlaceholder="Search contact persons..."
            emptyLabel="No contact person found."
          />
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
              options={projectTypes.map((type) => ({
                value: type.id,
                label: type.name,
              }))}
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
          <input
            id="name"
            className="input"
            name="name"
            defaultValue={initialValues.name}
            required
          />
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
          <FormLabel htmlFor="billingCycle" required>
            Billing cycle
          </FormLabel>
          <SearchableCombobox
            id="billingCycle"
            value={billingCycle}
            onValueChange={(value) => setBillingCycle(value as BillingCycle)}
            options={[
              { value: "ONE_TIME", label: "One Time" },
              { value: "MONTHLY", label: "Monthly" },
            ]}
            placeholder="Select billing cycle"
            searchPlaceholder="Search billing cycles..."
            emptyLabel="No billing cycle found."
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Use Monthly for projects billed every month, including hourly
            projects with a new PO each month.
          </p>
        </div>

        {isWarnerClient ? (
          <div>
            <FormLabel htmlFor="warnerProjectType" required>
              Project type
            </FormLabel>
            <SearchableCombobox
              id="warnerProjectType"
              value={warnerProjectType}
              onValueChange={(value) =>
                setWarnerProjectType(value as WarnerProjectType)
              }
              options={[
                { value: "OTHER", label: "Other" },
                { value: "PORTAL", label: "Portal" },
              ]}
              placeholder="Select project type"
              searchPlaceholder="Search project types..."
              emptyLabel="No project type found."
              required
            />
          </div>
        ) : null}

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
              { value: "COMPLETED_BILLED", label: "Completed & Billed" },
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
              onChange={(event) =>
                setHideCountriesInEntries(event.target.checked)
              }
            />
            Hide country dropdown in Time Entries and Estimates for this project
          </label>
        ) : null}

        {clientShowsMoviesInEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideMoviesInEntries}
              onChange={(event) => setHideTitlesInEntries(event.target.checked)}
            />
            Hide title dropdown in Time Entries and Estimates for this project
          </label>
        ) : null}

        {clientShowsAssetTypesInEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideAssetTypesInEntries}
              onChange={(event) =>
                setHideAssetTypesInEntries(event.target.checked)
              }
            />
            Hide asset type dropdown in Time Entries and Estimates for this
            project
          </label>
        ) : null}

        {clientShowsLensTypesInEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideLensTypesInEntries}
              onChange={(event) =>
                setHideLensTypesInEntries(event.target.checked)
              }
            />
            Hide Lens Type dropdown in Time Entries and Estimates for this
            project
          </label>
        ) : null}

        {clientShowsAssetNamesInEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideAssetNamesInEntries}
              onChange={(event) =>
                setHideAssetNamesInEntries(event.target.checked)
              }
            />
            Hide asset name dropdown in Time Entries and Estimates for this
            project
          </label>
        ) : null}

        {clientShowsNewslettersInEntries ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hideNewslettersInEntries}
              onChange={(event) =>
                setHideNewslettersInEntries(event.target.checked)
              }
            />
            Hide newsletter dropdown in Time Entries and Estimates for this
            project
          </label>
        ) : null}
        <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={addToBilling}
            onChange={(event) => setAddToBilling(event.target.checked)}
          />
          Add to Billing
        </label>

        {isAdmin && billingModel === "FIXED_FULL" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="additionalCharges">
              Additional Charges (USD)
            </FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                $
              </span>
              <input
                id="additionalCharges"
                className="input currency-input"
                name="additionalCharges"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.additionalCharges ?? "0.00"}
              />
            </div>
          </div>
        ) : null}

        {isAdmin && billingModel === "FIXED_FULL" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="partialBillingCost">
              Partial Billing cost (USD)
            </FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                $
              </span>
              <input
                id="partialBillingCost"
                className="input currency-input"
                name="partialBillingCost"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.partialBillingCost ?? "0.00"}
              />
            </div>
          </div>
        ) : null}

        {isAdmin && billingModel === "FIXED_COST" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="projectCost">Project Cost (USD)</FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                $
              </span>
              <input
                id="projectCost"
                className="input currency-input"
                name="projectCost"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.projectCost ?? "0.00"}
              />
            </div>
          </div>
        ) : null}

        {isAdmin && isUniversalPicturesClient ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Universal Cost Categories (USD)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Used in Universal Billing Summary for Social QA and Localization.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                [
                  "universalSmallCost",
                  "Small (1 to 19)",
                  initialValues.universalSmallCost,
                ],
                [
                  "universalMediumCost",
                  "Medium (20 to 34)",
                  initialValues.universalMediumCost,
                ],
                [
                  "universalLargeCost",
                  "Large (35 to 69)",
                  initialValues.universalLargeCost,
                ],
                [
                  "universalExtraLargeCost",
                  "Extra Large (70 above)",
                  initialValues.universalExtraLargeCost,
                ],
              ].map(([id, label, value]) => (
                <div key={String(id)}>
                  <FormLabel htmlFor={String(id)}>{label}</FormLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                      $
                    </span>
                    <input
                      id={String(id)}
                      className="input currency-input"
                      name={String(id)}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={String(value ?? "0.00")}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isAdmin && isSonyPicturesClient ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="projectCostOtherMovieBillingRegion">
              Project Cost - Other Title Billing Region (USD)
            </FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                $
              </span>
              <input
                id="projectCostOtherMovieBillingRegion"
                className="input currency-input"
                name="projectCostOtherMovieBillingRegion"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  initialValues.projectCostOtherMovieBillingRegion ?? "0.00"
                }
              />
            </div>
          </div>
        ) : null}
        {isFilmikClient ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Resources</h3>
            <p className="mt-1 text-xs text-slate-500">
              Update count per Filmik resource type and the month from which
              that count is applicable. A history row is kept for each
              project/resource/month.
            </p>
            {filmikResourceTypes.length ? (
              <div className="mt-4 space-y-3">
                {filmikResourceTypes.map((resource) => (
                  <div
                    key={resource.id}
                    className="grid gap-4 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_160px_180px] md:items-end"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {resource.name}
                      </div>
                      {resource.latestMonth ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Latest saved: {resource.latestCount} from{" "}
                          {resource.latestMonth}
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <FormLabel
                        htmlFor={`filmikResourceCount__${resource.id}`}
                      >
                        Count
                      </FormLabel>
                      <input
                        id={`filmikResourceCount__${resource.id}`}
                        className="input"
                        name={`filmikResourceCount__${resource.id}`}
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={resource.latestCount}
                      />
                    </div>
                    <div>
                      <FormLabel
                        htmlFor={`filmikResourceMonth__${resource.id}`}
                      >
                        Applicable from
                      </FormLabel>
                      <input
                        id={`filmikResourceMonth__${resource.id}`}
                        className="input"
                        name={`filmikResourceMonth__${resource.id}`}
                        type="month"
                        defaultValue={resource.latestMonth || currentMonth}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Create Filmik resource types from the Filmik Resources menu
                before assigning resource counts.
              </div>
            )}
          </div>
        ) : null}

        {isAdmin && billingModel === "FIXED_PER_COUNTRY" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="perCountryCharges">
              Per Country Charges (USD)
            </FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                $
              </span>
              <input
                id="perCountryCharges"
                className="input currency-input"
                name="perCountryCharges"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.perCountryCharges ?? "0.00"}
              />
            </div>
          </div>
        ) : null}

        {isAdmin && billingModel === "FIXED_FULL" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedContractHours" required>
              Fixed contract hours
            </FormLabel>
            <input
              id="fixedContractHours"
              className="input"
              name="fixedContractHours"
              type="number"
              min="0"
              step="0.25"
              defaultValue={initialValues.fixedContractHours ?? ""}
              required
            />
          </div>
        ) : null}

        {isAdmin && billingModel === "FIXED_MONTHLY" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedMonthlyHours" required>
              Fixed monthly hours
            </FormLabel>
            <input
              id="fixedMonthlyHours"
              className="input"
              name="fixedMonthlyHours"
              type="number"
              min="0"
              step="0.25"
              defaultValue={initialValues.fixedMonthlyHours ?? ""}
              required
            />
          </div>
        ) : null}

        {isAdmin && billingModel === "FIXED_MONTHLY" ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Monthly Additional Hours
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Add extra fixed monthly hours for specific months. Leave blank if
              no extra hours apply.
            </p>
            <div className="mt-4 space-y-3">
              {monthlyAdditionalRows.map((row, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[180px_1fr_auto] md:items-end"
                >
                  <div>
                    <FormLabel htmlFor={`monthlyAdditionalHourMonth_${index}`}>
                      Month
                    </FormLabel>
                    <input
                      id={`monthlyAdditionalHourMonth_${index}`}
                      className="input"
                      name="monthlyAdditionalHourMonth"
                      type="month"
                      value={row.month}
                      onChange={(event) =>
                        setMonthlyAdditionalRows((rows) =>
                          rows.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, month: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <FormLabel htmlFor={`monthlyAdditionalHourHours_${index}`}>
                      Additional hours
                    </FormLabel>
                    <input
                      id={`monthlyAdditionalHourHours_${index}`}
                      className="input"
                      name="monthlyAdditionalHourHours"
                      type="number"
                      min="0"
                      step="0.25"
                      value={row.hours}
                      onChange={(event) =>
                        setMonthlyAdditionalRows((rows) =>
                          rows.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, hours: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      setMonthlyAdditionalRows((rows) =>
                        rows.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    disabled={monthlyAdditionalRows.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-secondary mt-3"
              onClick={() =>
                setMonthlyAdditionalRows((rows) => [
                  ...rows,
                  { month: currentMonth, hours: "" },
                ])
              }
            >
              Add month
            </button>
          </div>
        ) : null}

        <div className="md:col-span-2">
          <FormLabel htmlFor="description">Description</FormLabel>
          <textarea
            id="description"
            className="input min-h-24"
            name="description"
            defaultValue={initialValues.description ?? ""}
          />
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
