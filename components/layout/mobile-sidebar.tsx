"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import {
  getSidebarItems,
  type BillingReportClientNavItem,
} from "@/components/layout/sidebar";

export function MobileSidebar({
  user,
  canAccessLeaveApprovals,
  billingReportClients = [],
}: {
  user: SessionUser;
  canAccessLeaveApprovals: boolean;
  billingReportClients?: BillingReportClientNavItem[];
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const mobileAllowedMenuKeys = new Set([
    "leave-requests",
    "profile",
    "change-password",
  ]);
  const items = getSidebarItems(user, canAccessLeaveApprovals).filter((item) =>
    mobileAllowedMenuKeys.has(item.key),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const drawer = open ? (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <button
        className="absolute inset-0 bg-slate-950/50"
        onClick={() => setOpen(false)}
        aria-label="Close menu"
      />
      <aside className="relative ml-auto flex h-full w-full max-w-xs flex-col bg-slate-950 text-slate-100 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-800 px-6 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Internal PMS + EMS
            </p>
            <h2 className="mt-3 text-lg font-semibold">
              Project &amp; Employee Management
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-200">
              {user.fullName}
            </p>
            <p className="text-xs text-slate-400">
              {user.userType === "HR"
                ? "Administration/HR"
                : user.userType.replaceAll("_", " ")}
              {user.designation ? ` · ${user.designation}` : ""}
            </p>
          </div>

          <button
            type="button"
            className="rounded-xl border border-slate-700 p-2 text-slate-200 hover:bg-slate-900"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {items.map((item) => {
            if (item.key === "billing-reports") {
              const Icon = item.icon;
              return (
                <details key={item.href} className="group rounded-xl" open>
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">Billing Reports</span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
                  </summary>
                  <div className="mt-1 space-y-1 pl-7">
                    <Link
                      href="/billing-reports"
                      className="block rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
                      onClick={() => setOpen(false)}
                    >
                      All Clients
                    </Link>
                    {billingReportClients.map((client) => (
                      <Link
                        key={client.id}
                        href={`/billing-reports/${client.id}`}
                        className="block rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
                        onClick={() => setOpen(false)}
                      >
                        <span className="line-clamp-2">{client.name}</span>
                      </Link>
                    ))}
                    {billingReportClients.length === 0 ? (
                      <span className="block rounded-lg px-3 py-2 text-xs text-slate-500">
                        No clients available
                      </span>
                    ) : null}
                  </div>
                </details>
              );
            }

            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white"
                onClick={() => setOpen(false)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {mounted && drawer ? createPortal(drawer, document.body) : null}
    </>
  );
}
