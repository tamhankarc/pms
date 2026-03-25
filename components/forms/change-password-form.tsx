import { changePasswordAction } from "@/lib/actions/profile-actions";
import { FormLabel } from "@/components/ui/form-label";

export function ChangePasswordForm() {
  return (
    <form action={changePasswordAction} className="card p-6">
      <h2 className="section-title">Change password</h2>
      <p className="section-subtitle">
        Fields marked <span className="text-red-600">*</span> are required.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="currentPassword" required>Current password</FormLabel>
          <input id="currentPassword" className="input" name="currentPassword" type="password" required />
        </div>

        <div>
          <FormLabel htmlFor="newPassword" required>New password</FormLabel>
          <input id="newPassword" className="input" name="newPassword" type="password" required />
        </div>

        <div>
          <FormLabel htmlFor="confirmPassword" required>Confirm new password</FormLabel>
          <input id="confirmPassword" className="input" name="confirmPassword" type="password" required />
        </div>

        <button className="btn-primary w-full">Update password</button>
      </div>
    </form>
  );
}
