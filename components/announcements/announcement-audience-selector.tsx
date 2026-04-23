"use client";

import { useEffect, useState } from "react";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";

export function AnnouncementAudienceSelector({
  modeName,
  userIdsName,
  options,
  defaultMode = "all",
  defaultUserIds = [],
}: {
  modeName: string;
  userIdsName: string;
  options: { value: string; label: string }[];
  defaultMode?: "all" | "specific";
  defaultUserIds?: string[];
}) {
  const [mode, setMode] = useState<"all" | "specific">(defaultMode);

  useEffect(() => {
    if (defaultMode === "specific" && defaultUserIds.length > 0) {
      setMode("specific");
    }
  }, [defaultMode, defaultUserIds]);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-700">Audience</label>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="radio"
            name={modeName}
            value="all"
            checked={mode === "all"}
            onChange={() => setMode("all")}
          />
          All Users
        </label>

        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="radio"
            name={modeName}
            value="specific"
            checked={mode === "specific"}
            onChange={() => setMode("specific")}
          />
          Specific users
        </label>
      </div>

      <div className={mode === "specific" ? "" : "pointer-events-none opacity-50"}>
        <SearchableMultiSelect
          id={userIdsName}
          name={userIdsName}
          options={options}
          defaultValue={defaultUserIds}
          placeholder="Select users"
          searchPlaceholder="Search users..."
          emptyLabel="No users found."
        />
      </div>
    </div>
  );
}