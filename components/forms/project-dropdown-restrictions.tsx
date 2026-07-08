"use client";

import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";

type Option = { id: string; name: string; clientId?: string; movieId?: string; title?: string };

type Props = {
  label: string;
  name: string;
  options: Array<{ value: string; label: string; keywords?: string }>;
  value: string[];
  onValueChange: (value: string[]) => void;
  disabled?: boolean;
  helpText?: string;
};

export function ProjectDropdownRestrictionSelect({
  label,
  name,
  options,
  value,
  onValueChange,
  disabled = false,
  helpText = "Default is All. Select one or more values to restrict what users can choose in Time Entries.",
}: Props) {
  return (
    <div className="space-y-1 pl-6">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Allowed {label} values in Time Entries
      </div>
      <SearchableMultiSelect
        id={name}
        name={name}
        value={value}
        onValueChange={onValueChange}
        options={options}
        placeholder="All values"
        searchPlaceholder={`Search ${label.toLowerCase()}...`}
        emptyLabel={`No ${label.toLowerCase()} found.`}
        disabled={disabled}
      />
      <p className="text-xs text-slate-500">
        {value.length ? `${value.length} value(s) selected.` : helpText}
      </p>
    </div>
  );
}

export function optionLabel(option: Option) {
  return option.title ?? option.name;
}
