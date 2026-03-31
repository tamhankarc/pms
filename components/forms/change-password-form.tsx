"use client";

import { useActionState, useState } from "react";
import {
  changePasswordAction,
  type PasswordActionState,
} from "@/lib/actions/profile-actions";
import { FormLabel } from "@/components/ui/form-label";

const initialState: PasswordActionState = {
  success: false,
  message: "",
};

function PasswordField({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <FormLabel htmlFor={id} required>{label}</FormLabel>
      <div className="relative">
        <input id={id} className="input pr-24" name={id} type={visible ? "text" : "password"} required />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-600 hover:text-slate-900"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="card p-6">
      <h2 className="section-title">Change password</h2>
      <p className="section-subtitle">
        Fields marked <span className="text-red-600">*</span> are required.
      </p>

      {state?.message ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <PasswordField id="currentPassword" label="Current password" />
        <PasswordField id="newPassword" label="New password" />
        <PasswordField id="confirmPassword" label="Confirm new password" />

        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Updating..." : "Update password"}
        </button>
      </div>
    </form>
  );
}
