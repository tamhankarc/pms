"use client";

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

type MovieOption = {
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

  const filteredProjects = useMemo(
    () => projectOptions.filter((project) => (selectedClientId === "all" ? true : project.clientId === selectedClientId)),
    [projectOptions, selectedClientId],
  );

  const isProjectAvailable = selectedProjectId === "all" || filteredProjects.some((project) => project.id === selectedProjectId);
  const effectiveProjectId = isProjectAvailable ? selectedProjectId : "all";

  return (
    <form className="relative z-20 flex flex-wrap items-end gap-3" method="get" action={`${action}${anchor}`}>
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
            if (currentProject && value !== "all" && currentProject.clientId !== value) {
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
      <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
        <SearchableCombobox
          id="projectProjectId"
          name="projectProjectId"
          value={effectiveProjectId}
          onValueChange={setSelectedProjectId}
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
        <button className="btn-secondary" type="submit">Apply</button>
        <a className="btn-secondary" href={buildResetHref(action, anchor, preservedParams)}>Reset</a>
      </div>
    </form>
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
  movieOptions?: MovieOption[];
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

  const useCountryEligibleOptions = selectedCountryId !== "all";
  const useMovieEligibleOptions = selectedMovieId !== "all";

  const allowedClientIds = new Set<string>();
  if (useCountryEligibleOptions) countryEligibleClientOptions.forEach((client) => allowedClientIds.add(client.id));
  if (useMovieEligibleOptions) movieEligibleClientOptions.forEach((client) => allowedClientIds.add(client.id));

  const activeClientOptions = useCountryEligibleOptions && useMovieEligibleOptions
    ? clientOptions.filter((client) => countryEligibleClientOptions.some((item) => item.id === client.id) && movieEligibleClientOptions.some((item) => item.id === client.id))
    : useCountryEligibleOptions
      ? countryEligibleClientOptions
      : useMovieEligibleOptions
        ? movieEligibleClientOptions
        : clientOptions;

  const activeProjectOptions = useMemo(() => {
    const countryIds = new Set(countryEligibleProjectOptions.map((project) => project.id));
    const movieIds = new Set(movieEligibleProjectOptions.map((project) => project.id));
    return projectOptions.filter((project) => {
      if (useCountryEligibleOptions && !countryIds.has(project.id)) return false;
      if (useMovieEligibleOptions && !movieIds.has(project.id)) return false;
      return true;
    });
  }, [projectOptions, countryEligibleProjectOptions, movieEligibleProjectOptions, useCountryEligibleOptions, useMovieEligibleOptions]);

  const activeSubProjectOptions = useMemo(() => {
    const countryIds = new Set(countryEligibleSubProjectOptions.map((subProject) => subProject.id));
    const movieIds = new Set(movieEligibleSubProjectOptions.map((subProject) => subProject.id));
    return subProjectOptions.filter((subProject) => {
      if (useCountryEligibleOptions && !countryIds.has(subProject.id)) return false;
      if (useMovieEligibleOptions && !movieIds.has(subProject.id)) return false;
      return true;
    });
  }, [subProjectOptions, countryEligibleSubProjectOptions, movieEligibleSubProjectOptions, useCountryEligibleOptions, useMovieEligibleOptions]);

  const selectedClientAllowsCountry =
    selectedClientId === "all" || countryEligibleClientOptions.some((client) => client.id === selectedClientId);
  const selectedProjectAllowsCountry =
    selectedProjectId === "all" || countryEligibleProjectOptions.some((project) => project.id === selectedProjectId);
  const selectedSubProjectAllowsCountry =
    selectedSubProjectId === "all" || countryEligibleSubProjectOptions.some((subProject) => subProject.id === selectedSubProjectId);
  const countryDropdownEnabled =
    selectedCountryId !== "all" ||
    (selectedClientAllowsCountry && selectedProjectAllowsCountry && selectedSubProjectAllowsCountry);

  const selectedClientAllowsMovie =
    selectedClientId === "all" || movieEligibleClientOptions.some((client) => client.id === selectedClientId);
  const selectedProjectAllowsMovie =
    selectedProjectId === "all" || movieEligibleProjectOptions.some((project) => project.id === selectedProjectId);
  const selectedSubProjectAllowsMovie =
    selectedSubProjectId === "all" || movieEligibleSubProjectOptions.some((subProject) => subProject.id === selectedSubProjectId);
  const movieDropdownEnabled =
    selectedMovieId !== "all" ||
    (selectedClientAllowsMovie && selectedProjectAllowsMovie && selectedSubProjectAllowsMovie);

  const filteredMovies = useMemo(
    () => movieOptions.filter((movie) => (selectedClientId === "all" ? true : movie.clientId === selectedClientId)),
    [movieOptions, selectedClientId],
  );
  const effectiveMovieId = movieDropdownEnabled && (selectedMovieId === "all" || filteredMovies.some((movie) => movie.id === selectedMovieId))
    ? selectedMovieId
    : "all";

  const filteredProjects = useMemo(
    () => activeProjectOptions.filter((project) => (selectedClientId === "all" ? true : project.clientId === selectedClientId)),
    [activeProjectOptions, selectedClientId],
  );
  const effectiveProjectId = selectedProjectId === "all" || filteredProjects.some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : "all";

  const filteredSubProjects = useMemo(
    () => activeSubProjectOptions.filter((subProject) => (effectiveProjectId === "all" ? true : subProject.projectId === effectiveProjectId)),
    [activeSubProjectOptions, effectiveProjectId],
  );
  const effectiveSubProjectId = selectedSubProjectId === "all" || filteredSubProjects.some((subProject) => subProject.id === selectedSubProjectId)
    ? selectedSubProjectId
    : "all";

  return (
    <form className="relative z-20 flex flex-wrap items-end gap-3" method="get" action={`${action}${anchor}`}>
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
            if (currentProject && value !== "all" && currentProject.clientId !== value) {
              setSelectedProjectId("all");
              setSelectedSubProjectId("all");
            }
            if (value !== "all" && !movieEligibleClientOptions.some((client) => client.id === value)) {
              setSelectedMovieId("all");
            }
          }}
          options={[{ value: "all", label: "All clients" }, ...activeClientOptions.map((client) => ({ value: client.id, label: client.name }))]}
          placeholder="All clients"
          searchPlaceholder="Search clients..."
          emptyLabel="No clients found."
        />
      </div>
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
              const nextMovie = movieOptions.find((movie) => movie.id === value);
              if (nextMovie && selectedClientId !== "all" && nextMovie.clientId !== selectedClientId) {
                setSelectedClientId(nextMovie.clientId);
                setSelectedProjectId("all");
                setSelectedSubProjectId("all");
              }
            }
          }}
          disabled={!movieDropdownEnabled}
          buttonClassName={!movieDropdownEnabled ? "border-dashed border-slate-300 bg-slate-50 text-slate-400" : undefined}
          options={[{ value: "all", label: "All movies" }, ...filteredMovies.map((movie) => ({ value: movie.id, label: movie.title, keywords: `${movie.title} ${movie.clientName}` }))]}
          placeholder="All movies"
          searchPlaceholder="Search movies..."
          emptyLabel="No movies found."
        />
      </div>
      <div className="w-full sm:w-[220px] md:w-[240px] lg:w-[260px]">
        <SearchableCombobox
          id="taskCountryId"
          name="taskCountryId"
          value={countryDropdownEnabled ? selectedCountryId : "all"}
          onValueChange={setSelectedCountryId}
          disabled={!countryDropdownEnabled}
          buttonClassName={!countryDropdownEnabled ? "border-dashed border-slate-300 bg-slate-50 text-slate-400" : undefined}
          options={[{ value: "all", label: "All countries" }, ...countryOptions.map((country) => ({ value: country.id, label: country.isoCode ? `${country.isoCode} - ${country.name}` : country.name, keywords: `${country.isoCode ?? ""} ${country.name}` }))]}
          placeholder="All countries"
          searchPlaceholder="Search countries..."
          emptyLabel="No countries found."
        />
      </div>
      <div className="flex w-full flex-wrap gap-3 sm:w-auto">
        <button className="btn-secondary" type="submit">Apply</button>
        <a className="btn-secondary" href={buildResetHref(action, anchor, preservedParams)}>Reset</a>
      </div>
    </form>
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
  movieOptions?: MovieOption[];
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

  const useCountryEligibleOptions = selectedCountryId !== "all";
  const useMovieEligibleOptions = selectedMovieId !== "all";

  const activeClientOptions = useMemo(() => {
    return clientOptions.filter((client) => {
      if (useCountryEligibleOptions && !countryEligibleClientOptions.some((item) => item.id === client.id)) return false;
      if (useMovieEligibleOptions && !movieEligibleClientOptions.some((item) => item.id === client.id)) return false;
      return true;
    });
  }, [clientOptions, countryEligibleClientOptions, movieEligibleClientOptions, useCountryEligibleOptions, useMovieEligibleOptions]);

  const activeProjectOptions = useMemo(() => {
    return projectOptions.filter((project) => {
      if (useCountryEligibleOptions && !countryEligibleProjectOptions.some((item) => item.id === project.id)) return false;
      if (useMovieEligibleOptions && !movieEligibleProjectOptions.some((item) => item.id === project.id)) return false;
      return true;
    });
  }, [projectOptions, countryEligibleProjectOptions, movieEligibleProjectOptions, useCountryEligibleOptions, useMovieEligibleOptions]);

  const activeSubProjectOptions = useMemo(() => {
    return subProjectOptions.filter((subProject) => {
      if (useCountryEligibleOptions && !countryEligibleSubProjectOptions.some((item) => item.id === subProject.id)) return false;
      if (useMovieEligibleOptions && !movieEligibleSubProjectOptions.some((item) => item.id === subProject.id)) return false;
      return true;
    });
  }, [subProjectOptions, countryEligibleSubProjectOptions, movieEligibleSubProjectOptions, useCountryEligibleOptions, useMovieEligibleOptions]);

  const selectedClientAllowsCountry =
    selectedClientId === "all" || countryEligibleClientOptions.some((client) => client.id === selectedClientId);
  const selectedProjectAllowsCountry =
    selectedProjectId === "all" || countryEligibleProjectOptions.some((project) => project.id === selectedProjectId);
  const selectedSubProjectAllowsCountry =
    selectedSubProjectId === "all" || countryEligibleSubProjectOptions.some((subProject) => subProject.id === selectedSubProjectId);
  const countryDropdownEnabled =
    selectedCountryId !== "all" ||
    (selectedClientAllowsCountry && selectedProjectAllowsCountry && selectedSubProjectAllowsCountry);

  const selectedClientAllowsMovie =
    selectedClientId === "all" || movieEligibleClientOptions.some((client) => client.id === selectedClientId);
  const selectedProjectAllowsMovie =
    selectedProjectId === "all" || movieEligibleProjectOptions.some((project) => project.id === selectedProjectId);
  const selectedSubProjectAllowsMovie =
    selectedSubProjectId === "all" || movieEligibleSubProjectOptions.some((subProject) => subProject.id === selectedSubProjectId);
  const movieDropdownEnabled =
    selectedMovieId !== "all" ||
    (selectedClientAllowsMovie && selectedProjectAllowsMovie && selectedSubProjectAllowsMovie);

  const filteredMovies = useMemo(
    () => movieOptions.filter((movie) => (selectedClientId === "all" ? true : movie.clientId === selectedClientId)),
    [movieOptions, selectedClientId],
  );
  const effectiveMovieId = movieDropdownEnabled && (selectedMovieId === "all" || filteredMovies.some((movie) => movie.id === selectedMovieId))
    ? selectedMovieId
    : "all";

  const filteredProjects = useMemo(
    () => activeProjectOptions.filter((project) => (selectedClientId === "all" ? true : project.clientId === selectedClientId)),
    [activeProjectOptions, selectedClientId],
  );
  const effectiveProjectId =
    selectedProjectId === "all" || filteredProjects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : "all";

  const filteredSubProjects = useMemo(
    () => activeSubProjectOptions.filter((subProject) => (effectiveProjectId === "all" ? true : subProject.projectId === effectiveProjectId)),
    [activeSubProjectOptions, effectiveProjectId],
  );
  const effectiveSubProjectId =
    selectedSubProjectId === "all" || filteredSubProjects.some((subProject) => subProject.id === selectedSubProjectId)
      ? selectedSubProjectId
      : "all";

  return (
    <form className="relative z-20 flex flex-wrap items-end gap-3" method="get" action={`${action}${anchor}`}>
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
            if (currentProject && value !== "all" && currentProject.clientId !== value) {
              setSelectedProjectId("all");
              setSelectedSubProjectId("all");
            }
            if (value !== "all" && !movieEligibleClientOptions.some((client) => client.id === value)) {
              setSelectedMovieId("all");
            }
          }}
          options={[{ value: "all", label: "All clients" }, ...activeClientOptions.map((client) => ({ value: client.id, label: client.name }))]}
          placeholder="All clients"
          searchPlaceholder="Search clients..."
          emptyLabel="No clients found."
        />
      </div>
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
              const nextMovie = movieOptions.find((movie) => movie.id === value);
              if (nextMovie && selectedClientId !== "all" && nextMovie.clientId !== selectedClientId) {
                setSelectedClientId(nextMovie.clientId);
                setSelectedProjectId("all");
                setSelectedSubProjectId("all");
              }
            }
          }}
          disabled={!movieDropdownEnabled}
          buttonClassName={!movieDropdownEnabled ? "border-dashed border-slate-300 bg-slate-50 text-slate-400" : undefined}
          options={[{ value: "all", label: "All movies" }, ...filteredMovies.map((movie) => ({ value: movie.id, label: movie.title, keywords: `${movie.title} ${movie.clientName}` }))]}
          placeholder="All movies"
          searchPlaceholder="Search movies..."
          emptyLabel="No movies found."
        />
      </div>
      <div className="w-full sm:w-[220px] md:w-[240px] lg:w-[260px]">
        <SearchableCombobox
          id={`${prefix}CountryId`}
          name={`${prefix}CountryId`}
          value={countryDropdownEnabled ? selectedCountryId : "all"}
          onValueChange={setSelectedCountryId}
          disabled={!countryDropdownEnabled}
          buttonClassName={!countryDropdownEnabled ? "border-dashed border-slate-300 bg-slate-50 text-slate-400" : undefined}
          options={[{ value: "all", label: "All countries" }, ...countryOptions.map((country) => ({ value: country.id, label: country.isoCode ? `${country.isoCode} - ${country.name}` : country.name, keywords: `${country.isoCode ?? ""} ${country.name}` }))]}
          placeholder="All countries"
          searchPlaceholder="Search countries..."
          emptyLabel="No countries found."
        />
      </div>
      <div className="flex w-full flex-wrap gap-3 sm:w-auto">
        <button className="btn-secondary" type="submit">Apply</button>
        <a className="btn-secondary" href={buildResetHref(action, anchor, preservedParams)}>Reset</a>
      </div>
    </form>
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
  movieOptions: MovieOption[];
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

  const filteredMovies = useMemo(
    () => movieOptions.filter((movie) => (selectedClientId === "all" ? true : movie.clientId === selectedClientId)),
    [movieOptions, selectedClientId],
  );

  const effectiveMovieId =
    selectedMovieId === "all" || filteredMovies.some((movie) => movie.id === selectedMovieId)
      ? selectedMovieId
      : "all";

  const filteredProjects = useMemo(
    () => projectOptions.filter((project) => (selectedClientId === "all" ? true : project.clientId === selectedClientId)),
    [projectOptions, selectedClientId],
  );

  const effectiveProjectId =
    selectedProjectId === "all" || filteredProjects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : "all";

  const filteredSubProjects = useMemo(
    () => subProjectOptions.filter((subProject) => (effectiveProjectId === "all" ? true : subProject.projectId === effectiveProjectId)),
    [subProjectOptions, effectiveProjectId],
  );

  const effectiveSubProjectId =
    selectedSubProjectId === "all" || filteredSubProjects.some((subProject) => subProject.id === selectedSubProjectId)
      ? selectedSubProjectId
      : "all";

  return (
    <form className="relative z-20 flex flex-wrap items-end gap-3" method="get" action={`${action}${anchor}`}>
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
            const nextMovie = movieOptions.find((movie) => movie.id === value);
            if (!nextMovie) return;
            setSelectedClientId(nextMovie.clientId);
            setSelectedProjectId("all");
            setSelectedSubProjectId("all");
          }}
          options={[{ value: "all", label: "All movies" }, ...filteredMovies.map((movie) => ({ value: movie.id, label: movie.title, keywords: movie.clientName }))]}
          placeholder="All movies"
          searchPlaceholder="Search movies..."
          emptyLabel="No movies found."
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
            if (currentProject && value !== "all" && currentProject.clientId !== value) {
              setSelectedProjectId("all");
              setSelectedSubProjectId("all");
            }
            const currentMovie = movieOptions.find((movie) => movie.id === selectedMovieId);
            if (currentMovie && value !== "all" && currentMovie.clientId !== value) {
              setSelectedMovieId("all");
            }
          }}
          options={[{ value: "all", label: "All clients" }, ...clientOptions.map((client) => ({ value: client.id, label: client.name }))]}
          placeholder="All clients"
          searchPlaceholder="Search clients..."
          emptyLabel="No clients found."
        />
      </div>
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
          value={selectedCountryId}
          onValueChange={setSelectedCountryId}
          options={[{ value: "all", label: "All countries" }, ...countryOptions.map((country) => ({ value: country.id, label: country.isoCode ? `${country.isoCode} - ${country.name}` : country.name, keywords: `${country.isoCode ?? ""} ${country.name}` }))]}
          placeholder="All countries"
          searchPlaceholder="Search countries..."
          emptyLabel="No countries found."
        />
      </div>
      <div className="flex w-full flex-wrap gap-3 sm:w-auto">
        <button className="btn-secondary" type="submit">Apply</button>
        <a className="btn-secondary" href={buildResetHref(action, anchor, preservedParams)}>Reset</a>
      </div>
    </form>
  );
}
