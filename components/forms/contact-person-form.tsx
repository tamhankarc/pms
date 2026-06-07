"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { ContactPersonFormState } from "@/lib/actions/contact-person-actions";

const initialState: ContactPersonFormState = {};
type Client = { id: string; name: string };
type Country = { id: string; name: string; isoCode: string | null };

export function ContactPersonForm({
  clients,
  countries,
  action,
  initialValues,
  submitLabel,
  title,
}: {
  clients: Client[];
  countries: Country[];
  action: (
    state: ContactPersonFormState,
    formData: FormData,
  ) => Promise<ContactPersonFormState>;
  initialValues?: {
    id?: string;
    clientId: string;
    countryId: string | null;
    name: string;
    email: string;
    contactNumber: string | null;
  };
  submitLabel: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedClientId, setSelectedClientId] = useState(
    initialValues?.clientId ?? "",
  );
  const defaultCountryId = useMemo(() => {
    return (
      initialValues?.countryId ||
      countries.find((country) => country.isoCode?.toUpperCase() === "US")
        ?.id ||
      countries.find(
        (country) => country.name.toLowerCase() === "united states",
      )?.id ||
      countries[0]?.id ||
      ""
    );
  }, [countries, initialValues?.countryId]);
  const [selectedCountryId, setSelectedCountryId] = useState(defaultCountryId);
  const clientOptions = useMemo(
    () => clients.map((client) => ({ value: client.id, label: client.name })),
    [clients],
  );
  const countryOptions = useMemo(
    () =>
      countries.map((country) => ({
        value: country.id,
        label: country.isoCode
          ? `${country.name} (${country.isoCode})`
          : country.name,
      })),
    [countries],
  );

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? (
        <input type="hidden" name="id" value={initialValues.id} />
      ) : null}
      <input type="hidden" name="clientId" value={selectedClientId} />
      <input type="hidden" name="countryId" value={selectedCountryId} />
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">
        Fields marked <span className="text-red-600">*</span> are required.
      </p>
      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Contact Person saved successfully.
        </div>
      ) : null}
      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="clientId" required>
            Client
          </FormLabel>
          <SearchableCombobox
            id="clientId"
            options={clientOptions}
            value={selectedClientId}
            onValueChange={setSelectedClientId}
            placeholder="Select client"
            searchPlaceholder="Search clients..."
            emptyLabel="No client found."
          />
        </div>
        <div>
          <FormLabel htmlFor="name" required>
            Name
          </FormLabel>
          <input
            id="name"
            name="name"
            className="input"
            defaultValue={initialValues?.name ?? ""}
            required
          />
        </div>
        <div>
          <FormLabel htmlFor="email" required>
            Email
          </FormLabel>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            defaultValue={initialValues?.email ?? ""}
            required
          />
        </div>
        <div>
          <FormLabel htmlFor="countryId" required>
            Country
          </FormLabel>
          <SearchableCombobox
            id="countryId"
            options={countryOptions}
            value={selectedCountryId}
            onValueChange={setSelectedCountryId}
            placeholder="Select country"
            searchPlaceholder="Search countries..."
            emptyLabel="No country found."
          />
        </div>
        <div>
          <FormLabel htmlFor="contactNumber">Contact Number</FormLabel>
          <input
            id="contactNumber"
            name="contactNumber"
            className="input"
            defaultValue={initialValues?.contactNumber ?? ""}
          />
        </div>
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
