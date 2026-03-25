import { PageHeader } from "@/components/ui/page-header";
import { assignTeamLeadAction } from "@/lib/actions/user-actions";
import { db } from "@/lib/db";
import { FormLabel } from "@/components/ui/form-label";

export default async function TeamLeadAssignmentsPage() {
  const [supervisors, employees, assignments] = await Promise.all([
    db.user.findMany({
      where: {
        userType: { in: ["TEAM_LEAD", "MANAGER"] },
        isActive: true,
      },
      orderBy: [{ userType: "asc" }, { fullName: "asc" }],
    }),
    db.user.findMany({
      where: { userType: "EMPLOYEE" },
      orderBy: { fullName: "asc" },
    }),
    db.employeeTeamLead.findMany({
      include: {
        teamLead: true,
        employee: true,
      },
      orderBy: { assignedAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Supervisor assignments"
        description="Every employee must have at least one assigned Team Lead or a Manager with the same functional role, and may have more than one supervisor."
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="table-wrap">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Employee</th>
                <th className="table-cell">Functional role</th>
                <th className="table-cell">Supervisor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td className="table-cell font-medium text-slate-900">
                    {assignment.employee.fullName}
                  </td>
                  <td className="table-cell">
                    {(assignment.employee.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}
                  </td>
                  <td className="table-cell">
                    {assignment.teamLead.fullName} · {assignment.teamLead.userType.replaceAll("_", " ")}
                  </td>
                </tr>
              ))}
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="table-cell text-center text-sm text-slate-500">
                    No supervisor assignments found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <form action={assignTeamLeadAction} className="card p-6">
          <h2 className="section-title">Assign Supervisor</h2>
          <p className="section-subtitle">
            Fields marked <span className="text-red-600">*</span> are required.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <FormLabel htmlFor="teamLeadId" required>Supervisor</FormLabel>
              <select id="teamLeadId" className="input" name="teamLeadId" required>
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
              <select id="employeeId" className="input" name="employeeId" required>
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

            <button className="btn-primary w-full">Save assignment</button>
          </div>
        </form>
      </div>
    </div>
  );
}
