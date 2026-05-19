"use client";

import { forwardRef, type FormHTMLAttributes, useImperativeHandle, useRef } from "react";

type AutoSubmitFilterFormProps = FormHTMLAttributes<HTMLFormElement> & {
  debounceMs?: number;
};

function isDebouncedInput(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement)) return false;
  const debouncedTypes = new Set(["", "text", "search", "email", "number", "tel", "url"]);
  return debouncedTypes.has(target.type);
}

export const AutoSubmitFilterForm = forwardRef<HTMLFormElement, AutoSubmitFilterFormProps>(
  function AutoSubmitFilterForm({ children, debounceMs = 550, onChange, ...props }, forwardedRef) {
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
        onChange={(event) => {
          onChange?.(event);
          if (!event.defaultPrevented) submitForm(event.target);
        }}
      >
        {children}
      </form>
    );
  },
);
