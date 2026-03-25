import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { ProfileForm } from "@/components/forms/profile-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ProfilePage() {
  const sessionUser = await requireUser();

  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      userType: true,
      functionalRole: true,
      employeeCode: true,
      designation: true,
      joiningDate: true,
      phoneNumber: true,
      currentAddress: true,
      permanentAddress: true,
      permanentSameAsCurrent: true,
    },
  });

  return (
    <div>
      <PageHeader
        title="My profile"
        description="Update your contact details, address information, and password. Core employee identity fields are read-only."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ProfileForm user={user} />
        <ChangePasswordForm />
      </div>
    </div>
  );
}
