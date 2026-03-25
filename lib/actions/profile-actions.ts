"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createSession,
  getSession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";

const profileSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  phoneNumber: z.string().trim().max(30).optional().or(z.literal("")),
  currentAddress: z.string().trim().max(2000).optional().or(z.literal("")),
  permanentSameAsCurrent: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  permanentAddress: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function updateProfileAction(formData: FormData) {
  const currentUser = await requireUser();

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phoneNumber: formData.get("phoneNumber"),
    currentAddress: formData.get("currentAddress"),
    permanentSameAsCurrent: formData.get("permanentSameAsCurrent") ?? undefined,
    permanentAddress: formData.get("permanentAddress"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid profile payload");
  }

  const permanentSameAsCurrent = Boolean(parsed.data.permanentSameAsCurrent);
  const currentAddress = parsed.data.currentAddress?.trim() || null;
  const permanentAddress = permanentSameAsCurrent
    ? currentAddress
    : parsed.data.permanentAddress?.trim() || null;

  const updated = await db.user.update({
    where: { id: currentUser.id },
    data: {
      fullName: parsed.data.fullName.trim(),
      phoneNumber: parsed.data.phoneNumber?.trim() || null,
      currentAddress,
      permanentAddress,
      permanentSameAsCurrent,
    },
  });

  await createSession({
    id: updated.id,
    name: updated.fullName,
    fullName: updated.fullName,
    email: updated.email,
    userType: updated.userType,
    functionalRole: updated.functionalRole ?? "UNASSIGNED",
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(6, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Please confirm the new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "New password and confirm password must match.",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(formData: FormData) {
  const currentUser = await requireUser();

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid password payload");
  }

  const user = await db.user.findUnique({ where: { id: currentUser.id } });
  if (!user) throw new Error("User not found.");

  const isValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!isValid) throw new Error("Current password is incorrect.");

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({
    where: { id: currentUser.id },
    data: { passwordHash },
  });

  const session = await getSession();
  if (session) {
    await createSession(session);
  }

  revalidatePath("/profile");
}
