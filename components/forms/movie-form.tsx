"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import type { MovieFormState } from "@/lib/actions/movie-actions";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";

type Client = { id: string; name: string };
type Country = { id: string; name: string };
type MovieStatus = "WORKING" | "COMPLETED" | "COMPLETED_BILLED";
const SONY_CLIENT_ID = "cmn66d3q40002l104n6wvefvl";
const WARNER_CLIENT_ID = "cmn66av4j0001l104077m5vxz";
const initialState: MovieFormState = {};

const movieStatusOptions = [
  { value: "WORKING", label: "Working" },
  { value: "COMPLETED", label: "Completed" },
  { value: "COMPLETED_BILLED", label: "Completed & Billed" },
];

export function MovieForm({ clients, countries = [], action, initialValues, submitLabel, title, canEditCosts = false }: {
  clients: Client[];
  countries?: Country[];
  action: (state: MovieFormState, formData: FormData) => Promise<MovieFormState>;
  initialValues?: { id?: string; clientId: string; title: string; description: string | null; status?: MovieStatus; isActive: boolean; billingDomestic?: boolean; billingIntl?: boolean; billingOther?: boolean; billingSocial?: boolean; otherCountryIds?: string[]; billingUnits?: Record<string, number>; sonyTicketingBannerCost?: number | null; sonyEmailTicketingBannerCost?: number | null; sonyCoppaSite?: boolean; sonyGlobalEpkSite?: boolean };
  submitLabel: string;
  title: string;
  canEditCosts?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedClientId, setSelectedClientId] = useState(initialValues?.clientId ?? "");
  const [movieStatus, setMovieStatus] = useState<MovieStatus>(initialValues?.status ?? "WORKING");
  const [billingDomestic, setBillingDomestic] = useState(initialValues?.billingDomestic ?? true);
  const [billingIntl, setBillingIntl] = useState(initialValues?.billingIntl ?? false);
  const [billingOther, setBillingOther] = useState(initialValues?.billingOther ?? false);
  const [billingSocial, setBillingSocial] = useState(initialValues?.billingSocial ?? false);
  const [sonyCoppaSite, setSonyCoppaSite] = useState(initialValues?.sonyCoppaSite ?? false);
  const [sonyGlobalEpkSite, setSonyGlobalEpkSite] = useState(initialValues?.sonyGlobalEpkSite ?? false);
  const [otherCountryIds, setOtherCountryIds] = useState<string[]>(initialValues?.otherCountryIds ?? []);
  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);
  const countryOptions = useMemo(() => countries.map((country) => ({ value: country.id, label: country.name })), [countries]);
  const isSonyClient = selectedClientId === SONY_CLIENT_ID;
  const showSonyCosts = canEditCosts && isSonyClient;
  const showBillingRegion = selectedClientId === WARNER_CLIENT_ID || selectedClientId === SONY_CLIENT_ID;
  const isWarnerClient = selectedClientId === WARNER_CLIENT_ID;
  const domesticOrIntlOrSocialSelected = billingDomestic || billingIntl || billingSocial;
  const otherSelected = billingOther;

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="clientId" value={selectedClientId} />
      <input type="hidden" name="status" value={movieStatus} />
      {isSonyClient && sonyCoppaSite ? <input type="hidden" name="sonyCoppaSite" value="on" /> : null}
      {isSonyClient && sonyGlobalEpkSite ? <input type="hidden" name="sonyGlobalEpkSite" value="on" /> : null}
      {showBillingRegion ? (
        <>
          {billingDomestic ? <input type="hidden" name="billingDomestic" value="on" /> : null}
          {billingIntl ? <input type="hidden" name="billingIntl" value="on" /> : null}
          {billingOther ? <input type="hidden" name="billingOther" value="on" /> : null}
          {billingSocial ? <input type="hidden" name="billingSocial" value="on" /> : null}
          {otherCountryIds.map((id) => <input key={id} type="hidden" name="otherCountryIds" value={id} />)}
        </>
      ) : (
        <input type="hidden" name="billingDomestic" value="on" />
      )}
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">Fields marked <span className="text-red-600">*</span> are required. Title code is generated automatically.</p>
      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Title saved successfully.</div> : null}
      <div className="mt-5 space-y-4">
        <div><FormLabel htmlFor="clientId" required>Client</FormLabel><SearchableCombobox id="clientId" options={clientOptions} value={selectedClientId} onValueChange={(value) => { setSelectedClientId(value); if (value !== SONY_CLIENT_ID) { setSonyCoppaSite(false); setSonyGlobalEpkSite(false); } }} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No client found." /></div>
        <div><FormLabel htmlFor="title" required>Title title</FormLabel><input id="title" name="title" className="input" defaultValue={initialValues?.title ?? ""} required /></div>
        <div><FormLabel htmlFor="status" required>Status</FormLabel><SearchableCombobox id="status" options={movieStatusOptions} value={movieStatus} onValueChange={(value) => setMovieStatus(value as MovieStatus)} placeholder="Select status" searchPlaceholder="Search statuses..." emptyLabel="No status found." required /></div>
        {showBillingRegion ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <FormLabel required>Billing region</FormLabel>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${otherSelected ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-700"}`}><input type="checkbox" checked={billingDomestic} disabled={otherSelected} onChange={(e) => setBillingDomestic(e.target.checked)} /> Domestic (US country)</label>
              <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${otherSelected ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-700"}`}><input type="checkbox" checked={billingIntl} disabled={otherSelected} onChange={(e) => setBillingIntl(e.target.checked)} /> INTL (except US)</label>
              <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${domesticOrIntlOrSocialSelected ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-700"}`}><input type="checkbox" checked={billingOther} disabled={domesticOrIntlOrSocialSelected} onChange={(e) => setBillingOther(e.target.checked)} /> Other (choose countries)</label>
              {isWarnerClient ? <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${otherSelected ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-700"}`}><input type="checkbox" checked={billingSocial} disabled={otherSelected} onChange={(e) => setBillingSocial(e.target.checked)} /> Social</label> : null}
            </div>
            {billingOther ? <div className="mt-4"><SearchableMultiSelect id="otherCountryIds" options={countryOptions} value={otherCountryIds} onValueChange={setOtherCountryIds} placeholder="Select one or more countries" searchPlaceholder="Search countries..." emptyLabel="No country found." /></div> : null}
            <p className="mt-2 text-xs text-slate-500">Social can be combined with Domestic and/or INTL. Other cannot be combined with Domestic, INTL, or Social.</p>
          </div>
        ) : null}


        {isSonyClient ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-900">Sony Pictures Entertainment site options</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={sonyCoppaSite} onChange={(event) => setSonyCoppaSite(event.target.checked)} />
                COPPA Site
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={sonyGlobalEpkSite} onChange={(event) => setSonyGlobalEpkSite(event.target.checked)} />
                Global EPK Site
              </label>
            </div>
          </div>
        ) : null}

        {showSonyCosts ? (
          <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <div>
              <FormLabel htmlFor="sonyTicketingBannerCost">Ticketing Banner (USD)</FormLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span>
                <input id="sonyTicketingBannerCost" name="sonyTicketingBannerCost" type="number" min="0" step="0.01" className="input currency-input" defaultValue={initialValues?.sonyTicketingBannerCost ?? "0.00"} />
              </div>
            </div>
            <div>
              <FormLabel htmlFor="sonyEmailTicketingBannerCost">Email Ticketing Banner (USD)</FormLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span>
                <input id="sonyEmailTicketingBannerCost" name="sonyEmailTicketingBannerCost" type="number" min="0" step="0.01" className="input currency-input" defaultValue={initialValues?.sonyEmailTicketingBannerCost ?? "0.00"} />
              </div>
            </div>
          </div>
        ) : null}
        <div><FormLabel htmlFor="description">Description</FormLabel><textarea id="description" name="description" className="input min-h-28" defaultValue={initialValues?.description ?? ""} /></div>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} /> Active movie</label>
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </form>
  );
}
