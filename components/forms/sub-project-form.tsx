"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { SubProjectFormState } from "@/lib/actions/sub-project-actions";

type ProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  clientShowsCountriesInEntries: boolean;
  clientShowsMoviesInEntries: boolean;
  clientShowsAssetTypesInEntries: boolean;
  clientShowsLensTypesInEntries: boolean;
  clientShowsAssetNamesInEntries: boolean;
  clientShowsNewslettersInEntries: boolean;
  hideCountriesInEntries: boolean;
  hideMoviesInEntries: boolean;
  hideAssetTypesInEntries: boolean;
  hideLensTypesInEntries: boolean;
  hideAssetNamesInEntries: boolean;
  hideNewslettersInEntries: boolean;
};

const initialState: SubProjectFormState = {};

export function SubProjectForm({
  mode,
  projects,
  action,
  initialValues,
}: {
  mode: "create" | "edit";
  projects: ProjectOption[];
  action: (
    state: SubProjectFormState,
    formData: FormData,
  ) => Promise<SubProjectFormState>;
  initialValues?: {
    id?: string;
    clientId?: string;
    projectId?: string;
    name?: string;
    description?: string | null;
    isActive?: boolean;
    hideCountriesInEntries?: boolean;
    hideMoviesInEntries?: boolean;
    hideAssetTypesInEntries?: boolean;
    hideLensTypesInEntries?: boolean;
    hideAssetNamesInEntries?: boolean;
    hideNewslettersInEntries?: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const defaultClientId =
    initialValues?.clientId ??
    (initialValues?.projectId
      ? projects.find((project) => project.id === initialValues.projectId)
          ?.clientId
      : "") ??
    "";

  const [clientId, setClientId] = useState(defaultClientId);
  const [projectId, setProjectId] = useState(initialValues?.projectId ?? "");
  const [hideCountriesInEntries, setHideCountriesInEntries] = useState(
    initialValues?.hideCountriesInEntries ?? false,
  );
  const [hideMoviesInEntries, setHideMoviesInEntries] = useState(
    initialValues?.hideMoviesInEntries ?? false,
  );
  const [hideAssetTypesInEntries, setHideAssetTypesInEntries] = useState(
    initialValues?.hideAssetTypesInEntries ?? false,
  );
  const [hideLensTypesInEntries, setHideLensTypesInEntries] = useState(
    initialValues?.hideLensTypesInEntries ?? false,
  );
  const [hideAssetNamesInEntries, setHideAssetNamesInEntries] = useState(
    initialValues?.hideAssetNamesInEntries ?? false,
  );
  const [hideNewslettersInEntries, setHideNewslettersInEntries] = useState(
    initialValues?.hideNewslettersInEntries ?? false,
  );

  const filteredProjects = useMemo(() => {
    if (!clientId) return projects;
    return projects.filter((project) => project.clientId === clientId);
  }, [projects, clientId]);

  useEffect(() => {
    if (!filteredProjects.some((project) => project.id === projectId)) {
      setProjectId("");
    }
  }, [filteredProjects, projectId]);

  const uniqueClients = Array.from(
    new Map(
      projects.map((project) => [
        project.clientId,
        { id: project.clientId, name: project.clientName },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const selectedProject = projects.find((project) => project.id === projectId);
  const canOverrideCountries = Boolean(
    selectedProject?.clientShowsCountriesInEntries,
  );
  const canOverrideMovies = Boolean(
    selectedProject?.clientShowsMoviesInEntries,
  );
  const canOverrideAssetTypes = Boolean(
    selectedProject?.clientShowsAssetTypesInEntries,
  );
  const canOverrideLensTypes = Boolean(
    selectedProject?.clientShowsLensTypesInEntries,
  );
  const canOverrideAssetNames = Boolean(
    selectedProject?.clientShowsAssetNamesInEntries,
  );
  const canOverrideNewsletters = Boolean(
    selectedProject?.clientShowsNewslettersInEntries,
  );
  const projectAlreadyHidesCountries = Boolean(
    selectedProject?.hideCountriesInEntries,
  );
  const projectAlreadyHidesMovies = Boolean(
    selectedProject?.hideMoviesInEntries,
  );
  const projectAlreadyHidesAssetTypes = Boolean(
    selectedProject?.hideAssetTypesInEntries,
  );
  const projectAlreadyHidesLensTypes = Boolean(
    selectedProject?.hideLensTypesInEntries,
  );
  const projectAlreadyHidesAssetNames = Boolean(
    selectedProject?.hideAssetNamesInEntries,
  );
  const projectAlreadyHidesNewsletters = Boolean(
    selectedProject?.hideNewslettersInEntries,
  );

  useEffect(() => {
    if (!canOverrideCountries || projectAlreadyHidesCountries) {
      setHideCountriesInEntries(false);
    }
  }, [canOverrideCountries, projectAlreadyHidesCountries]);

  useEffect(() => {
    if (!canOverrideMovies || projectAlreadyHidesMovies) {
      setHideMoviesInEntries(false);
    }
  }, [canOverrideMovies, projectAlreadyHidesMovies]);

  useEffect(() => {
    if (!canOverrideAssetTypes || projectAlreadyHidesAssetTypes) {
      setHideAssetTypesInEntries(false);
    }
  }, [canOverrideAssetTypes, projectAlreadyHidesAssetTypes]);

  useEffect(() => {
    if (!canOverrideLensTypes || projectAlreadyHidesLensTypes) {
      setHideLensTypesInEntries(false);
    }
  }, [canOverrideLensTypes, projectAlreadyHidesLensTypes]);

  useEffect(() => {
    if (!canOverrideAssetNames || projectAlreadyHidesAssetNames) {
      setHideAssetNamesInEntries(false);
    }
  }, [canOverrideAssetNames, projectAlreadyHidesAssetNames]);

  useEffect(() => {
    if (!canOverrideNewsletters || projectAlreadyHidesNewsletters) {
      setHideNewslettersInEntries(false);
    }
  }, [canOverrideNewsletters, projectAlreadyHidesNewsletters]);

  return (
    <form action={formAction} className="card p-6">
      {mode === "edit" && initialValues?.id ? (
        <input type="hidden" name="id" value={initialValues.id} />
      ) : null}
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

      <h2 className="section-title">
        {mode === "create" ? "Create Sub Project" : "Edit Sub Project"}
      </h2>
      <p className="section-subtitle">
        Select client first, then choose the project. User assignment is handled
        separately.
      </p>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Sub Project saved successfully.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="clientId" required>
            Client
          </FormLabel>
          <SearchableCombobox
            id="clientId"
            name="clientId"
            value={clientId}
            onValueChange={(value) => {
              setClientId(value);
              setProjectId("");
              setHideCountriesInEntries(false);
              setHideMoviesInEntries(false);
              setHideAssetTypesInEntries(false);
              setHideAssetNamesInEntries(false);
              setHideNewslettersInEntries(false);
            }}
            options={[
              { value: "", label: "Select client" },
              ...uniqueClients.map((client) => ({
                value: client.id,
                label: client.name,
              })),
            ]}
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
            value={projectId}
            onValueChange={(value) => {
              setProjectId(value);
              setHideCountriesInEntries(false);
              setHideMoviesInEntries(false);
              setHideAssetTypesInEntries(false);
              setHideAssetNamesInEntries(false);
              setHideNewslettersInEntries(false);

              if (!value) {
                return;
              }

              const nextProject = projects.find(
                (project) => project.id === value,
              );
              if (nextProject && nextProject.clientId !== clientId) {
                setClientId(nextProject.clientId);
              }
            }}
            options={filteredProjects.map((project) => ({
              value: project.id,
              label: `${project.name} · ${project.clientName}`,
              keywords: `${project.name} ${project.clientName}`,
            }))}
            placeholder="Select project"
            searchPlaceholder="Search projects..."
            emptyLabel="No projects found."
            required
          />
        </div>

        {canOverrideCountries ? (
          <>
            <label
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${projectAlreadyHidesCountries ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              <input
                type="checkbox"
                checked={hideCountriesInEntries}
                onChange={(event) =>
                  setHideCountriesInEntries(event.target.checked)
                }
                disabled={projectAlreadyHidesCountries}
              />
              Hide country dropdown in Time Entries and Estimates for this sub
              project
            </label>
            {projectAlreadyHidesCountries ? (
              <p className="text-sm text-amber-700">
                Countries are already hidden for this project, so the
                sub-project override is not needed.
              </p>
            ) : null}
          </>
        ) : null}

        {canOverrideMovies ? (
          <>
            <label
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${projectAlreadyHidesMovies ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              <input
                type="checkbox"
                checked={hideMoviesInEntries}
                onChange={(event) =>
                  setHideMoviesInEntries(event.target.checked)
                }
                disabled={projectAlreadyHidesMovies}
              />
              Hide movie dropdown in Time Entries and Estimates for this sub
              project
            </label>
            {projectAlreadyHidesMovies ? (
              <p className="text-sm text-amber-700">
                Movies are already hidden for this project, so the sub-project
                override is not needed.
              </p>
            ) : null}
          </>
        ) : null}

        {canOverrideAssetTypes ? (
          <>
            <label
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${projectAlreadyHidesAssetTypes ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              <input
                type="checkbox"
                checked={hideAssetTypesInEntries}
                onChange={(event) =>
                  setHideAssetTypesInEntries(event.target.checked)
                }
                disabled={projectAlreadyHidesAssetTypes}
              />
              Hide asset type dropdown in Time Entries and Estimates for this
              sub project
            </label>
            {projectAlreadyHidesAssetTypes ? (
              <p className="text-sm text-amber-700">
                Asset Types are already hidden for this project, so the
                sub-project override is not needed.
              </p>
            ) : null}
          </>
        ) : null}

        {canOverrideLensTypes ? (
          <>
            <label
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${projectAlreadyHidesLensTypes ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              <input
                type="checkbox"
                checked={hideLensTypesInEntries}
                onChange={(event) =>
                  setHideLensTypesInEntries(event.target.checked)
                }
                disabled={projectAlreadyHidesLensTypes}
              />
              Hide Lens Type dropdown in Time Entries and Estimates for this sub
              project
            </label>
            {projectAlreadyHidesLensTypes ? (
              <p className="text-sm text-amber-700">
                Lens Types are already hidden for this project, so the
                sub-project override is not needed.
              </p>
            ) : null}
          </>
        ) : null}

        {canOverrideAssetNames ? (
          <>
            <label
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${projectAlreadyHidesAssetNames ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              <input
                type="checkbox"
                checked={hideAssetNamesInEntries}
                onChange={(event) =>
                  setHideAssetNamesInEntries(event.target.checked)
                }
                disabled={projectAlreadyHidesAssetNames}
              />
              Hide asset name dropdown in Time Entries and Estimates for this
              sub project
            </label>
            {projectAlreadyHidesAssetNames ? (
              <p className="text-sm text-amber-700">
                Asset Names are already hidden for this project, so the
                sub-project override is not needed.
              </p>
            ) : null}
          </>
        ) : null}

        {canOverrideNewsletters ? (
          <>
            <label
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${projectAlreadyHidesNewsletters ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              <input
                type="checkbox"
                checked={hideNewslettersInEntries}
                onChange={(event) =>
                  setHideNewslettersInEntries(event.target.checked)
                }
                disabled={projectAlreadyHidesNewsletters}
              />
              Hide newsletter dropdown in Time Entries and Estimates for this
              sub project
            </label>
            {projectAlreadyHidesNewsletters ? (
              <p className="text-sm text-amber-700">
                Newsletters are already hidden for this project, so the
                sub-project override is not needed.
              </p>
            ) : null}
          </>
        ) : null}
        <div>
          <FormLabel htmlFor="name" required>
            Sub Project name
          </FormLabel>
          <input
            id="name"
            className="input"
            name="name"
            defaultValue={initialValues?.name ?? ""}
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="description">Description</FormLabel>
          <textarea
            id="description"
            className="input min-h-24"
            name="description"
            defaultValue={initialValues?.description ?? ""}
          />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initialValues?.isActive ?? true}
          />
          Active Sub Project
        </label>

        <button className="btn-primary w-full" disabled={pending}>
          {pending
            ? "Saving..."
            : mode === "create"
              ? "Create Sub Project"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
