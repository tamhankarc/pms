"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { ContactPersonFormState } from "@/lib/actions/contact-person-actions";

const initialState: ContactPersonFormState = {};

type Client = { id: string; name: string; showMoviesInEntries: boolean };
type Project = { id: string; name: string; clientId: string; clientName?: string };
type Movie = { id: string; title: string; clientId: string; clientName?: string };
type AssignmentMode = "project" | "movie";

export function ContactPersonForm({ clients, projects, movies, action, initialValues, submitLabel, title }: {
  clients: Client[];
  projects: Project[];
  movies: Movie[];
  action: (state: ContactPersonFormState, formData: FormData) => Promise<ContactPersonFormState>;
  initialValues?: { id?: string; clientId: string; projectId: string | null; movieId: string | null; name: string; email: string; contactNumber: string | null; };
  submitLabel: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const initialMode: AssignmentMode = initialValues?.movieId ? "movie" : "project";
  const [selectedClientId, setSelectedClientId] = useState(initialValues?.clientId ?? "");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(initialMode);
  const [selectedProjectId, setSelectedProjectId] = useState(initialValues?.projectId ?? "");
  const [selectedMovieId, setSelectedMovieId] = useState(initialValues?.movieId ?? "");

  const selectedClient = useMemo(() => clients.find((client) => client.id === selectedClientId), [clients, selectedClientId]);
  const canAssignByMovie = Boolean(selectedClient?.showMoviesInEntries);
  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);
  const projectOptions = useMemo(
    () => projects
      .filter((project) => !selectedClientId || project.clientId === selectedClientId)
      .map((project) => ({ value: project.id, label: project.name, keywords: project.clientName ?? "" })),
    [projects, selectedClientId],
  );
  const movieOptions = useMemo(
    () => movies
      .filter((movie) => !selectedClientId || movie.clientId === selectedClientId)
      .map((movie) => ({ value: movie.id, label: movie.title, keywords: movie.clientName ?? "" })),
    [movies, selectedClientId],
  );

  function handleClientChange(nextClientId: string) {
    setSelectedClientId(nextClientId);
    const nextClient = clients.find((client) => client.id === nextClientId);
    const currentProject = projects.find((project) => project.id === selectedProjectId);
    const currentMovie = movies.find((movie) => movie.id === selectedMovieId);

    if (!currentProject || currentProject.clientId !== nextClientId) setSelectedProjectId("");
    if (!currentMovie || currentMovie.clientId !== nextClientId) setSelectedMovieId("");
    if (!nextClient?.showMoviesInEntries) {
      setAssignmentMode("project");
      setSelectedMovieId("");
    }
  }

  function handleModeChange(nextMode: AssignmentMode) {
    setAssignmentMode(nextMode);
    if (nextMode === "project") setSelectedMovieId("");
    if (nextMode === "movie") setSelectedProjectId("");
  }

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="clientId" value={selectedClientId} />
      <input type="hidden" name="assignmentMode" value={assignmentMode} />
      <input type="hidden" name="projectId" value={assignmentMode === "project" ? selectedProjectId : ""} />
      <input type="hidden" name="movieId" value={assignmentMode === "movie" ? selectedMovieId : ""} />

      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">Fields marked <span className="text-red-600">*</span> are required. Contact Persons can be project-specific, or movie-specific for clients with Movie dropdown enabled.</p>

      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Contact Person saved successfully.</div> : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="clientId" required>Client</FormLabel>
          <SearchableCombobox id="clientId" options={clientOptions} value={selectedClientId} onValueChange={handleClientChange} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No client found." />
        </div>

        {canAssignByMovie ? (
          <div>
            <FormLabel htmlFor="assignmentMode" required>Assign Contact Person</FormLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${assignmentMode === "project" ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 bg-white text-slate-700"}`}>
                <input type="radio" className="h-4 w-4" checked={assignmentMode === "project"} onChange={() => handleModeChange("project")} />
                <span className="font-medium">By Project</span>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${assignmentMode === "movie" ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 bg-white text-slate-700"}`}>
                <input type="radio" className="h-4 w-4" checked={assignmentMode === "movie"} onChange={() => handleModeChange("movie")} />
                <span className="font-medium">By Movie</span>
              </label>
            </div>
          </div>
        ) : null}

        {assignmentMode === "movie" && canAssignByMovie ? (
          <div>
            <FormLabel htmlFor="movieId" required>Movie</FormLabel>
            <SearchableCombobox id="movieId" options={movieOptions} value={selectedMovieId} onValueChange={setSelectedMovieId} placeholder={selectedClientId ? "Select movie" : "Select client first"} searchPlaceholder="Search movies..." emptyLabel="No movie found." disabled={!selectedClientId} />
          </div>
        ) : (
          <div>
            <FormLabel htmlFor="projectId" required>Project</FormLabel>
            <SearchableCombobox id="projectId" options={projectOptions} value={selectedProjectId} onValueChange={setSelectedProjectId} placeholder={selectedClientId ? "Select project" : "Select client first"} searchPlaceholder="Search projects..." emptyLabel="No project found." disabled={!selectedClientId} />
          </div>
        )}

        <div>
          <FormLabel htmlFor="name" required>Name</FormLabel>
          <input id="name" name="name" className="input" defaultValue={initialValues?.name ?? ""} required />
        </div>

        <div>
          <FormLabel htmlFor="email" required>Email</FormLabel>
          <input id="email" name="email" type="email" className="input" defaultValue={initialValues?.email ?? ""} required />
        </div>

        <div>
          <FormLabel htmlFor="contactNumber">Contact Number</FormLabel>
          <input id="contactNumber" name="contactNumber" className="input" defaultValue={initialValues?.contactNumber ?? ""} />
        </div>

        <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </form>
  );
}
