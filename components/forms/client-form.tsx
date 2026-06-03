"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { ClientFormState } from "@/lib/actions/client-actions";

type ClientFormProps = {
  mode: "create" | "edit";
  action: (
    state: ClientFormState,
    formData: FormData,
  ) => Promise<ClientFormState>;
  canEditCosts?: boolean;
  initialValues?: {
    id?: string;
    name?: string;
    isActive?: boolean;
    showCountriesInTimeEntries?: boolean;
    showMoviesInEntries?: boolean;
    showAssetTypesInEntries?: boolean;
    showLensTypesInEntries?: boolean;
    lensFirstPlatformCost?: string | number;
    lensSubsequentPlatformCost?: string | number;
    showAssetNamesInEntries?: boolean;
    showLanguagesInEntries?: boolean;
    showNewslettersInEntries?: boolean;
    enableProjectTypes?: boolean;
    hourlyCost?: string | number;
    sonyCoppaSiteCost?: string | number;
    sonyUsEpkSiteCost?: string | number;
    sonyGlobalEpkSiteCost?: string | number;
    poAssignmentMode?: string;
  };
};

const initialState: ClientFormState = {};
const SONY_PICTURES_CLIENT_ID = "cmn66d3q40002l104n6wvefvl";
const SONY_PICTURES_CLIENT_NAME = "sony pictures entertainment";

