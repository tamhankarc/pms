"use client";

import { useMemo, useState } from "react";

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
      <select className="input" name="clientId" value={clientId} onChange={(event) => { setClientId(event.target.value); setMovieId(""); setProjectId(""); setSubProjectId(""); }}>
        <option value="">Select client</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select className="input" name="movieId" disabled={!clientId} value={movieId} onChange={(event) => setMovieId(event.target.value)}><option value="">All Titles</option>{filteredMovies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select className="input" name="projectId" disabled={!clientId} value={projectId} onChange={(event) => { setProjectId(event.target.value); setSubProjectId(""); }}><option value="">All Projects</option>{filteredProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select className="input" name="subProjectId" disabled={!clientId} value={subProjectId} onChange={(event) => setSubProjectId(event.target.value)}><option value="">All Sub-Projects</option>{filteredSubProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select className="input" name="marketId" disabled={!clientId} defaultValue={initial.marketId || australiaMarketId}>{markets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <button className="btn-secondary" disabled={!clientId}>Apply Filters</button>
    </form>
  );
}
