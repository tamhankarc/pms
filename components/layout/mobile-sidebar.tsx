"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth-actions";
import type { SessionUser } from "@/lib/auth";
import { getSidebarItems } from "@/components/layout/sidebar";

export function MobileSidebar({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const items = getSidebarItems(user);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
          />

          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Internal PMS</p>
                <h2 className="mt-3 text-lg font-semibold">Project Management Suite</h2>
                <p className="mt-2 text-sm font-medium text-slate-200">{user.fullName}</p>
                {user.designation ? (
                  <p className="text-xs text-slate-400">{user.designation}</p>
                ) : null}
              </div>

              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-slate-200 transition hover:bg-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <form action={logoutAction} className="border-t border-slate-800 p-4">
              <button className="btn-secondary w-full border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800">
                Sign out
              </button>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}
