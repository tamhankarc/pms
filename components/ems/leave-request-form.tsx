"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import type { LeaveFormState } from "@/lib/actions/leave-actions";

const initialState: LeaveFormState = {};
type DaySelection = "FULL_DAY" | "HALF_DAY" | "FIRST_HALF" | "SECOND_HALF";
type SelectionMode = "FULL_DAYS" | "HALF_DAYS" | "CUSTOM";
type FormContext = {
  id: string;
  fullName: string;
  approvers: Array<{
    id: string;
    fullName: string;
    userType: string;
    functionalRole?: string | null;
  }>;
  leaveBalance: { casualLeaves: number; earnedLeaves: number };
  blockedDateKeys: string[];
};

function isWeekend(dateString: string) {
  if (!dateString) return false;
  const day = new Date(`${dateString}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

function nextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function normalizeDaySelection(value: string | undefined): DaySelection {
  if (
    value === "FIRST_HALF" ||
    value === "SECOND_HALF" ||
    value === "HALF_DAY"
  ) {
    return value;
  }
  return "FULL_DAY";
}

function isHalfDaySelection(value: DaySelection) {
  return (
    value === "HALF_DAY" || value === "FIRST_HALF" || value === "SECOND_HALF"
  );
}

function parseStoredDurations(raw?: string | null) {
  if (!raw) return {} as Record<string, DaySelection>;
  try {
    const data = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(data).map(([date, type]) => [
        date,
        normalizeDaySelection(type),
      ]),
    ) as Record<string, DaySelection>;
  } catch {
    return {} as Record<string, DaySelection>;
  }
}

export function LeaveRequestForm({
  action,
  approvers,
  mode = "create",
  initialValues,
  minDate,
  leaveBalance,
  blockedDateKeys,
  employeeContexts = [],
  canCreateOnBehalf = false,
  currentUserId,
}: {
  action: (
    state: LeaveFormState,
    formData: FormData,
  ) => Promise<LeaveFormState>;
  approvers: Array<{
    id: string;
    fullName: string;
    userType: string;
    functionalRole?: string | null;
  }>;
  mode?: "create" | "edit";
  initialValues?: {
    id?: string;
    requestedForUserId?: string;
    requestedForUserName?: string;
    startDate?: string;
    endDate?: string;
    reason?: string | null;
    approverId?: string | null;
    approverIds?: string[];
    diwaliLeave?: boolean;
    daySelectionMode?: SelectionMode;
    leaveDayTypesJson?: string | null;
  };
  minDate: string;
  leaveBalance: { casualLeaves: number; earnedLeaves: number };
  blockedDateKeys: string[];
  employeeContexts?: FormContext[];
  canCreateOnBehalf?: boolean;
  currentUserId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [requestedForUserId, setRequestedForUserId] = useState(
    initialValues?.requestedForUserId ?? employeeContexts[0]?.id ?? "",
  );
  const selectedContext = employeeContexts.find(
    (employee) => employee.id === requestedForUserId,
  );
  const activeApprovers = selectedContext?.approvers ?? approvers;
  const activeLeaveBalance = selectedContext?.leaveBalance ?? leaveBalance;
  const activeBlockedDates =
    selectedContext?.blockedDateKeys ?? blockedDateKeys;
  const canSelectPastDate =
    mode === "create" &&
    canCreateOnBehalf &&
    Boolean(requestedForUserId) &&
    requestedForUserId !== currentUserId;
  const [approverIds, setApproverIds] = useState<string[]>(
    initialValues?.approverIds?.length
      ? initialValues.approverIds
      : initialValues?.approverId
        ? [initialValues.approverId]
        : [],
  );
  const [diwaliLeave, setDiwaliLeave] = useState(
    Boolean(initialValues?.diwaliLeave),
  );
  const [startDate, setStartDate] = useState(
    initialValues?.startDate ?? minDate,
  );
  const [endDate, setEndDate] = useState(
    initialValues?.endDate ?? initialValues?.startDate ?? minDate,
  );
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(
    initialValues?.daySelectionMode ?? "FULL_DAYS",
  );
  const [halfDaySelection, setHalfDaySelection] = useState<DaySelection>(() => {
    const stored = parseStoredDurations(initialValues?.leaveDayTypesJson);
    const firstHalfDay = Object.values(stored).find(isHalfDaySelection);
    return firstHalfDay === "SECOND_HALF" ? "SECOND_HALF" : "FIRST_HALF";
  });
  const [customDurations, setCustomDurations] = useState<
    Record<string, DaySelection>
  >(() => parseStoredDurations(initialValues?.leaveDayTypesJson));
  const [boundaryError, setBoundaryError] = useState("");
  const [key, setKey] = useState(0);
  const blockedDates = useMemo(
    () => new Set(activeBlockedDates),
    [activeBlockedDates],
  );

  const workingDateKeys = useMemo(() => {
    const items: string[] = [];
    if (!startDate || !endDate || endDate < startDate) return items;
    let cursor = startDate;
    while (cursor <= endDate) {
      if (!isWeekend(cursor) && !blockedDates.has(cursor)) items.push(cursor);
      cursor = nextDateKey(cursor);
    }
    return items;
  }, [startDate, endDate, blockedDates]);

  const effectiveDurations = useMemo(
    () =>
      Object.fromEntries(
        workingDateKeys.map((date) => [
          date,
          selectionMode === "HALF_DAYS"
            ? halfDaySelection
            : selectionMode === "CUSTOM"
              ? (customDurations[date] ?? "FULL_DAY")
              : "FULL_DAY",
        ]),
      ) as Record<string, DaySelection>,
    [workingDateKeys, selectionMode, halfDaySelection, customDurations],
  );
  const calculatedDays = Object.values(effectiveDurations).reduce(
    (sum, duration) => sum + (isHalfDaySelection(duration) ? 0.5 : 1),
    0,
  );

  useEffect(() => {
    if (state?.success && mode === "create") {
      setApproverIds([]);
      setDiwaliLeave(false);
      setStartDate(minDate);
      setEndDate(minDate);
      setSelectionMode("FULL_DAYS");
      setHalfDaySelection("FIRST_HALF");
      setCustomDurations({});
      setBoundaryError("");
      setKey((value) => value + 1);
    }
  }, [mode, state?.success, minDate]);

  useEffect(() => {
    const validApproverIds = new Set(
      activeApprovers.map((approver) => approver.id),
    );
    const filteredApproverIds = approverIds.filter((id) =>
      validApproverIds.has(id),
    );
    if (filteredApproverIds.length !== approverIds.length) {
      setApproverIds(filteredApproverIds);
    }
  }, [requestedForUserId, activeApprovers, approverIds]);

  function validateBoundary(nextDate: string, label: "Start" | "End") {
    if (!nextDate) {
      setBoundaryError("");
      return true;
    }
    if (isWeekend(nextDate) || blockedDates.has(nextDate)) {
      setBoundaryError(
        `${label} date cannot be a Saturday, Sunday, or official holiday.`,
      );
      return false;
    }
    setBoundaryError("");
    return true;
  }

  return (
    <form action={formAction} className="card p-6" key={key}>
      {initialValues?.id ? (
        <input type="hidden" name="id" value={initialValues.id} />
      ) : null}
      <input
        type="hidden"
        name="requestedForUserId"
        value={requestedForUserId}
      />
      {approverIds.map((approverId) => (
        <input
          key={approverId}
          type="hidden"
          name="approverIds"
          value={approverId}
        />
      ))}
      <input type="hidden" name="daySelectionMode" value={selectionMode} />
      <input
        type="hidden"
        name="leaveDayTypesJson"
        value={JSON.stringify(effectiveDurations)}
      />
      <h2 className="section-title">
        {mode === "create" ? "Create leave request" : "Edit leave request"}
      </h2>
      <p className="section-subtitle">
        Submit leave for approval. Leave deduction is automatically applied from
        casual leaves, then earned leaves, then unpaid leave.
      </p>
      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {boundaryError ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {boundaryError}
        </div>
      ) : null}
      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Leave request saved successfully.
        </div>
      ) : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {canCreateOnBehalf && mode === "create" ? (
          <div className="md:col-span-2">
            <label className="label" htmlFor="requestedForUserId">
              Request on behalf of employee
            </label>
            <SearchableCombobox
              id="requestedForUserSelector"
              value={requestedForUserId}
              onValueChange={setRequestedForUserId}
              options={employeeContexts.map((employee) => ({
                value: employee.id,
                label: employee.fullName,
              }))}
              placeholder="Select employee"
              searchPlaceholder="Search employees..."
              emptyLabel="No eligible user found."
              required
            />
          </div>
        ) : null}
        {mode === "edit" && initialValues?.requestedForUserName ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold">Employee:</span>{" "}
            {initialValues.requestedForUserName}
          </div>
        ) : null}
        <div className="md:col-span-2 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Leaves remaining</p>
          <p className="mt-1">
            Casual:{" "}
            <span className="font-semibold">
              {activeLeaveBalance.casualLeaves.toFixed(2)}
            </span>{" "}
            · Earned:{" "}
            <span className="font-semibold">
              {activeLeaveBalance.earnedLeaves.toFixed(2)}
            </span>
          </p>
        </div>
        <div>
          <label className="label" htmlFor="approverIds">
            Approvers
          </label>
          <SearchableMultiSelect
            id="approverIds"
            value={approverIds}
            onValueChange={setApproverIds}
            options={activeApprovers.map((approver) => ({
              value: approver.id,
              label: approver.fullName,
            }))}
            placeholder="Select one or more approvers"
            searchPlaceholder="Search approvers..."
            emptyLabel="No approver found."
            required
          />
        </div>
        <div>
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
          <label className="label" htmlFor="startDate">
            Start date
          </label>
          <input
            className="input"
            id="startDate"
            name="startDate"
            type="date"
            min={canSelectPastDate ? undefined : minDate}
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
          <label className="label" htmlFor="endDate">
            End date
          </label>
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
          <label className="label" htmlFor="daySelectionMode">
            Leave duration
          </label>
          <SearchableCombobox
            id="daySelectionMode"
            value={selectionMode}
            onValueChange={(value) => setSelectionMode(value as SelectionMode)}
            options={[
              { value: "FULL_DAYS", label: "All working days - Full day" },
              { value: "HALF_DAYS", label: "All working days - Half day" },
              ...(workingDateKeys.length > 1
                ? [{ value: "CUSTOM", label: "Customize each day" }]
                : []),
            ]}
            placeholder="Select leave duration"
            searchPlaceholder="Search leave durations..."
            emptyLabel="No leave duration found."
          />
          {selectionMode === "HALF_DAYS" ? (
            <div className="mt-3 max-w-xs">
              <label className="label" htmlFor="halfDaySelection">
                Half-day option
              </label>
              <SearchableCombobox
                id="halfDaySelection"
                value={halfDaySelection}
                onValueChange={(value) =>
                  setHalfDaySelection(
                    value === "SECOND_HALF" ? "SECOND_HALF" : "FIRST_HALF",
                  )
                }
                options={[
                  { value: "FIRST_HALF", label: "First half" },
                  { value: "SECOND_HALF", label: "Second half" },
                ]}
                placeholder="Select half-day option"
                searchPlaceholder="Search half-day options..."
                emptyLabel="No half-day option found."
              />
            </div>
          ) : null}
          <p className="mt-2 text-sm text-slate-500">
            Total selected leave:{" "}
            <span className="font-semibold text-slate-900">
              {calculatedDays.toFixed(2)} day(s)
            </span>
          </p>
        </div>
        {selectionMode === "CUSTOM" && workingDateKeys.length > 1 ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-900">
              Select leave duration for each working day
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {workingDateKeys.map((date) => (
                <label
                  key={date}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <span>{date}</span>
                  <div className="max-w-36">
                    <SearchableCombobox
                      id={`customDuration-${date}`}
                      value={customDurations[date] ?? "FULL_DAY"}
                      onValueChange={(value) =>
                        setCustomDurations((current) => ({
                          ...current,
                          [date]: normalizeDaySelection(value),
                        }))
                      }
                      options={[
                        { value: "FULL_DAY", label: "Full day" },
                        { value: "FIRST_HALF", label: "First half" },
                        { value: "SECOND_HALF", label: "Second half" },
                      ]}
                      placeholder="Select duration"
                      searchPlaceholder="Search durations..."
                      emptyLabel="No duration found."
                      buttonClassName="max-w-36"
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <div className="md:col-span-2">
          <label className="label" htmlFor="reason">
            Reason
          </label>
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
          <button
            className="btn-primary w-full"
            disabled={pending || Boolean(boundaryError)}
          >
            {pending
              ? "Saving..."
              : mode === "create"
                ? "Submit leave request"
                : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
