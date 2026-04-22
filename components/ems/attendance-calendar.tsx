"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clampMonthKey, shiftMonthKey } from "@/lib/ist";

type CalendarData = {
  monthKey: string;
  presentDays: string[];
  leaveDays: string[];
  weekendOrHolidayDays: string[];
  minMonthKey: string;
  maxMonthKey: string;
};

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)));
}

function toDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonthGrid(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const firstWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
  const cells: Array<{ day: number | null; dateKey?: string }> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ day: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, dateKey: toDateKey(year, month - 1, day) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: null });
  }

  return cells;
}

function DayCell({ dateKey, day, todayKey, presentDays, leaveDays, weekendOrHolidayDays }: {
  dateKey?: string;
  day: number | null;
  todayKey: string;
  presentDays: Set<string>;
  leaveDays: Set<string>;
  weekendOrHolidayDays: Set<string>;
}) {
  let className = "bg-transparent border-transparent";

  if (dateKey) {
    if (dateKey === todayKey) {
      className = "border-sky-200 bg-sky-100";
    } else if (leaveDays.has(dateKey)) {
      className = "border-orange-200 bg-orange-100";
    } else if (weekendOrHolidayDays.has(dateKey)) {
      className = "border-purple-200 bg-purple-100";
    } else if (dateKey > todayKey) {
      className = "border-slate-200 bg-white";
    } else if (presentDays.has(dateKey)) {
      className = "border-emerald-200 bg-emerald-100";
    } else {
      className = "border-red-200 bg-red-100";
    }
  }

  return (
    <div
      className={`flex min-h-12 items-start justify-end rounded-xl border px-2 py-2 text-sm font-medium text-slate-700 ${className}`}
    >
      {day ?? ""}
    </div>
  );
}

function MonthBlock({ monthKey, todayKey, presentDays, leaveDays, weekendOrHolidayDays, className = "" }: {
  monthKey: string;
  todayKey: string;
  presentDays: Set<string>;
  leaveDays: Set<string>;
  weekendOrHolidayDays: Set<string>;
  className?: string;
}) {
  const grid = buildMonthGrid(monthKey);

  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-4 ${className}`.trim()}>
      <div className="mb-4 text-center">
        <h3 className="text-lg font-semibold text-slate-900">{monthLabel(monthKey)}</h3>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="py-2">{label}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {grid.map((cell, index) => (
          <DayCell
            key={`${monthKey}-${index}`}
            dateKey={cell.dateKey}
            day={cell.day}
            todayKey={todayKey}
            presentDays={presentDays}
            leaveDays={leaveDays}
            weekendOrHolidayDays={weekendOrHolidayDays}
          />
        ))}
      </div>
    </div>
  );
}

export function AttendanceCalendar({
  focusMonthKey,
  companionMonthKey,
  focusData,
  companionData,
  todayKey,
}: {
  focusMonthKey: string;
  companionMonthKey?: string;
  focusData: CalendarData;
  companionData?: CalendarData;
  todayKey: string;
}) {
  const previousMonth = clampMonthKey(
    shiftMonthKey(focusMonthKey, -1),
    focusData.minMonthKey,
    focusData.maxMonthKey,
  );
  const nextMonth = clampMonthKey(
    shiftMonthKey(focusMonthKey, 1),
    focusData.minMonthKey,
    focusData.maxMonthKey,
  );

  const focusPresentDays = new Set(focusData.presentDays);
  const focusLeaveDays = new Set(focusData.leaveDays);
  const focusWeekendOrHolidayDays = new Set(focusData.weekendOrHolidayDays);
  const companionPresentDays = new Set(companionData?.presentDays ?? []);
  const companionLeaveDays = new Set(companionData?.leaveDays ?? []);
  const companionWeekendOrHolidayDays = new Set(companionData?.weekendOrHolidayDays ?? []);

  const showDualLayout = Boolean(companionMonthKey && companionData);
  const leftMonthKey = companionMonthKey && companionData ? companionMonthKey : focusMonthKey;

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="section-title">Attendance calendar</h2>
          <p className="section-subtitle">
            Green: present, Red: absent, Orange: approved leave, Purple: weekend or official holiday, Blue: today, White: future. Weekend or holiday dates change to approved leave only for unpaid sandwich leave cases.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 self-start">
          <Link
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border ${previousMonth === focusMonthKey ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            href={`/dashboard?month=${previousMonth}`}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
            {showDualLayout ? `${monthLabel(leftMonthKey)} - ${monthLabel(focusMonthKey)}` : monthLabel(focusMonthKey)}
          </div>
          <Link
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border ${nextMonth === focusMonthKey ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            href={`/dashboard?month=${nextMonth}`}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {showDualLayout ? (
        <div className="mt-6 grid gap-6 2xl:grid-cols-2">
          <MonthBlock
            monthKey={companionMonthKey!}
            todayKey={todayKey}
            presentDays={companionPresentDays}
            leaveDays={companionLeaveDays}
            weekendOrHolidayDays={companionWeekendOrHolidayDays}
            className="hidden 2xl:block"
          />
          <MonthBlock
            monthKey={focusMonthKey}
            todayKey={todayKey}
            presentDays={focusPresentDays}
            leaveDays={focusLeaveDays}
            weekendOrHolidayDays={focusWeekendOrHolidayDays}
            className="2xl:col-span-1"
          />
        </div>
      ) : (
        <div className="mt-6">
          <MonthBlock
            monthKey={focusMonthKey}
            todayKey={todayKey}
            presentDays={focusPresentDays}
            leaveDays={focusLeaveDays}
            weekendOrHolidayDays={focusWeekendOrHolidayDays}
          />
        </div>
      )}
    </section>
  );
}
