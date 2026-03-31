import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { TeamLeadAssignmentForm } from "@/components/forms/team-lead-assignment-form";

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

        <TeamLeadAssignmentForm
          supervisors={supervisors.map((lead) => ({
            id: lead.id,
            fullName: lead.fullName,
            userType: lead.userType,
            functionalRole: lead.functionalRole,
          }))}
          employees={employees.map((employee) => ({
            id: employee.id,
            fullName: employee.fullName,
            functionalRole: employee.functionalRole,
          }))}
        />
      </div>
    </div>
  );
}
