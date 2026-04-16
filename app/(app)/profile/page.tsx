import { ProfileForm } from "@/components/forms/profile-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

type CountryCode = "IN" | "US" | null;

function normalizeCountry(value: string | null): CountryCode {
  return value === "IN" || value === "US" ? value : null;
}

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
      secondaryPhoneNumber: true,
      permanentSameAsCurrent: true,
      currentAddressLine: true,
      currentCity: true,
      currentState: true,
      currentCountry: true,
      currentPostalCode: true,
      permanentAddressLine: true,
      permanentCity: true,
      permanentState: true,
      permanentCountry: true,
      permanentPostalCode: true,
    },
  });

  const normalizedUser = {
    ...user,
    currentCountry: normalizeCountry(user.currentCountry),
    permanentCountry: normalizeCountry(user.permanentCountry),
  };

  return (
    <div>
      <PageHeader
        title="My profile"
        description="Update your phone numbers and address information. Core employee identity fields are read-only."
      />

      <div className="max-w-4xl">
        <ProfileForm user={normalizedUser} />
      </div>
    </div>
  );
}
