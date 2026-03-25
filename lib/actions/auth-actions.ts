"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate, clearSession, createSession } from "@/lib/auth";
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
export async function loginAction(_state: unknown, formData: FormData) {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) return { error: "Invalid credentials or inactive account." };
  await createSession(user); redirect("/dashboard");
}
export async function logoutAction() { await clearSession(); redirect("/login"); }
