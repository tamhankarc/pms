"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  updateTimeEntryAction,
  type TimeEntryFormState,
} from "@/lib/actions/time-actions";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import Link from "next/link";

type TimeEntryProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  showCountriesInTimeEntries: boolean;
  hideCountriesInEntries: boolean;
  showMoviesInEntries: boolean;
  hideMoviesInEntries: boolean;
  showAssetTypesInEntries: boolean;
  hideAssetTypesInEntries: boolean;
  showLensTypesInEntries: boolean;
  hideLensTypesInEntries: boolean;
  showAssetNamesInEntries: boolean;
  hideAssetNamesInEntries: boolean;
  showNewslettersInEntries: boolean;
  hideNewslettersInEntries: boolean;
  requireCountriesInTimeEntries: boolean;
  requireMoviesInTimeEntries: boolean;
  requireAssetTypesInTimeEntries: boolean;
  requireLensTypesInTimeEntries: boolean;
  requireAssetNamesInTimeEntries: boolean;
  requireNewslettersInTimeEntries: boolean;
  allowedCountryIdsJson?: string | null;
  allowedMovieIdsJson?: string | null;
  allowedAssetTypeIdsJson?: string | null;
  allowedLensTypeIdsJson?: string | null;
  allowedAssetNameIdsJson?: string | null;
  allowedNewsletterIdsJson?: string | null;
  showLanguagesInEntries: boolean;
  assignedUserIds: string[];
};

type TimeEntrySubProjectOption = {
  id: string;
  name: string;
  projectId: string;
  assignedUserIds: string[];
  hideCountriesInEntries: boolean;
  hideMoviesInEntries: boolean;
  hideAssetTypesInEntries: boolean;
  hideLensTypesInEntries: boolean;
  hideAssetNamesInEntries: boolean;
  hideNewslettersInEntries: boolean;
};

type TitleOption = {
  id: string;
  title: string;
  clientId: string;
};

type AssetTypeOption = {
  id: string;
  name: string;
  clientId: string;
};

type LensTypeOption = {
  id: string;
  name: string;
};

type AssetNameOption = {
  id: string;
  name: string;
  clientId: string;
  movieId: string;
};

type NewsletterOption = {
  id: string;
  name: string;
  clientId: string;
};

type LanguageOption = {
  id: string;
  name: string;
  code: string;
};

const initialState: TimeEntryFormState = {};

function parseAllowedIds(value?: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [] as string[];
  }
}

function filterByAllowedIds<T extends { id: string }>(items: T[], allowedIds: string[]) {
  if (!allowedIds.length) return items;
  const allowed = new Set(allowedIds);
  return items.filter((item) => allowed.has(item.id));
}

