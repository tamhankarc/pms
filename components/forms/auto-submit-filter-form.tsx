"use client";

import {
  forwardRef,
  type FormHTMLAttributes,
  useImperativeHandle,
  useRef,
} from "react";

type AutoSubmitFilterFormProps = FormHTMLAttributes<HTMLFormElement> & {
  debounceMs?: number;
};

function isDebouncedInput(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement)) return false;
  const debouncedTypes = new Set([
    "",
    "text",
    "search",
    "email",
    "number",
    "tel",
    "url",
  ]);
  return debouncedTypes.has(target.type);
}

function isDatePickerInput(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement)) return false;
  return new Set(["date", "month", "week", "time", "datetime-local"]).has(
    target.type,
  );
}

export const AutoSubmitFilterForm = forwardRef<
  HTMLFormElement,
  AutoSubmitFilterFormProps
>(function AutoSubmitFilterForm(
  { children, debounceMs = 550, onBlur, onChange, ...props },
  forwardedRef,
) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const timerRef = useRef<number | null>(null);

  useImperativeHandle(forwardedRef, () => formRef.current as HTMLFormElement);

  function submitForm(target: EventTarget | null) {
    const form = formRef.current;
    if (!form) return;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isDebouncedInput(target)) {
      timerRef.current = window.setTimeout(() => {
        form.requestSubmit();
      }, debounceMs);
      return;
    }

    form.requestSubmit();
  }

  return (
    <form
      {...props}
      ref={formRef}
      data-auto-submit-filter="true"
      onBlur={(event) => {
        onBlur?.(event);
        if (!event.defaultPrevented && isDatePickerInput(event.target)) {
          submitForm(event.target);
        }
      }}
      onChange={(event) => {
        onChange?.(event);
        if (event.defaultPrevented) return;

        // Native date pickers can fire change events while the user is only
        // navigating the month/year popup. Submitting on those intermediate
        // changes makes the main results refresh before a final date is chosen.
        // Date-like inputs are therefore submitted from onBlur instead.
        if (isDatePickerInput(event.target)) return;

        submitForm(event.target);
      }}
    >
      {children}
    </form>
  );
});
