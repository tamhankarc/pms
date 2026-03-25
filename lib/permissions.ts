import type { UserType } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import type { CurrentUser } from "@/lib/auth-types";

type UserLike =
  | SessionUser
  | CurrentUser
  | { userType: UserType | CurrentUser["userType"] }
  | UserType
  | null
  | undefined;

function getUserType(user: UserLike) {
  if (!user) return undefined;
  if (typeof user === "string") return user;
  return user.userType;
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
  return isAdmin(user) || isManager(user);
}

export function canCreateProjects(user: UserLike) {
  return canCreateOrEditProject(user);
}

export function canSeeAllProjects(user: UserLike) {
  return isAdmin(user) || isManager(user) || isTeamLead(user) || isReportViewer(user);
}
