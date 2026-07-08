"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createProjectAction,
  type ProjectFormState,
} from "@/lib/actions/project-actions";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { ProjectDropdownRestrictionSelect } from "@/components/forms/project-dropdown-restrictions";

type Client = {
  id: string;
  name: string;
  enableProjectTypes: boolean;
  showCountriesInTimeEntries: boolean;
  showMoviesInEntries: boolean;
  showAssetTypesInEntries: boolean;
  showLensTypesInEntries: boolean;
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

type ContactPerson = {
  id: string;
  name: string;
  email: string;
  clientId: string;
};

type RestrictionOption = {
  id: string;
  name?: string;
  clientId?: string;
  movieId?: string;
  title?: string;
};

type BillingModel =
  | "HOURLY"
  | "FIXED_FULL"
  | "FIXED_MONTHLY"
  | "FIXED_PER_COUNTRY"
  | "FIXED_COST";
type BillingCycle = "ONE_TIME" | "MONTHLY";
type WarnerProjectType = "OTHER" | "PORTAL" | "DVD" | "TICKETING" | "SOCIAL";
type SonyProjectType = "OTHER" | "NEWSLETTERS";
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

export function NewProjectForm({
  clients,
  projectTypes,
  filmikResourceTypes,
  contactPersons = [],
  countries = [],
  movies = [],
  assetTypes = [],
  lensTypes = [],
  assetNames = [],
  newsletters = [],
  isAdmin = false,
}: {
  clients: Client[];
  projectTypes: ProjectType[];
  filmikResourceTypes: FilmikResourceType[];
  contactPersons?: ContactPerson[];
  countries?: RestrictionOption[];
  movies?: RestrictionOption[];
  assetTypes?: RestrictionOption[];
  lensTypes?: RestrictionOption[];
  assetNames?: RestrictionOption[];
  newsletters?: RestrictionOption[];
  isAdmin?: boolean;
}) {
  const [billingModel, setBillingModel] = useState<BillingModel>("HOURLY");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("ONE_TIME");
  const [warnerProjectType, setWarnerProjectType] =
    useState<WarnerProjectType>("OTHER");
  const [sonyProjectType, setSonyProjectType] =
    useState<SonyProjectType>("OTHER");
  const [clientId, setClientId] = useState("");
  const [projectTypeId, setProjectTypeId] = useState("");
  const [contactPersonIds, setContactPersonIds] = useState<string[]>([]);
  const [status, setStatus] = useState<ProjectStatus>("DRAFT");
  const [hideCountriesInEntries, setHideCountriesInEntries] = useState(false);
  const [hideMoviesInEntries, setHideTitlesInEntries] = useState(false);
  const [hideAssetTypesInEntries, setHideAssetTypesInEntries] = useState(false);
  const [hideLensTypesInEntries, setHideLensTypesInEntries] = useState(false);
  const [hideAssetNamesInEntries, setHideAssetNamesInEntries] = useState(false);
  const [hideNewslettersInEntries, setHideNewslettersInEntries] =
    useState(false);
  const [requireCountriesInTimeEntries, setRequireCountriesInTimeEntries] =
    useState(false);
  const [requireMoviesInTimeEntries, setRequireMoviesInTimeEntries] =
    useState(false);
  const [requireAssetTypesInTimeEntries, setRequireAssetTypesInTimeEntries] =
    useState(false);
  const [requireLensTypesInTimeEntries, setRequireLensTypesInTimeEntries] =
    useState(false);
  const [requireAssetNamesInTimeEntries, setRequireAssetNamesInTimeEntries] =
    useState(false);
  const [requireNewslettersInTimeEntries, setRequireNewslettersInTimeEntries] =
    useState(false);
  const [allowedCountryIds, setAllowedCountryIds] = useState<string[]>([]);
  const [allowedMovieIds, setAllowedMovieIds] = useState<string[]>([]);
  const [allowedAssetTypeIds, setAllowedAssetTypeIds] = useState<string[]>([]);
  const [allowedLensTypeIds, setAllowedLensTypeIds] = useState<string[]>([]);
  const [allowedAssetNameIds, setAllowedAssetNameIds] = useState<string[]>([]);
  const [allowedNewsletterIds, setAllowedNewsletterIds] = useState<string[]>([]);
  const [addToBilling, setAddToBilling] = useState(false);
  const [monthlyAdditionalRows, setMonthlyAdditionalRows] = useState([
    { month: new Date().toISOString().slice(0, 7), hours: "" },
  ]);
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialState,
  );

  const selectedClient = clients.find((client) => client.id === clientId);
  const isFilmikClient = clientId === FILMIK_CLIENT_ID;
  const isSonyPicturesClient = clientId === SONY_PICTURES_CLIENT_ID;
  const isUniversalPicturesClient = clientId === UNIVERSAL_PICTURES_CLIENT_ID;
  const isWarnerClient = clientId === WARNER_BROS_CLIENT_ID;
  const currentMonth = new Date().toISOString().slice(0, 7);

  const contactPersonOptions = useMemo(
    () =>
      contactPersons
        .filter((person) => clientId && person.clientId === clientId)
        .map((person) => ({
          value: person.id,
          label: person.name,
          keywords: person.email,
        })),
    [contactPersons, clientId],
  );

  const filteredProjectTypes = useMemo(
    () => projectTypes.filter((type) => type.clientId === clientId),
    [projectTypes, clientId],
  );

  const countryRestrictionOptions = useMemo(
    () => countries.map((country) => ({ value: country.id, label: country.name ?? "" })),
    [countries],
  );
  const titleRestrictionOptions = useMemo(
    () => movies.filter((movie) => movie.clientId === clientId).map((movie) => ({ value: movie.id, label: movie.title ?? movie.name ?? "" })),
    [movies, clientId],
  );
  const assetTypeRestrictionOptions = useMemo(
    () => assetTypes.filter((assetType) => assetType.clientId === clientId).map((assetType) => ({ value: assetType.id, label: assetType.name ?? "" })),
    [assetTypes, clientId],
  );
  const lensTypeRestrictionOptions = useMemo(
    () => lensTypes.map((lensType) => ({ value: lensType.id, label: lensType.name ?? "" })),
    [lensTypes],
  );
  const assetNameRestrictionOptions = useMemo(
    () => assetNames.filter((assetName) => assetName.clientId === clientId).map((assetName) => ({ value: assetName.id, label: assetName.name ?? "", keywords: movies.find((movie) => movie.id === assetName.movieId)?.title ?? "" })),
    [assetNames, movies, clientId],
  );
  const newsletterRestrictionOptions = useMemo(
    () => newsletters.filter((newsletter) => newsletter.clientId === clientId).map((newsletter) => ({ value: newsletter.id, label: newsletter.name ?? "" })),
    [newsletters, clientId],
  );

  return (
    <form action={formAction} className="card p-6">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="projectTypeId" value={projectTypeId} />
      {contactPersonIds.map((id) => (
        <input key={id} type="hidden" name="contactPersonIds" value={id} />
      ))}
      <input
        type="hidden"
        name="contactPersonId"
        value={contactPersonIds[0] ?? ""}
      />
      <input type="hidden" name="billingModel" value={billingModel} />
      <input type="hidden" name="billingCycle" value={billingCycle} />
      <input type="hidden" name="warnerProjectType" value={warnerProjectType} />
      <input type="hidden" name="sonyProjectType" value={sonyProjectType} />
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
      {selectedClient?.showCountriesInTimeEntries &&
      !hideCountriesInEntries &&
      requireCountriesInTimeEntries ? (
        <input type="hidden" name="requireCountriesInTimeEntries" value="on" />
      ) : null}
      {selectedClient?.showMoviesInEntries &&
      !hideMoviesInEntries &&
      requireMoviesInTimeEntries ? (
        <input type="hidden" name="requireMoviesInTimeEntries" value="on" />
      ) : null}
      {selectedClient?.showAssetTypesInEntries &&
      !hideAssetTypesInEntries &&
      requireAssetTypesInTimeEntries ? (
        <input type="hidden" name="requireAssetTypesInTimeEntries" value="on" />
      ) : null}
      {selectedClient?.showLensTypesInEntries &&
      !hideLensTypesInEntries &&
      requireLensTypesInTimeEntries ? (
        <input type="hidden" name="requireLensTypesInTimeEntries" value="on" />
      ) : null}
      {selectedClient?.showAssetNamesInEntries &&
      !hideAssetNamesInEntries &&
      requireAssetNamesInTimeEntries ? (
        <input type="hidden" name="requireAssetNamesInTimeEntries" value="on" />
      ) : null}
      {selectedClient?.showNewslettersInEntries &&
      !hideNewslettersInEntries &&
      requireNewslettersInTimeEntries ? (
        <input type="hidden" name="requireNewslettersInTimeEntries" value="on" />
      ) : null}
      {addToBilling ? (
        <input type="hidden" name="addToBilling" value="on" />
      ) : null}

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
              setContactPersonIds([]);
              setWarnerProjectType("OTHER");
              setSonyProjectType("OTHER");
              setHideCountriesInEntries(false);
              setHideTitlesInEntries(false);
              setHideAssetTypesInEntries(false);
              setHideLensTypesInEntries(false);
              setHideAssetNamesInEntries(false);
              setHideNewslettersInEntries(false);
              setRequireCountriesInTimeEntries(false);
              setRequireMoviesInTimeEntries(false);
              setRequireAssetTypesInTimeEntries(false);
              setRequireLensTypesInTimeEntries(false);
              setRequireAssetNamesInTimeEntries(false);
              setRequireNewslettersInTimeEntries(false);
              setAllowedCountryIds([]);
              setAllowedMovieIds([]);
              setAllowedAssetTypeIds([]);
              setAllowedLensTypeIds([]);
              setAllowedAssetNameIds([]);
              setAllowedNewsletterIds([]);
            }}
            options={clients.map((client) => ({
              value: client.id,
              label: client.name,
            }))}
            placeholder="Select client"
            searchPlaceholder="Search clients..."
            emptyLabel="No client found."
            required
          />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="contactPersonIds">Contact Person(s)</FormLabel>
          <SearchableMultiSelect
            id="contactPersonIds"
            name="contactPersonIds"
            value={contactPersonIds}
            onValueChange={setContactPersonIds}
            options={contactPersonOptions}
            placeholder={
              clientId ? "Select contact person(s)" : "Select client first"
            }
            searchPlaceholder="Search contact persons..."
            emptyLabel="No contact person found."
            disabled={!clientId}
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
              options={filteredProjectTypes.map((type) => ({
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
                { value: "DVD", label: "DVD" },
                { value: "TICKETING", label: "Ticketing" },
                { value: "SOCIAL", label: "Social" },
              ]}
              placeholder="Select project type"
              searchPlaceholder="Search project types..."
              emptyLabel="No project type found."
              required
            />
          </div>
        ) : null}

        {isSonyPicturesClient ? (
          <div>
            <FormLabel htmlFor="sonyProjectType" required>
              Project type
            </FormLabel>
            <SearchableCombobox
              id="sonyProjectType"
              value={sonyProjectType}
              onValueChange={(value) =>
                setSonyProjectType(value as SonyProjectType)
              }
              options={[
                { value: "OTHER", label: "Other" },
                { value: "NEWSLETTERS", label: "Newsletters" },
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

        {selectedClient?.showCountriesInTimeEntries ? (
          <div className="md:col-span-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hideCountriesInEntries}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setHideCountriesInEntries(checked);
                  if (checked) {
                    setRequireCountriesInTimeEntries(false);
                    setAllowedCountryIds([]);
                  }
                }}
              />
              Hide country dropdown in Time Entries and Estimates for this project
            </label>
            {!hideCountriesInEntries ? (
              <>
                <label className="flex items-center gap-3 pl-6">
                  <input
                    type="checkbox"
                    checked={requireCountriesInTimeEntries}
                    onChange={(event) =>
                      setRequireCountriesInTimeEntries(event.target.checked)
                    }
                  />
                  Make country dropdown mandatory in Time Entries
                </label>
                <ProjectDropdownRestrictionSelect
                  label="Country"
                  name="allowedCountryIds"
                  value={allowedCountryIds}
                  onValueChange={setAllowedCountryIds}
                  options={countryRestrictionOptions}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {selectedClient?.showMoviesInEntries ? (
          <div className="md:col-span-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hideMoviesInEntries}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setHideTitlesInEntries(checked);
                  if (checked) {
                    setRequireMoviesInTimeEntries(false);
                    setAllowedMovieIds([]);
                  }
                }}
              />
              Hide title dropdown in Time Entries and Estimates for this project
            </label>
            {!hideMoviesInEntries ? (
              <>
                <label className="flex items-center gap-3 pl-6">
                  <input
                    type="checkbox"
                    checked={requireMoviesInTimeEntries}
                    onChange={(event) =>
                      setRequireMoviesInTimeEntries(event.target.checked)
                    }
                  />
                  Make title dropdown mandatory in Time Entries
                </label>
                <ProjectDropdownRestrictionSelect
                  label="Title"
                  name="allowedMovieIds"
                  value={allowedMovieIds}
                  onValueChange={setAllowedMovieIds}
                  options={titleRestrictionOptions}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {selectedClient?.showAssetTypesInEntries ? (
          <div className="md:col-span-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hideAssetTypesInEntries}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setHideAssetTypesInEntries(checked);
                  if (checked) {
                    setRequireAssetTypesInTimeEntries(false);
                    setAllowedAssetTypeIds([]);
                  }
                }}
              />
              Hide asset type dropdown in Time Entries and Estimates for this project
            </label>
            {!hideAssetTypesInEntries ? (
              <>
                <label className="flex items-center gap-3 pl-6">
                  <input
                    type="checkbox"
                    checked={requireAssetTypesInTimeEntries}
                    onChange={(event) =>
                      setRequireAssetTypesInTimeEntries(event.target.checked)
                    }
                  />
                  Make asset type dropdown mandatory in Time Entries
                </label>
                <ProjectDropdownRestrictionSelect
                  label="Asset Type"
                  name="allowedAssetTypeIds"
                  value={allowedAssetTypeIds}
                  onValueChange={setAllowedAssetTypeIds}
                  options={assetTypeRestrictionOptions}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {selectedClient?.showLensTypesInEntries ? (
          <div className="md:col-span-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hideLensTypesInEntries}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setHideLensTypesInEntries(checked);
                  if (checked) {
                    setRequireLensTypesInTimeEntries(false);
                    setAllowedLensTypeIds([]);
                  }
                }}
              />
              Hide Lens Type dropdown in Time Entries and Estimates for this project
            </label>
            {!hideLensTypesInEntries ? (
              <>
                <label className="flex items-center gap-3 pl-6">
                  <input
                    type="checkbox"
                    checked={requireLensTypesInTimeEntries}
                    onChange={(event) =>
                      setRequireLensTypesInTimeEntries(event.target.checked)
                    }
                  />
                  Make Lens Type dropdown mandatory in Time Entries
                </label>
                <ProjectDropdownRestrictionSelect
                  label="Lens Type"
                  name="allowedLensTypeIds"
                  value={allowedLensTypeIds}
                  onValueChange={setAllowedLensTypeIds}
                  options={lensTypeRestrictionOptions}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {selectedClient?.showAssetNamesInEntries ? (
          <div className="md:col-span-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hideAssetNamesInEntries}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setHideAssetNamesInEntries(checked);
                  if (checked) {
                    setRequireAssetNamesInTimeEntries(false);
                    setAllowedAssetNameIds([]);
                  }
                }}
              />
              Hide asset name dropdown in Time Entries and Estimates for this project
            </label>
            {!hideAssetNamesInEntries ? (
              <>
                <label className="flex items-center gap-3 pl-6">
                  <input
                    type="checkbox"
                    checked={requireAssetNamesInTimeEntries}
                    onChange={(event) =>
                      setRequireAssetNamesInTimeEntries(event.target.checked)
                    }
                  />
                  Make asset name dropdown mandatory in Time Entries
                </label>
                <ProjectDropdownRestrictionSelect
                  label="Asset Name"
                  name="allowedAssetNameIds"
                  value={allowedAssetNameIds}
                  onValueChange={setAllowedAssetNameIds}
                  options={assetNameRestrictionOptions}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {selectedClient?.showNewslettersInEntries ? (
          <div className="md:col-span-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hideNewslettersInEntries}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setHideNewslettersInEntries(checked);
                  if (checked) {
                    setRequireNewslettersInTimeEntries(false);
                    setAllowedNewsletterIds([]);
                  }
                }}
              />
              Hide newsletter dropdown in Time Entries and Estimates for this project
            </label>
            {!hideNewslettersInEntries ? (
              <>
                <label className="flex items-center gap-3 pl-6">
                  <input
                    type="checkbox"
                    checked={requireNewslettersInTimeEntries}
                    onChange={(event) =>
                      setRequireNewslettersInTimeEntries(event.target.checked)
                    }
                  />
                  Make newsletter dropdown mandatory in Time Entries
                </label>
                <ProjectDropdownRestrictionSelect
                  label="Newsletter"
                  name="allowedNewsletterIds"
                  value={allowedNewsletterIds}
                  onValueChange={setAllowedNewsletterIds}
                  options={newsletterRestrictionOptions}
                />
              </>
            ) : null}
          </div>
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
                defaultValue="0.00"
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
                defaultValue="0.00"
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
                defaultValue="0.00"
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
                ["universalSmallCost", "Small (1 to 19)"],
                ["universalMediumCost", "Medium (20 to 34)"],
                ["universalLargeCost", "Large (35 to 69)"],
                ["universalExtraLargeCost", "Extra Large (70 above)"],
              ].map(([id, label]) => (
                <div key={id}>
                  <FormLabel htmlFor={id}>{label}</FormLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                      $
                    </span>
                    <input
                      id={id}
                      className="input currency-input"
                      name={id}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0.00"
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
                defaultValue="0.00"
              />
            </div>
          </div>
        ) : null}
        {isFilmikClient ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Resources</h3>
            <p className="mt-1 text-xs text-slate-500">
              Add count per Filmik resource type and the month from which that
              count is applicable. These entries are saved as monthly history
              for billing.
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
                        defaultValue="0"
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
                        defaultValue={currentMonth}
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
                defaultValue="0.00"
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
          />
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
