import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UserManageForm } from "@/components/forms/user-manage-form";
import { PageHeader } from "@/components/ui/page-header";
import { updateUserAction } from "@/lib/actions/user-actions";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { db } from "@/lib/db";

export default async function UserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireUser();
  if (!canManageUsers(currentUser)) redirect("/dashboard");

  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
  });

  if (!user) notFound();
  if (currentUser.userType === "HR" && user.userType === "OPERATIONS") redirect("/users");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit user · ${user.fullName}`}
        description="Update core user details, contact details, address information, employee code, joining date, and active status. Supervisor mapping is handled from Team Lead Assignments."
        actions={
          <Link href="/users" className="btn-secondary">
            Back to users
          </Link>
        }
      />

      <UserManageForm
        mode="edit"
        action={updateUserAction}
        allowOperationsUserType={currentUser.userType === "ADMIN"}
        initialValues={{
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          userType: user.userType,
          functionalRole: (user.functionalRole ?? "OTHER") as
            | "DEVELOPER"
            | "QA"
            | "DESIGNER"
            | "LOCALIZATION"
            | "DEVOPS"
            | "PROJECT_MANAGER"
            | "DIRECTOR"
            | "BILLING"
            | "OTHER",
          employeeCode: user.employeeCode,
          designation: user.designation,
          joiningDate: user.joiningDate ? new Date(user.joiningDate).toISOString().slice(0, 10) : null,
          phoneNumber: user.phoneNumber,
          secondaryPhoneNumber: user.secondaryPhoneNumber,
          isActive: user.isActive,
          permanentSameAsCurrent: user.permanentSameAsCurrent,
          currentAddressLine: user.currentAddressLine,
          currentCity: user.currentCity,
          currentState: user.currentState,
          currentCountry: user.currentCountry as "IN" | "US" | null,
          currentPostalCode: user.currentPostalCode,
          permanentAddressLine: user.permanentAddressLine,
          permanentCity: user.permanentCity,
          permanentState: user.permanentState,
          permanentCountry: user.permanentCountry as "IN" | "US" | null,
          permanentPostalCode: user.permanentPostalCode,
        }}
      />
    </div>
  );
}
