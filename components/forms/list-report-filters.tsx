"use client";

import Link from "next/link";
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

type Props = {
  basePath: string;
  selectedFromDate: string;
  selectedToDate: string;
  selectedClientId: string;
  selectedProjectId: string;
  clientOptions: ClientOption[];
  projectOptions: ProjectOption[];
};

export function ListReportFilters({
  basePath,
  selectedFromDate,
  selectedToDate,
  selectedClientId,
  selectedProjectId,
  clientOptions,
  projectOptions,
}: Props) {
  const [clientId, setClientId] = useState(selectedClientId);
  const [projectId, setProjectId] = useState(selectedProjectId);

  const filteredProjects = useMemo(
    () => projectOptions.filter((project) => (clientId === "all" ? true : project.clientId === clientId)),
    [projectOptions, clientId],
  );

  const effectiveProjectId =
    projectId === "all" || filteredProjects.some((project) => project.id === projectId) ? projectId : "all";

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="w-full sm:w-[180px]">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor={`${basePath}-fromDate`}>
          Date from
        </label>
        <input
          id={`${basePath}-fromDate`}
          name="fromDate"
          type="date"
          defaultValue={selectedFromDate}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div className="w-full sm:w-[180px]">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor={`${basePath}-toDate`}>
          Date to
        </label>
        <input
          id={`${basePath}-toDate`}
          name="toDate"
          type="date"
          defaultValue={selectedToDate}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div className="w-full min-w-0 sm:w-[260px] lg:w-[300px]">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor={`${basePath}-clientId`}>
          Client
        </label>
        <SearchableCombobox
          id={`${basePath}-clientId`}
          name="clientId"
          value={clientId}
          onValueChange={(value) => {
            setClientId(value);
            const currentProject = projectOptions.find((project) => project.id === projectId);
            if (currentProject && value !== "all" && currentProject.clientId !== value) {
              setProjectId("all");
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

      <div className="w-full min-w-0 sm:w-[260px] lg:w-[300px]">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor={`${basePath}-projectId`}>
          Project
        </label>
        <SearchableCombobox
          id={`${basePath}-projectId`}
          name="projectId"
          value={effectiveProjectId}
          onValueChange={(value) => {
            setProjectId(value);
            if (value === "all") return;
            const nextProject = projectOptions.find((project) => project.id === value);
            if (nextProject && clientId !== "all" && nextProject.clientId !== clientId) {
              setClientId(nextProject.clientId);
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

      <div className="flex flex-wrap gap-3">
        <button className="btn-secondary" type="submit">
          Apply
        </button>
        <Link className="btn-secondary" href={basePath}>
          Reset
        </Link>
      </div>
    </form>
  );
}
