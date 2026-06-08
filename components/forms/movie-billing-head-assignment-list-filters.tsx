"use client";


import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { useMemo, useRef, useState } from "react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type Client = { id: string; name: string };
type Title = { id: string; clientId: string; title: string };

export function MovieBillingHeadAssignmentListFilters({
  q,
  clientId,
  movieId,
  status,
  clients,
  movies,
}: {
  q: string;
  clientId: string;
  movieId: string;
  status: string;
  clients: Client[];
  movies: Title[];
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [selectedClientId, setSelectedClientId] = useState(clientId);
  const [selectedMovieId, setSelectedMovieId] = useState(movieId);
  const [selectedStatus, setSelectedStatus] = useState(status);

  const movieOptions = useMemo(() => {
    const filtered = selectedClientId === "all" ? movies : movies.filter((movie) => movie.clientId === selectedClientId);
    return [{ value: "all", label: "All titles" }, ...filtered.map((movie) => ({ value: movie.id, label: movie.title }))];
  }, [movies, selectedClientId]);

  function submitSoon() {
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  return (
    <AutoSubmitFilterForm ref={formRef} className="grid gap-3 md:grid-cols-[1fr_220px_220px_180px_auto]" method="get">
      <input className="input" name="q" defaultValue={q} placeholder="Search by client, title, or billing head" />
      <input type="hidden" name="clientId" value={selectedClientId} />
      <input type="hidden" name="movieId" value={selectedMovieId} />
      <input type="hidden" name="status" value={selectedStatus} />
      <SearchableCombobox
        id="clientId"
        value={selectedClientId}
        onValueChange={(value) => {
          setSelectedClientId(value);
          setSelectedMovieId("all");
          submitSoon();
        }}
        options={[{ value: "all", label: "All clients" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]}
        placeholder="All clients"
        searchPlaceholder="Search clients..."
        emptyLabel="No client found."
      />
      <SearchableCombobox
        id="movieId"
        value={selectedMovieId}
        onValueChange={(value) => {
          setSelectedMovieId(value);
          submitSoon();
        }}
        options={movieOptions}
        placeholder="All titles"
        searchPlaceholder="Search titles..."
        emptyLabel="No title found."
      />
      <SearchableCombobox
        id="status"
        value={selectedStatus}
        onValueChange={(value) => {
          setSelectedStatus(value);
          submitSoon();
        }}
        options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active only" }, { value: "inactive", label: "Inactive only" }]}
        placeholder="All statuses"
        searchPlaceholder="Search statuses..."
        emptyLabel="No status found."
      />
    </AutoSubmitFilterForm>
  );
}
