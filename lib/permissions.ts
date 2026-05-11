import type { UserType } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import type { CurrentUser } from "@/lib/auth-types";
import { getBaseMenuKeysForUserType, normalizeMenuKeys, type MenuKey } from "@/lib/menu-access";

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

export function hasExtraMenuAccess(user: UserLike, menuKey: MenuKey) {
  if (!user || typeof user === "string" || !("extraMenuKeys" in user)) return false;
  return normalizeMenuKeys(user.extraMenuKeys ?? []).includes(menuKey);
}

export function hasAnyExtraMenuAccess(user: UserLike, menuKeys: MenuKey[]) {
  return menuKeys.some((menuKey) => hasExtraMenuAccess(user, menuKey));
}

export function canAccessMenuItem(user: UserLike, menuKey: MenuKey) {
  const userType = getUserType(user);
  if (!userType) return false;
  return getBaseMenuKeysForUserType(userType).includes(menuKey) || hasExtraMenuAccess(user, menuKey);
}

export function isAdmin(user: UserLike) { return getUserType(user) === "ADMIN"; }
export function isManager(user: UserLike) { return getUserType(user) === "MANAGER"; }
export function isTeamLead(user: UserLike) { return getUserType(user) === "TEAM_LEAD"; }
export function isEmployee(user: UserLike) { return getUserType(user) === "EMPLOYEE"; }
export function isReportViewer(user: UserLike) { return getUserType(user) === "REPORT_VIEWER"; }
export function isAccounts(user: UserLike) { return getUserType(user) === "ACCOUNTS"; }
export function canViewBillingReports(user: UserLike) { return isAdmin(user) || isAccounts(user); }
export function isHR(user: UserLike) { return getUserType(user) === "HR"; }
export function isOperations(user: UserLike) { return getUserType(user) === "OPERATIONS"; }
export function isProjectManager(user: UserLike) { return isManager(user) && getFunctionalRole(user) === "PROJECT_MANAGER"; }
export function isAdminProjectManager(user: UserLike) { return isAdmin(user) && getFunctionalRole(user) === "PROJECT_MANAGER"; }
export function isRoleScopedManager(user: UserLike) { return isManager(user) && getFunctionalRole(user) !== "PROJECT_MANAGER"; }
export function isAdminDirector(user: UserLike) { return isAdmin(user) && getFunctionalRole(user) === "DIRECTOR"; }
export function isPmLike(user: UserLike) {
  return (isManager(user) || isAdmin(user)) && getFunctionalRole(user) === "PROJECT_MANAGER";
}

export function canComprehensivelyModerateProject(user: UserLike) { return isAdmin(user) || isManager(user) || isHR(user); }
export function canFullyModerateProject(user: UserLike) { return canComprehensivelyModerateProject(user); }
export function canManageUsers(user: UserLike) { return isAdmin(user) || isHR(user) || hasExtraMenuAccess(user, "users"); }
export function canAssignTeamLeads(user: UserLike) { return isAdmin(user) || isManager(user) || isHR(user); }
export function canManageMasterData(user: UserLike) {
  return isAdmin(user) || isOperations(user) || hasAnyExtraMenuAccess(user, ["clients", "movies", "newsletters", "asset-type", "countries", "languages", "projects", "sub-project", "user-assignments", "contact-persons"]);
}
export function canCreateOrEditProject(user: UserLike) { return isAdmin(user) || isOperations(user) || hasExtraMenuAccess(user, "projects"); }
export function canCreateProjects(user: UserLike) { return canCreateOrEditProject(user); }
export function canSeeAllProjects(user: UserLike) { return isAdmin(user) || isOperations(user) || isManager(user) || isTeamLead(user) || isReportViewer(user) || isAccounts(user) || isHR(user) || hasExtraMenuAccess(user, "projects"); }
export function canManageCountries(user: UserLike) { return isAdmin(user) || isOperations(user) || hasExtraMenuAccess(user, "countries"); }
export function canManageLanguages(user: UserLike) { return isAdmin(user) || isOperations(user) || hasExtraMenuAccess(user, "languages"); }
export function canManageClients(user: UserLike) { return isAdmin(user) || isOperations(user) || hasExtraMenuAccess(user, "clients"); }
export function canManageMovies(user: UserLike) { return isAdmin(user) || isOperations(user) || hasExtraMenuAccess(user, "movies"); }
export function canManageNewsletters(user: UserLike) { return isAdmin(user) || isOperations(user) || hasExtraMenuAccess(user, "newsletters"); }
export function canManageAssetTypes(user: UserLike) { return isAdmin(user) || isOperations(user) || hasExtraMenuAccess(user, "asset-type"); }
export function canManageProjectTypes(user: UserLike) { return canManageClients(user); }
export function canManageAssignments(user: UserLike) { return isAdmin(user) || isOperations(user) || hasExtraMenuAccess(user, "user-assignments"); }
export function canManageSubProjects(user: UserLike) { return isAdmin(user) || isOperations(user) || hasExtraMenuAccess(user, "sub-project"); }
export function canManageContactPersons(user: UserLike) { return isAdmin(user) || isOperations(user) || hasExtraMenuAccess(user, "contact-persons"); }
export function canManageClientBillingHeads(user: UserLike) { return isAdmin(user) || hasExtraMenuAccess(user, "client-billing-heads"); }
export function canManageMovieBillingHeads(user: UserLike) { return isAdmin(user) || hasExtraMenuAccess(user, "movie-billing-heads"); }

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
