"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate, clearSession, createSession } from "@/lib/auth";

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, "Username or email is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  latitude: z.string().min(1, "Browser geolocation is required to sign in."),
  longitude: z.string().min(1, "Browser geolocation is required to sign in."),
  returnTo: z.string().optional(),
});

export async function loginAction(_state: unknown, formData: FormData) {
  const parsed = loginSchema.safeParse({
    usernameOrEmail: formData.get("usernameOrEmail"),
    password: formData.get("password"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    returnTo: formData.get("returnTo"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Enter a valid username/email and password." };
  }

  const user = await authenticate(parsed.data.usernameOrEmail, parsed.data.password);
  if (!user) return { error: "Invalid credentials or inactive account." };

  await createSession(user);
  const requestedReturnTo = parsed.data.returnTo || "";
  const safeReturnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "";
  redirect(safeReturnTo || (user.userType === "ACCOUNTS" ? "/billing-reports" : "/dashboard"));
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
