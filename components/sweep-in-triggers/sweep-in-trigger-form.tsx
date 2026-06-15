"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import type { SearchableComboboxOption } from "@/components/ui/searchable-combobox";

type UserOption = SearchableComboboxOption;

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  users: UserOption[];
  triggerId?: string;
  defaultDate?: string;
  defaultTime?: string;
  defaultUserIds?: string[];
  defaultNotes?: string;
  cancelHref?: string;
};

export function SweepInTriggerForm({
  action,
  submitLabel,
  users,
  triggerId,
  defaultDate = "",
  defaultTime = "",
  defaultUserIds = [],
  defaultNotes = "",
  cancelHref = "/sweep-in-triggers",
}: Props) {
  const [triggerDate, setTriggerDate] = useState(defaultDate);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(defaultUserIds);

  useEffect(() => {
    setSelectedUserIds(defaultUserIds);
  }, [defaultUserIds]);

  const selectedDateLabel = useMemo(() => {
    if (!triggerDate) return "Select a date before selecting users.";
    return "Select one or more users";
  }, [triggerDate]);

  return (
    <form action={action} className="card grid gap-5 p-5 md:grid-cols-2">
      {triggerId ? <input type="hidden" name="triggerId" value={triggerId} /> : null}

      <label className="block text-sm font-medium text-slate-700">
        Trigger date <span className="text-rose-600">*</span>
        <input
          type="date"
          name="triggerDate"
          required
          value={triggerDate}
          onChange={(event) => {
            setTriggerDate(event.target.value);
            setSelectedUserIds([]);
          }}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Login time <span className="text-rose-600">*</span>
        <input
          type="time"
          name="triggerTime"
          required
          defaultValue={defaultTime}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-slate-700">
          Users <span className="text-rose-600">*</span>
        </label>
        <SearchableMultiSelect
          key={triggerDate || "no-date"}
          id="sweep-in-users"
          name="userIds"
          options={users}
          value={selectedUserIds}
          onValueChange={setSelectedUserIds}
          placeholder={selectedDateLabel}
          searchPlaceholder="Search users..."
          emptyLabel="No users available."
          disabled={!triggerDate}
          required
        />
        <p className="mt-2 text-xs text-slate-500">
          User selection is enabled only after selecting a date. Changing the date clears the selected users.
        </p>
      </div>

      <label className="block text-sm font-medium text-slate-700 md:col-span-2">
        Notes <span className="text-rose-600">*</span>
        <textarea
          name="notes"
          required
          rows={4}
          defaultValue={defaultNotes}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          placeholder="Explain why the sweep-in login time update is required."
        />
      </label>

      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
        <a href={cancelHref} className="btn-secondary">
          Cancel
        </a>
      </div>
    </form>
  );
}
