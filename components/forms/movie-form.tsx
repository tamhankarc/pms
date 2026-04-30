"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import type { MovieFormState } from "@/lib/actions/movie-actions";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";

type Client = { id: string; name: string };
type Country = { id: string; name: string };
type MovieStatus = "WORKING" | "COMPLETED" | "COMPLETED_BILLED";
type BillingHead = { id: string; name: string; clientId: string; costType: "WHOLE_COST" | "PER_UNIT_COST" };
const initialState: MovieFormState = {};

const movieStatusOptions = [
  { value: "WORKING", label: "Working" },
  { value: "COMPLETED", label: "Completed" },
  { value: "COMPLETED_BILLED", label: "Completed & Billed" },
];

export function MovieForm({ clients, countries = [], billingHeads = [], action, initialValues, submitLabel, title }: {
  clients: Client[];
  countries?: Country[];
  billingHeads?: BillingHead[];
  action: (state: MovieFormState, formData: FormData) => Promise<MovieFormState>;
  initialValues?: { id?: string; clientId: string; title: string; description: string | null; status?: MovieStatus; isActive: boolean; billingDomestic?: boolean; billingIntl?: boolean; billingOther?: boolean; otherCountryIds?: string[]; billingUnits?: Record<string, number> };
  submitLabel: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedClientId, setSelectedClientId] = useState(initialValues?.clientId ?? "");
  const [movieStatus, setMovieStatus] = useState<MovieStatus>(initialValues?.status ?? "WORKING");
  const [billingDomestic, setBillingDomestic] = useState(initialValues?.billingDomestic ?? true);
  const [billingIntl, setBillingIntl] = useState(initialValues?.billingIntl ?? false);
  const [billingOther, setBillingOther] = useState(initialValues?.billingOther ?? false);
  const [otherCountryIds, setOtherCountryIds] = useState<string[]>(initialValues?.otherCountryIds ?? []);
  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);
  const countryOptions = useMemo(() => countries.map((country) => ({ value: country.id, label: country.name })), [countries]);
  const perUnitHeads = useMemo(() => billingHeads.filter((head) => head.clientId === selectedClientId && head.costType === "PER_UNIT_COST"), [billingHeads, selectedClientId]);
  const domesticOrIntlSelected = billingDomestic || billingIntl;
  const otherSelected = billingOther;

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="clientId" value={selectedClientId} />
      <input type="hidden" name="status" value={movieStatus} />
      {billingDomestic ? <input type="hidden" name="billingDomestic" value="on" /> : null}
      {billingIntl ? <input type="hidden" name="billingIntl" value="on" /> : null}
      {billingOther ? <input type="hidden" name="billingOther" value="on" /> : null}
      {otherCountryIds.map((id) => <input key={id} type="hidden" name="otherCountryIds" value={id} />)}
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">Fields marked <span className="text-red-600">*</span> are required. Movie code is generated automatically.</p>
      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Movie saved successfully.</div> : null}
      <div className="mt-5 space-y-4">
        <div><FormLabel htmlFor="clientId" required>Client</FormLabel><SearchableCombobox id="clientId" options={clientOptions} value={selectedClientId} onValueChange={(value) => { setSelectedClientId(value); }} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No client found." /></div>
        <div><FormLabel htmlFor="title" required>Movie title</FormLabel><input id="title" name="title" className="input" defaultValue={initialValues?.title ?? ""} required /></div>
        <div><FormLabel htmlFor="status" required>Status</FormLabel><SearchableCombobox id="status" options={movieStatusOptions} value={movieStatus} onValueChange={(value) => setMovieStatus(value as MovieStatus)} placeholder="Select status" searchPlaceholder="Search statuses..." emptyLabel="No status found." required /></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <FormLabel required>Billing region</FormLabel>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${otherSelected ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-700"}`}><input type="checkbox" checked={billingDomestic} disabled={otherSelected} onChange={(e) => setBillingDomestic(e.target.checked)} /> Domestic (US country)</label>
            <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${otherSelected ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-700"}`}><input type="checkbox" checked={billingIntl} disabled={otherSelected} onChange={(e) => setBillingIntl(e.target.checked)} /> INTL (except US)</label>
            <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${domesticOrIntlSelected ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-700"}`}><input type="checkbox" checked={billingOther} disabled={domesticOrIntlSelected} onChange={(e) => setBillingOther(e.target.checked)} /> Other (choose countries)</label>
          </div>
          {billingOther ? <div className="mt-4"><SearchableMultiSelect id="otherCountryIds" options={countryOptions} value={otherCountryIds} onValueChange={setOtherCountryIds} placeholder="Select one or more countries" searchPlaceholder="Search countries..." emptyLabel="No country found." /></div> : null}
          <p className="mt-2 text-xs text-slate-500">Domestic/INTL and Other are mutually exclusive for billing reports.</p>
        </div>
        {perUnitHeads.length > 0 ? <div className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-sm font-semibold text-slate-900">Per-unit billing head units</h3><p className="mt-1 text-xs text-slate-500">Optional number of units for per-unit cost billing heads.</p><div className="mt-3 grid gap-3 md:grid-cols-2">{perUnitHeads.map((head) => (<div key={head.id}><FormLabel htmlFor={`billingHeadUnit_${head.id}`}>{head.name} units</FormLabel><input id={`billingHeadUnit_${head.id}`} name={`billingHeadUnit_${head.id}`} type="number" min="0" step="1" className="input" defaultValue={initialValues?.billingUnits?.[head.id] ?? ""} /></div>))}</div></div> : null}
        <div><FormLabel htmlFor="description">Description</FormLabel><textarea id="description" name="description" className="input min-h-28" defaultValue={initialValues?.description ?? ""} /></div>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} /> Active movie</label>
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </form>
  );
}
