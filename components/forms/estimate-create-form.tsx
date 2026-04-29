"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createEstimateAction,
  type EstimateFormState,
} from "@/lib/actions/estimate-actions";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type EstimateProjectOption = {
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
  showLanguagesInEntries: boolean;
  assignedUserIds: string[];
};

type EstimateSubProjectOption = {
  id: string;
  name: string;
  projectId: string;
  assignedUserIds: string[];
  hideCountriesInEntries: boolean;
  hideMoviesInEntries: boolean;
  hideAssetTypesInEntries: boolean;
};

type EstimateEmployeeOption = {
  id: string;
  fullName: string;
  userType: string;
};

type MovieOption = {
  id: string;
  title: string;
  clientId: string;
};

type AssetTypeOption = {
  id: string;
  name: string;
  clientId: string;
};

type LanguageOption = {
  id: string;
  name: string;
  code: string;
};

const initialState: EstimateFormState = {};

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EstimateCreateForm({
  projects,
  subProjects,
  countries,
  movies,
  assetTypes,
  languages,
  currentUserId,
  currentUserType,
  assignableEmployees = [],
  defaultEmployeeId,
  allowUnassignedSubProjects = false,
}: {
  projects: EstimateProjectOption[];
  subProjects: EstimateSubProjectOption[];
  countries: { id: string; name: string }[];
  movies: MovieOption[];
  assetTypes: AssetTypeOption[];
  languages: LanguageOption[];
  currentUserId: string;
  currentUserType: string;
  assignableEmployees?: EstimateEmployeeOption[];
  defaultEmployeeId?: string;
  allowUnassignedSubProjects?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createEstimateAction, initialState);
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

  const defaultClientId = clientOptions[0]?.id ?? "";
  const [selectedClientId, setSelectedClientId] = useState(defaultClientId);
  const [selectedProjectId, setSelectedProjectId] = useState(
    projects.find((project) => project.clientId === defaultClientId)?.id ?? "",
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    defaultEmployeeId ?? assignableEmployees[0]?.id ?? currentUserId,
  );
  const [selectedSubProjectId, setSelectedSubProjectId] = useState("");

  const selectedEmployee =
    assignableEmployees.find((employee) => employee.id === selectedEmployeeId) ??
    ({ id: currentUserId, fullName: "", userType: currentUserType } as EstimateEmployeeOption);

  const bypassAssignmentForSelectedEmployee =
    allowUnassignedSubProjects &&
    (selectedEmployee?.userType === "MANAGER" || selectedEmployee?.userType === "TEAM_LEAD");

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        if (project.clientId !== selectedClientId) return false;
        if (bypassAssignmentForSelectedEmployee) return true;

        const hasProjectAssignment = project.assignedUserIds.includes(selectedEmployeeId);
        const hasSubProjectAssignment = subProjects.some(
          (subProject) =>
            subProject.projectId === project.id && subProject.assignedUserIds.includes(selectedEmployeeId),
        );

        return !selectedEmployeeId || hasProjectAssignment || hasSubProjectAssignment;
      }),
    [projects, selectedClientId, selectedEmployeeId, bypassAssignmentForSelectedEmployee, subProjects],
  );

  const selectedProjectOption = projects.find((project) => project.id === selectedProjectId);
  const selectedEmployeeHasProjectAssignment = Boolean(
    selectedEmployeeId && selectedProjectOption?.assignedUserIds.includes(selectedEmployeeId),
  );

  const filteredSubProjects = useMemo(
    () =>
      subProjects.filter((subProject) => {
        if (subProject.projectId !== selectedProjectId) return false;
        if (bypassAssignmentForSelectedEmployee || selectedEmployeeHasProjectAssignment) return true;
        return !selectedEmployeeId || subProject.assignedUserIds.includes(selectedEmployeeId);
      }),
    [
      subProjects,
      selectedProjectId,
      selectedEmployeeId,
      bypassAssignmentForSelectedEmployee,
      selectedEmployeeHasProjectAssignment,
    ],
  );

  useEffect(() => {
    if (selectedProjectId && filteredProjects.some((project) => project.id === selectedProjectId)) {
      return;
    }

    const nextProjectId = filteredProjects[0]?.id ?? "";
    if (nextProjectId !== selectedProjectId) {
      setSelectedProjectId(nextProjectId);
      setSelectedSubProjectId("");
    }
  }, [filteredProjects, selectedProjectId]);

  const filteredMovies = useMemo(
    () => movies.filter((movie) => movie.clientId === selectedClientId),
    [movies, selectedClientId],
  );

  const filteredAssetTypes = useMemo(
    () => assetTypes.filter((assetType) => assetType.clientId === selectedClientId),
    [assetTypes, selectedClientId],
  );

  const showEmployeeField = assignableEmployees.length > 1;
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedSubProject = subProjects.find((subProject) => subProject.id === selectedSubProjectId);
  const showCountryField = Boolean(
    selectedProject?.showCountriesInTimeEntries &&
      !selectedProject?.hideCountriesInEntries &&
      !selectedSubProject?.hideCountriesInEntries,
  );
  const showMovieField = Boolean(
    selectedProject?.showMoviesInEntries &&
      !selectedProject?.hideMoviesInEntries &&
      !selectedSubProject?.hideMoviesInEntries,
  );
  const showAssetTypeField = Boolean(
    selectedProject?.showAssetTypesInEntries &&
      !selectedProject?.hideAssetTypesInEntries &&
      !selectedSubProject?.hideAssetTypesInEntries,
  );
  const showLanguageField = Boolean(selectedProject?.showLanguagesInEntries);
  const countryRequired = showCountryField;
  const languageRequired = showLanguageField;

  return (
    <form action={formAction} className="card p-6">
      <h2 className="section-title">Submit estimate</h2>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Estimate submitted successfully.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {showEmployeeField ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="employeeId">Employee</FormLabel>
            <SearchableCombobox
              id="employeeId"
              name="employeeId"
              value={selectedEmployeeId}
              onValueChange={(nextValue) => {
                setSelectedEmployeeId(nextValue);
                setSelectedSubProjectId("");
              }}
              options={assignableEmployees.map((employee) => ({
                value: employee.id,
                label: `${employee.fullName} · ${employee.userType.replaceAll("_", " ")}`,
              }))}
              placeholder="Select employee"
              searchPlaceholder="Search employees..."
              emptyLabel="No employees found."
            />
          </div>
        ) : (
          <input type="hidden" name="employeeId" value={selectedEmployeeId} />
        )}

        <div>
          <FormLabel htmlFor="clientId" required>
            Client
          </FormLabel>
          <SearchableCombobox
            id="clientId"
            name="clientId"
            value={selectedClientId}
            onValueChange={(nextValue) => {
              const nextProjectId = projects.find((project) => project.clientId === nextValue)?.id ?? "";
              setSelectedClientId(nextValue);
              setSelectedProjectId(nextProjectId);
              setSelectedSubProjectId("");
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
              defaultValue=""
              options={[
                { value: "", label: "Select country" },
                ...countries.map((country) => ({ value: country.id, label: country.name })),
              ]}
              placeholder="Select country"
              searchPlaceholder="Search countries..."
              emptyLabel="No countries found."
              required={countryRequired}
            />
          </div>
        ) : null}

        {showMovieField ? (
          <div>
            <FormLabel htmlFor="movieId">Movie</FormLabel>
            <SearchableCombobox
              id="movieId"
              name="movieId"
              defaultValue=""
              options={[
                { value: "", label: "No specific movie" },
                ...filteredMovies.map((movie) => ({ value: movie.id, label: movie.title })),
              ]}
              placeholder="No specific movie"
              searchPlaceholder="Search movies..."
              emptyLabel="No movies found."
            />
          </div>
        ) : null}

        {showAssetTypeField ? (
          <div>
            <FormLabel htmlFor="assetTypeId">Asset Type</FormLabel>
            <SearchableCombobox
              id="assetTypeId"
              name="assetTypeId"
              defaultValue={""}
              options={[
                { value: "", label: "No specific asset type" },
                ...filteredAssetTypes.map((assetType) => ({ value: assetType.id, label: assetType.name })),
              ]}
              placeholder="No specific asset type"
              searchPlaceholder="Search asset types..."
              emptyLabel="No asset types found."
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
              defaultValue=""
              options={[
                { value: "", label: "Select language" },
                ...languages.map((language) => ({ value: language.id, label: `${language.name} (${language.code})` })),
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
          <input id="workDate" className="input" type="date" name="workDate" defaultValue={maxWorkDate} max={maxWorkDate} required />
        </div>

        <div>
          <FormLabel htmlFor="estimatedMinutes" required>
            Minutes
          </FormLabel>
          <input id="estimatedMinutes" className="input" type="number" min={1} step={1} name="estimatedMinutes" required />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="notes">Notes</FormLabel>
          <textarea id="notes" className="input min-h-28" name="notes" placeholder="Optional estimate context" />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Submitting..." : "Submit Estimate"}
        </button>
      </div>
    </form>
  );
}
