"use client";

import { useActionState, useMemo, useState } from "react";
import {
  updateTimeEntryAction,
  type TimeEntryFormState,
} from "@/lib/actions/time-actions";
import { FormLabel } from "@/components/ui/form-label";
import Link from "next/link";

type TimeEntryProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  showCountriesInTimeEntries: boolean;
  showMoviesInEntries: boolean;
  showLanguagesInEntries: boolean;
};

type TimeEntrySubProjectOption = {
  id: string;
  name: string;
  projectId: string;
  assignedUserIds: string[];
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

export function TimeEntryEditForm({
  entry,
  countries,
  movies,
  languages,
  projects,
  subProjects,
}: {
  entry: {
    id: string;
    employeeId: string;
    employeeName: string;
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
}) {
  const [state, formAction, pending] = useActionState(updateTimeEntryAction, initialState);

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

  const filteredSubProjects = useMemo(
    () =>
      subProjects.filter(
        (subProject) =>
          subProject.projectId === selectedProjectId &&
          subProject.assignedUserIds.includes(entry.employeeId),
      ),
    [subProjects, selectedProjectId, entry.employeeId],
  );

  const filteredMovies = useMemo(
    () => movies.filter((movie) => movie.clientId === selectedClientId),
    [movies, selectedClientId],
  );

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const showCountryField = Boolean(selectedProject?.showCountriesInTimeEntries);
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
          <select
            id="clientId"
            className="input"
            name="clientId"
            value={selectedClientId}
            onChange={(e) => {
              const nextClientId = e.target.value;
              const nextProjectId = projects.find((project) => project.clientId === nextClientId)?.id ?? "";
              setSelectedClientId(nextClientId);
              setSelectedProjectId(nextProjectId);
              setSelectedSubProjectId("");
            }}
            required
          >
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FormLabel htmlFor="projectId" required>
            Project
          </FormLabel>
          <select
            id="projectId"
            className="input"
            name="projectId"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSelectedSubProjectId("");
            }}
            required
          >
            {filteredProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FormLabel htmlFor="subProjectId">Sub Project</FormLabel>
          <select
            id="subProjectId"
            className="input"
            name="subProjectId"
            value={selectedSubProjectId}
            onChange={(e) => setSelectedSubProjectId(e.target.value)}
          >
            <option value="">No Sub Project</option>
            {filteredSubProjects.map((subProject) => (
              <option key={subProject.id} value={subProject.id}>
                {subProject.name}
              </option>
            ))}
          </select>
        </div>

        {showCountryField ? (
          <div>
            <FormLabel htmlFor="countryId" required={countryRequired}>
              Country
            </FormLabel>
            <select
              id="countryId"
              className="input"
              name="countryId"
              defaultValue={entry.countryId ?? ""}
              required={countryRequired}
            >
              <option value="">Select country</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {showMovieField ? (
          <div>
            <FormLabel htmlFor="movieId">Movie</FormLabel>
            <select id="movieId" className="input" name="movieId" defaultValue={entry.movieId ?? ""}>
              <option value="">No specific movie</option>
              {filteredMovies.map((movie) => (
                <option key={movie.id} value={movie.id}>
                  {movie.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {showLanguageField ? (
          <div>
            <FormLabel htmlFor="languageId" required={languageRequired}>
              Language
            </FormLabel>
            <select
              id="languageId"
              className="input"
              name="languageId"
              defaultValue={entry.languageId ?? ""}
              required={languageRequired}
            >
              <option value="">Select language</option>
              {languages.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name} ({language.code})
                </option>
              ))}
            </select>
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
          <FormLabel htmlFor="notes">Notes</FormLabel>
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