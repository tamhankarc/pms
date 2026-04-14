"use client";

import { useActionState, useMemo, useState } from "react";
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

const initialState: TimeEntryFormState = {};

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
  languages,
  projects,
  subProjects,
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
    languageId: string | null;
    workDate: Date;
    taskName: string;
    minutesSpent: number;
    isBillable: boolean;
    notes: string | null;
  };
  countries: { id: string; name: string }[];
  movies: MovieOption[];
  languages: LanguageOption[];
  projects: TimeEntryProjectOption[];
  subProjects: TimeEntrySubProjectOption[];
  allowUnassignedSubProjects?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateTimeEntryAction, initialState);
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
  const [selectedSubProjectId, setSelectedSubProjectId] = useState(entry.subProjectId ?? "");

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.clientId === selectedClientId),
    [projects, selectedClientId],
  );

  const bypassAssignmentForEntryEmployee =
    allowUnassignedSubProjects &&
    (entry.employeeUserType === "MANAGER" || entry.employeeUserType === "TEAM_LEAD");

  const selectedProjectOption = projects.find((project) => project.id === selectedProjectId);
  const entryEmployeeHasProjectAssignment = Boolean(
    selectedProjectOption?.assignedUserIds.includes(entry.employeeId),
  );

  const filteredSubProjects = useMemo(
    () =>
      subProjects.filter((subProject) => {
        if (subProject.projectId !== selectedProjectId) return false;
        if (bypassAssignmentForEntryEmployee || entryEmployeeHasProjectAssignment) return true;
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
  const showMovieField = Boolean(
    selectedProject?.showMoviesInEntries &&
      !selectedProject?.hideMoviesInEntries &&
      !selectedSubProject?.hideMoviesInEntries,
  );
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
          Time entry updated successfully.
        </div>
      ) : null}

      <input type="hidden" name="entryId" value={entry.id} />
      <input type="hidden" name="employeeId" value={entry.employeeId} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormLabel htmlFor="employeeName">Employee</FormLabel>
          <input id="employeeName" className="input bg-slate-50" value={entry.employeeName} readOnly />
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
              defaultValue={entry.countryId ?? ""}
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
              defaultValue={entry.movieId ?? ""}
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
              defaultValue={entry.languageId ?? ""}
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
          <input id="taskName" className="input" name="taskName" defaultValue={entry.taskName} required />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="notes">Task Description</FormLabel>
          <textarea id="notes" className="input min-h-24" name="notes" defaultValue={entry.notes ?? ""} />
        </div>

        <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="hidden" name="isBillable" value="false" />
          <input type="checkbox" name="isBillable" value="true" defaultChecked={entry.isBillable} />
          Billable time
        </label>
      </div>

      <div className="flex gap-3">
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