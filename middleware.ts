import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/unsupported-device"];
const EMPLOYEE_ALLOWED_PATHS = [
  "/dashboard",
  "/time-entries",
  "/estimates",
  "/leave-requests",
  "/leave-approvals",
  "/attendance-history",
  "/profile",
  "/change-password",
];
const ACCOUNTS_ALLOWED_PATHS = ["/billing-reports", "/change-password"];
const MOBILE_ALLOWED_PATHS = [
  "/mobile-location-correction",
  "/leave-requests",
  "/profile",
  "/change-password",
];
const HR_ALLOWED_PATHS = [
  "/dashboard",
  "/users",
  "/leave-requests",
  "/leave-approvals",
  "/attendance-history",
  "/sweep-in-triggers",
  "/announcements",
  "/hr-reports",
  "/leave-admin",
  "/profile",
  "/change-password",
];
const OPERATIONS_ALLOWED_PATHS = [
  "/dashboard",
  "/clients",
  "/movies",
  "/newsletters",
  "/asset-type",
  "/asset-names",
  "/filmik-resource",
  "/countries",
  "/languages",
  "/projects",
  "/sub-project",
  "/sub-projects",
  "/user-assignments",
  "/contact-persons",
  "/profile",
  "/change-password",
];
const MASTER_DATA_PATHS = [
  "/clients",
  "/movies",
  "/newsletters",
  "/asset-type",
  "/asset-names",
  "/filmik-resource",
  "/countries",
  "/languages",
  "/projects",
  "/sub-project",
  "/sub-projects",
  "/user-assignments",
  "/contact-persons",
];
const TEAM_LEAD_BLOCKED_PATHS = [
  "/users",
  "/team-lead-assignments",
  "/leave-admin",
];

async function getSessionPayload(request: NextRequest) {
  const token = request.cookies.get("pms_session")?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return null;

  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(secret));
    return verified.payload as {
      userType?: string;
      functionalRole?: string;
      extraMenuKeys?: string[];
    } | null;
  } catch {
    return null;
  }
}

function isMobileRequest(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    userAgent,
  );
}

function getMobileLandingPath(
  session: { userType?: string; functionalRole?: string } | null,
) {
  const mayUseLeaveRequests =
    session?.userType === "EMPLOYEE" ||
    session?.userType === "TEAM_LEAD" ||
    session?.userType === "MANAGER" ||
    session?.userType === "HR" ||
    (session?.userType === "ADMIN" &&
      session.functionalRole === "PROJECT_MANAGER");
  return mayUseLeaveRequests ? "/leave-requests" : "/profile";
}

