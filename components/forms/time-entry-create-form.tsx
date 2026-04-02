"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createTimeEntryAction,
  type TimeEntryFormState,
} from "@/lib/actions/time-actions";
import { FormLabel } from "@/components/ui/form-label";

type TimeEntryProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  showCountriesInTimeEntries: boolean;
  showMoviesInEntries: boolean;
  showLanguagesInEntries: boolean;
  assignedUserIds: string[];
};

type TimeEntrySubProjectOption = {
  id: string;
  name: string;
  projectId: string;
  assignedUserIds: string[];
};

type TimeEntryEmployeeOption = {
  id: string;
  fullName: string;
  userType: string;
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

export function TimeEntryCreateForm({
  projects,
  subProjects,
  countries,
  movies,
  languages,
  assignableEmployees = [],
  defaultEmployeeId,
  allowUnassignedSubProjects = false,
}: {
  projects: TimeEntryProjectOption[];
  subProjects: TimeEntrySubProjectOption[];
  countries: { id: string; name: string }[];
  movies: MovieOption[];
  languages: LanguageOption[];
  assignableEmployees?: TimeEntryEmployeeOption[];
  defaultEmployeeId?: string;
  allowUnassignedSubProjects?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createTimeEntryAction, initialState);

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
    defaultEmployeeId ?? assignableEmployees[0]?.id ?? "",
  );
  const [selectedSubProjectId, setSelectedSubProjectId] = useState("");

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.clientId === selectedClientId),
    [projects, selectedClientId],
  );

  const selectedEmployee = assignableEmployees.find((employee) => employee.id === selectedEmployeeId);
  const bypassAssignmentForSelectedEmployee =
    allowUnassignedSubProjects &&
    (selectedEmployee?.userType === "MANAGER" || selectedEmployee?.userType === "TEAM_LEAD");

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

  const filteredMovies = useMemo(
    () => movies.filter((movie) => movie.clientId === selectedClientId),
    [movies, selectedClientId],
  );

  const showEmployeeField = assignableEmployees.length > 1;
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const showCountryField = Boolean(selectedProject?.showCountriesInTimeEntries);
  const showMovieField = Boolean(selectedProject?.showMoviesInEntries);
  const showLanguageField = Boolean(selectedProject?.showLanguagesInEntries);
  const countryRequired = showCountryField;
  const languageRequired = showLanguageField;

  return (
    <form action={formAction} className="card p-6">
      <h2 className="section-title">Submit time entry</h2>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Time entry submitted successfully.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {showEmployeeField ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="employeeId">Employee</FormLabel>
            <select
              id="employeeId"
              className="input"
              name="employeeId"
              value={selectedEmployeeId}
              onChange={(e) => {
                setSelectedEmployeeId(e.target.value);
                setSelectedSubProjectId("");
              }}
            >
              {assignableEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName} · {employee.userType.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="employeeId" value={selectedEmployeeId} />
        )}

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
          <input id="workDate" className="input" name="workDate" type="date" required />
        </div>

        <div>
          <FormLabel htmlFor="minutesSpent" required>
            Time spent (minutes)
          </FormLabel>
          <input id="minutesSpent" className="input" name="minutesSpent" type="number" min="1" step="1" required />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="taskName" required>
            Task name
          </FormLabel>
          <input id="taskName" className="input" name="taskName" required />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="notes">Notes</FormLabel>
          <textarea id="notes" className="input min-h-24" name="notes" />
        </div>

        <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="hidden" name="isBillable" value="false" />
          <input type="checkbox" name="isBillable" value="true" defaultChecked />
          Billable time
        </label>

        <div className="md:col-span-2">
          <button className="btn-primary w-full md:w-auto" disabled={pending}>
            {pending ? "Submitting..." : "Submit time entry"}
          </button>
        </div>
      </div>
    </form>
  );
}