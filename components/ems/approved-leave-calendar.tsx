"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { clampMonthKey, getDisplayDateFromKey, getIstDateKey, shiftMonthKey } from "@/lib/ist";

type ApprovedLeaveCalendarData = {
  monthKey: string;
  minMonthKey: string;
  maxMonthKey: string;
  selectedDateKey: string;
  itemsByDate: Record<string, string[]>;
};

type CalendarCell = {
  day: number | null;
  dateKey?: string;
};

const STORAGE_KEY = "approved-leave-calendar-selection";

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)));
}

function formatSelectedDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(getDisplayDateFromKey(dateKey));
}

function toDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonthGrid(monthKey: string): CalendarCell[] {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const firstWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ day: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      dateKey: toDateKey(year, month - 1, day),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: null });
  }

  return cells;
}

function readStoredSelection() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { dateKey?: string; names?: string[] };
    if (!parsed.dateKey) return null;

    return {
      dateKey: parsed.dateKey,
      names: Array.isArray(parsed.names) ? parsed.names : [],
    };
  } catch {
    return null;
  }
}

function writeStoredSelection(dateKey: string, names: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dateKey,
        names,
      }),
    );
  } catch {
    // ignore storage failures
  }
}

export function ApprovedLeaveCalendar({
  title,
  subtitle,
  data,
  basePath,
  extraSearchParams = {},
}: {
  title: string;
  subtitle: string;
  data: ApprovedLeaveCalendarData;
  basePath: string;
  extraSearchParams?: Record<string, string | undefined>;
}) {
  const todayKey = getIstDateKey();

  const fallbackDateKey = data.selectedDateKey.startsWith(data.monthKey)
    ? data.selectedDateKey
    : `${data.monthKey}-01`;

  const storedSelection = readStoredSelection();

  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    storedSelection?.dateKey || fallbackDateKey,
  );

  const [selectedNames, setSelectedNames] = useState<string[]>(
    storedSelection?.names ?? data.itemsByDate[fallbackDateKey] ?? [],
  );

  const previousMonth = clampMonthKey(
    shiftMonthKey(data.monthKey, -1),
    data.minMonthKey,
    data.maxMonthKey,
  );

  const nextMonth = clampMonthKey(
    shiftMonthKey(data.monthKey, 1),
    data.minMonthKey,
    data.maxMonthKey,
  );

  const previousDisabled = previousMonth === data.monthKey;
  const nextDisabled = nextMonth === data.monthKey;
  const grid = useMemo(() => buildMonthGrid(data.monthKey), [data.monthKey]);

  const buildHref = (month: string) => {
    const params = new URLSearchParams();
    params.set("leaveMonth", month);

    Object.entries(extraSearchParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    const query = params.toString();
    return query
      ? `${basePath}?${query}#approved-leave-calendar`
      : `${basePath}#approved-leave-calendar`;
  };

  const handleDateClick = (dateKey: string) => {
    const names = data.itemsByDate[dateKey] ?? [];
    setSelectedDateKey(dateKey);
    setSelectedNames(names);
    writeStoredSelection(dateKey, names);
  };

  return (
    <section id="approved-leave-calendar" className="card p-6 scroll-mt-24">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>

        <div className="flex items-center justify-center gap-3 self-start">
          <Link
            scroll={false}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border ${
              previousDisabled
                ? "pointer-events-none border-slate-200 text-slate-300"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
            href={buildHref(previousMonth)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <div className="inline-flex min-w-[84px] items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium leading-none text-slate-700">
            {monthLabel(data.monthKey)}
          </div>

          <Link
            scroll={false}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border ${
              nextDisabled
                ? "pointer-events-none border-slate-200 text-slate-300"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
            href={buildHref(nextMonth)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, headerIndex) => (
            <div key={`weekday-${headerIndex}-${label}`} className="py-2">
              {label}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {grid.map((cell, index) => {
            const cellKey = `${data.monthKey}-${index}-${cell.dateKey ?? "empty"}`;

            if (!cell.dateKey || cell.day === null) {
              return (
                <div
                  key={cellKey}
                  className="min-h-16 rounded-2xl border border-transparent bg-transparent"
                />
              );
            }

            const hasLeave = (data.itemsByDate[cell.dateKey] ?? []).length > 0;
            const isSelected = selectedDateKey === cell.dateKey;
            const isToday = todayKey === cell.dateKey;

            const baseClass =
              isSelected && isToday
                ? "border-indigo-400 bg-indigo-100 ring-2 ring-indigo-200 shadow-sm"
                : isSelected
                  ? "border-amber-400 bg-amber-100 ring-2 ring-amber-200 shadow-sm"
                  : isToday
                    ? "border-sky-400 bg-sky-100 ring-2 ring-sky-200"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";

            return (
              <button
                key={cellKey}
                type="button"
                onClick={() => handleDateClick(cell.dateKey!)}
                className={`flex min-h-16 flex-col items-start justify-between rounded-2xl border px-3 py-2 text-left transition ${baseClass}`}
              >
                <span className="text-sm font-semibold text-slate-800">{cell.day}</span>
                <span className="flex h-5 items-center gap-1 text-[11px] font-medium text-orange-700">
                  {hasLeave ? <CalendarDays className="h-3.5 w-3.5" /> : null}
                  {hasLeave ? "Leave" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="text-sm font-semibold text-slate-900">
          {formatSelectedDate(selectedDateKey)}
        </div>
        <div className="mt-2 text-sm text-slate-600">
          {selectedNames.length > 0 ? selectedNames.join(", ") : "No employees on approved leave."}
        </div>
      </div>
    </section>
  );
}