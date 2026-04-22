"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonthKey } from "@/lib/ist";

type CalendarData = {
  monthKey: string;
  presentDays: string[];
  leaveDays: string[];
  weekendOrHolidayDays: string[];
  holidayNamesByDate?: Record<string, string>;
  minMonthKey: string;
  maxMonthKey: string;
};

type CalendarQueryParams = {
  billingStartDate?: string;
  billingEndDate?: string;
  billingProjectId?: string;
  billingModel?: string;
  leaveMonth?: string;
};

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)));
}

function shortMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "2-digit",
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

function buildMonthHref(monthKey: string, queryParams?: CalendarQueryParams) {
  const params = new URLSearchParams();

  if (queryParams?.billingStartDate) params.set("billingStartDate", queryParams.billingStartDate);
  if (queryParams?.billingEndDate) params.set("billingEndDate", queryParams.billingEndDate);
  if (queryParams?.billingProjectId) params.set("billingProjectId", queryParams.billingProjectId);
  if (queryParams?.billingModel) params.set("billingModel", queryParams.billingModel);
  if (queryParams?.leaveMonth) params.set("leaveMonth", queryParams.leaveMonth);
  params.set("month", monthKey);

  const query = params.toString();
  return query ? `/dashboard?${query}#attendance-calendar` : "/dashboard#attendance-calendar";
}

function DayCell({
  dateKey,
  day,
  todayKey,
  presentDays,
  leaveDays,
  weekendOrHolidayDays,
  holidayNamesByDate,
}: {
  dateKey?: string;
  day: number | null;
  todayKey: string;
  presentDays: Set<string>;
  leaveDays: Set<string>;
  weekendOrHolidayDays: Set<string>;
  holidayNamesByDate: Record<string, string>;
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

  const holidayName = dateKey ? holidayNamesByDate[dateKey] : "";

  return (
    <div className={`flex min-h-16 flex-col rounded-xl border px-2 py-2 text-slate-700 ${className}`}>
      <div className="flex items-start justify-end text-sm font-medium">{day ?? ""}</div>
      {holidayName ? (
        <div className="mt-1 line-clamp-2 text-[10px] leading-3 text-slate-600">{holidayName}</div>
      ) : null}
    </div>
  );
}

function MonthBlock({
  monthKey,
  todayKey,
  presentDays,
  leaveDays,
  weekendOrHolidayDays,
  holidayNamesByDate,
  className = "",
}: {
  monthKey: string;
  todayKey: string;
  presentDays: Set<string>;
  leaveDays: Set<string>;
  weekendOrHolidayDays: Set<string>;
  holidayNamesByDate: Record<string, string>;
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
          <div key={label} className="py-2">
            {label}
          </div>
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
            holidayNamesByDate={holidayNamesByDate}
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
  queryParams,
}: {
  focusMonthKey: string;
  companionMonthKey?: string;
  focusData: CalendarData;
  companionData?: CalendarData;
  todayKey: string;
  queryParams?: CalendarQueryParams;
}) {
  const rawPreviousMonth = shiftMonthKey(focusMonthKey, -1);
  const canGoPrevious = rawPreviousMonth >= focusData.minMonthKey;
  const previousMonth = canGoPrevious ? rawPreviousMonth : focusMonthKey;

  const nextMonth = shiftMonthKey(focusMonthKey, 1);

  const focusPresentDays = new Set(focusData.presentDays);
  const focusLeaveDays = new Set(focusData.leaveDays);
  const focusWeekendOrHolidayDays = new Set(focusData.weekendOrHolidayDays);
  const focusHolidayNamesByDate = focusData.holidayNamesByDate ?? {};
  const companionPresentDays = new Set(companionData?.presentDays ?? []);
  const companionLeaveDays = new Set(companionData?.leaveDays ?? []);
  const companionWeekendOrHolidayDays = new Set(companionData?.weekendOrHolidayDays ?? []);
  const companionHolidayNamesByDate = companionData?.holidayNamesByDate ?? {};

  const showDualLayout = Boolean(companionMonthKey && companionData);
  const leftMonthKey = companionMonthKey && companionData ? companionMonthKey : focusMonthKey;

  return (
    <section id="attendance-calendar" className="card p-6 scroll-mt-24">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="section-title">Attendance calendar</h2>
          <p className="section-subtitle">
            Green: present, Red: absent, Orange: approved leave, Purple: weekend or official holiday, Blue: today,
            White: future. Weekend or holiday dates change to approved leave only for unpaid sandwich leave cases.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 self-start">
          <Link
            scroll={false}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border ${
              !canGoPrevious
                ? "pointer-events-none border-slate-200 text-slate-300"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
            href={buildMonthHref(previousMonth, queryParams)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <div className="inline-flex min-w-[84px] items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium leading-none text-slate-700">
            {showDualLayout
              ? `${shortMonthLabel(leftMonthKey)} - ${shortMonthLabel(focusMonthKey)}`
              : shortMonthLabel(focusMonthKey)}
          </div>

          <Link
            scroll={false}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
            href={buildMonthHref(nextMonth, queryParams)}
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
            holidayNamesByDate={companionHolidayNamesByDate}
            className="hidden 2xl:block"
          />
          <MonthBlock
            monthKey={focusMonthKey}
            todayKey={todayKey}
            presentDays={focusPresentDays}
            leaveDays={focusLeaveDays}
            weekendOrHolidayDays={focusWeekendOrHolidayDays}
            holidayNamesByDate={focusHolidayNamesByDate}
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
            holidayNamesByDate={focusHolidayNamesByDate}
          />
        </div>
      )}
    </section>
  );
}