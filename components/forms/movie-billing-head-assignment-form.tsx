"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { MovieBillingHeadAssignmentFormState } from "@/lib/actions/movie-billing-head-assignment-actions";

const initialState: MovieBillingHeadAssignmentFormState = {};

type Client = { id: string; name: string };
type Country = { id: string; name: string; isoCode: string | null };
type Movie = { id: string; clientId: string; title: string };
type BillingHead = {
  id: string;
  clientId: string;
  name: string;
  costType: "WHOLE_COST" | "PER_UNIT_COST";
  domesticActive: boolean;
  intlActive: boolean;
  domesticCompulsionType: "FIXED_COMPULSORY" | "FIXED_OPTIONAL";
  intlCompulsionType: "FIXED_COMPULSORY" | "FIXED_OPTIONAL";
};

type InitialValues = {
  id?: string;
  clientId: string;
  countryId: string;
  movieId: string;
  billingHeadId: string;
  units?: string | number | null;
  isActive: boolean;
};

function isDomesticCountry(country?: Country) {
  if (!country) return false;
  const iso = (country.isoCode ?? "").toUpperCase();
  const name = country.name.trim().toLowerCase();
  return iso === "US" || name === "united states" || name === "usa";
}

export function MovieBillingHeadAssignmentForm({
  clients,
  countries,
  movies,
  billingHeads,
  action,
  initialValues,
  submitLabel,
  title,
}: {
  clients: Client[];
  countries: Country[];
  movies: Movie[];
  billingHeads: BillingHead[];
  action: (state: MovieBillingHeadAssignmentFormState, formData: FormData) => Promise<MovieBillingHeadAssignmentFormState>;
  initialValues?: InitialValues;
  submitLabel: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [clientId, setClientId] = useState(initialValues?.clientId ?? "");
  const [countryId, setCountryId] = useState(initialValues?.countryId ?? "");
  const [movieId, setMovieId] = useState(initialValues?.movieId ?? "");
  const [billingHeadId, setBillingHeadId] = useState(initialValues?.billingHeadId ?? "");

  const selectedCountry = countries.find((country) => country.id === countryId);
  const domesticCountry = isDomesticCountry(selectedCountry);

  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);
  const countryOptions = useMemo(() => countries.map((country) => ({ value: country.id, label: country.isoCode ? `${country.name} (${country.isoCode})` : country.name })), [countries]);

  const movieOptions = useMemo(
    () => movies.filter((movie) => movie.clientId === clientId).map((movie) => ({ value: movie.id, label: movie.title })),
    [movies, clientId],
  );

  const billingHeadOptions = useMemo(
    () => billingHeads
      .filter((head) => {
        if (head.clientId !== clientId) return false;
        if (!countryId) return false;
        return domesticCountry
          ? head.domesticActive && head.domesticCompulsionType === "FIXED_OPTIONAL"
          : head.intlActive && head.intlCompulsionType === "FIXED_OPTIONAL";
      })
      .map((head) => ({ value: head.id, label: `${head.name} · ${head.costType === "PER_UNIT_COST" ? "Per-unit" : "Whole cost"}` })),
    [billingHeads, clientId, countryId, domesticCountry],
  );

  const selectedBillingHead = billingHeads.find((head) => head.id === billingHeadId);
  const selectorsReady = Boolean(clientId && countryId);

  function handleClientChange(value: string) {
    setClientId(value);
    setMovieId("");
    setBillingHeadId("");
  }

  function handleCountryChange(value: string) {
    setCountryId(value);
    setBillingHeadId("");
  }

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="countryId" value={countryId} />
      <input type="hidden" name="movieId" value={movieId} />
      <input type="hidden" name="billingHeadId" value={billingHeadId} />
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">Select a client and country first. Movie and billing head are enabled only after both are selected.</p>
      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Movie billing head saved successfully.</div> : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <FormLabel htmlFor="clientId" required>Client</FormLabel>
          <SearchableCombobox id="clientId" value={clientId} onValueChange={handleClientChange} options={clientOptions} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No client found." required />
        </div>
        <div>
          <FormLabel htmlFor="countryId" required>Country</FormLabel>
          <SearchableCombobox id="countryId" value={countryId} onValueChange={handleCountryChange} options={countryOptions} placeholder="Select country" searchPlaceholder="Search countries..." emptyLabel="No country found." required />
        </div>
        <div className={!selectorsReady ? "opacity-60" : ""}>
          <FormLabel htmlFor="movieId" required>Movie</FormLabel>
          <SearchableCombobox id="movieId" value={movieId} onValueChange={setMovieId} options={movieOptions} placeholder={selectorsReady ? "Select Working movie" : "Select client and country first"} searchPlaceholder="Search movies..." emptyLabel="No Working movies found." disabled={!selectorsReady} required />
        </div>
        <div className={!selectorsReady ? "opacity-60" : ""}>
          <FormLabel htmlFor="billingHeadId" required>Billing Head</FormLabel>
          <SearchableCombobox id="billingHeadId" value={billingHeadId} onValueChange={setBillingHeadId} options={billingHeadOptions} placeholder={selectorsReady ? "Select Fixed - Optional billing head" : "Select client and country first"} searchPlaceholder="Search billing heads..." emptyLabel="No valid Fixed - Optional heads found." disabled={!selectorsReady} required />
        </div>
        {selectedBillingHead?.costType === "PER_UNIT_COST" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="units">Number of units</FormLabel>
            <input id="units" name="units" type="number" min="0" step="1" className="input" defaultValue={initialValues?.units ?? ""} />
          </div>
        ) : null}
        <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} /> Active movie billing head</label>
        <div className="md:col-span-2"><button className="btn-primary w-full md:w-auto" disabled={pending}>{pending ? "Saving..." : submitLabel}</button></div>
      </div>
    </form>
  );
}
