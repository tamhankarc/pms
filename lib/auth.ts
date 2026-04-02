"use server";

import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { FunctionalRoleCode, UserType } from "@prisma/client";

export type SessionUser = {
  id: string;
  name: string;
  fullName: string;
  email: string;
  username: string;
  designation?: string | null;
  userType: UserType;
  functionalRole: FunctionalRoleCode | "UNASSIGNED";
};

const COOKIE_NAME = "pms_session";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET missing");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Page/component guard version: redirects when unauthenticated.
 */
export async function requireUser() {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

/**
 * Page/component guard version: redirects when unauthorized.
 */
export async function requireUserTypes(userTypes: UserType[]) {
  const user = await requireUser();
  if (!userTypes.includes(user.userType)) redirect("/dashboard");
  return user;
}

/**
 * Server action-safe version: throws normal errors instead of redirecting.
 */
export async function requireUserForAction() {
  const user = await getSession();
  if (!user) {
    throw new Error("You must be signed in.");
  }
  return user;
}

/**
 * Server action-safe version: throws normal errors instead of redirecting.
 */
export async function requireUserTypesForAction(userTypes: UserType[]) {
  const user = await requireUserForAction();
  if (!userTypes.includes(user.userType)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return user;
}

export async function authenticate(usernameOrEmail: string, password: string) {
  const normalizedInput = usernameOrEmail.trim().toLowerCase();
  const user = await db.user.findFirst({
    where: {
      OR: [{ email: normalizedInput }, { username: normalizedInput }],
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      username: true,
      designation: true,
      userType: true,
      functionalRole: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    name: user.fullName,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    designation: user.designation ?? null,
    userType: user.userType,
    functionalRole: user.functionalRole ?? "UNASSIGNED",
  } satisfies SessionUser;
}