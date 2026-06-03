"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchableComboboxOption } from "@/components/ui/searchable-combobox";

type Props = {
  id: string;
  name?: string;
  options: SearchableComboboxOption[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  required?: boolean;
  buttonClassName?: string;
};

export function SearchableMultiSelect({
  id,
  name,
  options,
  value,
  defaultValue = [],
  onValueChange,
  placeholder = "Select options",
  searchPlaceholder = "Search...",
  emptyLabel = "No results found.",
  disabled = false,
  required = false,
  buttonClassName,
}: Props) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<string[]>(defaultValue);
  const selectedValues = isControlled ? value : internalValue;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastAutoSubmittedValueRef = useRef(defaultValue.join("\u001F"));

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
    setActiveIndex(0);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) => {
      const haystack = `${option.label} ${option.keywords ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  useEffect(() => {
    setActiveIndex((currentIndex) => {
      if (!filteredOptions.length) return 0;
      return Math.min(currentIndex, filteredOptions.length - 1);
    });
  }, [filteredOptions]);

  useEffect(() => {
    if (!isOpen) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const selectedOptions = useMemo(
    () => options.filter((option) => selectedValues.includes(option.value)),
    [options, selectedValues],
  );

  useEffect(() => {
    if (isOpen) return;

    const selectedKey = selectedValues.join("\u001F");
    if (selectedKey === lastAutoSubmittedValueRef.current) return;
    requestAutoSubmit(selectedValues);
  }, [isOpen, selectedValues]);

  function requestAutoSubmit(nextValues: string[]) {
    lastAutoSubmittedValueRef.current = nextValues.join("\u001F");
    window.setTimeout(() => {
      const form = wrapperRef.current?.closest("form");
      if (
        form instanceof HTMLFormElement &&
        form.dataset.autoSubmitFilter === "true"
      ) {
        form.requestSubmit();
      }
    }, 0);
  }

  function updateValues(nextValues: string[]) {
    if (!isControlled) {
      setInternalValue(nextValues);
    }
    onValueChange?.(nextValues);

    if (!isOpen) {
      requestAutoSubmit(nextValues);
    }
  }

  function toggleValue(nextValue: string) {
    const nextValues = selectedValues.includes(nextValue)
      ? selectedValues.filter((value) => value !== nextValue)
      : [...selectedValues, nextValue];

    updateValues(nextValues);
  }

  function removeValue(targetValue: string) {
    updateValues(selectedValues.filter((value) => value !== targetValue));
  }

  function moveActiveIndex(direction: 1 | -1) {
    if (!filteredOptions.length) return;
    setActiveIndex((currentIndex) => {
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0) return filteredOptions.length - 1;
      if (nextIndex >= filteredOptions.length) return 0;
      return nextIndex;
    });
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveIndex(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveIndex(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(0, filteredOptions.length - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const activeOption = filteredOptions[activeIndex];
      if (activeOption) toggleValue(activeOption.value);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative mt-1 w-full">
      {name
        ? selectedValues.map((selectedValue) => (
            <input
              key={selectedValue}
              type="hidden"
              name={name}
              value={selectedValue}
            />
          ))
        : null}
      {name && required && selectedValues.length === 0 ? (
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value=""
          readOnly
          required
          className="sr-only"
        />
      ) : null}

      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(
          "inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm font-normal text-slate-900 shadow-sm outline-none transition hover:border-slate-400 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          selectedOptions.length === 0 && "text-slate-500",
          buttonClassName,
        )}
      >
        <span className="min-w-0 flex-1">
          {selectedOptions.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {selectedOptions.map((option) => (
                <span
                  key={option.value}
                  className="inline-flex max-w-full items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                  onClick={(event) => event.stopPropagation()}
                >
                  <span className="truncate">{option.label}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeValue(option.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        removeValue(option.value);
                      }
                    }}
                    className="inline-flex items-center"
                    aria-label={`Remove ${option.label}`}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              ))}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-700 font-bold" />
      </button>

      {isOpen ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                data-auto-submit-ignore="true"
                onChange={(event) => {
                  event.stopPropagation();
                  setQuery(event.target.value);
                }}
                onInput={(event) => event.stopPropagation()}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                role="combobox"
                aria-controls={`${id}-listbox`}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-activedescendant={
                  filteredOptions[activeIndex]
                    ? `${id}-option-${filteredOptions[activeIndex].value}`
                    : undefined
                }
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div
            id={`${id}-listbox`}
            role="listbox"
            aria-multiselectable="true"
            className="max-h-64 overflow-y-auto p-1"
          >
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => {
                const isSelected = selectedValues.includes(option.value);
                const isActive = index === activeIndex;
                return (
                  <button
                    key={option.value}
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    id={`${id}-option-${option.value}`}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => toggleValue(option.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100",
                      isActive && "bg-slate-50 text-slate-900",
                      isSelected && "bg-slate-100 text-slate-900",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-sm text-slate-500">
                {emptyLabel}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
