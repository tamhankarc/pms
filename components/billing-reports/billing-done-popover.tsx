"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type BillingDonePopoverProps = {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
};

export function BillingDonePopover({
  label,
  children,
  align = "right",
}: BillingDonePopoverProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close billing popup"
            className="fixed inset-0 z-10 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            className={`absolute z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <div className="pt-2">{children}</div>
          </div>
        </>
      ) : null}
    </div>
  );
}
