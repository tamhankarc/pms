import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { TeamLeadAssignmentForm } from "@/components/forms/team-lead-assignment-form";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";
import { TeamLeadAssignmentListFilters } from "@/components/forms/team-lead-assignment-list-filters";

export default async function TeamLeadAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; role?: string; employeeId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);
  const selectedRole = params.role ?? "all";
  const selectedEmployeeId = params.employeeId ?? "";

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
      include: {
        employeeSupervisors: { select: { id: true } },
      },
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

  const filteredAssignments = assignments.filter((assignment) => {
    const employeeRole = assignment.employee.functionalRole ?? "UNASSIGNED";
    if (selectedRole !== "all" && employeeRole !== selectedRole) return false;
    if (selectedEmployeeId && assignment.employeeId !== selectedEmployeeId) return false;
    return true;
  });

  const unassignedEmployees = employees.filter((employee) => {
    const employeeRole = employee.functionalRole ?? "UNASSIGNED";
    if (selectedRole !== "all" && employeeRole !== selectedRole) return false;
    if (selectedEmployeeId && employee.id !== selectedEmployeeId) return false;
    return employee.employeeSupervisors.length === 0;
  });

  const { items: paginatedAssignments, currentPage, totalPages, totalItems, pageSize } = paginateItems(filteredAssignments, page, DEFAULT_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervisor assignments"
        description="Assign Team Leads or role-matched Managers to employees. You can also review employees who still have no supervisor assigned."
      />

      <div className="card p-4">
        <TeamLeadAssignmentListFilters
          selectedRole={selectedRole}
          selectedEmployeeId={selectedEmployeeId}
          employees={employees.map((employee) => ({
            id: employee.id,
            fullName: employee.fullName,
            functionalRole: employee.functionalRole,
          }))}
        />
      </div>

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
              {paginatedAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td className="table-cell font-medium text-slate-900">{assignment.employee.fullName}</td>
                  <td className="table-cell">{(assignment.employee.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}</td>
                  <td className="table-cell">
                    {assignment.teamLead.fullName} · {assignment.teamLead.userType.replaceAll("_", " ")}
                  </td>
                </tr>
              ))}
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="table-cell text-center text-sm text-slate-500">
                    No supervisor assignments found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <PaginationControls
            basePath="/team-lead-assignments"
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            searchParams={{ role: selectedRole === "all" ? undefined : selectedRole, employeeId: selectedEmployeeId || undefined }}
          />
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

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Employee</th>
              <th className="table-cell">Functional role</th>
              <th className="table-cell">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {unassignedEmployees.map((employee) => (
              <tr key={employee.id}>
                <td className="table-cell font-medium text-slate-900">{employee.fullName}</td>
                <td className="table-cell">{(employee.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}</td>
                <td className="table-cell text-amber-700">No supervisor assigned</td>
              </tr>
            ))}
            {unassignedEmployees.length === 0 ? (
              <tr>
                <td colSpan={3} className="table-cell text-center text-sm text-slate-500">
                  Every listed employee has at least one supervisor assigned.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
