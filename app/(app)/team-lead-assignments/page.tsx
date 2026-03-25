import { PageHeader } from "@/components/ui/page-header";
import { assignTeamLeadAction } from "@/lib/actions/user-actions";
import { db } from "@/lib/db";
import { FormLabel } from "@/components/ui/form-label";

export default async function TeamLeadAssignmentsPage() {
  const [teamLeads, employees, assignments] = await Promise.all([
    db.user.findMany({
      where: { userType: "TEAM_LEAD" },
      orderBy: { fullName: "asc" },
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
        title="Team Lead assignments"
        description="Every employee must have at least one assigned Team Lead, and may have more than one."
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="table-wrap">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Employee</th>
                <th className="table-cell">Functional role</th>
                <th className="table-cell">Team Lead</th>
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
                  <td className="table-cell">{assignment.teamLead.fullName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={assignTeamLeadAction} className="card p-6">
          <h2 className="section-title">Assign Team Lead</h2>
          <p className="section-subtitle">
            Fields marked <span className="text-red-600">*</span> are required.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <FormLabel htmlFor="teamLeadId" required>Team Lead</FormLabel>
              <select id="teamLeadId" className="input" name="teamLeadId" required>
                {teamLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.fullName}
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

            <button className="btn-primary w-full">Save assignment</button>
          </div>
        </form>
      </div>
    </div>
  );
}
