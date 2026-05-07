"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { sendTestMailAction, type TestMailState } from "@/lib/actions/mail-actions";
import type { SesFromEmailDetails } from "@/lib/mail/ses";

const initialState: TestMailState = {
  success: undefined,
  message: "",
};

export function TestMailPanel({
  mailEnabled,
  fromEmailOptions,
}: {
  mailEnabled: boolean;
  fromEmailOptions: SesFromEmailDetails[];
}) {
  const [state, formAction, pending] = useActionState(sendTestMailAction, initialState);
  const hasMultipleFromEmails = fromEmailOptions.length > 1;

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
        <div className="space-y-4">
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

          <div>
            <span className="label">Send from</span>
            {fromEmailOptions.length ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {fromEmailOptions.map((option, index) => (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-slate-300"
                  >
                    <input
                      type="radio"
                      name="fromEmailOption"
                      value={option.key}
                      defaultChecked={index === 0}
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      <span className="block font-medium text-slate-900">{option.label}</span>
                      <span className="block break-all text-slate-500">{option.email}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Configure <code>SES_FROM_EMAIL</code> before sending a test email.
              </p>
            )}
            {!hasMultipleFromEmails ? (
              <p className="mt-2 text-xs text-slate-500">
                Add <code>SES_FROM_EMAIL_2</code> to show the second sender option.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-end">
          <button className="btn-primary w-full lg:w-auto lg:min-w-[150px]" disabled={pending || !fromEmailOptions.length}>
            {pending ? "Sending..." : "Send test mail"}
          </button>
        </div>
      </form>
    </section>
  );
}
