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

export function isAdmin(user: UserLike) { return getUserType(user) === "ADMIN"; }
export function isManager(user: UserLike) { return getUserType(user) === "MANAGER"; }
export function isTeamLead(user: UserLike) { return getUserType(user) === "TEAM_LEAD"; }
export function isEmployee(user: UserLike) { return getUserType(user) === "EMPLOYEE"; }
export function isReportViewer(user: UserLike) { return getUserType(user) === "REPORT_VIEWER"; }
export function isAccounts(user: UserLike) { return getUserType(user) === "ACCOUNTS"; }
export function isHR(user: UserLike) { return getUserType(user) === "HR"; }
export function isProjectManager(user: UserLike) { return isManager(user) && getFunctionalRole(user) === "PROJECT_MANAGER"; }
export function isAdminProjectManager(user: UserLike) { return isAdmin(user) && getFunctionalRole(user) === "PROJECT_MANAGER"; }
export function isRoleScopedManager(user: UserLike) { return isManager(user) && getFunctionalRole(user) !== "PROJECT_MANAGER"; }
export function isAdminDirector(user: UserLike) { return isAdmin(user) && getFunctionalRole(user) === "DIRECTOR"; }
export function isPmLike(user: UserLike) {
  return (isManager(user) || isAdmin(user)) && getFunctionalRole(user) === "PROJECT_MANAGER";
}

export function canComprehensivelyModerateProject(user: UserLike) { return isAdmin(user) || isManager(user) || isHR(user); }
export function canFullyModerateProject(user: UserLike) { return canComprehensivelyModerateProject(user); }
export function canManageUsers(user: UserLike) { return isAdmin(user) || isManager(user) || isHR(user); }
export function canAssignTeamLeads(user: UserLike) { return isAdmin(user) || isManager(user) || isHR(user); }
export function canCreateOrEditProject(user: UserLike) { return isAdmin(user) || isManager(user) || isTeamLead(user); }
export function canCreateProjects(user: UserLike) { return canCreateOrEditProject(user); }
export function canSeeAllProjects(user: UserLike) { return isAdmin(user) || isManager(user) || isTeamLead(user) || isReportViewer(user) || isHR(user); }
export function canManageCountries(user: UserLike) { return isAdmin(user) || isManager(user) || isTeamLead(user) || isHR(user); }
export function canManageLanguages(user: UserLike) { return isAdmin(user) || isManager(user) || isTeamLead(user) || isHR(user); }
export function canManageClients(user: UserLike) { return isAdmin(user) || isManager(user) || isTeamLead(user) || isHR(user); }
export function canManageProjectTypes(user: UserLike) { return isAdmin(user) || isManager(user) || isTeamLead(user) || isHR(user); }
export function canManageAssignments(user: UserLike) { return isAdmin(user) || isManager(user) || isTeamLead(user) || isHR(user); }

export function canSeeBillingDashboard(user: UserLike) {
  return (
    isAdmin(user) ||
    (isManager(user) && getFunctionalRole(user) === "PROJECT_MANAGER") ||
    (isAccounts(user) && getFunctionalRole(user) === "BILLING")
  );
}

export function canViewEMSAdminDashboard(user: UserLike) {
  return isAdmin(user) || isHR(user) || isProjectManager(user);
}

export function canMarkAttendance(user: UserLike) {
  return isEmployee(user) || isTeamLead(user) || isRoleScopedManager(user);
}

export function canAccessLeaveRequests(user: UserLike) {
  return canMarkAttendance(user) || isPmLike(user) || isHR(user);
}

export function canAssignApprovers(user: UserLike) {
  return canViewEMSAdminDashboard(user);
}

export function canViewLeaveApprovals(user: UserLike) {
  return isAdmin(user) || isHR(user);
}
