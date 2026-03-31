"use client";

import { useActionState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import {
  assignTeamLeadAction,
  type TeamLeadAssignmentState,
} from "@/lib/actions/user-actions";

const initialState: TeamLeadAssignmentState = {};

export function TeamLeadAssignmentForm({
  supervisors,
  employees,
}: {
  supervisors: {
    id: string;
    fullName: string;
    userType: string;
    functionalRole: string | null;
  }[];
  employees: {
    id: string;
    fullName: string;
    functionalRole: string | null;
  }[];
}) {
  const [state, formAction, pending] = useActionState(assignTeamLeadAction, initialState);

  return (
    <form action={formAction} className="card p-6">
      <h2 className="section-title">Assign Supervisor</h2>
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
          Supervisor assignment saved successfully.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="teamLeadId" required>Supervisor</FormLabel>
          <select id="teamLeadId" className="input" name="teamLeadId" required defaultValue={supervisors[0]?.id ?? ""}>
            {supervisors.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.fullName} · {lead.userType.replaceAll("_", " ")}
                {lead.userType === "MANAGER" && lead.functionalRole
                  ? ` · ${lead.functionalRole.replaceAll("_", " ")}`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FormLabel htmlFor="employeeId" required>Employee</FormLabel>
          <select id="employeeId" className="input" name="employeeId" required defaultValue={employees[0]?.id ?? ""}>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName} · {(employee.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-slate-500">
          Managers can be assigned only when their functional role matches the employee’s functional role.
        </p>

        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Saving..." : "Save assignment"}
        </button>
      </div>
    </form>
  );
}