function isAllowed(pathname: string, allowedPaths: string[]) {
  return allowedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

const MENU_ROUTE_PREFIXES: Record<string, string> = {
  clients: "/clients",
  movies: "/movies",
  newsletters: "/newsletters",
  "client-billing-heads": "/client-billing-heads",
  "movie-billing-heads": "/movie-billing-heads",
  "asset-type": "/asset-type",
  "asset-names": "/asset-names",
  "filmik-resource": "/filmik-resource",
  countries: "/countries",
  languages: "/languages",
  projects: "/projects",
  "sub-project": "/sub-project",
  "user-assignments": "/user-assignments",
  users: "/users",
  "contact-persons": "/contact-persons",
  "time-entries": "/time-entries",
  estimates: "/estimates",
  "team-lead-assignments": "/team-lead-assignments",
  reports: "/reports",
  "leave-requests": "/leave-requests",
  "leave-approvals": "/leave-approvals",
  "leave-admin": "/leave-admin",
  "attendance-history": "/attendance-history",
  "sweep-in-triggers": "/sweep-in-triggers",
  "mobile-location-correction": "/mobile-location-correction",
  announcements: "/announcements",
  profile: "/profile",
  "billing-reports": "/billing-reports",
  "change-password": "/change-password",
  "copy-decks": "/copy-decks",
};

function hasExtraMenuRouteAccess(pathname: string, extraMenuKeys?: string[]) {
  if (!extraMenuKeys?.length) return false;
  return extraMenuKeys.some((key) => {
    const path = MENU_ROUTE_PREFIXES[key];
    return path ? pathname === path || pathname.startsWith(`${path}/`) : false;
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const session = await getSessionPayload(request);
  const authed = Boolean(session);
  const mobileRequest = isMobileRequest(request);

  if (!authed && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    const returnTo = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(loginUrl);
  }

  if (
    authed &&
    (pathname === "/" ||
      pathname === "/login" ||
      pathname === "/unsupported-device")
  ) {
    const landingPath = mobileRequest
      ? getMobileLandingPath(session)
      : session?.userType === "ACCOUNTS"
        ? "/billing-reports"
        : "/dashboard";
    return NextResponse.redirect(new URL(landingPath, request.url));
  }

  if (isPublic) {
    return NextResponse.next();
  }

  if (mobileRequest) {
    if (!isAllowed(pathname, MOBILE_ALLOWED_PATHS)) {
      return NextResponse.redirect(
        new URL(getMobileLandingPath(session), request.url),
      );
    }
    return NextResponse.next();
  }

  const hasExtraAccess = hasExtraMenuRouteAccess(
    pathname,
    session?.extraMenuKeys,
  );

  if (pathname === "/copy-decks" || pathname.startsWith("/copy-decks/")) {
    const role = session?.functionalRole;
    const canAccessCopyDecks =
      session?.userType === "TEAM_LEAD" ||
      (session?.userType === "MANAGER" && role === "PROJECT_MANAGER") ||
      (session?.userType === "EMPLOYEE" &&
        (role === "LOCALIZATION" || role === "QA")) ||
      (session?.userType === "ADMIN" && role === "OTHER") ||
      hasExtraAccess;
    if (!canAccessCopyDecks) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (
    session?.userType === "ACCOUNTS" &&
    (pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/reports" ||
      pathname.startsWith("/reports/"))
  ) {
    return NextResponse.redirect(new URL("/billing-reports", request.url));
  }


  if (pathname === "/sweep-in-triggers" || pathname.startsWith("/sweep-in-triggers/")) {
    const canAccessSweepIn =
      session?.userType === "HR" ||
      (session?.userType === "ADMIN" &&
        (session.functionalRole === "OTHER" ||
          session.functionalRole === "PROJECT_MANAGER")) ||
      (session?.userType === "MANAGER" &&
        session.functionalRole !== "GENERAL_MANAGER");
    if (!canAccessSweepIn) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (
    pathname === "/billing-reports" ||
    pathname.startsWith("/billing-reports/")
  ) {
    if (
      session?.userType !== "ADMIN" &&
      session?.userType !== "ACCOUNTS" &&
      session?.userType !== "MANAGER"
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (
    pathname === "/client-billing-heads" ||
    pathname.startsWith("/client-billing-heads/") ||
    pathname === "/movie-billing-heads" ||
    pathname.startsWith("/movie-billing-heads/")
  ) {
    if (session?.userType !== "ADMIN" && !hasExtraAccess) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (
    session?.userType === "EMPLOYEE" &&
    !hasExtraAccess &&
    !isAllowed(pathname, EMPLOYEE_ALLOWED_PATHS)
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    session?.userType === "ACCOUNTS" &&
    !hasExtraAccess &&
    !isAllowed(pathname, ACCOUNTS_ALLOWED_PATHS)
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    session?.userType === "HR" &&
    !hasExtraAccess &&
    !isAllowed(pathname, HR_ALLOWED_PATHS)
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    session?.userType === "OPERATIONS" &&
    !hasExtraAccess &&
    !isAllowed(pathname, OPERATIONS_ALLOWED_PATHS)
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    isAllowed(pathname, MASTER_DATA_PATHS) &&
    session?.userType !== "ADMIN" &&
    session?.userType !== "OPERATIONS" &&
    !hasExtraAccess
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session?.userType === "TEAM_LEAD" && !hasExtraAccess) {
    const blocked = TEAM_LEAD_BLOCKED_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
    if (blocked) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
