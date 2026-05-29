import Link from "next/link";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCheck,
  ClipboardCheck,
  Clapperboard,
  Box,
  FolderKanban,
  Globe2,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
  TimerReset,
  UserCog,
  Contact,
  ReceiptText,
  Layers3,
  Languages,
  ListChecks,
  Bell,
  Mail,
  ChevronDown,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { MenuKey } from "@/lib/menu-access";
import { menuItems, normalizeMenuKeys } from "@/lib/menu-access";
import {
  canAccessLeaveRequests,
  canManageCountries,
  canManageLanguages,
  canManageUsers,
  isHR,
  isOperations,
  isRoleScopedManager,
} from "@/lib/permissions";

export type SidebarNavItem = {
  key: MenuKey;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  access?: "countries" | "languages";
};

const iconByMenuKey: Record<
  MenuKey,
  React.ComponentType<{ className?: string }>
> = {
  dashboard: LayoutDashboard,
  clients: Building2,
  movies: Clapperboard,
  newsletters: Mail,
  "client-billing-heads": ReceiptText,
  "movie-billing-heads": ReceiptText,
  "asset-type": Box,
  "lens-type": Box,
  "asset-names": Box,
  "filmik-resource": Box,
  countries: Globe2,
  languages: Languages,
  projects: FolderKanban,
  "sub-project": Layers3,
  "user-assignments": ListChecks,
  users: ShieldCheck,
  "contact-persons": Contact,
  "time-entries": TimerReset,
  estimates: ClipboardCheck,
  "team-lead-assignments": BriefcaseBusiness,
  reports: BarChart3,
  "billing-reports": ReceiptText,
  "leave-requests": CalendarDays,
  "leave-approvals": CheckCheck,
  "leave-admin": CalendarDays,
  "hr-reports": BarChart3,
  announcements: Bell,
  profile: UserCog,
  "change-password": KeyRound,
};

const baseMenuItems: SidebarNavItem[] = menuItems.map((item) => ({
  ...item,
  icon: iconByMenuKey[item.key],
  access:
    item.key === "countries"
      ? "countries"
      : item.key === "languages"
        ? "languages"
        : undefined,
}));

function getItemsByKeys(keys: MenuKey[]) {
  const keySet = new Set(keys);
  return baseMenuItems.filter((item) => keySet.has(item.key));
}

function withLeaveItems(
  items: SidebarNavItem[],
  user: SessionUser,
  canAccessLeaveApprovals: boolean,
) {
  const nextItems = [...items];
  const existingKeys = new Set(nextItems.map((item) => item.key));

  function pushIfMissing(key: MenuKey) {
    if (existingKeys.has(key)) return;
    const item = baseMenuItems.find((entry) => entry.key === key);
    if (item) {
      nextItems.push(item);
      existingKeys.add(key);
    }
  }

  if (canAccessLeaveRequests(user)) {
    pushIfMissing("leave-requests");
  }

  if (canAccessLeaveApprovals) {
    pushIfMissing("leave-approvals");
  }

  if (isHR(user)) {
    pushIfMissing("leave-admin");
    pushIfMissing("hr-reports");
  }

  return nextItems;
}

const fullItems: SidebarNavItem[] = getItemsByKeys([
  "dashboard",
  "clients",
  "movies",
  "newsletters",
  "client-billing-heads",
  "movie-billing-heads",
  "asset-type",
  "lens-type",
  "asset-names",
  "filmik-resource",
  "countries",
  "languages",
  "projects",
  "sub-project",
  "user-assignments",
  "users",
  "contact-persons",
  "time-entries",
  "estimates",
  "team-lead-assignments",
  "reports",
  "billing-reports",
  "hr-reports",
  "profile",
  "change-password",
]);

const teamLeadItems: SidebarNavItem[] = getItemsByKeys([
  "dashboard",
  "clients",
  "movies",
  "newsletters",
  "asset-type",
  "lens-type",
  "asset-names",
  "filmik-resource",
  "countries",
  "languages",
  "projects",
  "sub-project",
  "user-assignments",
  "time-entries",
  "estimates",
  "profile",
  "change-password",
]);

const employeeItems: SidebarNavItem[] = getItemsByKeys([
  "dashboard",
  "time-entries",
  "estimates",
  "profile",
  "change-password",
]);

const operationsItems: SidebarNavItem[] = getItemsByKeys([
  "dashboard",
  "clients",
  "movies",
  "newsletters",
  "asset-type",
  "lens-type",
  "asset-names",
  "filmik-resource",
  "countries",
  "languages",
  "projects",
  "sub-project",
  "user-assignments",
  "contact-persons",
  "profile",
  "change-password",
]);

const accountsItems: SidebarNavItem[] = getItemsByKeys(["billing-reports"]);

function isMasterDataHref(href: string) {
  return [
    "/clients",
    "/movies",
    "/newsletters",
    "/asset-type",
    "/lens-type",
    "/asset-names",
    "/filmik-resource",
    "/countries",
    "/languages",
    "/projects",
    "/sub-project",
    "/user-assignments",
    "/contact-persons",
  ].includes(href);
}

