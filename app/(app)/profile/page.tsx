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
        description="Update your contact details and address information. Core employee identity fields are read-only."
      />

      <div className="max-w-4xl">
        <ProfileForm user={user} />
      </div>
    </div>
  );
}
