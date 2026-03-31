import type { UserType } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import type { CurrentUser } from "@/lib/auth-types";

type UserLike =
  | SessionUser
  | CurrentUser
  | {
      userType: UserType | CurrentUser["userType"];
      functionalRole?: SessionUser["functionalRole"] | null;
    }
  | UserType
  | null
  | undefined;

function getUserType(user: UserLike) {
  if (!user) return undefined;
  if (typeof user === "string") return user;
  return user.userType;
}

function getFunctionalRole(user: UserLike) {
  if (!user || typeof user === "string" || !("functionalRole" in user)) return undefined;
  return user.functionalRole ?? undefined;
}

export const PROJECT_MANAGERS: UserType[] = ["ADMIN", "MANAGER"];
export const MANAGER: UserType[] = ["ADMIN", "MANAGER"];

export function isAdmin(user: UserLike) {
  return getUserType(user) === "ADMIN";
}

export function isManager(user: UserLike) {
  return getUserType(user) === "MANAGER";
}

export function isTeamLead(user: UserLike) {
  return getUserType(user) === "TEAM_LEAD";
}

export function isEmployee(user: UserLike) {
  return getUserType(user) === "EMPLOYEE";
}

export function isReportViewer(user: UserLike) {
  return getUserType(user) === "REPORT_VIEWER";
}

export function isAccounts(user: UserLike) {
  return getUserType(user) === "ACCOUNTS";
}

export function isRoleScopedManager(user: UserLike) {
  return isManager(user) && getFunctionalRole(user) !== "PROJECT_MANAGER";
}

export function canComprehensivelyModerateProject(user: UserLike) {
  return isAdmin(user) || isManager(user);
}

export function canFullyModerateProject(user: UserLike) {
  return canComprehensivelyModerateProject(user);
}

export function canManageUsers(user: UserLike) {
  return isAdmin(user) || isManager(user);
}

export function canAssignTeamLeads(user: UserLike) {
  return isAdmin(user) || isManager(user);
}

export function canCreateOrEditProject(user: UserLike) {
  return isAdmin(user) || isManager(user) || isTeamLead(user);
}

export function canCreateProjects(user: UserLike) {
  return canCreateOrEditProject(user);
}

export function canSeeAllProjects(user: UserLike) {
  return isAdmin(user) || isManager(user) || isTeamLead(user) || isReportViewer(user);
}

export function canManageCountries(user: UserLike) {
  return isAdmin(user) || (isManager(user) && getFunctionalRole(user) === "PROJECT_MANAGER");
}

export function canSeeBillingDashboard(user: UserLike) {
  return (
    isAdmin(user) ||
    (isManager(user) && getFunctionalRole(user) === "PROJECT_MANAGER") ||
    (isAccounts(user) && getFunctionalRole(user) === "BILLING")
  );
}
