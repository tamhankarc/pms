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
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
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
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  access?: "countries" | "languages";
};

function withLeaveItems(items: SidebarNavItem[], user: SessionUser, canAccessLeaveApprovals: boolean) {
  const nextItems = [...items];

  if (canAccessLeaveRequests(user)) {
    nextItems.push({ href: "/leave-requests", label: "Leave Requests", icon: CalendarDays });
  }

  if (canAccessLeaveApprovals) {
    nextItems.push({ href: "/leave-approvals", label: "Leave Approvals", icon: CheckCheck });
  }

  if (isHR(user)) {
    nextItems.push({ href: "/leave-admin", label: "Leave Administration", icon: CalendarDays });
  }

  return nextItems;
}

const fullItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/movies", label: "Movies", icon: Clapperboard },
  { href: "/movie-billing-heads", label: "Movie Billing Heads", icon: ReceiptText },
  { href: "/asset-type", label: "Asset Types", icon: Box },
  { href: "/countries", label: "Countries", icon: Globe2, access: "countries" },
  { href: "/languages", label: "Languages", icon: Languages, access: "languages" },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/sub-project", label: "Sub Projects", icon: Layers3 },
  { href: "/user-assignments", label: "User Assignments", icon: ListChecks },
  { href: "/users", label: "Users", icon: ShieldCheck },
  { href: "/contact-persons", label: "Contact Persons", icon: Contact },
  { href: "/time-entries", label: "Time Entries", icon: TimerReset },
  { href: "/estimates", label: "Estimates", icon: ClipboardCheck },
  { href: "/team-lead-assignments", label: "Team Lead Assignments", icon: BriefcaseBusiness },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/profile", label: "My Profile", icon: UserCog },
  { href: "/change-password", label: "Change Password", icon: KeyRound },
];

const teamLeadItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/movies", label: "Movies", icon: Clapperboard },
  { href: "/movie-billing-heads", label: "Movie Billing Heads", icon: ReceiptText },
  { href: "/asset-type", label: "Asset Types", icon: Box },
  { href: "/countries", label: "Countries", icon: Globe2, access: "countries" },
  { href: "/languages", label: "Languages", icon: Languages, access: "languages" },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/sub-project", label: "Sub Projects", icon: Layers3 },
  { href: "/user-assignments", label: "User Assignments", icon: ListChecks },
  { href: "/time-entries", label: "Time Entries", icon: TimerReset },
  { href: "/estimates", label: "Estimates", icon: ClipboardCheck },
  { href: "/profile", label: "My Profile", icon: UserCog },
  { href: "/change-password", label: "Change Password", icon: KeyRound },
];

const employeeItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/time-entries", label: "Time Entries", icon: TimerReset },
  { href: "/estimates", label: "Estimates", icon: ClipboardCheck },
  { href: "/profile", label: "My Profile", icon: UserCog },
  { href: "/change-password", label: "Change Password", icon: KeyRound },
];

const operationsItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/movies", label: "Movies", icon: Clapperboard },
  { href: "/asset-type", label: "Asset Types", icon: Box },
  { href: "/countries", label: "Countries", icon: Globe2, access: "countries" },
  { href: "/languages", label: "Languages", icon: Languages, access: "languages" },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/sub-project", label: "Sub Projects", icon: Layers3 },
  { href: "/user-assignments", label: "User Assignments", icon: ListChecks },
  { href: "/contact-persons", label: "Contact Persons", icon: Contact },
  { href: "/profile", label: "My Profile", icon: UserCog },
  { href: "/change-password", label: "Change Password", icon: KeyRound },
];

const accountsItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/change-password", label: "Change Password", icon: KeyRound },
];

function isMasterDataHref(href: string) {
  return ["/clients", "/movies", "/asset-type", "/countries", "/languages", "/projects", "/sub-project", "/user-assignments", "/contact-persons"].includes(href);
}

function filterAccess(items: SidebarNavItem[], user: SessionUser) {
  return items.filter(
    (item) =>
      (item.access !== "countries" || canManageCountries(user)) &&
      (item.access !== "languages" || canManageLanguages(user)),
  );
}

export function getSidebarItems(user: SessionUser, canAccessLeaveApprovals: boolean): SidebarNavItem[] {
  if (user.userType === "EMPLOYEE") {
    return withLeaveItems(employeeItems, user, canAccessLeaveApprovals);
  }

  if (user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) {
    return withLeaveItems(filterAccess(teamLeadItems, user).filter((item) => !isMasterDataHref(item.href)), user, canAccessLeaveApprovals);
  }

  if (isOperations(user)) {
    return filterAccess(operationsItems, user);
  }

  if (user.userType === "ACCOUNTS") {
    return withLeaveItems(accountsItems, user, canAccessLeaveApprovals);
  }

  if (user.userType === "HR") {
    return [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/users", label: "Users", icon: ShieldCheck },
      { href: "/leave-requests", label: "Leave Requests", icon: CalendarDays },
      ...(canAccessLeaveApprovals ? [{ href: "/leave-approvals", label: "Leave Approvals", icon: CheckCheck }] : []),
      { href: "/leave-admin", label: "Leave Administration", icon: CalendarDays },
      { href: "/announcements", label: "Announcements", icon: Bell },
      { href: "/profile", label: "My Profile", icon: UserCog },
      { href: "/change-password", label: "Change Password", icon: KeyRound },
    ];
  }

  const merged = withLeaveItems(filterAccess(fullItems, user), user, canAccessLeaveApprovals);
  return merged.filter((item) => {
    if (isMasterDataHref(item.href) && user.userType !== "ADMIN" && user.userType !== "OPERATIONS") return false;
    if (item.href === "/users" && !canManageUsers(user)) return false;
    if (item.href === "/contact-persons" && user.userType !== "ADMIN" && user.userType !== "OPERATIONS") return false;
    if (item.href === "/movie-billing-heads" && user.userType !== "ADMIN") return false;
    return true;
  });
}

export function Sidebar({ user, canAccessLeaveApprovals }: { user: SessionUser; canAccessLeaveApprovals: boolean }) {
  const items = getSidebarItems(user, canAccessLeaveApprovals);

  return (
    <aside className="hidden lg:block shrink-0 w-64 2xl:w-72 border-r border-slate-200 bg-slate-950 text-slate-100">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-800 px-5 2xl:px-6 py-5 2xl:py-6">
          <p className="text-[11px] 2xl:text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            Internal PMS + EMS
          </p>
          <h2 className="mt-3 text-base 2xl:text-lg font-semibold">Project &amp; Leave Management Suite</h2>
          <p className="mt-2 text-sm font-medium text-slate-200">{user.fullName}</p>
          <p className="text-xs text-slate-400">
            {user.designation ? `${user.designation}` : ""}
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-2.5 2xl:px-3 py-5 2xl:py-6">
          {items.map((item) => {
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
