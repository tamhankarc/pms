import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { UserManageForm } from "@/components/forms/user-manage-form";
import { createUserAction, toggleUserStatusAction } from "@/lib/actions/user-actions";
import { db } from "@/lib/db";

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; userType?: string; create?: string }>;
}) {
  const currentUser = await requireUser();
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";
  const userType = params.userType ?? "all";
  const showCreate = params.create === "1";

  const [users, teamLeads, groups] = await Promise.all([
    db.user.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { fullName: { contains: q } },
                { email: { contains: q } },
                { designation: { contains: q } },
                { employeeCode: { contains: q } },
              ],
            }
          : {}),
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
        ...(userType !== "all" ? { userType: userType as any } : {}),
      },
      include: {
        employeeGroups: { include: { employeeGroup: true } },
        teamLeadAssignmentsAsEmployee: { include: { teamLead: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: { userType: "TEAM_LEAD", isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true },
    }),
    db.employeeGroup.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Create and manage users, roles, employee groups, Team Lead assignment, employee code, designation, joining date, and active status."
        actions={
          canManageUsers(currentUser) ? (
            <Link className="btn-primary" href="/users?create=1">
              Create user
            </Link>
          ) : null
        }
      />

      <div className="card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]" method="get">
          <input className="input" name="q" defaultValue={q} placeholder="Search by name, email, designation, or employee code" />
          <select className="input" name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <select className="input" name="userType" defaultValue={userType}>
            <option value="all">All user types</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="TEAM_LEAD">Team Lead</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
            <option value="REPORT_VIEWER">Report Viewer</option>
          </select>
          <button className="btn-secondary" type="submit">Apply</button>
        </form>
      </div>

      {showCreate && canManageUsers(currentUser) ? (
        <UserManageForm mode="create" teamLeads={teamLeads} groups={groups} action={createUserAction} />
      ) : null}

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">User</th>
              <th className="table-cell">User type</th>
              <th className="table-cell">Functional role</th>
              <th className="table-cell">Employee code</th>
              <th className="table-cell">Designation</th>
              <th className="table-cell">Joining date</th>
              <th className="table-cell">Groups / Team Leads</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="table-cell">
                  <div className="font-medium text-slate-900">{user.fullName}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </td>
                <td className="table-cell">{user.userType.replaceAll("_", " ")}</td>
                <td className="table-cell">{(user.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}</td>
                <td className="table-cell">{user.employeeCode || "—"}</td>
                <td className="table-cell">{user.designation || "—"}</td>
                <td className="table-cell">{user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : "—"}</td>
                <td className="table-cell">
                  <div className="text-xs text-slate-600">
                    Groups: {user.employeeGroups.map((g) => g.employeeGroup.name).join(", ") || "—"}
                  </div>
                  {user.userType === "EMPLOYEE" ? (
                    <div className="mt-1 text-xs text-slate-600">
                      Leads: {user.teamLeadAssignmentsAsEmployee.map((t) => t.teamLead.fullName).join(", ") || "—"}
                    </div>
                  ) : null}
                </td>
                <td className="table-cell">
                  <span className={user.isActive ? "badge-emerald" : "badge-slate"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="table-cell">
                  <div className="flex gap-2">
                    <Link className="btn-secondary text-xs" href={`/users/${user.id}`}>
                      Edit
                    </Link>
                    <form action={toggleUserStatusAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button className="btn-secondary text-xs">
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-cell text-center text-sm text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
