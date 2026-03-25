import Link from "next/link";
import { notFound } from "next/navigation";
import { UserManageForm } from "@/components/forms/user-manage-form";
import { PageHeader } from "@/components/ui/page-header";
import { updateUserAction } from "@/lib/actions/user-actions";
import { db } from "@/lib/db";

export default async function UserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, supervisorRows, groups] = await Promise.all([
    db.user.findUnique({
      where: { id },
      include: {
        employeeGroups: true,
        teamLeadAssignmentsAsEmployee: true,
      },
    }),
    db.user.findMany({
      where: {
        isActive: true,
        userType: { in: ["TEAM_LEAD", "MANAGER"] },
      },
      orderBy: [{ userType: "asc" }, { fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        email: true,
        userType: true,
        functionalRole: true,
      },
    }),
    db.employeeGroup.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!user) notFound();

  const supervisors = supervisorRows
    .filter(
      (person): person is typeof person & { userType: "TEAM_LEAD" | "MANAGER" } =>
        person.userType === "TEAM_LEAD" || person.userType === "MANAGER",
    )
    .map((person) => ({
      id: person.id,
      fullName: person.fullName,
      email: person.email,
      userType: person.userType,
      functionalRole: person.functionalRole,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit user · ${user.fullName}`}
        description="Update core user details, groups, supervisors, employee code, designation, joining date, and active status."
        actions={
          <Link href="/users" className="btn-secondary">
            Back to users
          </Link>
        }
      />

      <UserManageForm
        mode="edit"
        action={updateUserAction}
        supervisors={supervisors}
        groups={groups}
        initialValues={{
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          userType: user.userType,
          functionalRole: user.functionalRole ?? "OTHER",
          employeeCode: user.employeeCode,
          designation: user.designation,
          joiningDate: user.joiningDate
            ? new Date(user.joiningDate).toISOString().slice(0, 10)
            : null,
          phoneNumber: user.phoneNumber,
          isActive: user.isActive,
          groupIds: user.employeeGroups.map((row) => row.employeeGroupId),
          supervisorIds: user.teamLeadAssignmentsAsEmployee.map((row) => row.teamLeadId),
        }}
      />
    </div>
  );
}