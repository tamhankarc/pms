"use client";

import { useRef, useState } from "react";
import type { BillingModel } from "@prisma/client";

type Props = {
  attendanceDate: string;
  attendanceMode: "present" | "absent";
  leaveMonth: string;
  month?: string;
  billingStartDate?: string;
  billingEndDate?: string;
  billingClientId?: string;
  billingProjectId?: string;
  billingModel?: BillingModel | "";
  approvedLeaveSelectedDate?: string;
  dashboardSection?: string;
};

const APPROVED_LEAVE_STORAGE_KEY = "approved-leave-calendar-selection";

function readApprovedLeaveSelectedDate() {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.sessionStorage.getItem(APPROVED_LEAVE_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { dateKey?: string };
    return parsed.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dateKey) ? parsed.dateKey : undefined;
  } catch {
    return undefined;
  }
}

export function AttendanceSelectedDateFilters({
  attendanceDate,
  attendanceMode,
  leaveMonth,
  month,
  billingStartDate,
  billingEndDate,
  billingClientId,
  billingProjectId,
  billingModel,
  approvedLeaveSelectedDate,
  dashboardSection,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(attendanceDate);
  const [selectedMode, setSelectedMode] = useState<"present" | "absent">(attendanceMode);
  const approvedLeaveInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <form
      className="mt-4 grid gap-3 lg:grid-cols-[minmax(320px,1fr)_auto_auto]"
      method="get"
      action="/dashboard#attendance-selected-date"
      onSubmit={() => {
        const latestApprovedLeaveSelectedDate = readApprovedLeaveSelectedDate() ?? approvedLeaveSelectedDate ?? "";
        if (approvedLeaveInputRef.current) {
          approvedLeaveInputRef.current.value = latestApprovedLeaveSelectedDate;
        }
      }}
    >
      <input
        className="input"
        type="date"
        name="attendanceDate"
        value={selectedDate}
        onChange={(event) => setSelectedDate(event.target.value)}
      />

      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="radio"
            name="attendanceMode"
            value="present"
            checked={selectedMode === "present"}
            onChange={() => setSelectedMode("present")}
          />
          Present
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="radio"
            name="attendanceMode"
            value="absent"
            checked={selectedMode === "absent"}
            onChange={() => setSelectedMode("absent")}
          />
          Absent
        </label>
      </div>

      <button className="btn-secondary" type="submit">Apply</button>

      <input type="hidden" name="leaveMonth" value={leaveMonth} />
      {month ? <input type="hidden" name="month" value={month} /> : null}
      {billingStartDate ? <input type="hidden" name="billingStartDate" value={billingStartDate} /> : null}
      {billingEndDate ? <input type="hidden" name="billingEndDate" value={billingEndDate} /> : null}
      {billingClientId ? <input type="hidden" name="billingClientId" value={billingClientId} /> : null}
      {billingProjectId ? <input type="hidden" name="billingProjectId" value={billingProjectId} /> : null}
      {billingModel ? <input type="hidden" name="billingModel" value={billingModel} /> : null}
      <input
        ref={approvedLeaveInputRef}
        type="hidden"
        name="approvedLeaveSelectedDate"
        defaultValue={approvedLeaveSelectedDate ?? ""}
      />
      {dashboardSection ? <input type="hidden" name="dashboardSection" value={dashboardSection} /> : null}
    </form>
  );
}