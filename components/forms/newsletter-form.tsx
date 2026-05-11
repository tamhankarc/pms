"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { NewsletterFormState } from "@/lib/actions/newsletter-actions";

const SONY_PICTURES_CLIENT_ID = "cmn66d3q40002l104n6wvefvl";
const initialState: NewsletterFormState = {};

type Client = { id: string; name: string; showNewslettersInEntries: boolean };
type NewsletterType = "ISG" | "AFFIRM" | "HOME";

export function NewsletterForm({ clients, action, initialValues, title, submitLabel }: {
  clients: Client[];
  action: (state: NewsletterFormState, formData: FormData) => Promise<NewsletterFormState>;
  initialValues?: { id?: string; clientId: string; name: string; newsletterType?: NewsletterType | null; isActive: boolean };
  title: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedClientId, setSelectedClientId] = useState(initialValues?.clientId ?? clients[0]?.id ?? "");
  const [newsletterType, setNewsletterType] = useState<NewsletterType | "">(initialValues?.newsletterType ?? "");
  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);
  const showNewsletterType = selectedClientId === SONY_PICTURES_CLIENT_ID;

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="clientId" value={selectedClientId} />
      {showNewsletterType && newsletterType ? <input type="hidden" name="newsletterType" value={newsletterType} /> : null}
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">Fields marked <span className="text-red-600">*</span> are required.</p>
      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Newsletter saved successfully.</div> : null}
      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="clientId" required>Client</FormLabel>
          <SearchableCombobox id="clientId" value={selectedClientId} onValueChange={(value) => { setSelectedClientId(value); setNewsletterType(""); }} options={clientOptions} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No client found." required />
        </div>
        <div>
          <FormLabel htmlFor="name" required>Newsletter name</FormLabel>
          <input id="name" name="name" className="input" defaultValue={initialValues?.name ?? ""} required />
        </div>
        {showNewsletterType ? (
          <div>
            <FormLabel htmlFor="newsletterType" required>Newsletter Type</FormLabel>
            <SearchableCombobox id="newsletterType" value={newsletterType} onValueChange={(value) => setNewsletterType(value as NewsletterType)} options={[{ value: "ISG", label: "ISG" }, { value: "AFFIRM", label: "Affirm" }, { value: "HOME", label: "HOME" }]} placeholder="Select newsletter type" searchPlaceholder="Search types..." emptyLabel="No type found." required />
          </div>
        ) : null}
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} />
          Active Newsletter
        </label>
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </form>
  );
}
