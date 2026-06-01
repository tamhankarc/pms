import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { UserProfileImportForm } from "@/components/forms/user-profile-import-form";
import { requireUser } from "@/lib/auth";

export default async function AdminUserImportPage() {
  const user = await requireUser();
  if (user.userType !== "ADMIN" || user.functionalRole !== "OTHER") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Temporary User Profile Import"
        description="Upload an Excel sheet to validate by Username and Email, then update employee code, leave balances, designation, and joining date for existing users. Accessible only to Admin users with Functional Role Other."
      />
      <UserProfileImportForm />
    </div>
  );
}
