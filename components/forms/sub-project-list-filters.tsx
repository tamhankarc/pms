"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type ClientOption = { id: string; name: string };
type ProjectOption = { id: string; name: string; clientId: string; clientName: string };

export function SubProjectListFilters({
  selectedClientId,
  selectedProjectId,
  clients,
  projects,
}: {
  selectedClientId: string;
  selectedProjectId: string;
  clients: ClientOption[];
  projects: ProjectOption[];
}) {
  const [clientId, setClientId] = useState(selectedClientId);
  const [projectId, setProjectId] = useState(selectedProjectId);

  const filteredProjects = useMemo(
    () => (clientId ? projects.filter((project) => project.clientId === clientId) : projects),
    [projects, clientId],
  );

  const effectiveProjectId = filteredProjects.some((project) => project.id === projectId) ? projectId : "";

  return (
    <form method="get" className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
      <SearchableCombobox
        id="clientId"
        name="clientId"
        value={clientId}
        onValueChange={(value) => {
          setClientId(value);
          if (!value) {
            return;
          }
          const currentProject = projects.find((project) => project.id === projectId);
          if (currentProject && currentProject.clientId !== value) {
            setProjectId("");
          }
        }}
        options={[
          { value: "", label: "All clients" },
          ...clients.map((client) => ({ value: client.id, label: client.name })),
        ]}
        placeholder="All clients"
        searchPlaceholder="Search clients..."
        emptyLabel="No client found."
      />

      <SearchableCombobox
        id="projectId"
        name="projectId"
        value={effectiveProjectId}
        onValueChange={(value) => {
          setProjectId(value);
          if (!value) {
            return;
          }
          const nextProject = projects.find((project) => project.id === value);
          if (nextProject && nextProject.clientId !== clientId) {
            setClientId(nextProject.clientId);
          }
        }}
        options={[
          { value: "", label: "All projects" },
          ...filteredProjects.map((project) => ({
            value: project.id,
            label: `${project.name} · ${project.clientName}`,
            keywords: `${project.name} ${project.clientName}`,
          })),
        ]}
        placeholder="All projects"
        searchPlaceholder="Search projects..."
        emptyLabel="No projects found."
      />

      <button className="btn-secondary" type="submit">
        Apply
      </button>
      <Link href="/sub-project" className="btn-secondary">
        Reset
      </Link>
    </form>
  );
}
