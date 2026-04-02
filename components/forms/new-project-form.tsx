"use client";

import { useActionState, useMemo, useState } from "react";
import { createProjectAction, type ProjectFormState } from "@/lib/actions/project-actions";
import { FormLabel } from "@/components/ui/form-label";

type Client = {
  id: string;
  name: string;
  enableProjectTypes: boolean;
};

type ProjectType = {
  id: string;
  name: string;
  clientId: string;
};

type BillingModel = "HOURLY" | "FIXED_FULL" | "FIXED_MONTHLY";

const initialState: ProjectFormState = {};

export function NewProjectForm({
  clients,
  projectTypes,
}: {
  clients: Client[];
  projectTypes: ProjectType[];
}) {
  const [billingModel, setBillingModel] = useState<BillingModel>("HOURLY");
  const [clientId, setClientId] = useState("");
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);

  const selectedClient = clients.find((client) => client.id === clientId);

  const filteredProjectTypes = useMemo(
    () => projectTypes.filter((type) => type.clientId === clientId),
    [projectTypes, clientId],
  );

  return (
    <form action={formAction} className="card p-6">
      <h2 className="section-title">Create project</h2>
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
          Project created successfully.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormLabel htmlFor="clientId" required>
            Client
          </FormLabel>
          <select
            id="clientId"
            className="input"
            name="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        {selectedClient?.enableProjectTypes ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="projectTypeId" required>
              Project type
            </FormLabel>
            <select id="projectTypeId" className="input" name="projectTypeId" required>
              <option value="">Select project type</option>
              {filteredProjectTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="md:col-span-2">
          <FormLabel htmlFor="name" required>
            Project name
          </FormLabel>
          <input id="name" className="input" name="name" required />
        </div>

        <div>
          <FormLabel htmlFor="billingModel" required>
            Billing model
          </FormLabel>
          <select
            id="billingModel"
            className="input"
            name="billingModel"
            value={billingModel}
            onChange={(e) => setBillingModel(e.target.value as BillingModel)}
            required
          >
            <option value="HOURLY">Hourly</option>
            <option value="FIXED_FULL">Fixed - Full Project</option>
            <option value="FIXED_MONTHLY">Fixed - Monthly</option>
          </select>
        </div>

        <div>
          <FormLabel htmlFor="status" required>
            Status
          </FormLabel>
          <select id="status" className="input" name="status" required>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        {billingModel === "FIXED_FULL" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedContractHours" required>
              Fixed contract hours
            </FormLabel>
            <input
              id="fixedContractHours"
              className="input"
              name="fixedContractHours"
              type="number"
              min="0"
              step="0.25"
              required
            />
          </div>
        ) : null}

        {billingModel === "FIXED_MONTHLY" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedMonthlyHours" required>
              Fixed monthly hours
            </FormLabel>
            <input
              id="fixedMonthlyHours"
              className="input"
              name="fixedMonthlyHours"
              type="number"
              min="0"
              step="0.25"
              required
            />
          </div>
        ) : null}

        <div className="md:col-span-2">
          <FormLabel htmlFor="description">Description</FormLabel>
          <textarea id="description" className="input min-h-24" name="description" />
        </div>

        <div className="md:col-span-2">
          <button className="btn-primary w-full md:w-auto" disabled={pending}>
            {pending ? "Saving..." : "Create project"}
          </button>
        </div>
      </div>
    </form>
  );
}