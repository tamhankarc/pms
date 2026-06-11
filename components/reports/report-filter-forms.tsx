"use client";


import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { useMemo, useState } from "react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type ClientOption = {
  id: string;
  name: string;
};

type ProjectOption = {
  id: string;
  name: string;
  clientId: string;
  hideCountriesInEntries?: boolean;
  hideMoviesInEntries?: boolean;
};

type SubProjectOption = {
  id: string;
  name: string;
  projectId: string;
  hideCountriesInEntries?: boolean;
  hideMoviesInEntries?: boolean;
};

type CountryOption = {
  id: string;
  name: string;
  isoCode: string;
};

type TitleOption = {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
};

type PreservedParams = Record<string, string | undefined>;

function renderHiddenParams(params: PreservedParams) {
  return Object.entries(params).map(([key, value]) =>
    value ? <input key={key} type="hidden" name={key} value={value} /> : null,
  );
}

function buildResetHref(action: string, anchor: string, params: PreservedParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${action}?${query}${anchor}` : `${action}${anchor}`;
}

const LOCKED_FILTER_BUTTON_CLASS = "border-dashed border-slate-300 bg-slate-50 text-slate-400";

function LockedDependentFiltersNotice({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;

  return (
    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
      Select a specific client to enable the other filters.
    </div>
  );
}


export function ProjectHoursFilterForm({
  action,
  anchor,
  fromDate,
  toDate,
  clientId,
  projectId,
  clientOptions,
  projectOptions,
  preservedParams = {},
}: {
  action: string;
  anchor: string;
  fromDate: string;
  toDate: string;
  clientId: string;
  projectId: string;
  clientOptions: ClientOption[];
  projectOptions: ProjectOption[];
  preservedParams?: PreservedParams;
}) {
  const [selectedClientId, setSelectedClientId] = useState(clientId);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const dependentFiltersEnabled = selectedClientId !== "all";

  const filteredProjects = useMemo(
    () => projectOptions.filter((project) => (dependentFiltersEnabled ? project.clientId === selectedClientId : false)),
    [projectOptions, selectedClientId, dependentFiltersEnabled],
  );

  const isProjectAvailable = selectedProjectId === "all" || filteredProjects.some((project) => project.id === selectedProjectId);
  const effectiveProjectId = dependentFiltersEnabled && isProjectAvailable ? selectedProjectId : "all";

  return (
    <AutoSubmitFilterForm className="relative z-20 flex flex-wrap items-end gap-3" method="get" action={`${action}${anchor}`}>
      {renderHiddenParams(preservedParams)}
      <div className="w-full sm:w-[180px]">
        <input className="input w-full" type="date" name="projectFromDate" defaultValue={fromDate} />
      </div>
      <div className="w-full sm:w-[180px]">
        <input className="input w-full" type="date" name="projectToDate" defaultValue={toDate} />
      </div>
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id="projectClientId"
          name="projectClientId"
          value={selectedClientId}
          onValueChange={(value) => {
            setSelectedClientId(value);
            const currentProject = projectOptions.find((project) => project.id === selectedProjectId);
            if (value === "all" || (currentProject && currentProject.clientId !== value)) {
              setSelectedProjectId("all");
            }
          }}
          options={[
            { value: "all", label: "All clients" },
            ...clientOptions.map((client) => ({ value: client.id, label: client.name })),
          ]}
          placeholder="All clients"
          searchPlaceholder="Search clients..."
          emptyLabel="No clients found."
        />
      </div>
      <LockedDependentFiltersNotice isVisible={!dependentFiltersEnabled} />
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id="projectProjectId"
          name="projectProjectId"
          value={effectiveProjectId}
          onValueChange={setSelectedProjectId}
          disabled={!dependentFiltersEnabled}
          buttonClassName={!dependentFiltersEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[
            { value: "all", label: "All projects" },
            ...filteredProjects.map((project) => ({ value: project.id, label: project.name })),
          ]}
          placeholder="All projects"
          searchPlaceholder="Search projects..."
          emptyLabel="No projects found."
        />
      </div>
      <div className="flex w-full flex-wrap gap-3 sm:w-auto">
        <a className="btn-secondary" href={buildResetHref(action, anchor, preservedParams)}>Reset</a>
      </div>
    </AutoSubmitFilterForm>
  );
}

export function TaskDetailFilterForm({
  action,
  anchor,
  fromDate,
  toDate,
  clientId,
  projectId,
  subProjectId,
  countryId,
  movieId,
  clientOptions,
  projectOptions,
  subProjectOptions,
  countryOptions,
  movieOptions = [],
  countryEligibleClientOptions = clientOptions,
  countryEligibleProjectOptions = projectOptions,
  countryEligibleSubProjectOptions = subProjectOptions,
  movieEligibleClientOptions = clientOptions,
  movieEligibleProjectOptions = projectOptions,
  movieEligibleSubProjectOptions = subProjectOptions,
  preservedParams = {},
}: {
  action: string;
  anchor: string;
  fromDate: string;
  toDate: string;
  clientId: string;
  projectId: string;
  subProjectId: string;
  countryId: string;
  movieId: string;
  clientOptions: ClientOption[];
  projectOptions: ProjectOption[];
  subProjectOptions: SubProjectOption[];
  countryOptions: CountryOption[];
  movieOptions?: TitleOption[];
  countryEligibleClientOptions?: ClientOption[];
  countryEligibleProjectOptions?: ProjectOption[];
  countryEligibleSubProjectOptions?: SubProjectOption[];
  movieEligibleClientOptions?: ClientOption[];
  movieEligibleProjectOptions?: ProjectOption[];
  movieEligibleSubProjectOptions?: SubProjectOption[];
  preservedParams?: PreservedParams;
}) {
  const [selectedClientId, setSelectedClientId] = useState(clientId);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [selectedSubProjectId, setSelectedSubProjectId] = useState(subProjectId);
  const [selectedCountryId, setSelectedCountryId] = useState(countryId);
  const [selectedMovieId, setSelectedMovieId] = useState(movieId);
  const dependentFiltersEnabled = selectedClientId !== "all";

  const useCountryEligibleOptions = dependentFiltersEnabled && selectedCountryId !== "all";
  const useTitleEligibleOptions = dependentFiltersEnabled && selectedMovieId !== "all";

  const allowedClientIds = new Set<string>();
  if (useCountryEligibleOptions) countryEligibleClientOptions.forEach((client) => allowedClientIds.add(client.id));
  if (useTitleEligibleOptions) movieEligibleClientOptions.forEach((client) => allowedClientIds.add(client.id));

  const activeClientOptions = useCountryEligibleOptions && useTitleEligibleOptions
    ? clientOptions.filter((client) => countryEligibleClientOptions.some((item) => item.id === client.id) && movieEligibleClientOptions.some((item) => item.id === client.id))
    : useCountryEligibleOptions
      ? countryEligibleClientOptions
      : useTitleEligibleOptions
        ? movieEligibleClientOptions
        : clientOptions;

  const activeProjectOptions = useMemo(() => {
    const countryIds = new Set(countryEligibleProjectOptions.map((project) => project.id));
    const movieIds = new Set(movieEligibleProjectOptions.map((project) => project.id));
    return projectOptions.filter((project) => {
      if (useCountryEligibleOptions && !countryIds.has(project.id)) return false;
      if (useTitleEligibleOptions && !movieIds.has(project.id)) return false;
      return true;
    });
  }, [projectOptions, countryEligibleProjectOptions, movieEligibleProjectOptions, useCountryEligibleOptions, useTitleEligibleOptions]);

  const activeSubProjectOptions = useMemo(() => {
    const countryIds = new Set(countryEligibleSubProjectOptions.map((subProject) => subProject.id));
    const movieIds = new Set(movieEligibleSubProjectOptions.map((subProject) => subProject.id));
    return subProjectOptions.filter((subProject) => {
      if (useCountryEligibleOptions && !countryIds.has(subProject.id)) return false;
      if (useTitleEligibleOptions && !movieIds.has(subProject.id)) return false;
      return true;
    });
  }, [subProjectOptions, countryEligibleSubProjectOptions, movieEligibleSubProjectOptions, useCountryEligibleOptions, useTitleEligibleOptions]);

  const selectedClientAllowsCountry =
    selectedClientId === "all" || countryEligibleClientOptions.some((client) => client.id === selectedClientId);
  const selectedProjectAllowsCountry =
    selectedProjectId === "all" || countryEligibleProjectOptions.some((project) => project.id === selectedProjectId);
  const selectedSubProjectAllowsCountry =
    selectedSubProjectId === "all" || countryEligibleSubProjectOptions.some((subProject) => subProject.id === selectedSubProjectId);
  const countryDropdownEnabled =
    dependentFiltersEnabled &&
    (selectedCountryId !== "all" ||
      (selectedClientAllowsCountry && selectedProjectAllowsCountry && selectedSubProjectAllowsCountry));

  const selectedClientAllowsTitle =
    selectedClientId === "all" || movieEligibleClientOptions.some((client) => client.id === selectedClientId);
  const selectedProjectAllowsTitle =
    selectedProjectId === "all" || movieEligibleProjectOptions.some((project) => project.id === selectedProjectId);
  const selectedSubProjectAllowsTitle =
    selectedSubProjectId === "all" || movieEligibleSubProjectOptions.some((subProject) => subProject.id === selectedSubProjectId);
  const movieDropdownEnabled =
    dependentFiltersEnabled &&
    (selectedMovieId !== "all" ||
      (selectedClientAllowsTitle && selectedProjectAllowsTitle && selectedSubProjectAllowsTitle));

  const filteredTitles = useMemo(
    () =>
      dependentFiltersEnabled
        ? movieOptions.filter((movie) => movie.clientId === selectedClientId)
        : [],
    [movieOptions, selectedClientId, dependentFiltersEnabled],
  );
  const effectiveMovieId = movieDropdownEnabled && (selectedMovieId === "all" || filteredTitles.some((movie) => movie.id === selectedMovieId))
    ? selectedMovieId
    : "all";

  const filteredProjects = useMemo(
    () => activeProjectOptions.filter((project) => (dependentFiltersEnabled ? project.clientId === selectedClientId : false)),
    [activeProjectOptions, selectedClientId, dependentFiltersEnabled],
  );
  const effectiveProjectId = dependentFiltersEnabled && (selectedProjectId === "all" || filteredProjects.some((project) => project.id === selectedProjectId))
    ? selectedProjectId
    : "all";

  const filteredProjectIds = useMemo(
    () => new Set(filteredProjects.map((project) => project.id)),
    [filteredProjects],
  );

  const filteredSubProjects = useMemo(
    () =>
      activeSubProjectOptions.filter((subProject) => {
        if (effectiveProjectId !== "all") {
          return subProject.projectId === effectiveProjectId;
        }
        if (selectedClientId !== "all") {
          return filteredProjectIds.has(subProject.projectId);
        }
        return true;
      }),
    [activeSubProjectOptions, effectiveProjectId, filteredProjectIds, selectedClientId],
  );
  const effectiveSubProjectId = dependentFiltersEnabled && (selectedSubProjectId === "all" || filteredSubProjects.some((subProject) => subProject.id === selectedSubProjectId))
    ? selectedSubProjectId
    : "all";

  return (
    <AutoSubmitFilterForm className="relative z-20 flex flex-wrap items-end gap-3" method="get" action={`${action}${anchor}`}>
      {renderHiddenParams(preservedParams)}
      <div className="w-full sm:w-[180px]">
        <input className="input w-full" type="date" name="taskFromDate" defaultValue={fromDate} />
      </div>
      <div className="w-full sm:w-[180px]">
        <input className="input w-full" type="date" name="taskToDate" defaultValue={toDate} />
      </div>
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id="taskClientId"
          name="taskClientId"
          value={selectedClientId}
          onValueChange={(value) => {
            setSelectedClientId(value);
            const currentProject = activeProjectOptions.find((project) => project.id === selectedProjectId);
            if (value === "all" || (currentProject && currentProject.clientId !== value)) {
              setSelectedProjectId("all");
              setSelectedSubProjectId("all");
            }
            if (value === "all" || !movieEligibleClientOptions.some((client) => client.id === value)) {
              setSelectedMovieId("all");
            }
            if (value === "all" || !countryEligibleClientOptions.some((client) => client.id === value)) {
              setSelectedCountryId("all");
            }
          }}
          options={[{ value: "all", label: "All clients" }, ...activeClientOptions.map((client) => ({ value: client.id, label: client.name }))]}
          placeholder="All clients"
          searchPlaceholder="Search clients..."
          emptyLabel="No clients found."
        />
      </div>
      <LockedDependentFiltersNotice isVisible={!dependentFiltersEnabled} />
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id="taskProjectId"
          name="taskProjectId"
          value={effectiveProjectId}
          onValueChange={(value) => {
            setSelectedProjectId(value);
            const currentSubProject = activeSubProjectOptions.find((subProject) => subProject.id === selectedSubProjectId);
            if (currentSubProject && value !== "all" && currentSubProject.projectId !== value) {
              setSelectedSubProjectId("all");
            }
            if (value !== "all") {
              const nextProject = activeProjectOptions.find((project) => project.id === value);
              if (nextProject && selectedClientId !== "all" && nextProject.clientId !== selectedClientId) {
                setSelectedClientId(nextProject.clientId);
              }
              if (!movieEligibleProjectOptions.some((project) => project.id === value)) {
                setSelectedMovieId("all");
              }
            }
          }}
          disabled={!dependentFiltersEnabled}
          buttonClassName={!dependentFiltersEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All projects" }, ...filteredProjects.map((project) => ({ value: project.id, label: project.name }))]}
          placeholder="All projects"
          searchPlaceholder="Search projects..."
          emptyLabel="No projects found."
        />
      </div>
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id="taskSubProjectId"
          name="taskSubProjectId"
          value={effectiveSubProjectId}
          onValueChange={(value) => {
            setSelectedSubProjectId(value);
            if (value !== "all" && !movieEligibleSubProjectOptions.some((subProject) => subProject.id === value)) {
              setSelectedMovieId("all");
            }
          }}
          disabled={!dependentFiltersEnabled}
          buttonClassName={!dependentFiltersEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All sub-projects" }, ...filteredSubProjects.map((subProject) => ({ value: subProject.id, label: subProject.name }))]}
          placeholder="All sub-projects"
          searchPlaceholder="Search sub-projects..."
          emptyLabel="No sub-projects found."
        />
      </div>
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id="taskMovieId"
          name="taskMovieId"
          value={movieDropdownEnabled ? effectiveMovieId : "all"}
          onValueChange={(value) => {
            setSelectedMovieId(value);
            if (value !== "all") {
              const nextTitle = movieOptions.find((movie) => movie.id === value);
              if (nextTitle && selectedClientId !== "all" && nextTitle.clientId !== selectedClientId) {
                setSelectedClientId(nextTitle.clientId);
                setSelectedProjectId("all");
                setSelectedSubProjectId("all");
              }
            }
          }}
          disabled={!movieDropdownEnabled}
          buttonClassName={!movieDropdownEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All titles" }, ...filteredTitles.map((movie) => ({ value: movie.id, label: movie.title, keywords: `${movie.title} ${movie.clientName}` }))]}
          placeholder="All titles"
          searchPlaceholder="Search titles..."
          emptyLabel="No titles found."
        />
      </div>
      <div className="w-full sm:w-[220px] md:w-[240px] lg:w-[260px]">
        <SearchableCombobox
          id="taskCountryId"
          name="taskCountryId"
          value={countryDropdownEnabled ? selectedCountryId : "all"}
          onValueChange={setSelectedCountryId}
          disabled={!countryDropdownEnabled}
          buttonClassName={!countryDropdownEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All countries" }, ...countryOptions.map((country) => ({ value: country.id, label: country.isoCode ? `${country.isoCode} - ${country.name}` : country.name, keywords: `${country.isoCode ?? ""} ${country.name}` }))]}
          placeholder="All countries"
          searchPlaceholder="Search countries..."
          emptyLabel="No countries found."
        />
      </div>
      <div className="flex w-full flex-wrap gap-3 sm:w-auto">
        <a className="btn-secondary" href={buildResetHref(action, anchor, preservedParams)}>Reset</a>
      </div>
    </AutoSubmitFilterForm>
  );
}

export function ScopedMinutesFilterForm({
  action,
  anchor,
  prefix,
  fromDate,
  toDate,
  clientId,
  projectId,
  subProjectId,
  countryId,
  movieId,
  clientOptions,
  projectOptions,
  subProjectOptions,
  countryOptions,
  movieOptions = [],
  countryEligibleClientOptions = clientOptions,
  countryEligibleProjectOptions = projectOptions,
  countryEligibleSubProjectOptions = subProjectOptions,
  movieEligibleClientOptions = clientOptions,
  movieEligibleProjectOptions = projectOptions,
  movieEligibleSubProjectOptions = subProjectOptions,
  preservedParams = {},
}: {
  action: string;
  anchor: string;
  prefix: string;
  fromDate: string;
  toDate: string;
  clientId: string;
  projectId: string;
  subProjectId: string;
  countryId: string;
  movieId: string;
  clientOptions: ClientOption[];
  projectOptions: ProjectOption[];
  subProjectOptions: SubProjectOption[];
  countryOptions: CountryOption[];
  movieOptions?: TitleOption[];
  countryEligibleClientOptions?: ClientOption[];
  countryEligibleProjectOptions?: ProjectOption[];
  countryEligibleSubProjectOptions?: SubProjectOption[];
  movieEligibleClientOptions?: ClientOption[];
  movieEligibleProjectOptions?: ProjectOption[];
  movieEligibleSubProjectOptions?: SubProjectOption[];
  preservedParams?: PreservedParams;
}) {
  const [selectedClientId, setSelectedClientId] = useState(clientId);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [selectedSubProjectId, setSelectedSubProjectId] = useState(subProjectId);
  const [selectedCountryId, setSelectedCountryId] = useState(countryId);
  const [selectedMovieId, setSelectedMovieId] = useState(movieId);
  const dependentFiltersEnabled = selectedClientId !== "all";

  const useCountryEligibleOptions = dependentFiltersEnabled && selectedCountryId !== "all";
  const useTitleEligibleOptions = dependentFiltersEnabled && selectedMovieId !== "all";

  const activeClientOptions = useMemo(() => {
    return clientOptions.filter((client) => {
      if (useCountryEligibleOptions && !countryEligibleClientOptions.some((item) => item.id === client.id)) return false;
      if (useTitleEligibleOptions && !movieEligibleClientOptions.some((item) => item.id === client.id)) return false;
      return true;
    });
  }, [clientOptions, countryEligibleClientOptions, movieEligibleClientOptions, useCountryEligibleOptions, useTitleEligibleOptions]);

  const activeProjectOptions = useMemo(() => {
    return projectOptions.filter((project) => {
      if (useCountryEligibleOptions && !countryEligibleProjectOptions.some((item) => item.id === project.id)) return false;
      if (useTitleEligibleOptions && !movieEligibleProjectOptions.some((item) => item.id === project.id)) return false;
      return true;
    });
  }, [projectOptions, countryEligibleProjectOptions, movieEligibleProjectOptions, useCountryEligibleOptions, useTitleEligibleOptions]);

  const activeSubProjectOptions = useMemo(() => {
    return subProjectOptions.filter((subProject) => {
      if (useCountryEligibleOptions && !countryEligibleSubProjectOptions.some((item) => item.id === subProject.id)) return false;
      if (useTitleEligibleOptions && !movieEligibleSubProjectOptions.some((item) => item.id === subProject.id)) return false;
      return true;
    });
  }, [subProjectOptions, countryEligibleSubProjectOptions, movieEligibleSubProjectOptions, useCountryEligibleOptions, useTitleEligibleOptions]);

  const selectedClientAllowsCountry =
    selectedClientId === "all" || countryEligibleClientOptions.some((client) => client.id === selectedClientId);
  const selectedProjectAllowsCountry =
    selectedProjectId === "all" || countryEligibleProjectOptions.some((project) => project.id === selectedProjectId);
  const selectedSubProjectAllowsCountry =
    selectedSubProjectId === "all" || countryEligibleSubProjectOptions.some((subProject) => subProject.id === selectedSubProjectId);
  const countryDropdownEnabled =
    dependentFiltersEnabled &&
    (selectedCountryId !== "all" ||
      (selectedClientAllowsCountry && selectedProjectAllowsCountry && selectedSubProjectAllowsCountry));

  const selectedClientAllowsTitle =
    selectedClientId === "all" || movieEligibleClientOptions.some((client) => client.id === selectedClientId);
  const selectedProjectAllowsTitle =
    selectedProjectId === "all" || movieEligibleProjectOptions.some((project) => project.id === selectedProjectId);
  const selectedSubProjectAllowsTitle =
    selectedSubProjectId === "all" || movieEligibleSubProjectOptions.some((subProject) => subProject.id === selectedSubProjectId);
  const movieDropdownEnabled =
    dependentFiltersEnabled &&
    (selectedMovieId !== "all" ||
      (selectedClientAllowsTitle && selectedProjectAllowsTitle && selectedSubProjectAllowsTitle));

  const filteredTitles = useMemo(
    () =>
      dependentFiltersEnabled
        ? movieOptions.filter((movie) => movie.clientId === selectedClientId)
        : [],
    [movieOptions, selectedClientId, dependentFiltersEnabled],
  );
  const effectiveMovieId = movieDropdownEnabled && (selectedMovieId === "all" || filteredTitles.some((movie) => movie.id === selectedMovieId))
    ? selectedMovieId
    : "all";

  const filteredProjects = useMemo(
    () => activeProjectOptions.filter((project) => (dependentFiltersEnabled ? project.clientId === selectedClientId : false)),
    [activeProjectOptions, selectedClientId, dependentFiltersEnabled],
  );
  const effectiveProjectId =
    dependentFiltersEnabled && (selectedProjectId === "all" || filteredProjects.some((project) => project.id === selectedProjectId))
      ? selectedProjectId
      : "all";

  const filteredProjectIds = useMemo(
    () => new Set(filteredProjects.map((project) => project.id)),
    [filteredProjects],
  );

  const filteredSubProjects = useMemo(
    () =>
      activeSubProjectOptions.filter((subProject) => {
        if (effectiveProjectId !== "all") {
          return subProject.projectId === effectiveProjectId;
        }
        if (selectedClientId !== "all") {
          return filteredProjectIds.has(subProject.projectId);
        }
        return true;
      }),
    [activeSubProjectOptions, effectiveProjectId, filteredProjectIds, selectedClientId],
  );
  const effectiveSubProjectId =
    dependentFiltersEnabled && (selectedSubProjectId === "all" || filteredSubProjects.some((subProject) => subProject.id === selectedSubProjectId))
      ? selectedSubProjectId
      : "all";

  return (
    <AutoSubmitFilterForm className="relative z-20 flex flex-wrap items-end gap-3" method="get" action={`${action}${anchor}`}>
      {renderHiddenParams(preservedParams)}
      <div className="w-full sm:w-[180px]">
        <input className="input w-full" type="date" name={`${prefix}FromDate`} defaultValue={fromDate} />
      </div>
      <div className="w-full sm:w-[180px]">
        <input className="input w-full" type="date" name={`${prefix}ToDate`} defaultValue={toDate} />
      </div>
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id={`${prefix}ClientId`}
          name={`${prefix}ClientId`}
          value={selectedClientId}
          onValueChange={(value) => {
            setSelectedClientId(value);
            const currentProject = activeProjectOptions.find((project) => project.id === selectedProjectId);
            if (value === "all" || (currentProject && currentProject.clientId !== value)) {
              setSelectedProjectId("all");
              setSelectedSubProjectId("all");
            }
            if (value === "all" || !movieEligibleClientOptions.some((client) => client.id === value)) {
              setSelectedMovieId("all");
            }
            if (value === "all" || !countryEligibleClientOptions.some((client) => client.id === value)) {
              setSelectedCountryId("all");
            }
          }}
          options={[{ value: "all", label: "All clients" }, ...activeClientOptions.map((client) => ({ value: client.id, label: client.name }))]}
          placeholder="All clients"
          searchPlaceholder="Search clients..."
          emptyLabel="No clients found."
        />
      </div>
      <LockedDependentFiltersNotice isVisible={!dependentFiltersEnabled} />
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id={`${prefix}ProjectId`}
          name={`${prefix}ProjectId`}
          value={effectiveProjectId}
          onValueChange={(value) => {
            setSelectedProjectId(value);
            const currentSubProject = activeSubProjectOptions.find((subProject) => subProject.id === selectedSubProjectId);
            if (currentSubProject && value !== "all" && currentSubProject.projectId !== value) {
              setSelectedSubProjectId("all");
            }
            if (value !== "all") {
              const nextProject = activeProjectOptions.find((project) => project.id === value);
              if (nextProject && selectedClientId !== "all" && nextProject.clientId !== selectedClientId) {
                setSelectedClientId(nextProject.clientId);
              }
              if (!movieEligibleProjectOptions.some((project) => project.id === value)) {
                setSelectedMovieId("all");
              }
            }
          }}
          disabled={!dependentFiltersEnabled}
          buttonClassName={!dependentFiltersEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All projects" }, ...filteredProjects.map((project) => ({ value: project.id, label: project.name }))]}
          placeholder="All projects"
          searchPlaceholder="Search projects..."
          emptyLabel="No projects found."
        />
      </div>
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id={`${prefix}SubProjectId`}
          name={`${prefix}SubProjectId`}
          value={effectiveSubProjectId}
          onValueChange={(value) => {
            setSelectedSubProjectId(value);
            if (value !== "all" && !movieEligibleSubProjectOptions.some((subProject) => subProject.id === value)) {
              setSelectedMovieId("all");
            }
          }}
          disabled={!dependentFiltersEnabled}
          buttonClassName={!dependentFiltersEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All sub-projects" }, ...filteredSubProjects.map((subProject) => ({ value: subProject.id, label: subProject.name }))]}
          placeholder="All sub-projects"
          searchPlaceholder="Search sub-projects..."
          emptyLabel="No sub-projects found."
        />
      </div>
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id={`${prefix}MovieId`}
          name={`${prefix}MovieId`}
          value={movieDropdownEnabled ? effectiveMovieId : "all"}
          onValueChange={(value) => {
            setSelectedMovieId(value);
            if (value !== "all") {
              const nextTitle = movieOptions.find((movie) => movie.id === value);
              if (nextTitle && selectedClientId !== "all" && nextTitle.clientId !== selectedClientId) {
                setSelectedClientId(nextTitle.clientId);
                setSelectedProjectId("all");
                setSelectedSubProjectId("all");
              }
            }
          }}
          disabled={!movieDropdownEnabled}
          buttonClassName={!movieDropdownEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All titles" }, ...filteredTitles.map((movie) => ({ value: movie.id, label: movie.title, keywords: `${movie.title} ${movie.clientName}` }))]}
          placeholder="All titles"
          searchPlaceholder="Search titles..."
          emptyLabel="No titles found."
        />
      </div>
      <div className="w-full sm:w-[220px] md:w-[240px] lg:w-[260px]">
        <SearchableCombobox
          id={`${prefix}CountryId`}
          name={`${prefix}CountryId`}
          value={countryDropdownEnabled ? selectedCountryId : "all"}
          onValueChange={setSelectedCountryId}
          disabled={!countryDropdownEnabled}
          buttonClassName={!countryDropdownEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All countries" }, ...countryOptions.map((country) => ({ value: country.id, label: country.isoCode ? `${country.isoCode} - ${country.name}` : country.name, keywords: `${country.isoCode ?? ""} ${country.name}` }))]}
          placeholder="All countries"
          searchPlaceholder="Search countries..."
          emptyLabel="No countries found."
        />
      </div>
      <div className="flex w-full flex-wrap gap-3 sm:w-auto">
        <a className="btn-secondary" href={buildResetHref(action, anchor, preservedParams)}>Reset</a>
      </div>
    </AutoSubmitFilterForm>
  );
}

export function MovieMinutesFilterForm({
  action,
  anchor,
  fromDate,
  toDate,
  movieId,
  clientId,
  projectId,
  subProjectId,
  countryId,
  movieOptions,
  clientOptions,
  projectOptions,
  subProjectOptions,
  countryOptions,
  preservedParams = {},
}: {
  action: string;
  anchor: string;
  fromDate: string;
  toDate: string;
  movieId: string;
  clientId: string;
  projectId: string;
  subProjectId: string;
  countryId: string;
  movieOptions: TitleOption[];
  clientOptions: ClientOption[];
  projectOptions: ProjectOption[];
  subProjectOptions: SubProjectOption[];
  countryOptions: CountryOption[];
  preservedParams?: PreservedParams;
}) {
  const [selectedMovieId, setSelectedMovieId] = useState(movieId);
  const [selectedClientId, setSelectedClientId] = useState(clientId);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [selectedSubProjectId, setSelectedSubProjectId] = useState(subProjectId);
  const [selectedCountryId, setSelectedCountryId] = useState(countryId);
  const dependentFiltersEnabled = selectedClientId !== "all";

  const filteredTitles = useMemo(
    () =>
      dependentFiltersEnabled
        ? movieOptions.filter((movie) => movie.clientId === selectedClientId)
        : [],
    [movieOptions, selectedClientId, dependentFiltersEnabled],
  );

  const effectiveMovieId =
    dependentFiltersEnabled && (selectedMovieId === "all" || filteredTitles.some((movie) => movie.id === selectedMovieId))
      ? selectedMovieId
      : "all";

  const filteredProjects = useMemo(
    () => projectOptions.filter((project) => (dependentFiltersEnabled ? project.clientId === selectedClientId : false)),
    [projectOptions, selectedClientId, dependentFiltersEnabled],
  );

  const effectiveProjectId =
    dependentFiltersEnabled && (selectedProjectId === "all" || filteredProjects.some((project) => project.id === selectedProjectId))
      ? selectedProjectId
      : "all";

  const filteredProjectIds = useMemo(
    () => new Set(filteredProjects.map((project) => project.id)),
    [filteredProjects],
  );

  const filteredSubProjects = useMemo(
    () =>
      subProjectOptions.filter((subProject) => {
        if (effectiveProjectId !== "all") {
          return subProject.projectId === effectiveProjectId;
        }
        if (selectedClientId !== "all") {
          return filteredProjectIds.has(subProject.projectId);
        }
        return true;
      }),
    [subProjectOptions, effectiveProjectId, filteredProjectIds, selectedClientId],
  );

  const effectiveSubProjectId =
    dependentFiltersEnabled && (selectedSubProjectId === "all" || filteredSubProjects.some((subProject) => subProject.id === selectedSubProjectId))
      ? selectedSubProjectId
      : "all";

  return (
    <AutoSubmitFilterForm className="relative z-20 flex flex-wrap items-end gap-3" method="get" action={`${action}${anchor}`}>
      {renderHiddenParams(preservedParams)}
      <div className="w-full sm:w-[180px]">
        <input className="input w-full" type="date" name="movieFromDate" defaultValue={fromDate} />
      </div>
      <div className="w-full sm:w-[180px]">
        <input className="input w-full" type="date" name="movieToDate" defaultValue={toDate} />
      </div>
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id="movieMovieId"
          name="movieMovieId"
          value={effectiveMovieId}
          onValueChange={(value) => {
            setSelectedMovieId(value);
            if (value === "all") return;
            const nextTitle = movieOptions.find((movie) => movie.id === value);
            if (!nextTitle) return;
            setSelectedClientId(nextTitle.clientId);
            setSelectedProjectId("all");
            setSelectedSubProjectId("all");
          }}
          disabled={!dependentFiltersEnabled}
          buttonClassName={!dependentFiltersEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All titles" }, ...filteredTitles.map((movie) => ({ value: movie.id, label: movie.title, keywords: movie.clientName }))]}
          placeholder="All titles"
          searchPlaceholder="Search titles..."
          emptyLabel="No titles found."
        />
      </div>
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id="movieClientId"
          name="movieClientId"
          value={selectedClientId}
          onValueChange={(value) => {
            setSelectedClientId(value);
            const currentProject = projectOptions.find((project) => project.id === selectedProjectId);
            if (value === "all" || (currentProject && currentProject.clientId !== value)) {
              setSelectedProjectId("all");
              setSelectedSubProjectId("all");
            }
            const currentTitle = movieOptions.find((movie) => movie.id === selectedMovieId);
            if (value === "all" || (currentTitle && currentTitle.clientId !== value)) {
              setSelectedMovieId("all");
            }
            if (value === "all") {
              setSelectedCountryId("all");
            }
          }}
          options={[{ value: "all", label: "All clients" }, ...clientOptions.map((client) => ({ value: client.id, label: client.name }))]}
          placeholder="All clients"
          searchPlaceholder="Search clients..."
          emptyLabel="No clients found."
        />
      </div>
      <LockedDependentFiltersNotice isVisible={!dependentFiltersEnabled} />
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id="movieProjectId"
          name="movieProjectId"
          value={effectiveProjectId}
          onValueChange={(value) => {
            setSelectedProjectId(value);
            if (value === "all") {
              setSelectedSubProjectId("all");
              return;
            }
            const currentSubProject = subProjectOptions.find((subProject) => subProject.id === selectedSubProjectId);
            if (currentSubProject && currentSubProject.projectId !== value) {
              setSelectedSubProjectId("all");
            }
            const nextProject = projectOptions.find((project) => project.id === value);
            if (nextProject && selectedClientId !== "all" && nextProject.clientId !== selectedClientId) {
              setSelectedClientId(nextProject.clientId);
            }
          }}
          disabled={!dependentFiltersEnabled}
          buttonClassName={!dependentFiltersEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All projects" }, ...filteredProjects.map((project) => ({ value: project.id, label: project.name }))]}
          placeholder="All projects"
          searchPlaceholder="Search projects..."
          emptyLabel="No projects found."
        />
      </div>
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id="movieSubProjectId"
          name="movieSubProjectId"
          value={effectiveSubProjectId}
          onValueChange={setSelectedSubProjectId}
          disabled={!dependentFiltersEnabled}
          buttonClassName={!dependentFiltersEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All sub-projects" }, ...filteredSubProjects.map((subProject) => ({ value: subProject.id, label: subProject.name }))]}
          placeholder="All sub-projects"
          searchPlaceholder="Search sub-projects..."
          emptyLabel="No sub-projects found."
        />
      </div>
      <div className="w-full sm:w-[220px] md:w-[240px] lg:w-[260px]">
        <SearchableCombobox
          id="movieCountryId"
          name="movieCountryId"
          value={dependentFiltersEnabled ? selectedCountryId : "all"}
          onValueChange={setSelectedCountryId}
          disabled={!dependentFiltersEnabled}
          buttonClassName={!dependentFiltersEnabled ? LOCKED_FILTER_BUTTON_CLASS : undefined}
          options={[{ value: "all", label: "All countries" }, ...countryOptions.map((country) => ({ value: country.id, label: country.isoCode ? `${country.isoCode} - ${country.name}` : country.name, keywords: `${country.isoCode ?? ""} ${country.name}` }))]}
          placeholder="All countries"
          searchPlaceholder="Search countries..."
          emptyLabel="No countries found."
        />
      </div>
      <div className="flex w-full flex-wrap gap-3 sm:w-auto">
        <a className="btn-secondary" href={buildResetHref(action, anchor, preservedParams)}>Reset</a>
      </div>
    </AutoSubmitFilterForm>
  );
}
