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
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

  useEffect(() => {
    if (!isControlled) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue, isControlled]);

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

  useEffect(() => {
    if (!filteredOptions.length) {
      setActiveIndex(0);
      return;
    }

    const selectedIndex = filteredOptions.findIndex(
      (option) => option.value === selectedValue,
    );
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [filteredOptions, selectedValue]);

  useEffect(() => {
    if (!isOpen) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  function updateValue(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = nextValue;
    }

    onValueChange?.(nextValue);
    setIsOpen(false);

    window.setTimeout(() => {
      const hiddenInput = hiddenInputRef.current;
      if (!hiddenInput) return;

      hiddenInput.value = nextValue;

      const form = hiddenInput.closest("form");
      if (
        form instanceof HTMLFormElement &&
        form.dataset.autoSubmitFilter === "true"
      ) {
        form.requestSubmit();
      }
    }, 0);
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
      if (activeOption) updateValue(activeOption.value);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      {name ? (
        <input
          ref={hiddenInputRef}
          type="hidden"
          name={name}
          value={selectedValue}
          required={required}
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
          "inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1 text-left text-sm font-normal text-slate-900 shadow-sm outline-none transition hover:border-slate-400 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          !selectedOption && "text-slate-500",
          buttonClassName,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-700 font-bold" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
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
            className="max-h-48 overflow-y-auto p-1"
          >
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === selectedValue;
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
                    onClick={() => updateValue(option.value)}
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
