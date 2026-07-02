"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { createCopyDeckAction, type CopyDeckActionState } from "@/lib/actions/copy-deck-actions";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { FormLabel } from "@/components/ui/form-label";

type Option = { id: string; name: string; clientId?: string; projectId?: string };

export function CopyDeckUploadForm({
  clients, movies, projects, subProjects, markets, australiaMarketId, translationStatus,
}: {
  clients: Option[];
  movies: Option[];
  projects: Option[];
  subProjects: Option[];
  markets: Option[];
  australiaMarketId: string;
  translationStatus: { configured: boolean; label: string };
}) {
  const [state, action, pending] = useActionState<CopyDeckActionState, FormData>(createCopyDeckAction, {});
  const [clientId, setClientId] = useState("");
  const [movieId, setMovieId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [subProjectId, setSubProjectId] = useState("");
  const [marketIds, setMarketIds] = useState([australiaMarketId]);
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
      <div className={`rounded-xl border p-3 text-sm ${translationStatus.configured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        {translationStatus.label}
      </div>
      {state.success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {state.message} {state.copyDeckId ? <Link className="font-semibold underline" href={`/copy-decks/${state.copyDeckId}`}>Open copy deck</Link> : null}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div><FormLabel htmlFor="name" required>Name</FormLabel><input id="name" className="input" name="name" required /></div>
        <div><FormLabel htmlFor="copyDeckClientId" required>Client</FormLabel>
          <SearchableCombobox id="copyDeckClientId" name="clientId" required value={clientId} onValueChange={(value) => { setClientId(value); setMovieId(""); setProjectId(""); setSubProjectId(""); }} options={clients.map((item) => ({ value: item.id, label: item.name }))} placeholder="Select client first" searchPlaceholder="Search clients..." emptyLabel="No clients found." />
        </div>
        <div><FormLabel htmlFor="copyDeckMovieId">Title</FormLabel>
          <SearchableCombobox id="copyDeckMovieId" name="movieId" disabled={!clientId} value={movieId} onValueChange={setMovieId} options={[{ value: "", label: "No title" }, ...filteredMovies.map((item) => ({ value: item.id, label: item.name }))]} placeholder="No title" searchPlaceholder="Search titles..." emptyLabel="No titles found." />
        </div>
        <div><FormLabel htmlFor="copyDeckProjectId">Project</FormLabel>
          <SearchableCombobox id="copyDeckProjectId" name="projectId" disabled={!clientId} value={projectId} onValueChange={(value) => { setProjectId(value); setSubProjectId(""); }} options={[{ value: "", label: "No project" }, ...filteredProjects.map((item) => ({ value: item.id, label: item.name }))]} placeholder="No project" searchPlaceholder="Search projects..." emptyLabel="No projects found." />
        </div>
        <div><FormLabel htmlFor="copyDeckSubProjectId">Sub-Project</FormLabel>
          <SearchableCombobox id="copyDeckSubProjectId" name="subProjectId" disabled={!clientId} value={subProjectId} onValueChange={setSubProjectId} options={[{ value: "", label: "No sub-project" }, ...filteredSubProjects.map((item) => ({ value: item.id, label: item.name }))]} placeholder="No sub-project" searchPlaceholder="Search sub-projects..." emptyLabel="No sub-projects found." />
        </div>
        <div><FormLabel htmlFor="copyDeckMarketIds" required>Markets</FormLabel>
          <SearchableMultiSelect id="copyDeckMarketIds" name="marketIds" required disabled={!clientId} value={marketIds} onValueChange={setMarketIds} options={markets.map((item) => ({ value: item.id, label: item.name }))} placeholder="Select one or more markets" searchPlaceholder="Search markets..." emptyLabel="No markets found." />
        </div>
      </div>
      <label className="block space-y-1 text-sm font-medium">Excel file (.xlsx)
        <input className="input" type="file" name="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
      </label>
      <button className="btn-primary" disabled={pending || !clientId || marketIds.length === 0}>{pending ? "Generating..." : "Upload and generate"}</button>
    </form>
  );
}
