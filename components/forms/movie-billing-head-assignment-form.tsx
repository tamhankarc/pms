"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import type { MovieBillingHeadAssignmentFormState } from "@/lib/actions/movie-billing-head-assignment-actions";

const initialState: MovieBillingHeadAssignmentFormState = {};

type Client = { id: string; name: string };
type Country = { id: string; name: string; isoCode: string | null };
type Movie = {
  id: string;
  clientId: string;
  title: string;
  billingDomestic: boolean;
  billingIntl: boolean;
  billingOther: boolean;
};
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
  countryIds?: string[];
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

function headDomesticOptional(head: BillingHead) {
  return head.domesticActive && head.domesticCompulsionType === "FIXED_OPTIONAL";
}

function headIntlOptional(head: BillingHead) {
  return head.intlActive && head.intlCompulsionType === "FIXED_OPTIONAL";
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
  canEditCosts = false,
}: {
  clients: Client[];
  countries: Country[];
  movies: Movie[];
  billingHeads: BillingHead[];
  action: (state: MovieBillingHeadAssignmentFormState, formData: FormData) => Promise<MovieBillingHeadAssignmentFormState>;
  initialValues?: InitialValues;
  submitLabel: string;
  title: string;
  canEditCosts?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [clientId, setClientId] = useState(initialValues?.clientId ?? "");
  const [movieId, setMovieId] = useState(initialValues?.movieId ?? "");
  const [billingHeadId, setBillingHeadId] = useState(initialValues?.billingHeadId ?? "");
  const [countryIds, setCountryIds] = useState<string[]>(initialValues?.countryIds ?? (initialValues?.countryId ? [initialValues.countryId] : []));
  const [useDomestic, setUseDomestic] = useState(() => {
    const initialCountry = countries.find((country) => country.id === initialValues?.countryId);
    return isDomesticCountry(initialCountry);
  });

  const usCountry = countries.find(isDomesticCountry);
  const selectedMovie = movies.find((movie) => movie.id === movieId);
  const selectedBillingHead = billingHeads.find((head) => head.id === billingHeadId);
  const selectedHeadDomestic = selectedBillingHead ? headDomesticOptional(selectedBillingHead) : false;
  const selectedHeadIntl = selectedBillingHead ? headIntlOptional(selectedBillingHead) : false;
  const selectedMovieAllowsDomestic = Boolean(selectedMovie?.billingDomestic);
  const selectedMovieAllowsIntl = Boolean(selectedMovie?.billingIntl || selectedMovie?.billingOther);
  const selectedHeadAvailableForBoth = selectedHeadDomestic && selectedHeadIntl && selectedMovieAllowsDomestic && selectedMovieAllowsIntl;
  const selectedHeadDomesticOnly = selectedHeadDomestic && !selectedHeadIntl;
  const selectedHeadIntlOnly = !selectedHeadDomestic && selectedHeadIntl;
  const forceDomestic = Boolean(selectedBillingHead && selectedHeadDomestic && !selectedMovieAllowsIntl);
  const showDomesticCheckbox = Boolean(selectedBillingHead && selectedHeadAvailableForBoth);
  const countrySelectEnabled = Boolean(billingHeadId && selectedHeadIntl && !useDomestic && !forceDomestic);
  const effectiveCountryIds = forceDomestic || useDomestic || selectedHeadDomesticOnly ? (usCountry ? [usCountry.id] : []) : countryIds;

  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);
  const countryOptions = useMemo(
    () => countries
      .filter((country) => !isDomesticCountry(country))
      .map((country) => ({ value: country.id, label: country.isoCode ? `${country.name} (${country.isoCode})` : country.name })),
    [countries],
  );

  const movieOptions = useMemo(
    () => movies.filter((movie) => movie.clientId === clientId).map((movie) => ({ value: movie.id, label: movie.title })),
    [movies, clientId],
  );

  const billingHeadOptions = useMemo(
    () => billingHeads
      .filter((head) => {
        if (head.clientId !== clientId || !selectedMovie) return false;
        const domesticValid = selectedMovie.billingDomestic && headDomesticOptional(head);
        const intlValid = (selectedMovie.billingIntl || selectedMovie.billingOther) && headIntlOptional(head);
        return domesticValid || intlValid;
      })
      .map((head) => ({ value: head.id, label: canEditCosts ? `${head.name} · ${head.costType === "PER_UNIT_COST" ? "Per-unit" : "Whole cost"}` : head.name })),
    [billingHeads, canEditCosts, clientId, selectedMovie],
  );

  function handleClientChange(value: string) {
    setClientId(value);
    setMovieId("");
    setBillingHeadId("");
    setCountryIds([]);
    setUseDomestic(false);
  }

  function handleMovieChange(value: string) {
    setMovieId(value);
    setBillingHeadId("");
    setCountryIds([]);
    setUseDomestic(false);
  }

  function handleBillingHeadChange(value: string) {
    const nextHead = billingHeads.find((head) => head.id === value);
    setBillingHeadId(value);
    setCountryIds([]);
    setUseDomestic(Boolean(nextHead && headDomesticOptional(nextHead) && !headIntlOptional(nextHead)));
  }

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="movieId" value={movieId} />
      <input type="hidden" name="billingHeadId" value={billingHeadId} />
      {effectiveCountryIds.map((id) => <input key={id} type="hidden" name="countryIds" value={id} />)}
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">Select Client and Movie first. Billing Head is filtered by the selected movie&apos;s billing region. Country becomes available after Billing Head is selected.</p>
      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Movie billing head saved successfully.</div> : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <FormLabel htmlFor="clientId" required>Client</FormLabel>
          <SearchableCombobox id="clientId" value={clientId} onValueChange={handleClientChange} options={clientOptions} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No client found." required />
        </div>
        <div className={!clientId ? "opacity-60" : ""}>
          <FormLabel htmlFor="movieId" required>Movie</FormLabel>
          <SearchableCombobox id="movieId" value={movieId} onValueChange={handleMovieChange} options={movieOptions} placeholder={clientId ? "Select Working movie" : "Select client first"} searchPlaceholder="Search movies..." emptyLabel="No Working movies found." disabled={!clientId} required />
        </div>
        <div className={!movieId ? "opacity-60" : ""}>
          <FormLabel htmlFor="billingHeadId" required>Billing Head</FormLabel>
          <SearchableCombobox id="billingHeadId" value={billingHeadId} onValueChange={handleBillingHeadChange} options={billingHeadOptions} placeholder={movieId ? "Select Fixed - Optional billing head" : "Select client and movie first"} searchPlaceholder="Search billing heads..." emptyLabel="No valid Fixed - Optional heads found." disabled={!movieId} required />
        </div>
        <div className={!billingHeadId ? "opacity-60" : ""}>
          <FormLabel htmlFor="countryIds" required>Country</FormLabel>
          {selectedBillingHead && (forceDomestic || selectedHeadDomesticOnly) ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">US country is selected automatically for this Domestic-only billing head.</div>
          ) : showDomesticCheckbox ? (
            <div className="space-y-3">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={useDomestic} onChange={(event) => { setUseDomestic(event.target.checked); setCountryIds([]); }} />
                Domestic
              </label>
              {!useDomestic ? <SearchableMultiSelect id="countryIds" value={countryIds} onValueChange={setCountryIds} options={countryOptions} placeholder="Select one or more countries" searchPlaceholder="Search countries..." emptyLabel="No countries found." disabled={!countrySelectEnabled} /> : <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">US country will be selected in background.</div>}
            </div>
          ) : selectedHeadIntlOnly || selectedHeadIntl ? (
            <SearchableMultiSelect id="countryIds" value={countryIds} onValueChange={setCountryIds} options={countryOptions} placeholder={billingHeadId ? "Select one or more countries" : "Select billing head first"} searchPlaceholder="Search countries..." emptyLabel="No countries found." disabled={!countrySelectEnabled} required />
          ) : (
            <SearchableMultiSelect id="countryIds" value={countryIds} onValueChange={setCountryIds} options={countryOptions} placeholder="Select billing head first" disabled />
          )}
        </div>
        {canEditCosts && selectedBillingHead?.costType === "PER_UNIT_COST" ? (
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
