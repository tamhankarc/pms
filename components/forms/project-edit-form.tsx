"use client";

import { useActionState, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import {
  updateProjectAction,
  type ProjectFormState,
} from "@/lib/actions/project-actions";

type Country = { id: string; name: string };
type EmployeeGroup = { id: string; name: string };

const initialState: ProjectFormState = {};

export function ProjectEditForm({
  projectId,
  initialValues,
  countries,
  employeeGroups,
  lockedClientName,
  lockedMovieTitle,
}: {
  projectId: string;
  initialValues: {
    name: string;
    billingModel: "HOURLY" | "FIXED_FULL" | "FIXED_MONTHLY";
    fixedContractHours: number | null;
    fixedMonthlyHours: number | null;
    status: "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
    description: string | null;
    countryIds: string[];
    employeeGroupIds: string[];
  };
  countries: Country[];
  employeeGroups: EmployeeGroup[];
  lockedClientName: string;
  lockedMovieTitle?: string | null;
}) {
  const [billingModel, setBillingModel] = useState(initialValues.billingModel);
  const [state, formAction, pending] = useActionState(
    updateProjectAction.bind(null, projectId),
    initialState,
  );

  return (
    <form action={formAction} className="card p-6">
      <h2 className="section-title">Edit project</h2>
      <p className="section-subtitle">
        Client and Movie are locked after project creation. Fields marked <span className="text-red-600">*</span> are required.
      </p>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Project updated successfully.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormLabel htmlFor="lockedClient">Client</FormLabel>
          <input id="lockedClient" className="input bg-slate-50" value={lockedClientName} disabled readOnly />
        </div>

        {lockedMovieTitle ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="lockedMovie">Movie</FormLabel>
            <input id="lockedMovie" className="input bg-slate-50" value={lockedMovieTitle} disabled readOnly />
          </div>
        ) : null}

        <div className="md:col-span-2">
          <FormLabel htmlFor="name" required>Project name</FormLabel>
          <input id="name" className="input" name="name" defaultValue={initialValues.name} required />
        </div>

        <div>
          <FormLabel htmlFor="billingModel" required>Billing model</FormLabel>
          <select
            id="billingModel"
            className="input"
            name="billingModel"
            value={billingModel}
            onChange={(e) => setBillingModel(e.target.value as "HOURLY" | "FIXED_FULL" | "FIXED_MONTHLY")}
            required
          >
            <option value="HOURLY">Hourly</option>
            <option value="FIXED_FULL">Fixed - Full Project</option>
            <option value="FIXED_MONTHLY">Fixed - Monthly</option>
          </select>
        </div>

        <div>
          <FormLabel htmlFor="status" required>Status</FormLabel>
          <select id="status" className="input" name="status" defaultValue={initialValues.status} required>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        {billingModel === "FIXED_FULL" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedContractHours" required>Fixed contract hours</FormLabel>
            <input id="fixedContractHours" className="input" name="fixedContractHours" type="number" min="0" step="0.25" defaultValue={initialValues.fixedContractHours ?? 0} required />
            <p className="mt-1 text-xs text-slate-500">
              Enter the total hours included for the full project scope.
            </p>
          </div>
        ) : null}

        {billingModel === "FIXED_MONTHLY" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedMonthlyHours" required>Fixed monthly hours</FormLabel>
            <input id="fixedMonthlyHours" className="input" name="fixedMonthlyHours" type="number" min="0" step="0.25" defaultValue={initialValues.fixedMonthlyHours ?? 0} required />
            <p className="mt-1 text-xs text-slate-500">
              Enter the included effort available each month before overage applies.
            </p>
          </div>
        ) : null}

        <div className="md:col-span-2">
          <FormLabel htmlFor="description">Description</FormLabel>
          <textarea id="description" className="input min-h-24" name="description" defaultValue={initialValues.description ?? ""} />
        </div>

        <div>
          <FormLabel htmlFor="countryIds" required>Countries</FormLabel>
          <select id="countryIds" className="input min-h-32" name="countryIds" multiple defaultValue={initialValues.countryIds} required>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>{country.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Select at least one country. Hold Ctrl/Cmd to select multiple countries.
          </p>
        </div>

        <div>
          <FormLabel htmlFor="employeeGroupIds" required>Employee groups</FormLabel>
          <select id="employeeGroupIds" className="input min-h-32" name="employeeGroupIds" multiple defaultValue={initialValues.employeeGroupIds} required>
            {employeeGroups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Select at least one group. These groups define project visibility for operational users.
          </p>
        </div>
      </div>

      <button className="btn-primary mt-6 w-full" disabled={pending}>
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
