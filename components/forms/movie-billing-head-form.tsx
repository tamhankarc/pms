"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { MovieBillingHeadFormState } from "@/lib/actions/movie-billing-head-actions";

const initialState: MovieBillingHeadFormState = {};
type Client = { id: string; name: string };
type CompulsionType = "FIXED_COMPULSORY" | "FIXED_OPTIONAL";
type CostType = "WHOLE_COST" | "PER_UNIT_COST";

const headTypeOptions = [
  { value: "FIXED_COMPULSORY", label: "Fixed - Compulsory" },
  { value: "FIXED_OPTIONAL", label: "Fixed - Optional" },
];

const costTypeOptions = [
  { value: "WHOLE_COST", label: "Whole cost" },
  { value: "PER_UNIT_COST", label: "Per-unit cost" },
];

export function MovieBillingHeadForm({ clients, action, initialValues, submitLabel, title }: {
  clients: Client[];
  action: (state: MovieBillingHeadFormState, formData: FormData) => Promise<MovieBillingHeadFormState>;
  initialValues?: {
    id?: string;
    clientId: string;
    name: string;
    compulsionType?: CompulsionType;
    domesticCompulsionType?: CompulsionType;
    intlCompulsionType?: CompulsionType;
    costType: CostType;
    domesticCost: string | number;
    intlCost: string | number;
    isActive: boolean;
  };
  submitLabel: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [clientId, setClientId] = useState(initialValues?.clientId ?? "");
  const [domesticCompulsionType, setDomesticCompulsionType] = useState<CompulsionType>(initialValues?.domesticCompulsionType ?? initialValues?.compulsionType ?? "FIXED_COMPULSORY");
  const [intlCompulsionType, setIntlCompulsionType] = useState<CompulsionType>(initialValues?.intlCompulsionType ?? initialValues?.compulsionType ?? "FIXED_COMPULSORY");
  const [costType, setCostType] = useState<CostType>(initialValues?.costType ?? "WHOLE_COST");
  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="domesticCompulsionType" value={domesticCompulsionType} />
      <input type="hidden" name="intlCompulsionType" value={intlCompulsionType} />
      <input type="hidden" name="compulsionType" value={domesticCompulsionType} />
      <input type="hidden" name="costType" value={costType} />
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">Fields marked <span className="text-red-600">*</span> are required. Costs are in USD.</p>
      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Billing head saved successfully.</div> : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2"><FormLabel htmlFor="clientId" required>Client</FormLabel><SearchableCombobox id="clientId" value={clientId} onValueChange={setClientId} options={clientOptions} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No client found." required /></div>
        <div className="md:col-span-2"><FormLabel htmlFor="name" required>Billing head name</FormLabel><input id="name" name="name" className="input" defaultValue={initialValues?.name ?? ""} required /></div>
        <div className="md:col-span-2"><FormLabel htmlFor="costType" required>Cost type</FormLabel><SearchableCombobox id="costType" value={costType} onValueChange={(v) => setCostType(v as CostType)} options={costTypeOptions} placeholder="Select cost type" searchPlaceholder="Search cost types..." emptyLabel="No cost type found." required /></div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Domestic billing</h3>
          <p className="mt-1 text-xs text-slate-500">Head type and cost used for US country billing.</p>
          <div className="mt-4 space-y-4">
            <div><FormLabel htmlFor="domesticCompulsionType" required>Head type - Domestic</FormLabel><SearchableCombobox id="domesticCompulsionType" value={domesticCompulsionType} onValueChange={(v) => setDomesticCompulsionType(v as CompulsionType)} options={headTypeOptions} placeholder="Select domestic type" searchPlaceholder="Search types..." emptyLabel="No type found." required /></div>
            <div><FormLabel htmlFor="domesticCost" required>Domestic cost (USD)</FormLabel><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span><input id="domesticCost" name="domesticCost" type="number" min="0" step="0.01" className="input currency-input" defaultValue={initialValues?.domesticCost ?? "0.00"} required /></div></div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">INTL billing</h3>
          <p className="mt-1 text-xs text-slate-500">Head type and cost used for all non-US country billing.</p>
          <div className="mt-4 space-y-4">
            <div><FormLabel htmlFor="intlCompulsionType" required>Head type - INTL</FormLabel><SearchableCombobox id="intlCompulsionType" value={intlCompulsionType} onValueChange={(v) => setIntlCompulsionType(v as CompulsionType)} options={headTypeOptions} placeholder="Select INTL type" searchPlaceholder="Search types..." emptyLabel="No type found." required /></div>
            <div><FormLabel htmlFor="intlCost" required>INTL cost (USD)</FormLabel><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span><input id="intlCost" name="intlCost" type="number" min="0" step="0.01" className="input currency-input" defaultValue={initialValues?.intlCost ?? "0.00"} required /></div></div>
          </div>
        </div>

        <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} /> Active billing head</label>
        <div className="md:col-span-2"><button className="btn-primary w-full md:w-auto" disabled={pending}>{pending ? "Saving..." : submitLabel}</button></div>
      </div>
    </form>
  );
}
