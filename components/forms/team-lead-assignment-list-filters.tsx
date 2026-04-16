"use client";

import { useMemo, useState } from "react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

export function TeamLeadAssignmentListFilters({
  selectedRole,
  selectedEmployeeId,
  employees,
}: {
  selectedRole: string;
  selectedEmployeeId: string;
  employees: { id: string; fullName: string; functionalRole: string | null }[];
}) {
  const [role, setRole] = useState(selectedRole);
  const [employeeId, setEmployeeId] = useState(selectedEmployeeId);

  const roleOptions = useMemo(
    () => [
      { value: "all", label: "All roles" },
      ...Array.from(new Set(employees.map((employee) => employee.functionalRole ?? "UNASSIGNED")))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value.replaceAll("_", " ") })),
    ],
    [employees],
  );

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (role === "all") return true;
        return (employee.functionalRole ?? "UNASSIGNED") === role;
      }),
    [employees, role],
  );

  function handleRoleChange(nextRole: string) {
    setRole(nextRole);
    const nextEmployees = employees.filter((employee) => {
      if (nextRole === "all") return true;
      return (employee.functionalRole ?? "UNASSIGNED") === nextRole;
    });
    if (!nextEmployees.some((employee) => employee.id === employeeId)) {
      setEmployeeId("");
    }
  }

  return (
    <form method="get" className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
      <SearchableCombobox
        id="role"
        name="role"
        value={role}
        onValueChange={handleRoleChange}
        options={roleOptions}
        placeholder="All roles"
        searchPlaceholder="Search roles..."
        emptyLabel="No role found."
      />

      <SearchableCombobox
        id="employeeId"
        name="employeeId"
        value={employeeId}
        onValueChange={setEmployeeId}
        options={[
          { value: "", label: "All employees" },
          ...filteredEmployees.map((employee) => ({
            value: employee.id,
            label: `${employee.fullName} · ${(employee.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}`,
            keywords: `${employee.fullName} ${employee.functionalRole ?? "UNASSIGNED"}`,
          })),
        ]}
        placeholder="All employees"
        searchPlaceholder="Search employees..."
        emptyLabel="No employee found."
      />

      <button className="btn-secondary" type="submit">
        Apply
      </button>
    </form>
  );
}
