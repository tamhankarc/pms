"use client";

import { useActionState, useMemo, useState } from "react";
import {
  updateEstimateAction,
  type EstimateFormState,
} from "@/lib/actions/estimate-actions";
import { FormLabel } from "@/components/ui/form-label";
import Link from "next/link";

type EstimateProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  showCountriesInTimeEntries: boolean;
  showMoviesInEntries: boolean;
  showLanguagesInEntries: boolean;
  assignedUserIds: string[];
};

type EstimateSubProjectOption = {
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
    selectedProjectOption?.assignedUserIds.includes(estimate.employeeId),
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
          Estimate updated successfully.
        </div>
      ) : null}

      <input type="hidden" name="estimateId" value={estimate.id} />

      <div className="grid gap-4 md:grid-cols-2">
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
              defaultValue={estimate.countryId ?? ""}
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
            <select id="movieId" className="input" name="movieId" defaultValue={estimate.movieId ?? ""}>
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
              defaultValue={estimate.languageId ?? ""}
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
            type="date"
            name="workDate"
            defaultValue={new Date(estimate.workDate).toISOString().slice(0, 10)}
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="estimatedMinutes" required>
            Estimated minutes
          </FormLabel>
          <input
            id="estimatedMinutes"
            className="input"
            type="number"
            name="estimatedMinutes"
            min="15"
            step="15"
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
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/estimates" className="btn-secondary">
          Cancel
        </Link>
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Resubmit estimate"}
        </button>
      </div>
    </form>
  );
}