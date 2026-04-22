"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { LeaveFormState } from "@/lib/actions/leave-actions";

const initialState: LeaveFormState = {};

function isWeekend(dateString: string) {
  if (!dateString) return false;
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function LeaveRequestForm({
  action,
  approvers,
  mode = "create",
  initialValues,
  minDate,
  leaveBalance,
  blockedDateKeys,
}: {
  action: (state: LeaveFormState, formData: FormData) => Promise<LeaveFormState>;
  approvers: Array<{ id: string; fullName: string; userType: string; functionalRole?: string | null }>;
  mode?: "create" | "edit";
  initialValues?: {
    id?: string;
    startDate?: string;
    endDate?: string;
    reason?: string | null;
    approverId?: string | null;
    diwaliLeave?: boolean;
  };
  minDate: string;
  leaveBalance: { casualLeaves: number; earnedLeaves: number };
  blockedDateKeys: string[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [approverId, setApproverId] = useState(initialValues?.approverId ?? "");
  const [diwaliLeave, setDiwaliLeave] = useState(Boolean(initialValues?.diwaliLeave));
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? minDate);
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? initialValues?.startDate ?? minDate);
  const [boundaryError, setBoundaryError] = useState<string>("");
  const [key, setKey] = useState(0);
  const blockedDates = useMemo(() => new Set(blockedDateKeys), [blockedDateKeys]);

  useEffect(() => {
    if (state?.success && mode === "create") {
      setApproverId("");
      setDiwaliLeave(false);
      setStartDate(minDate);
      setEndDate(minDate);
      setBoundaryError("");
      setKey((value) => value + 1);
    }
  }, [mode, state?.success, minDate]);

  function validateBoundary(nextDate: string, label: "Start" | "End") {
    if (!nextDate) {
      setBoundaryError("");
      return true;
    }
    if (isWeekend(nextDate) || blockedDates.has(nextDate)) {
      setBoundaryError(`${label} date cannot be a Saturday, Sunday, or official holiday.`);
      return false;
    }
    setBoundaryError("");
    return true;
  }

  return (
    <form action={formAction} className="card p-6" key={key}>
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="approverId" value={approverId} />

      <h2 className="section-title">{mode === "create" ? "Create leave request" : "Edit leave request"}</h2>
      <p className="section-subtitle">
        Submit leave for approval. Leave type is automatically derived from available casual leaves, then earned leaves, then unpaid leave if needed.
      </p>

      <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Leaves remaining</p>
        <p className="mt-1">Casual: <span className="font-semibold">{leaveBalance.casualLeaves.toFixed(2)}</span> · Earned: <span className="font-semibold">{leaveBalance.earnedLeaves.toFixed(2)}</span></p>
      </div>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      ) : null}
      {boundaryError ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{boundaryError}</div>
      ) : null}
      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Leave request saved successfully.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="approverId">Approver</label>
          <SearchableCombobox
            id="approverId"
            value={approverId}
            onValueChange={setApproverId}
            options={approvers.map((approver) => ({
              value: approver.id,
              label: `${approver.fullName}`,
            }))}
            placeholder="Select approver"
            searchPlaceholder="Search approvers..."
            emptyLabel="No approver found."
          />
        </div>

        <div className="md:col-span-1">
          <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 mt-8 md:mt-7">
            <input
              type="checkbox"
              name="diwaliLeave"
              checked={diwaliLeave}
              onChange={(event) => setDiwaliLeave(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>Diwali Leave</span>
          </label>
        </div>

        <div>
          <label className="label" htmlFor="startDate">Start date</label>
          <input
            className="input"
            id="startDate"
            name="startDate"
            type="date"
            min={minDate}
            value={startDate}
            onChange={(event) => {
              const next = event.target.value;
              if (!validateBoundary(next, "Start")) return;
              setStartDate(next);
              if (endDate && endDate < next) setEndDate(next);
            }}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="endDate">End date</label>
          <input
            className="input"
            id="endDate"
            name="endDate"
            type="date"
            min={startDate || minDate}
            value={endDate}
            onChange={(event) => {
              const next = event.target.value;
              if (!validateBoundary(next, "End")) return;
              setEndDate(next);
            }}
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="reason">Reason</label>
          <textarea
            id="reason"
            name="reason"
            rows={4}
            className="input min-h-28"
            defaultValue={initialValues?.reason ?? ""}
            placeholder="Reason for leave"
            required
          />
        </div>

        <div className="md:col-span-2">
          <button className="btn-primary w-full" disabled={pending || Boolean(boundaryError)}>
            {pending ? "Saving..." : mode === "create" ? "Submit leave request" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
