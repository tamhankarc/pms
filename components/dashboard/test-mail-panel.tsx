"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { sendTestMailAction, type TestMailState } from "@/lib/actions/mail-actions";

const initialState: TestMailState = {
  success: undefined,
  message: "",
};

export function TestMailPanel({ mailEnabled }: { mailEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(sendTestMailAction, initialState);

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-slate-600" />
            <h2 className="section-title">Test email sending</h2>
          </div>
          <p className="section-subtitle">
            Admin-only temporary panel to verify Amazon SES mail sending from the application.
          </p>
        </div>
        <span className={mailEnabled ? "badge-emerald" : "badge-blue"}>
          {mailEnabled ? "Mail sending enabled" : "Mail sending disabled"}
        </span>
      </div>

      {state?.message ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <form action={formAction} className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <label className="label" htmlFor="testEmail">
            Test recipient email
          </label>
          <input
            id="testEmail"
            name="email"
            type="email"
            className="input"
            placeholder="name@example.com"
            required
          />
          {!mailEnabled ? (
            <p className="mt-2 text-xs text-slate-500">
              Set <code>SEND_MAILS_ENABLED=true</code> on the environment where you want to send real emails.
            </p>
          ) : null}
        </div>

        <div className="flex items-end">
          <button className="btn-primary w-full lg:w-auto lg:min-w-[150px]" disabled={pending}>
            {pending ? "Sending..." : "Send test mail"}
          </button>
        </div>
      </form>
    </section>
  );
}
