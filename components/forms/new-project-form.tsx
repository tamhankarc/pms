"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createProjectAction,
  type ProjectFormState,
} from "@/lib/actions/project-actions";
import { FormLabel } from "@/components/ui/form-label";

type Client = { id: string; name: string };
type Movie = { id: string; title: string; clientId: string };
type Country = { id: string; name: string };
type EmployeeGroup = { id: string; name: string };
type AssignableUser = { id: string; fullName: string; userType: string; functionalRole: string | null };

const initialState: ProjectFormState = {};

export function NewProjectForm({
  clients,
  movies,
  countries,
  employeeGroups,
  assignableUsers,
}: {
  clients: Client[];
  movies: Movie[];
  countries: Country[];
  employeeGroups: EmployeeGroup[];
  assignableUsers: AssignableUser[];
}) {
  const [billingModel, setBillingModel] = useState<
    "HOURLY" | "FIXED_FULL" | "FIXED_MONTHLY"
  >("HOURLY");
  const [clientId, setClientId] = useState("");
  const [assignmentType, setAssignmentType] = useState<"GROUP" | "USER">("GROUP");

  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialState,
  );

  const filteredMovies = useMemo(
    () => movies.filter((movie) => movie.clientId === clientId),
    [movies, clientId],
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
          <FormLabel htmlFor="clientId" required>Client</FormLabel>
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
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Every project must belong to exactly one client.
          </p>
        </div>

        {clientId && filteredMovies.length > 0 ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="movieId">Movie</FormLabel>
            <select id="movieId" className="input" name="movieId" defaultValue="">
              <option value="">No movie</option>
              {filteredMovies.map((movie) => (
                <option key={movie.id} value={movie.id}>{movie.title}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Movie selection is optional and shown only when the selected client has movies.
            </p>
          </div>
        ) : null}

        <div className="md:col-span-2">
          <FormLabel htmlFor="name" required>Project name</FormLabel>
          <input id="name" className="input" name="name" required />
        </div>

        <div>
          <FormLabel htmlFor="billingModel" required>Billing model</FormLabel>
          <select
            id="billingModel"
            className="input"
            name="billingModel"
            value={billingModel}
            onChange={(e) =>
              setBillingModel(e.target.value as "HOURLY" | "FIXED_FULL" | "FIXED_MONTHLY")
            }
            required
          >
            <option value="HOURLY">Hourly</option>
            <option value="FIXED_FULL">Fixed - Full Project</option>
            <option value="FIXED_MONTHLY">Fixed - Monthly</option>
          </select>
        </div>

        <div>
          <FormLabel htmlFor="status" required>Status</FormLabel>
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
            <FormLabel htmlFor="fixedContractHours" required>Fixed contract hours</FormLabel>
            <input id="fixedContractHours" className="input" name="fixedContractHours" type="number" min="0" step="0.25" required />
            <p className="mt-1 text-xs text-slate-500">
              Enter the total hours included for the full project scope.
            </p>
          </div>
        ) : null}

        {billingModel === "FIXED_MONTHLY" ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="fixedMonthlyHours" required>Fixed monthly hours</FormLabel>
            <input id="fixedMonthlyHours" className="input" name="fixedMonthlyHours" type="number" min="0" step="0.25" required />
            <p className="mt-1 text-xs text-slate-500">
              Enter the included effort available each month before overage applies.
            </p>
          </div>
        ) : null}

        <div className="md:col-span-2">
          <FormLabel htmlFor="description">Description</FormLabel>
          <textarea id="description" className="input min-h-24" name="description" />
        </div>

        <div>
          <FormLabel htmlFor="countryIds" required>Countries</FormLabel>
          <select id="countryIds" className="input min-h-32" name="countryIds" multiple required>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>{country.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Select at least one country. Hold Ctrl/Cmd to select multiple countries.
          </p>
        </div>
        
        <div className="space-y-6">
          <div>
            <FormLabel htmlFor="assignmentType" required>Assignment type</FormLabel>
            <select
              id="assignmentType"
              className="input"
              name="assignmentType"
              value={assignmentType}
              onChange={(e) => setAssignmentType(e.target.value as "GROUP" | "USER")}
              required
            >
              <option value="GROUP">Employee group</option>
              <option value="USER">Individual user</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Choose whether this project is assigned through employee groups or directly to specific users.
            </p>
          </div>

          <div>
            {assignmentType === "GROUP" ? (
              <>
                <FormLabel htmlFor="employeeGroupIds" required>Employee groups</FormLabel>
                <select id="employeeGroupIds" className="input min-h-32" name="employeeGroupIds" multiple required>
                  {employeeGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Select at least one group. These groups define project visibility for operational users.
                </p>
              </>
            ) : (
              <>
                <FormLabel htmlFor="directUserId" required>Assigned Individual</FormLabel>
                <select id="directUserId" className="input" name="directUserId" required>
                  <option value="">Select user</option>
                  {assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} · {user.userType.replaceAll("_", " ")}
                      {user.functionalRole ? ` · ${user.functionalRole.replaceAll("_", " ")}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Select one active Employee or Team Lead.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <button className="btn-primary mt-6 w-full" disabled={pending}>
        {pending ? "Creating..." : "Create project"}
      </button>
    </form>
  );
}
