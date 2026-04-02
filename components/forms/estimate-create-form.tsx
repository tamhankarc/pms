"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createEstimateAction,
  type EstimateFormState,
} from "@/lib/actions/estimate-actions";
import { FormLabel } from "@/components/ui/form-label";

type EstimateProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  showCountriesInTimeEntries: boolean;
  showMoviesInEntries: boolean;
  showLanguagesInEntries: boolean;
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

export function EstimateCreateForm({
  projects,
  subProjects,
  countries,
  movies,
  languages,
  currentUserId,
}: {
  projects: EstimateProjectOption[];
  subProjects: EstimateSubProjectOption[];
  countries: { id: string; name: string }[];
  movies: MovieOption[];
  languages: LanguageOption[];
  currentUserId: string;
}) {
  const [state, formAction, pending] = useActionState(createEstimateAction, initialState);

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
  const [selectedSubProjectId, setSelectedSubProjectId] = useState("");

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.clientId === selectedClientId),
    [projects, selectedClientId],
  );

  const filteredSubProjects = useMemo(
    () =>
      subProjects.filter(
        (subProject) =>
          subProject.projectId === selectedProjectId &&
          subProject.assignedUserIds.includes(currentUserId),
      ),
    [subProjects, selectedProjectId, currentUserId],
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
            required
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSelectedSubProjectId("");
            }}
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
            <select id="countryId" className="input" name="countryId" defaultValue="" required={countryRequired}>
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
            <select id="movieId" className="input" name="movieId" defaultValue="">
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
            <select id="languageId" className="input" name="languageId" defaultValue="" required={languageRequired}>
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
          <input id="workDate" className="input" type="date" name="workDate" required />
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
            required
          />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="notes">Notes</FormLabel>
          <textarea id="notes" className="input min-h-28" name="notes" />
        </div>

        <div className="md:col-span-2">
          <button className="btn-primary w-full md:w-auto" disabled={pending}>
            {pending ? "Submitting..." : "Submit estimate"}
          </button>
        </div>
      </div>
    </form>
  );
}