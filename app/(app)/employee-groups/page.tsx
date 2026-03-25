import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmployeeGroupForm } from "@/components/forms/employee-group-form";
import { createEmployeeGroupAction, toggleEmployeeGroupStatusAction } from "@/lib/actions/group-actions";
import { db } from "@/lib/db";

export default async function EmployeeGroupsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";

  const [groups, users] = await Promise.all([
    db.employeeGroup.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { description: { contains: q } },
              ],
            }
          : {}),
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
      },
      include: {
        users: { include: { user: true } },
        projects: true,
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: {
        isActive: true,
        userType: {
          in: ["EMPLOYEE", "TEAM_LEAD"],
        },
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true, userType: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Employee groups"
        description="Admins, Managers, and Team Leads can define groups, assign operational users, and control project visibility."
      />

      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]" method="get">
          <input className="input" name="q" defaultValue={q} placeholder="Search by group name or description" />
          <select className="input" name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <button className="btn-secondary" type="submit">Apply</button>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="table-wrap">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Group</th>
                <th className="table-cell">Assigned users</th>
                <th className="table-cell">Linked projects</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((group) => (
                <tr key={group.id}>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">{group.name}</div>
                    <div className="text-xs text-slate-500">{group.description || "—"}</div>
                  </td>
                  <td className="table-cell">
                    {group.users.length > 0 ? group.users.map((row) => row.user.fullName).join(", ") : "—"}
                  </td>
                  <td className="table-cell">{group.projects.length}</td>
                  <td className="table-cell">
                    <span className={group.isActive ? "badge-emerald" : "badge-slate"}>
                      {group.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <Link className="btn-secondary text-xs" href={`/employee-groups/${group.id}`}>
                        Edit
                      </Link>
                      <form action={toggleEmployeeGroupStatusAction}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <button className="btn-secondary text-xs">
                          {group.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-cell text-center text-sm text-slate-500">
                    No employee groups found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <EmployeeGroupForm mode="create" users={users} action={createEmployeeGroupAction} />
      </div>
    </div>
  );
}
