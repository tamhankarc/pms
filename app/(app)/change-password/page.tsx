import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { PageHeader } from "@/components/ui/page-header";

export default function ChangePasswordPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Change password"
        description="Update your account password."
      />

      <div className="max-w-2xl">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
