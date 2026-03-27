import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login"];
const EMPLOYEE_ALLOWED_PATHS = [
  "/dashboard",
  "/time-entries",
  "/estimates",
  "/profile",
];
const TEAM_LEAD_BLOCKED_PATHS = [
  "/users",
  "/team-lead-assignments",
  "/reports",
  "/countries",
];

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

  if (!authed && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authed && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session?.userType === "EMPLOYEE") {
    const allowed = EMPLOYEE_ALLOWED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
    if (!allowed) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
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
      (session?.userType === "MANAGER" && session?.functionalRole === "PROJECT_MANAGER");
    if (!allowed) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
