"use client";

import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  ADDRESS_COUNTRY_OPTIONS,
  getStateOptions,
  normalizeAddressCountry,
  type AddressValue,
} from "@/lib/address";

export function AddressFields({
  prefix,
  title,
  value,
  onChange,
  disabled = false,
}: {
  prefix: string;
  title: string;
  value: AddressValue;
  onChange: (nextValue: AddressValue) => void;
  disabled?: boolean;
}) {
  const country = normalizeAddressCountry(value.country);
  const stateOptions = getStateOptions(country).map((state) => ({ value: state, label: state }));

  function updateField<K extends keyof AddressValue>(key: K, nextFieldValue: AddressValue[K]) {
    const nextValue = { ...value, [key]: nextFieldValue } as AddressValue;
    if (key === "country") {
      const nextCountry = normalizeAddressCountry(String(nextFieldValue));
      const availableStates: string[] = [...getStateOptions(nextCountry)];
      nextValue.country = nextCountry;
      if (nextValue.state && !availableStates.includes(nextValue.state)) {
        nextValue.state = "";
      }
    }
    onChange(nextValue);
  }

  return (
    <div className="md:col-span-2 rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormLabel htmlFor={`${prefix}AddressLine`}>Address</FormLabel>
          <textarea
            id={`${prefix}AddressLine`}
            className="input min-h-24"
            name={`${prefix}AddressLine`}
            value={value.addressLine}
            onChange={(event) => updateField("addressLine", event.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <FormLabel htmlFor={`${prefix}City`}>City</FormLabel>
          <input
            id={`${prefix}City`}
            className="input"
            name={`${prefix}City`}
            value={value.city}
            onChange={(event) => updateField("city", event.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <FormLabel htmlFor={`${prefix}Country`}>Country</FormLabel>
          <SearchableCombobox
            id={`${prefix}Country`}
            name={`${prefix}Country`}
            value={country}
            onValueChange={(nextValue) => updateField("country", normalizeAddressCountry(nextValue))}
            options={ADDRESS_COUNTRY_OPTIONS}
            placeholder="Select country"
            searchPlaceholder="Search countries..."
            emptyLabel="No country found."
            disabled={disabled}
          />
        </div>

        <div>
          <FormLabel htmlFor={`${prefix}State`}>State</FormLabel>
          <SearchableCombobox
            id={`${prefix}State`}
            name={`${prefix}State`}
            value={value.state}
            onValueChange={(nextValue) => updateField("state", nextValue)}
            options={stateOptions}
            placeholder="Select state"
            searchPlaceholder="Search states..."
            emptyLabel="No state found."
            disabled={disabled}
          />
        </div>

        <div>
          <FormLabel htmlFor={`${prefix}PostalCode`}>{country === "US" ? "Zip Code" : "Pin Code"}</FormLabel>
          <input
            id={`${prefix}PostalCode`}
            className="input"
            name={`${prefix}PostalCode`}
            value={value.postalCode}
            onChange={(event) => updateField("postalCode", event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
