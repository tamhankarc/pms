"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableComboboxOption = {
  value: string;
  label: string;
  keywords?: string;
};

type Props = {
  id: string;
  name?: string;
  options: SearchableComboboxOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  required?: boolean;
  buttonClassName?: string;
};

export function SearchableCombobox({
  id,
  name,
  options,
  value,
  defaultValue = "",
  onValueChange,
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  emptyLabel = "No results found.",
  disabled = false,
  required = false,
  buttonClassName,
}: Props) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = isControlled ? value : internalValue;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
    setQuery("");
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedValue),
    [options, selectedValue],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) => {
      const haystack = `${option.label} ${option.keywords ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  function updateValue(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
    setIsOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative mt-1 w-full">
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-required={required}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1 text-left text-sm font-normal text-slate-900 shadow-sm outline-none transition hover:border-slate-400 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          !selectedOption && "text-slate-500",
          buttonClassName,
        )}
      >
        <span className="min-w-0 flex-1 truncate">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 text-bold" />
      </button>

      {isOpen ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === selectedValue;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateValue(option.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100",
                      isSelected && "bg-slate-100 text-slate-900",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    <Check className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-sm text-slate-500">{emptyLabel}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
