"use client";

import { useActionState, useMemo, useState } from "react";
import {
  updateEstimateAction,
  type EstimateFormState,
} from "@/lib/actions/estimate-actions";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import Link from "next/link";

type EstimateProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  showCountriesInTimeEntries: boolean;
  hideCountriesInEntries: boolean;
  showMoviesInEntries: boolean;
  showLanguagesInEntries: boolean;
  assignedUserIds: string[];
};

type EstimateSubProjectOption = {
  id: string;
  name: string;
  projectId: string;
  assignedUserIds: string[];
  hideCountriesInEntries: boolean;
};


type MovieOption = {
  id: string;
  title: string;
  clientId: string;
};

type LanguageOption = {
  id: string;
  name: string;
  code: string;
};

const initialState: EstimateFormState = {};

export function EstimateEditForm({
  estimate,
  projects,
  subProjects,
  countries,
  movies,
  languages,
  allowUnassignedSubProjects = false,
}: {
  estimate: {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeUserType: string;
    clientId: string;
    projectId: string;
    subProjectId: string | null;
    countryId: string | null;
    movieId: string | null;
    languageId: string | null;
    workDate: Date;
    estimatedMinutes: number;
    notes: string | null;
  };
  projects: EstimateProjectOption[];
  subProjects: EstimateSubProjectOption[];
  countries: { id: string; name: string }[];
  movies: MovieOption[];
  languages: LanguageOption[];
  allowUnassignedSubProjects?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateEstimateAction, initialState);

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

  const [selectedClientId, setSelectedClientId] = useState(estimate.clientId);
  const [selectedProjectId, setSelectedProjectId] = useState(estimate.projectId);
  const [selectedSubProjectId, setSelectedSubProjectId] = useState(estimate.subProjectId ?? "");

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.clientId === selectedClientId),
    [projects, selectedClientId],
  );

  const bypassAssignmentForEstimateEmployee =
    allowUnassignedSubProjects &&
    (estimate.employeeUserType === "MANAGER" || estimate.employeeUserType === "TEAM_LEAD");

  const selectedProjectOption = projects.find((project) => project.id === selectedProjectId);
  const estimateEmployeeHasProjectAssignment = Boolean(
    estimate.employeeId && selectedProjectOption?.assignedUserIds.includes(estimate.employeeId),
  );

  const filteredSubProjects = useMemo(
    () =>
      subProjects.filter((subProject) => {
        if (subProject.projectId !== selectedProjectId) return false;
        if (bypassAssignmentForEstimateEmployee || estimateEmployeeHasProjectAssignment) return true;
        return subProject.assignedUserIds.includes(estimate.employeeId);
      }),
    [
      subProjects,
      selectedProjectId,
      estimate.employeeId,
      bypassAssignmentForEstimateEmployee,
      estimateEmployeeHasProjectAssignment,
    ],
  );

  const filteredMovies = useMemo(
    () => movies.filter((movie) => movie.clientId === selectedClientId),
    [movies, selectedClientId],
  );

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedSubProject = subProjects.find((subProject) => subProject.id === selectedSubProjectId);
  const showCountryField = Boolean(
    selectedProject?.showCountriesInTimeEntries &&
      !selectedProject?.hideCountriesInEntries &&
      !selectedSubProject?.hideCountriesInEntries,
  );
  const showMovieField = Boolean(selectedProject?.showMoviesInEntries);
  const showLanguageField = Boolean(selectedProject?.showLanguagesInEntries);
  const countryRequired = showCountryField;
  const languageRequired = showLanguageField;

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Estimate updated successfully.
        </div>
      ) : null}

      <input type="hidden" name="estimateId" value={estimate.id} />

      <div className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="employeeId" value={estimate.employeeId} />
        <div className="md:col-span-2">
          <FormLabel htmlFor="employeeName">Employee</FormLabel>
          <input id="employeeName" className="input bg-slate-50" value={estimate.employeeName} readOnly />
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
              defaultValue={estimate.countryId ?? ""}
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
              defaultValue={estimate.movieId ?? ""}
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

        {showLanguageField ? (
          <div>
            <FormLabel htmlFor="languageId" required={languageRequired}>
              Language
            </FormLabel>
            <SearchableCombobox
              id="languageId"
              name="languageId"
              defaultValue={estimate.languageId ?? ""}
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
          <input
            id="workDate"
            className="input"
            type="date"
            name="workDate"
            defaultValue={estimate.workDate.toISOString().slice(0, 10)}
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="estimatedMinutes" required>
            Minutes
          </FormLabel>
          <input
            id="estimatedMinutes"
            className="input"
            type="number"
            min={1}
            step={1}
            name="estimatedMinutes"
            defaultValue={estimate.estimatedMinutes}
            required
          />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="notes">Notes</FormLabel>
          <textarea
            id="notes"
            className="input min-h-28"
            name="notes"
            defaultValue={estimate.notes ?? ""}
            placeholder="Optional estimate context"
          />
        </div>
      </div>

      <div className="flex justify-between gap-3 pt-2">
        <Link href="/estimates" className="btn-secondary">
          Cancel
        </Link>
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save & Resubmit"}
        </button>
      </div>
    </form>
  );
}