function filterAccess(items: SidebarNavItem[], user: SessionUser) {
  return items.filter(
    (item) =>
      (item.access !== "countries" || canManageCountries(user)) &&
      (item.access !== "languages" || canManageLanguages(user)),
  );
}

function appendExtraMenus(items: SidebarNavItem[], user: SessionUser) {
  const existingKeys = new Set(items.map((item) => item.key));
  const extraKeys = normalizeMenuKeys(user.extraMenuKeys ?? []);
  const extras = extraKeys
    .filter((key) => !existingKeys.has(key))
    .map((key) => baseMenuItems.find((item) => item.key === key))
    .filter((item): item is SidebarNavItem => Boolean(item));

  return [...items, ...extras];
}

export function getSidebarItems(
  user: SessionUser,
  canAccessLeaveApprovals: boolean,
): SidebarNavItem[] {
  if (user.userType === "EMPLOYEE") {
    return appendExtraMenus(
      withLeaveItems(employeeItems, user, canAccessLeaveApprovals),
      user,
    );
  }

  if (user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) {
    const scopedItems = filterAccess(teamLeadItems, user).filter(
      (item) => !isMasterDataHref(item.href),
    );
    if (isRoleScopedManager(user)) {
      const billingReportsItem = baseMenuItems.find(
        (item) => item.key === "billing-reports",
      );
      if (billingReportsItem) scopedItems.push(billingReportsItem);
    }
    return appendExtraMenus(
      withLeaveItems(scopedItems, user, canAccessLeaveApprovals),
      user,
    );
  }

  if (isOperations(user)) {
    return appendExtraMenus(filterAccess(operationsItems, user), user);
  }

  if (user.userType === "ACCOUNTS") {
    return appendExtraMenus(
      withLeaveItems(accountsItems, user, canAccessLeaveApprovals),
      user,
    );
  }

  if (isHR(user)) {
    return appendExtraMenus(
      getItemsByKeys([
        "dashboard",
        "users",
        "leave-requests",
        ...(canAccessLeaveApprovals ? (["leave-approvals"] as MenuKey[]) : []),
        "leave-admin",
        "hr-reports",
        "announcements",
        ...(user.userType === "MANAGER"
          ? (["billing-reports"] as MenuKey[])
          : []),
        "profile",
        "change-password",
      ]),
      user,
    );
  }

  const merged = withLeaveItems(
    filterAccess(fullItems, user),
    user,
    canAccessLeaveApprovals,
  );
  const filtered = merged.filter((item) => {
    if (
      isMasterDataHref(item.href) &&
      user.userType !== "ADMIN" &&
      user.userType !== "OPERATIONS"
    )
      return false;
    if (item.href === "/users" && !canManageUsers(user)) return false;
    if (
      item.href === "/contact-persons" &&
      user.userType !== "ADMIN" &&
      user.userType !== "OPERATIONS"
    )
      return false;
    if (
      (item.href === "/client-billing-heads" ||
        item.href === "/movie-billing-heads") &&
      user.userType !== "ADMIN"
    )
      return false;
    if (
      item.href === "/filmik-resource" &&
      user.userType !== "ADMIN" &&
      user.userType !== "OPERATIONS"
    )
      return false;
    return true;
  });

  return appendExtraMenus(filtered, user);
}

export type BillingReportClientNavItem = { id: string; name: string };

function BillingReportsAccordion({
  clients,
}: {
  clients: BillingReportClientNavItem[];
}) {
  const Icon = iconByMenuKey["billing-reports"];

  return (
    <details className="group rounded-xl" open>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white 2xl:text-sm">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Billing Reports</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="mt-1 space-y-1 pl-7">
        <Link
          href="/billing-reports"
          className="block rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
        >
          All Clients
        </Link>
        {clients.map((client) => (
          <Link
            key={client.id}
            href={`/billing-reports/${client.id}`}
            className="block rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
          >
            <span className="line-clamp-2">{client.name}</span>
          </Link>
        ))}
        {clients.length === 0 ? (
          <span className="block rounded-lg px-3 py-2 text-xs text-slate-500">
            No clients available
          </span>
        ) : null}
      </div>
    </details>
  );
}

export function Sidebar({
  user,
  canAccessLeaveApprovals,
  billingReportClients = [],
}: {
  user: SessionUser;
  canAccessLeaveApprovals: boolean;
  billingReportClients?: BillingReportClientNavItem[];
}) {
  const items = getSidebarItems(user, canAccessLeaveApprovals);

  return (
    <aside className="hidden lg:block shrink-0 w-64 2xl:w-72 border-r border-slate-200 bg-slate-950 text-slate-100">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-800 px-5 2xl:px-6 py-5 2xl:py-6">
          <p className="text-[11px] 2xl:text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            Internal PMS + EMS
          </p>
          <h2 className="mt-3 text-base 2xl:text-lg font-semibold">
            Project &amp; Leave Management Suite
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-200">
            {user.fullName}
          </p>
          <p className="text-xs text-slate-400">
            {user.designation ? `${user.designation}` : ""}
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 2xl:px-3 py-5 2xl:py-6">
          {items.map((item) => {
            if (item.key === "billing-reports") {
              return (
                <BillingReportsAccordion
                  key={item.href}
                  clients={billingReportClients}
                />
              );
            }

            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] 2xl:text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