function getOnlyOptionId<T extends { id: string }>(items: T[]) {
  return items.length === 1 ? items[0].id : "";
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TimeEntryEditForm({
  entry,
  countries,
  movies,
  assetTypes,
  lensTypes,
  assetNames,
  newsletters,
  languages,
  projects,
  subProjects,
  currentUserId,
  canCurrentUserBypassProjectAssignment = false,
  allowUnassignedSubProjects = false,
}: {
  entry: {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeUserType: string;
    clientId: string;
    projectId: string;
    subProjectId: string | null;
    countryId: string | null;
    movieId: string | null;
    assetTypeId: string | null;
    lensTypeId: string | null;
    assetNameId: string | null;
    newsletterId: string | null;
    languageId: string | null;
    workDate: Date;
    taskName: string;
    minutesSpent: number;
    isBillable: boolean;
    notes: string | null;
  };
  countries: { id: string; name: string }[];
  movies: TitleOption[];
  assetTypes: AssetTypeOption[];
  lensTypes: LensTypeOption[];
  assetNames: AssetNameOption[];
  newsletters: NewsletterOption[];
  languages: LanguageOption[];
  projects: TimeEntryProjectOption[];
  subProjects: TimeEntrySubProjectOption[];
  currentUserId?: string;
  canCurrentUserBypassProjectAssignment?: boolean;
  allowUnassignedSubProjects?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateTimeEntryAction,
    initialState,
  );
  const maxWorkDate = useMemo(() => getTodayDateString(), []);

  const clientOptions = useMemo(
    () =>
      Array.from(
        new Map(
          projects.map((project) => [
            project.clientId,
            { id: project.clientId, name: project.clientName },
          ]),
        ).values(),
      ),
    [projects],
  );

  const [selectedClientId, setSelectedClientId] = useState(entry.clientId);
  const [selectedProjectId, setSelectedProjectId] = useState(entry.projectId);
  const [selectedSubProjectId, setSelectedSubProjectId] = useState(
    entry.subProjectId ?? "",
  );
  const [selectedMovieId, setSelectedMovieId] = useState(entry.movieId ?? "");
  const [selectedCountryId, setSelectedCountryId] = useState(entry.countryId ?? "");
  const [selectedAssetTypeId, setSelectedAssetTypeId] = useState(entry.assetTypeId ?? "");
  const [selectedLensTypeId, setSelectedLensTypeId] = useState(entry.lensTypeId ?? "");
  const [selectedAssetNameId, setSelectedAssetNameId] = useState(entry.assetNameId ?? "");
  const [selectedNewsletterId, setSelectedNewsletterId] = useState(entry.newsletterId ?? "");

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.clientId === selectedClientId),
    [projects, selectedClientId],
  );

  const bypassAssignmentForEntryEmployee = Boolean(
    allowUnassignedSubProjects &&
    canCurrentUserBypassProjectAssignment &&
    currentUserId &&
    entry.employeeId === currentUserId,
  );

  const selectedProjectOption = projects.find(
    (project) => project.id === selectedProjectId,
  );
  const entryEmployeeHasProjectAssignment = Boolean(
    selectedProjectOption?.assignedUserIds.includes(entry.employeeId),
  );

  const filteredSubProjects = useMemo(
    () =>
      subProjects.filter((subProject) => {
        if (subProject.projectId !== selectedProjectId) return false;
        if (
          bypassAssignmentForEntryEmployee ||
          entryEmployeeHasProjectAssignment
        )
          return true;
        return subProject.assignedUserIds.includes(entry.employeeId);
      }),
    [
      subProjects,
      selectedProjectId,
      entry.employeeId,
      bypassAssignmentForEntryEmployee,
      entryEmployeeHasProjectAssignment,
    ],
  );

  const activeProjectForRestrictions = projects.find(
    (project) => project.id === selectedProjectId,
  );
  const allowedCountryIds = useMemo(
    () => parseAllowedIds(activeProjectForRestrictions?.allowedCountryIdsJson),
    [activeProjectForRestrictions?.allowedCountryIdsJson],
  );
  const allowedMovieIds = useMemo(
    () => parseAllowedIds(activeProjectForRestrictions?.allowedMovieIdsJson),
    [activeProjectForRestrictions?.allowedMovieIdsJson],
  );
  const allowedAssetTypeIds = useMemo(
    () => parseAllowedIds(activeProjectForRestrictions?.allowedAssetTypeIdsJson),
    [activeProjectForRestrictions?.allowedAssetTypeIdsJson],
  );
  const allowedLensTypeIds = useMemo(
    () => parseAllowedIds(activeProjectForRestrictions?.allowedLensTypeIdsJson),
    [activeProjectForRestrictions?.allowedLensTypeIdsJson],
  );
  const allowedAssetNameIds = useMemo(
    () => parseAllowedIds(activeProjectForRestrictions?.allowedAssetNameIdsJson),
    [activeProjectForRestrictions?.allowedAssetNameIdsJson],
  );
  const allowedNewsletterIds = useMemo(
    () => parseAllowedIds(activeProjectForRestrictions?.allowedNewsletterIdsJson),
    [activeProjectForRestrictions?.allowedNewsletterIdsJson],
  );

  const filteredCountries = useMemo(
    () => filterByAllowedIds(countries, allowedCountryIds),
    [countries, allowedCountryIds],
  );

  const filteredTitles = useMemo(
    () => filterByAllowedIds(movies.filter((movie) => movie.clientId === selectedClientId), allowedMovieIds),
    [movies, selectedClientId, allowedMovieIds],
  );

  const filteredAssetTypes = useMemo(
    () =>
      filterByAllowedIds(assetTypes.filter((assetType) => assetType.clientId === selectedClientId), allowedAssetTypeIds),
    [assetTypes, selectedClientId, allowedAssetTypeIds],
  );

  const filteredAssetNames = useMemo(
    () =>
      filterByAllowedIds(assetNames.filter(
        (assetName) =>
          assetName.clientId === selectedClientId &&
          assetName.movieId === selectedMovieId,
      ), allowedAssetNameIds),
    [assetNames, selectedClientId, selectedMovieId, allowedAssetNameIds],
  );

  const filteredNewsletters = useMemo(
    () =>
      filterByAllowedIds(newsletters.filter(
        (newsletter) => newsletter.clientId === selectedClientId,
      ), allowedNewsletterIds),
    [newsletters, selectedClientId, allowedNewsletterIds],
  );

  const filteredLensTypes = useMemo(
    () => filterByAllowedIds(lensTypes, allowedLensTypeIds),
    [lensTypes, allowedLensTypeIds],
  );

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );
  const selectedSubProject = subProjects.find(
    (subProject) => subProject.id === selectedSubProjectId,
  );
  const showCountryField = Boolean(
    selectedProject?.showCountriesInTimeEntries &&
    !selectedProject?.hideCountriesInEntries &&
    !selectedSubProject?.hideCountriesInEntries,
  );
  const showTitleField = Boolean(
    selectedProject?.showMoviesInEntries &&
    !selectedProject?.hideMoviesInEntries &&
    !selectedSubProject?.hideMoviesInEntries,
  );
  const showAssetTypeField = Boolean(
    selectedProject?.showAssetTypesInEntries &&
    !selectedProject?.hideAssetTypesInEntries &&
    !selectedSubProject?.hideAssetTypesInEntries,
  );
  const showLensTypeField = Boolean(
    selectedProject?.showLensTypesInEntries &&
    !selectedProject?.hideLensTypesInEntries &&
    !selectedSubProject?.hideLensTypesInEntries,
  );
  const showAssetNameField = Boolean(
    selectedProject?.showAssetNamesInEntries &&
    !selectedProject?.hideAssetNamesInEntries &&
    !selectedSubProject?.hideAssetNamesInEntries,
  );
  const showNewsletterField = Boolean(
    selectedProject?.showNewslettersInEntries &&
    !selectedProject?.hideNewslettersInEntries &&
    !selectedSubProject?.hideNewslettersInEntries,
  );
  const showLanguageField = Boolean(selectedProject?.showLanguagesInEntries);
  const assetNameRequired = Boolean(
    showAssetNameField && selectedProject?.requireAssetNamesInTimeEntries,
  );
  const countryRequired = Boolean(
    showCountryField && selectedProject?.requireCountriesInTimeEntries,
  );
  const titleRequired = Boolean(
    showTitleField &&
      (selectedProject?.requireMoviesInTimeEntries || assetNameRequired),
  );
  const assetTypeRequired = Boolean(
    showAssetTypeField && selectedProject?.requireAssetTypesInTimeEntries,
  );
  const lensTypeRequired = Boolean(
    showLensTypeField && selectedProject?.requireLensTypesInTimeEntries,
  );
  const newsletterRequired = Boolean(
    showNewsletterField && selectedProject?.requireNewslettersInTimeEntries,
  );
  const languageRequired = showLanguageField;
  const singleAllowedAssetName = allowedAssetNameIds.length === 1
    ? assetNames.find((assetName) => assetName.id === allowedAssetNameIds[0])
    : undefined;
  const countryLocked = showCountryField && filteredCountries.length === 1;
  const titleLocked = Boolean(
    showTitleField && (filteredTitles.length === 1 || singleAllowedAssetName?.movieId),
  );
  const assetTypeLocked = showAssetTypeField && filteredAssetTypes.length === 1;
  const lensTypeLocked = showLensTypeField && filteredLensTypes.length === 1;
  const assetNameLocked = showAssetNameField && filteredAssetNames.length === 1;
  const newsletterLocked = showNewsletterField && filteredNewsletters.length === 1;

  useEffect(() => {
    const only = getOnlyOptionId(filteredCountries);
    if (countryLocked && selectedCountryId !== only) setSelectedCountryId(only);
    if (!countryLocked && selectedCountryId && !filteredCountries.some((country) => country.id === selectedCountryId)) setSelectedCountryId("");
  }, [countryLocked, filteredCountries, selectedCountryId]);
  useEffect(() => {
    const only = singleAllowedAssetName?.movieId ?? getOnlyOptionId(filteredTitles);
    if (titleLocked && only && selectedMovieId !== only) setSelectedMovieId(only);
    if (!titleLocked && selectedMovieId && !filteredTitles.some((movie) => movie.id === selectedMovieId)) setSelectedMovieId("");
  }, [titleLocked, filteredTitles, selectedMovieId, singleAllowedAssetName?.movieId]);
  useEffect(() => {
    const only = getOnlyOptionId(filteredAssetTypes);
    if (assetTypeLocked && selectedAssetTypeId !== only) setSelectedAssetTypeId(only);
    if (!assetTypeLocked && selectedAssetTypeId && !filteredAssetTypes.some((assetType) => assetType.id === selectedAssetTypeId)) setSelectedAssetTypeId("");
  }, [assetTypeLocked, filteredAssetTypes, selectedAssetTypeId]);
  useEffect(() => {
    const only = getOnlyOptionId(filteredLensTypes);
    if (lensTypeLocked && selectedLensTypeId !== only) setSelectedLensTypeId(only);
    if (!lensTypeLocked && selectedLensTypeId && !filteredLensTypes.some((lensType) => lensType.id === selectedLensTypeId)) setSelectedLensTypeId("");
  }, [lensTypeLocked, filteredLensTypes, selectedLensTypeId]);
  useEffect(() => {
    const only = getOnlyOptionId(filteredAssetNames);
    if (assetNameLocked && selectedAssetNameId !== only) setSelectedAssetNameId(only);
    if (!assetNameLocked && selectedAssetNameId && !filteredAssetNames.some((assetName) => assetName.id === selectedAssetNameId)) setSelectedAssetNameId("");
  }, [assetNameLocked, filteredAssetNames, selectedAssetNameId]);
  useEffect(() => {
    const only = getOnlyOptionId(filteredNewsletters);
    if (newsletterLocked && selectedNewsletterId !== only) setSelectedNewsletterId(only);
    if (!newsletterLocked && selectedNewsletterId && !filteredNewsletters.some((newsletter) => newsletter.id === selectedNewsletterId)) setSelectedNewsletterId("");
  }, [newsletterLocked, filteredNewsletters, selectedNewsletterId]);

  return (
    <form action={formAction} className="card p-6">
      {state?.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Time entry updated successfully.
        </div>
      ) : null}

      <input type="hidden" name="entryId" value={entry.id} />
      <input type="hidden" name="employeeId" value={entry.employeeId} />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormLabel htmlFor="employeeName">Employee</FormLabel>
          <input
            id="employeeName"
            className="input bg-slate-50"
            value={entry.employeeName}
            readOnly
          />
        </div>

        <div>
          <FormLabel htmlFor="clientId" required>
            Client
          </FormLabel>
          <SearchableCombobox
            id="clientId"
            name="clientId"
            value={selectedClientId}
            onValueChange={(nextValue) => {
              const nextProjectId =
                projects.find((project) => project.clientId === nextValue)
                  ?.id ?? "";
              setSelectedClientId(nextValue);
              setSelectedProjectId(nextProjectId);
              setSelectedSubProjectId("");
              setSelectedMovieId("");
              setSelectedCountryId("");
              setSelectedAssetTypeId("");
              setSelectedLensTypeId("");
              setSelectedAssetNameId("");
              setSelectedNewsletterId("");
            }}
            options={clientOptions.map((client) => ({
              value: client.id,
              label: client.name,
            }))}
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
            value={selectedProjectId}
            onValueChange={(nextValue) => {
              setSelectedProjectId(nextValue);
              setSelectedSubProjectId("");
              setSelectedMovieId("");
              setSelectedCountryId("");
              setSelectedAssetTypeId("");
              setSelectedLensTypeId("");
              setSelectedAssetNameId("");
              setSelectedNewsletterId("");
            }}
            options={filteredProjects.map((project) => ({
              value: project.id,
              label: project.name,
              keywords: project.clientName,
            }))}
            placeholder="Select project"
            searchPlaceholder="Search projects..."
            emptyLabel="No projects found."
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="subProjectId">Sub Project</FormLabel>
          <SearchableCombobox
            id="subProjectId"
            name="subProjectId"
            value={selectedSubProjectId}
            onValueChange={setSelectedSubProjectId}
            options={[
              { value: "", label: "No Sub Project" },
              ...filteredSubProjects.map((subProject) => ({
                value: subProject.id,
                label: subProject.name,
              })),
            ]}
            placeholder="No Sub Project"
            searchPlaceholder="Search sub projects..."
            emptyLabel="No sub projects found."
          />
        </div>

        {showCountryField ? (
          <div>
            <FormLabel htmlFor="countryId" required={countryRequired}>
              Country
            </FormLabel>
            <SearchableCombobox
              id="countryId"
              name="countryId"
              value={selectedCountryId}
              onValueChange={setSelectedCountryId}
              options={[
                { value: "", label: "Select country" },
                ...filteredCountries.map((country) => ({
                  value: country.id,
                  label: country.name,
                })),
              ]}
              placeholder="Select country"
              searchPlaceholder="Search countries..."
              emptyLabel="No countries found."
              required={countryRequired}
              disabled={countryLocked}
            />
          </div>
        ) : null}

        {showTitleField ? (
          <div>
            <FormLabel htmlFor="movieId" required={titleRequired}>Title</FormLabel>
            <SearchableCombobox
              id="movieId"
              name="movieId"
              value={selectedMovieId}
              onValueChange={setSelectedMovieId}
              options={[
                { value: "", label: "No specific movie" },
                ...filteredTitles.map((movie) => ({
                  value: movie.id,
                  label: movie.title,
                })),
              ]}
              placeholder="No specific movie"
              searchPlaceholder="Search titles..."
              emptyLabel="No titles found."
              required={titleRequired}
              disabled={titleLocked}
            />
          </div>
        ) : null}

        {showNewsletterField ? (
          <div>
            <FormLabel htmlFor="newsletterId" required={newsletterRequired}>Newsletter</FormLabel>
            <SearchableCombobox
              id="newsletterId"
              name="newsletterId"
              value={selectedNewsletterId}
              onValueChange={setSelectedNewsletterId}
              options={[
                { value: "", label: "No specific newsletter" },
                ...filteredNewsletters.map((newsletter) => ({
                  value: newsletter.id,
                  label: newsletter.name,
                })),
              ]}
              placeholder="No specific newsletter"
              searchPlaceholder="Search newsletters..."
              emptyLabel="No newsletters found."
              required={newsletterRequired}
              disabled={newsletterLocked}
            />
          </div>
        ) : null}

        {showAssetNameField ? (
          <div>
            <FormLabel htmlFor="assetNameId" required={assetNameRequired}>Asset Name</FormLabel>
            <SearchableCombobox
              key={selectedMovieId || "no-movie"}
              id="assetNameId"
              name="assetNameId"
              value={selectedAssetNameId}
              onValueChange={setSelectedAssetNameId}
              options={[
                {
                  value: "",
                  label: selectedMovieId
                    ? "No specific asset name"
                    : "Select title first",
                },
                ...filteredAssetNames.map((assetName) => ({
                  value: assetName.id,
                  label: assetName.name,
                })),
              ]}
              placeholder={
                selectedMovieId
                  ? "No specific asset name"
                  : "Select title first"
              }
              searchPlaceholder="Search asset names..."
              emptyLabel={
                selectedMovieId
                  ? "No asset names found for selected title."
                  : "Select a title first."
              }
              disabled={!selectedMovieId || assetNameLocked}
              required={assetNameRequired}
            />
          </div>
        ) : null}

        {showAssetTypeField ? (
          <div>
            <FormLabel htmlFor="assetTypeId" required={assetTypeRequired}>Asset Type</FormLabel>
            <SearchableCombobox
              id="assetTypeId"
              name="assetTypeId"
              value={selectedAssetTypeId}
              onValueChange={setSelectedAssetTypeId}
              options={[
                { value: "", label: "No specific asset type" },
                ...filteredAssetTypes.map((assetType) => ({
                  value: assetType.id,
                  label: assetType.name,
                })),
              ]}
              placeholder="No specific asset type"
              searchPlaceholder="Search asset types..."
              emptyLabel="No asset types found."
              required={assetTypeRequired}
              disabled={assetTypeLocked}
            />
          </div>
        ) : null}

        {showLensTypeField ? (
          <div>
            <FormLabel htmlFor="lensTypeId" required={lensTypeRequired}>Lens Type</FormLabel>
            <SearchableCombobox
              id="lensTypeId"
              name="lensTypeId"
              value={selectedLensTypeId}
              onValueChange={setSelectedLensTypeId}
              options={[
                { value: "", label: "No specific lens type" },
                ...filteredLensTypes.map((lensType) => ({
                  value: lensType.id,
                  label: lensType.name,
                })),
              ]}
              placeholder="No specific lens type"
              searchPlaceholder="Search lens types..."
              emptyLabel="No lens types found."
              required={lensTypeRequired}
              disabled={lensTypeLocked}
            />
          </div>
        ) : null}

        {showLanguageField ? (
          <div>
            <FormLabel htmlFor="languageId" required={languageRequired}>
              Language
            </FormLabel>
            <SearchableCombobox
              id="languageId"
              name="languageId"
              defaultValue={entry.languageId ?? ""}
              options={[
                { value: "", label: "Select language" },
                ...languages.map((language) => ({
                  value: language.id,
                  label: `${language.name} (${language.code})`,
                })),
              ]}
              placeholder="Select language"
              searchPlaceholder="Search languages..."
              emptyLabel="No languages found."
              required={languageRequired}
            />
          </div>
        ) : null}

        <div>
          <FormLabel htmlFor="workDate" required>
            Work date
          </FormLabel>
          <input
            id="workDate"
            className="input"
            name="workDate"
            type="date"
            defaultValue={new Date(entry.workDate).toISOString().slice(0, 10)}
            max={maxWorkDate}
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="minutesSpent" required>
            Time spent (minutes)
          </FormLabel>
          <input
            id="minutesSpent"
            className="input"
            name="minutesSpent"
            type="number"
            min="1"
            step="1"
            defaultValue={entry.minutesSpent}
            required
          />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="taskName" required>
            Task name
          </FormLabel>
          <input
            id="taskName"
            className="input"
            name="taskName"
            defaultValue={entry.taskName}
            required
          />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="notes">Task Description</FormLabel>
          <textarea
            id="notes"
            className="input min-h-24"
            name="notes"
            defaultValue={entry.notes ?? ""}
          />
        </div>

        <input type="hidden" name="isBillable" value="true" />
      </div>

      <div className="mt-5 flex gap-3">
        <Link href="/time-entries" className="btn-secondary">
          Cancel
        </Link>
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
