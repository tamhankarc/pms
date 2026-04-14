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
};

type SubProjectOption = {
  id: string;
  name: string;
  projectId: string;
};

type CountryOption = {
  id: string;
  name: string;
  isoCode: string;
};

type PreservedParams = Record<string, string | undefined>;

function renderHiddenParams(params: PreservedParams) {
  return Object.entries(params).map(([key, value]) =>
    value ? <input key={key} type="hidden" name={key} value={value} /> : null,
  );
}

function buildResetHref(anchor: string, params: PreservedParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/reports?${query}${anchor}` : `/reports${anchor}`;
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
        <a className="btn-secondary" href={buildResetHref(anchor, preservedParams)}>Reset</a>
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
  clientId: string;
  projectId: string;
  subProjectId: string;
  countryId: string;
  clientOptions: ClientOption[];
  projectOptions: ProjectOption[];
  subProjectOptions: SubProjectOption[];
  countryOptions: CountryOption[];
  preservedParams?: PreservedParams;
}) {
  const [selectedClientId, setSelectedClientId] = useState(clientId);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [selectedSubProjectId, setSelectedSubProjectId] = useState(subProjectId);
  const [selectedCountryId, setSelectedCountryId] = useState(countryId);

  const filteredProjects = useMemo(
    () => projectOptions.filter((project) => (selectedClientId === "all" ? true : project.clientId === selectedClientId)),
    [projectOptions, selectedClientId],
  );

  const isProjectAvailable = selectedProjectId === "all" || filteredProjects.some((project) => project.id === selectedProjectId);
  const effectiveProjectId = isProjectAvailable ? selectedProjectId : "all";

  const filteredSubProjects = useMemo(
    () =>
      subProjectOptions.filter((subProject) => {
        if (effectiveProjectId === "all") return true;
        return subProject.projectId === effectiveProjectId;
      }),
    [effectiveProjectId, subProjectOptions],
  );

  const isSubProjectAvailable =
    selectedSubProjectId === "all" || filteredSubProjects.some((subProject) => subProject.id === selectedSubProjectId);
  const effectiveSubProjectId = isSubProjectAvailable ? selectedSubProjectId : "all";

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
            const currentProject = projectOptions.find((project) => project.id === selectedProjectId);
            if (currentProject && value !== "all" && currentProject.clientId !== value) {
              setSelectedProjectId("all");
              setSelectedSubProjectId("all");
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
          id="taskProjectId"
          name="taskProjectId"
          value={effectiveProjectId}
          onValueChange={(value) => {
            setSelectedProjectId(value);
            const currentSubProject = subProjectOptions.find((subProject) => subProject.id === selectedSubProjectId);
            if (currentSubProject && value !== "all" && currentSubProject.projectId !== value) {
              setSelectedSubProjectId("all");
            }
            if (value === "all") {
              return;
            }
            const nextProject = projectOptions.find((project) => project.id === value);
            if (nextProject && selectedClientId !== "all" && nextProject.clientId !== selectedClientId) {
              setSelectedClientId(nextProject.clientId);
            }
          }}
          options={[
            { value: "all", label: "All projects" },
            ...filteredProjects.map((project) => ({ value: project.id, label: project.name })),
          ]}
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
          onValueChange={setSelectedSubProjectId}
          options={[
            { value: "all", label: "All sub-projects" },
            ...filteredSubProjects.map((subProject) => ({ value: subProject.id, label: subProject.name })),
          ]}
          placeholder="All sub-projects"
          searchPlaceholder="Search sub-projects..."
          emptyLabel="No sub-projects found."
        />
      </div>
      <div className="w-full sm:w-[220px] md:w-[240px] lg:w-[260px]">
        <SearchableCombobox
          id="taskCountryId"
          name="taskCountryId"
          value={selectedCountryId}
          onValueChange={setSelectedCountryId}
          options={[
            { value: "all", label: "All countries" },
            ...countryOptions.map((country) => ({
              value: country.id,
              label: country.isoCode ? `${country.isoCode} - ${country.name}` : country.name,
              keywords: `${country.isoCode ?? ""} ${country.name}`,
            })),
          ]}
          placeholder="All countries"
          searchPlaceholder="Search countries..."
          emptyLabel="No countries found."
        />
      </div>
      <div className="flex w-full flex-wrap gap-3 sm:w-auto">
        <button className="btn-secondary" type="submit">Apply</button>
        <a className="btn-secondary" href={buildResetHref(anchor, preservedParams)}>Reset</a>
      </div>
    </form>
  );
}
