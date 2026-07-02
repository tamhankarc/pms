"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { createCopyDeckAction, type CopyDeckActionState } from "@/lib/actions/copy-deck-actions";

type Option = { id: string; name: string; clientId?: string; projectId?: string };

export function CopyDeckUploadForm({
  clients, movies, projects, subProjects, countries, australiaId,
}: {
  clients: Option[];
  movies: Option[];
  projects: Option[];
  subProjects: Option[];
  countries: Option[];
  australiaId: string;
}) {
  const [state, action, pending] = useActionState<CopyDeckActionState, FormData>(createCopyDeckAction, {});
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const filteredMovies = useMemo(() => movies.filter((item) => item.clientId === clientId), [movies, clientId]);
  const filteredProjects = useMemo(() => projects.filter((item) => item.clientId === clientId), [projects, clientId]);
  const filteredSubProjects = useMemo(
    () => subProjects.filter((item) => item.clientId === clientId && (!projectId || item.projectId === projectId)),
    [subProjects, clientId, projectId],
  );
  return (
    <form action={action} className="card max-w-4xl space-y-5 p-6">
      <div>
        <h2 className="section-title">Upload English copy deck</h2>
        <p className="section-subtitle">The first worksheet must contain an “English Text” column.</p>
      </div>
      {state.error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</div> : null}
      {state.success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {state.message} {state.copyDeckId ? <Link className="font-semibold underline" href={`/copy-decks/${state.copyDeckId}`}>Open copy deck</Link> : null}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">Name<input className="input" name="name" required /></label>
        <label className="space-y-1 text-sm font-medium">Client
          <select className="input" name="clientId" required value={clientId} onChange={(event) => { setClientId(event.target.value); setProjectId(""); }}>
            <option value="">Select client first</option>
            {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">Title
          <select className="input" name="movieId" disabled={!clientId}><option value="">No title</option>{filteredMovies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </label>
        <label className="space-y-1 text-sm font-medium">Project
          <select className="input" name="projectId" disabled={!clientId} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">No project</option>{filteredProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">Sub-Project
          <select className="input" name="subProjectId" disabled={!clientId}><option value="">No sub-project</option>{filteredSubProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </label>
        <label className="space-y-1 text-sm font-medium">Country
          <select className="input" name="countryId" required disabled={!clientId} defaultValue={australiaId}>
            {countries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-sm font-medium">Excel file (.xlsx)
        <input className="input" type="file" name="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
      </label>
      <button className="btn-primary" disabled={pending || !clientId}>{pending ? "Generating..." : "Upload and generate"}</button>
    </form>
  );
}
