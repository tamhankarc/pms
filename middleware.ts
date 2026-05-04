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
  "/profile",
  "/change-password",
];
const ACCOUNTS_ALLOWED_PATHS = ["/billing-reports", "/change-password"];
const HR_ALLOWED_PATHS = [
  "/dashboard",
  "/users",
  "/leave-requests",
  "/leave-approvals",
  "/announcements",
  "/leave-admin",
  "/profile",
  "/change-password",
];
const OPERATIONS_ALLOWED_PATHS = [
  "/dashboard",
  "/clients",
  "/movies",
  "/asset-type",
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
  "/asset-type",
  "/countries",
  "/languages",
  "/projects",
  "/sub-project",
  "/sub-projects",
  "/user-assignments",
  "/contact-persons",
];
const TEAM_LEAD_BLOCKED_PATHS = ["/users", "/team-lead-assignments", "/reports", "/leave-admin"];

async function getSessionPayload(request: NextRequest) {
  const token = request.cookies.get("pms_session")?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return null;

  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(secret));
    return verified.payload as { userType?: string; functionalRole?: string; extraMenuKeys?: string[] } | null;
  } catch {
    return null;
  }
}

function isAllowed(pathname: string, allowedPaths: string[]) {
  return allowedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

const MENU_ROUTE_PREFIXES: Record<string, string> = {
  clients: "/clients",
  movies: "/movies",
  "client-billing-heads": "/client-billing-heads",
  "movie-billing-heads": "/movie-billing-heads",
  "asset-type": "/asset-type",
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
  announcements: "/announcements",
  profile: "/profile",
  "billing-reports": "/billing-reports",
  "change-password": "/change-password",
};

function isManagedMenuPath(pathname: string) {
  return Object.values(MENU_ROUTE_PREFIXES).some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function hasExtraMenuRouteAccess(pathname: string, extraMenuKeys?: string[]) {
  if (!extraMenuKeys?.length) return false;
  return extraMenuKeys.some((key) => {
    const path = MENU_ROUTE_PREFIXES[key];
    return path ? pathname === path || pathname.startsWith(`${path}/`) : false;
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const session = await getSessionPayload(request);
  const authed = Boolean(session);

  if (!authed && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authed && (pathname === "/" || pathname === "/login" || pathname === "/unsupported-device")) {
    return NextResponse.redirect(new URL(session?.userType === "ACCOUNTS" ? "/billing-reports" : "/dashboard", request.url));
  }

  if (session?.userType === "ACCOUNTS" && (pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/reports" || pathname.startsWith("/reports/"))) {
    return NextResponse.redirect(new URL("/billing-reports", request.url));
  }

  if (pathname === "/billing-reports" || pathname.startsWith("/billing-reports/")) {
    if (session?.userType !== "ADMIN" && session?.userType !== "ACCOUNTS") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (isManagedMenuPath(pathname)) {
    return NextResponse.next();
  }

  if (session?.userType === "EMPLOYEE" && !isAllowed(pathname, EMPLOYEE_ALLOWED_PATHS)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session?.userType === "ACCOUNTS" && !isAllowed(pathname, ACCOUNTS_ALLOWED_PATHS)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session?.userType === "HR" && !isAllowed(pathname, HR_ALLOWED_PATHS)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session?.userType === "OPERATIONS" && !isAllowed(pathname, OPERATIONS_ALLOWED_PATHS)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isAllowed(pathname, MASTER_DATA_PATHS) && session?.userType !== "ADMIN" && session?.userType !== "OPERATIONS") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session?.userType === "TEAM_LEAD") {
    const blocked = TEAM_LEAD_BLOCKED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
    if (blocked) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (
    pathname === "/client-billing-heads" ||
    pathname.startsWith("/client-billing-heads/") ||
    pathname === "/movie-billing-heads" ||
    pathname.startsWith("/movie-billing-heads/")
  ) {
    if (session?.userType !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
