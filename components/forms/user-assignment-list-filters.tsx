"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type ClientOption = { id: string; name: string };
type ProjectOption = { id: string; name: string; clientId: string; clientName: string };
type SubProjectOption = { id: string; name: string; projectId: string; projectName: string; clientId: string; clientName: string };

export function UserAssignmentListFilters({
  selectedClientId,
  selectedProjectId,
  selectedSubProjectId,
  clients,
  projects,
  subProjects,
}: {
  selectedClientId: string;
  selectedProjectId: string;
  selectedSubProjectId: string;
  clients: ClientOption[];
  projects: ProjectOption[];
  subProjects: SubProjectOption[];
}) {
  const [clientId, setClientId] = useState(selectedClientId);
  const [projectId, setProjectId] = useState(selectedProjectId);
  const [subProjectId, setSubProjectId] = useState(selectedSubProjectId);

  const filteredProjects = useMemo(
    () => (clientId ? projects.filter((project) => project.clientId === clientId) : projects),
    [projects, clientId],
  );

  const filteredSubProjects = useMemo(() => {
    if (projectId) {
      return subProjects.filter((subProject) => subProject.projectId === projectId);
    }
    if (clientId) {
      return subProjects.filter((subProject) => subProject.clientId === clientId);
    }
    return subProjects;
  }, [subProjects, clientId, projectId]);

  const effectiveProjectId = filteredProjects.some((project) => project.id === projectId) ? projectId : "";
  const effectiveSubProjectId = filteredSubProjects.some((subProject) => subProject.id === subProjectId) ? subProjectId : "";

  return (
    <form method="get" className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
      <SearchableCombobox
        id="clientId"
        name="clientId"
        value={clientId}
        onValueChange={(value) => {
          setClientId(value);
          const currentProject = projects.find((project) => project.id === projectId);
          const nextProjectId = currentProject && (!value || currentProject.clientId === value) ? projectId : "";
          setProjectId(nextProjectId);

          const currentSubProject = subProjects.find((subProject) => subProject.id === subProjectId);
          const canKeepSubProject =
            currentSubProject &&
            (!value || currentSubProject.clientId === value) &&
            (!nextProjectId || currentSubProject.projectId === nextProjectId);
          setSubProjectId(canKeepSubProject ? subProjectId : "");
        }}
        options={[
          { value: "", label: "All clients" },
          ...clients.map((client) => ({ value: client.id, label: client.name })),
        ]}
        placeholder="All clients"
        searchPlaceholder="Search clients..."
        emptyLabel="No clients found."
      />

      <SearchableCombobox
        id="projectId"
        name="projectId"
        value={effectiveProjectId}
        onValueChange={(value) => {
          setProjectId(value);
          if (!value) {
            const currentSubProject = subProjects.find((subProject) => subProject.id === subProjectId);
            setSubProjectId(currentSubProject && (!clientId || currentSubProject.clientId === clientId) ? subProjectId : "");
            return;
          }

          const nextProject = projects.find((project) => project.id === value);
          if (nextProject && nextProject.clientId !== clientId) {
            setClientId(nextProject.clientId);
          }

          const currentSubProject = subProjects.find((subProject) => subProject.id === subProjectId);
          setSubProjectId(currentSubProject?.projectId === value ? subProjectId : "");
        }}
        options={[
          { value: "", label: "All projects" },
          ...filteredProjects.map((project) => ({
            value: project.id,
            label: project.name,
            keywords: project.clientName,
          })),
        ]}
        placeholder="All projects"
        searchPlaceholder="Search projects..."
        emptyLabel="No projects found."
      />

      <SearchableCombobox
        id="subProjectId"
        name="subProjectId"
        value={effectiveSubProjectId}
        onValueChange={(value) => {
          setSubProjectId(value);
          if (!value) {
            return;
          }
          const nextSubProject = subProjects.find((subProject) => subProject.id === value);
          if (!nextSubProject) {
            return;
          }
          if (!projectId || nextSubProject.projectId !== projectId) {
            setProjectId(nextSubProject.projectId);
          }
          if (!clientId || nextSubProject.clientId !== clientId) {
            setClientId(nextSubProject.clientId);
          }
        }}
        options={[
          { value: "", label: "All sub projects" },
          ...filteredSubProjects.map((subProject) => ({
            value: subProject.id,
            label: subProject.name,
            keywords: `${subProject.projectName} ${subProject.clientName}`,
          })),
        ]}
        placeholder="All sub projects"
        searchPlaceholder="Search sub projects..."
        emptyLabel="No sub project found."
      />

      <button className="btn-secondary" type="submit">
        Apply
      </button>
      <Link href="/user-assignments" className="btn-secondary">
        Reset
      </Link>
    </form>
  );
}
