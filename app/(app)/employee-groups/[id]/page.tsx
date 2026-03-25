import Link from "next/link";
import { notFound } from "next/navigation";
import { EmployeeGroupForm } from "@/components/forms/employee-group-form";
import { PageHeader } from "@/components/ui/page-header";
import { updateEmployeeGroupAction } from "@/lib/actions/group-actions";
import { db } from "@/lib/db";

export default async function EmployeeGroupEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group, users] = await Promise.all([
    db.employeeGroup.findUnique({
      where: { id },
      include: {
        users: true,
        projects: { include: { project: true } },
      },
    }),
    db.user.findMany({
      where: {
        isActive: true,
        userType: { in: ["EMPLOYEE", "TEAM_LEAD"] },
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true, userType: true },
    }),
  ]);

  if (!group) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit employee group · ${group.name}`}
        description="Update the group definition, assigned users, and active status."
        actions={<Link href="/employee-groups" className="btn-secondary">Back to groups</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="card p-6">
          <h2 className="section-title">Linked projects</h2>
          <div className="mt-4 space-y-2">
            {group.projects.length > 0 ? group.projects.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {row.project.name}
              </div>
            )) : (
              <div className="text-sm text-slate-500">No linked projects.</div>
            )}
          </div>
        </div>

        <EmployeeGroupForm
          mode="edit"
          users={users}
          action={updateEmployeeGroupAction}
          initialValues={{
            id: group.id,
            name: group.name,
            description: group.description,
            isActive: group.isActive,
            userIds: group.users.map((row) => row.userId),
          }}
        />
      </div>
    </div>
  );
}
