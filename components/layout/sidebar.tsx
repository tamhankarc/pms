import Link from "next/link";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  Clapperboard,
  FolderKanban,
  Globe2,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
  TimerReset,
  UserCog,
  Users
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth-actions";
import type { SessionUser } from "@/lib/auth";
import { canManageCountries, isRoleScopedManager } from "@/lib/permissions";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  access?: "countries";
};

const fullItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/movies", label: "Movies", icon: Clapperboard },
  { href: "/countries", label: "Countries", icon: Globe2, access: "countries" },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/employee-groups", label: "Employee Groups", icon: Users },
  { href: "/users", label: "Users", icon: ShieldCheck },
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
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/employee-groups", label: "Employee Groups", icon: Users },
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

const accountsItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/change-password", label: "Change Password", icon: KeyRound },
];

export function getSidebarItems(user: SessionUser): SidebarNavItem[] {
  return user.userType === "EMPLOYEE"
    ? employeeItems
    : user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
      ? teamLeadItems
      : user.userType === "ACCOUNTS"
        ? accountsItems
        : fullItems.filter((item) => item.access !== "countries" || canManageCountries(user));
}

export function Sidebar({ user }: { user: SessionUser }) {
  const items = getSidebarItems(user);

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-950 text-slate-100 lg:block">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-800 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Internal PMS</p>
          <h2 className="mt-3 text-lg font-semibold">Project Management Suite</h2>
          <p className="mt-2 text-sm font-medium text-slate-200">{user.fullName}</p>
          {user.designation ? (
            <p className="text-xs text-slate-400">{user.designation}</p>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
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
      </div>
    </aside>
  );
}
