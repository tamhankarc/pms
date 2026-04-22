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
const ACCOUNTS_ALLOWED_PATHS = ["/dashboard", "/change-password"];
const HR_ALLOWED_PATHS = [
  "/dashboard",
  "/users",
  "/leave-requests",
  "/leave-approvals",
  "/leave-admin",
  "/profile",
  "/change-password",
];
const TEAM_LEAD_BLOCKED_PATHS = ["/users", "/team-lead-assignments", "/reports", "/leave-admin"];

async function getSessionPayload(request: NextRequest) {
  const token = request.cookies.get("pms_session")?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return null;

  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(secret));
    return verified.payload as { userType?: string; functionalRole?: string } | null;
  } catch {
    return null;
  }
}

function isAllowed(pathname: string, allowedPaths: string[]) {
  return allowedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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
    return NextResponse.redirect(new URL("/dashboard", request.url));
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

  if (session?.userType === "TEAM_LEAD") {
    const blocked = TEAM_LEAD_BLOCKED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
    if (blocked) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (pathname === "/countries" || pathname.startsWith("/countries/")) {
    const allowed =
      session?.userType === "ADMIN" ||
      session?.userType === "MANAGER" ||
      session?.userType === "TEAM_LEAD" ||
      session?.userType === "HR";
    if (!allowed) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
