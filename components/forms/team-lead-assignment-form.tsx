"use client";

import { useActionState, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { assignTeamLeadAction, type TeamLeadAssignmentState } from "@/lib/actions/user-actions";

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
  const [teamLeadId, setTeamLeadId] = useState(supervisors[0]?.id ?? "");
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");

  return (
    <form action={formAction} className="card p-6">
      <input type="hidden" name="teamLeadId" value={teamLeadId} />
      <input type="hidden" name="employeeId" value={employeeId} />

      <h2 className="section-title">Assign Supervisor</h2>
      <p className="section-subtitle">
        Fields marked <span className="text-red-600">*</span> are required.
      </p>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Supervisor assignment saved successfully.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="teamLeadId" required>
            Supervisor
          </FormLabel>
          <SearchableCombobox
            id="teamLeadId"
            value={teamLeadId}
            onValueChange={setTeamLeadId}
            options={supervisors.map((lead) => ({
              value: lead.id,
              label: `${lead.fullName} · ${lead.userType.replaceAll("_", " ")}${
                lead.userType === "MANAGER" && lead.functionalRole
                  ? ` · ${lead.functionalRole.replaceAll("_", " ")}`
                  : ""
              }`,
              keywords: `${lead.fullName} ${lead.userType} ${lead.functionalRole ?? ""}`,
            }))}
            placeholder="Select supervisor"
            searchPlaceholder="Search supervisors..."
            emptyLabel="No supervisor found."
            required
          />
        </div>

        <div>
          <FormLabel htmlFor="employeeId" required>
            Employee
          </FormLabel>
          <SearchableCombobox
            id="employeeId"
            value={employeeId}
            onValueChange={setEmployeeId}
            options={employees.map((employee) => ({
              value: employee.id,
              label: `${employee.fullName} · ${(employee.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}`,
              keywords: `${employee.fullName} ${employee.functionalRole ?? "UNASSIGNED"}`,
            }))}
            placeholder="Select employee"
            searchPlaceholder="Search employees..."
            emptyLabel="No employee found."
            required
          />
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