export function ClientForm({
  mode,
  action,
  initialValues,
  canEditCosts = false,
}: ClientFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [clientName, setClientName] = useState(initialValues?.name ?? "");
  const [showLensTypesInEntries, setShowLensTypesInEntries] = useState(
    initialValues?.showLensTypesInEntries ?? false,
  );
  const isSonyPicturesClient =
    initialValues?.id === SONY_PICTURES_CLIENT_ID ||
    clientName.trim().toLowerCase() === SONY_PICTURES_CLIENT_NAME;

  return (
    <form action={formAction} className="card p-6">
      {mode === "edit" && initialValues?.id ? (
        <input type="hidden" name="id" value={initialValues.id} />
      ) : null}

      <h2 className="section-title">
        {mode === "create" ? "Create client" : "Edit client"}
      </h2>
      <p className="section-subtitle">
        Fields marked <span className="text-red-600">*</span> are required.
        Client code is generated automatically.
      </p>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Client saved successfully.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="name" required>
            Client name
          </FormLabel>
          <input
            id="name"
            className="input"
            name="name"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="poAssignmentMode">PO Assignment Mode</FormLabel>
          <SearchableCombobox
            id="poAssignmentMode"
            name="poAssignmentMode"
            defaultValue={initialValues?.poAssignmentMode ?? "NOT_REQUIRED"}
            options={[
              { value: "NOT_REQUIRED", label: "Not Required" },
              { value: "TITLE", label: "Title" },
              { value: "TITLE_BILLING_REPORT", label: "Title + Billing Report" },
              { value: "TITLE_PROJECT", label: "Title + Project" },
              { value: "PROJECT", label: "Project" },
            ]}
            placeholder="Select PO assignment mode"
            searchPlaceholder="Search PO assignment modes..."
            emptyLabel="No PO assignment mode found."
          />
          <p className="mt-1 text-xs text-slate-500">Controls where PO is assigned and resolved for this client.</p>
        </div>

        {canEditCosts ? (
          <div>
            <FormLabel htmlFor="hourlyCost">Per hour cost (USD)</FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                $
              </span>
              <input
                id="hourlyCost"
                name="hourlyCost"
                type="number"
                min="0"
                step="0.01"
                className="input currency-input"
                defaultValue={initialValues?.hourlyCost ?? "0.00"}
              />
            </div>
          </div>
        ) : null}

        {canEditCosts && isSonyPicturesClient ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-4 text-sm font-semibold text-slate-900">
              Sony Pictures Entertainment site charges
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  id: "sonyCoppaSiteCost",
                  label: "COPPA Site",
                  value: initialValues?.sonyCoppaSiteCost,
                },
                {
                  id: "sonyUsEpkSiteCost",
                  label: "US EPK Site",
                  value: initialValues?.sonyUsEpkSiteCost,
                },
                {
                  id: "sonyGlobalEpkSiteCost",
                  label: "Global EPK Site",
                  value: initialValues?.sonyGlobalEpkSiteCost,
                },
              ].map((field) => (
                <div key={field.id}>
                  <FormLabel htmlFor={field.id}>{field.label} (USD)</FormLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                      $
                    </span>
                    <input
                      id={field.id}
                      name={field.id}
                      type="number"
                      min="0"
                      step="0.01"
                      className="input currency-input"
                      defaultValue={field.value ?? "0.00"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="showCountriesInTimeEntries"
            defaultChecked={initialValues?.showCountriesInTimeEntries ?? false}
          />
          Show Countries dropdown in Time Entries and Estimates and make it
          mandatory
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="showLanguagesInEntries"
            defaultChecked={initialValues?.showLanguagesInEntries ?? false}
          />
          Show Language dropdown in Time Entries and Estimates and make it
          mandatory
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="showMoviesInEntries"
            defaultChecked={initialValues?.showMoviesInEntries ?? false}
          />
          Show Title dropdown in Time Entries and Estimates (optional)
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="showAssetTypesInEntries"
            defaultChecked={initialValues?.showAssetTypesInEntries ?? false}
          />
          Show Asset Type dropdown in Time Entries and Estimates (optional)
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="showLensTypesInEntries"
            checked={showLensTypesInEntries}
            onChange={(event) =>
              setShowLensTypesInEntries(event.target.checked)
            }
          />
          Show Lens Type dropdown in Time Entries and Estimates (optional)
        </label>

        {canEditCosts && showLensTypesInEntries ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-1 text-sm font-semibold text-slate-900">
              Lens Type / platform charges
            </p>
            <p className="mb-4 text-xs text-slate-600">
              Charges are calculated per market: first platform uses the first
              platform charge and every additional platform in the same market
              uses the subsequent platform charge.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  id: "lensFirstPlatformCost",
                  label: "1st Platform Charges (USD)",
                  value: initialValues?.lensFirstPlatformCost,
                },
                {
                  id: "lensSubsequentPlatformCost",
                  label: "Subsequent Platform Charges (USD)",
                  value: initialValues?.lensSubsequentPlatformCost,
                },
              ].map((field) => (
                <div key={field.id}>
                  <FormLabel htmlFor={field.id}>{field.label}</FormLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                      $
                    </span>
                    <input
                      id={field.id}
                      name={field.id}
                      type="number"
                      min="0"
                      step="0.01"
                      className="input currency-input"
                      defaultValue={field.value ?? "0.00"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="showAssetNamesInEntries"
            defaultChecked={initialValues?.showAssetNamesInEntries ?? false}
          />
          Show Asset Name dropdown in Time Entries and Estimates (optional)
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="showNewslettersInEntries"
            defaultChecked={initialValues?.showNewslettersInEntries ?? false}
          />
          Show Newsletter dropdown in Time Entries and Estimates (optional)
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="enableProjectTypes"
            defaultChecked={initialValues?.enableProjectTypes ?? false}
          />
          Enable client-specific Project Types
        </label>

        {mode === "edit" && initialValues?.id ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Need to manage project types for this client?{" "}
            <Link
              href={`/clients/${initialValues.id}/project-types`}
              className="font-medium text-blue-600 hover:underline"
            >
              Open Project Types
            </Link>
          </div>
        ) : null}

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initialValues?.isActive ?? true}
          />
          Active client
        </label>

        <button className="btn-primary w-full" disabled={pending}>
          {pending
            ? "Saving..."
            : mode === "create"
              ? "Create client"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
