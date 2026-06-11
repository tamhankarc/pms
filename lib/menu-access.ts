import type { UserType } from "@prisma/client";

export const menuItems = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard" },
  {
    key: "billing-reports",
    href: "/billing-reports",
    label: "Billing Reports",
  },
  { key: "purchase-orders", href: "/purchase-orders", label: "Purchase Orders" },
  {
    key: "contact-persons",
    href: "/contact-persons",
    label: "Contact Persons",
  },
  {
    key: "billing-contacts",
    href: "/billing-contacts",
    label: "Billing Contacts",
  },
  {
    key: "client-billing-heads",
    href: "/client-billing-heads",
    label: "Billing Heads",
  },
  {
    key: "movie-billing-heads",
    href: "/movie-billing-heads",
    label: "Title Billing Heads",
  },
  {
    key: "filmik-resource",
    href: "/filmik-resource",
    label: "Filmik Resources",
  },
  { key: "reports", href: "/reports", label: "Reports" },
  { key: "leave-requests", href: "/leave-requests", label: "Leave Requests" },
  {
    key: "leave-approvals",
    href: "/leave-approvals",
    label: "Leave Approvals",
  },
  { key: "leave-admin", href: "/leave-admin", label: "Leave Administration" },
  {
    key: "attendance-history",
    href: "/attendance-history",
    label: "Attendance History",
  },
  { key: "hr-reports", href: "/hr-reports", label: "HR Reports" },
  { key: "announcements", href: "/announcements", label: "Announcements" },
  { key: "clients", href: "/clients", label: "Clients" },
  { key: "movies", href: "/movies", label: "Titles" },
  { key: "projects", href: "/projects", label: "Projects" },
  { key: "sub-project", href: "/sub-project", label: "Sub Projects" },
  {
    key: "user-assignments",
    href: "/user-assignments",
    label: "User Assignments",
  },
  { key: "newsletters", href: "/newsletters", label: "Newsletters" },
  { key: "asset-type", href: "/asset-type", label: "Asset Types" },
  { key: "lens-type", href: "/lens-type", label: "Lens Types" },
  { key: "asset-names", href: "/asset-names", label: "Asset Names" },
  { key: "countries", href: "/countries", label: "Countries" },
  { key: "languages", href: "/languages", label: "Languages" },
  { key: "users", href: "/users", label: "Users" },
  { key: "time-entries", href: "/time-entries", label: "Time Entries" },
  { key: "estimates", href: "/estimates", label: "Estimates" },
  {
    key: "team-lead-assignments",
    href: "/team-lead-assignments",
    label: "Team Lead Assignments",
  },
  { key: "profile", href: "/profile", label: "My Profile" },
  {
    key: "change-password",
    href: "/change-password",
    label: "Change Password",
  },
] as const;

export type MenuKey = (typeof menuItems)[number]["key"];

export const menuKeySet = new Set<string>(menuItems.map((item) => item.key));

export function normalizeMenuKeys(values: unknown): MenuKey[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map(String)
        .filter((value): value is MenuKey => menuKeySet.has(value)),
    ),
  );
}

export function parseMenuKeysJson(value?: string | null): MenuKey[] {
  if (!value) return [];
  try {
    return normalizeMenuKeys(JSON.parse(value));
  } catch {
    return [];
  }
}

export function getBaseMenuKeysForUserType(
  userType: UserType | string,
): MenuKey[] {
  switch (userType) {
    case "ADMIN":
      return menuItems.map((item) => item.key);
    case "OPERATIONS":
      return [
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
        "billing-contacts",
        "purchase-orders",
        "profile",
        "change-password",
      ];
    case "HR":
      return [
        "dashboard",
        "users",
        "leave-requests",
        "leave-approvals",
        "leave-admin",
        "hr-reports",
        "attendance-history",
        "announcements",
        "profile",
        "change-password",
      ];
    case "ACCOUNTS":
      return ["billing-reports", "change-password"];
    case "EMPLOYEE":
      return [
        "dashboard",
        "time-entries",
        "estimates",
        "leave-requests",
        "profile",
        "change-password",
      ];
    case "TEAM_LEAD":
      return [
        "dashboard",
        "time-entries",
        "estimates",
        "leave-requests",
        "profile",
        "change-password",
      ];
    case "MANAGER":
    case "REPORT_VIEWER":
      return [
        "dashboard",
        "time-entries",
        "estimates",
        "team-lead-assignments",
        "reports",
        "profile",
        "change-password",
      ];
    default:
      return [];
  }
}

export function getExtraMenuOptionsForUserType(userType: UserType | string) {
  const defaults = new Set(getBaseMenuKeysForUserType(userType));
  return menuItems.filter((item) => {
    if (defaults.has(item.key)) return false;
    if (item.key === "billing-reports") return false;
    if (
      userType === "ACCOUNTS" &&
      ["dashboard", "reports", "change-password"].includes(item.key)
    )
      return false;
    return true;
  });
}
