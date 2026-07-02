"use client";

import { useMemo, useState } from "react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type Option = { id: string; name: string; clientId?: string; projectId?: string };

export function CopyDeckFilterForm({
  clients, movies, projects, subProjects, markets, initial, australiaMarketId,
}: {
  clients: Option[]; movies: Option[]; projects: Option[]; subProjects: Option[]; markets: Option[];
  initial: { clientId: string; movieId: string; projectId: string; subProjectId: string; marketId: string };
  australiaMarketId: string;
}) {
  const [clientId, setClientId] = useState(initial.clientId);
  const [movieId, setMovieId] = useState(initial.movieId);
  const [projectId, setProjectId] = useState(initial.projectId);
  const [subProjectId, setSubProjectId] = useState(initial.subProjectId);
  const filteredMovies = useMemo(() => movies.filter((item) => item.clientId === clientId), [movies, clientId]);
  const filteredProjects = useMemo(() => projects.filter((item) => item.clientId === clientId), [projects, clientId]);
  const filteredSubProjects = useMemo(() => subProjects.filter((item) => item.clientId === clientId && (!projectId || item.projectId === projectId)), [subProjects, clientId, projectId]);
  return (
    <form method="get" className="card grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
      <SearchableCombobox id="copyDeckFilterClient" name="clientId" value={clientId} onValueChange={(value) => { setClientId(value); setMovieId(""); setProjectId(""); setSubProjectId(""); }} options={[{ value: "", label: "Select client" }, ...clients.map((item) => ({ value: item.id, label: item.name }))]} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No clients found." />
      <SearchableCombobox id="copyDeckFilterMovie" name="movieId" disabled={!clientId} value={movieId} onValueChange={setMovieId} options={[{ value: "", label: "All Titles" }, ...filteredMovies.map((item) => ({ value: item.id, label: item.name }))]} placeholder="All Titles" searchPlaceholder="Search titles..." emptyLabel="No titles found." />
      <SearchableCombobox id="copyDeckFilterProject" name="projectId" disabled={!clientId} value={projectId} onValueChange={(value) => { setProjectId(value); setSubProjectId(""); }} options={[{ value: "", label: "All Projects" }, ...filteredProjects.map((item) => ({ value: item.id, label: item.name }))]} placeholder="All Projects" searchPlaceholder="Search projects..." emptyLabel="No projects found." />
      <SearchableCombobox id="copyDeckFilterSubProject" name="subProjectId" disabled={!clientId} value={subProjectId} onValueChange={setSubProjectId} options={[{ value: "", label: "All Sub-Projects" }, ...filteredSubProjects.map((item) => ({ value: item.id, label: item.name }))]} placeholder="All Sub-Projects" searchPlaceholder="Search sub-projects..." emptyLabel="No sub-projects found." />
      <SearchableCombobox id="copyDeckFilterMarket" name="marketId" disabled={!clientId} defaultValue={initial.marketId || australiaMarketId} options={markets.map((item) => ({ value: item.id, label: item.name }))} placeholder="Select market" searchPlaceholder="Search markets..." emptyLabel="No markets found." />
      <button className="btn-secondary" disabled={!clientId}>Apply Filters</button>
    </form>
  );
}
