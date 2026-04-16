"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createSession,
  getSession,
  hashPassword,
  requireUserForAction,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeAddressCountry, toAddressSummary } from "@/lib/address";

export type ProfileActionState = {
  success?: boolean;
  message?: string;
};

export type PasswordActionState = {
  success?: boolean;
  message?: string;
};

const profileSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  phoneNumber: z.string().trim().max(30).optional().or(z.literal("")),
  secondaryPhoneNumber: z.string().trim().max(30).optional().or(z.literal("")),
  currentAddressLine: z.string().trim().max(2000).optional().or(z.literal("")),
  currentCity: z.string().trim().max(120).optional().or(z.literal("")),
  currentState: z.string().trim().max(120).optional().or(z.literal("")),
  currentCountry: z.enum(["IN", "US"]).optional(),
  currentPostalCode: z.string().trim().max(30).optional().or(z.literal("")),
  permanentSameAsCurrent: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  permanentAddressLine: z.string().trim().max(2000).optional().or(z.literal("")),
  permanentCity: z.string().trim().max(120).optional().or(z.literal("")),
  permanentState: z.string().trim().max(120).optional().or(z.literal("")),
  permanentCountry: z.enum(["IN", "US"]).optional(),
  permanentPostalCode: z.string().trim().max(30).optional().or(z.literal("")),
});

export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  try {
    const currentUser = await requireUserForAction();

    const parsed = profileSchema.safeParse({
      fullName: String(formData.get("fullName") ?? ""),
      phoneNumber: String(formData.get("phoneNumber") ?? ""),
      secondaryPhoneNumber: String(formData.get("secondaryPhoneNumber") ?? ""),
      currentAddressLine: String(formData.get("currentAddressLine") ?? ""),
      currentCity: String(formData.get("currentCity") ?? ""),
      currentState: String(formData.get("currentState") ?? ""),
      currentCountry: String(formData.get("currentCountry") ?? "IN"),
      currentPostalCode: String(formData.get("currentPostalCode") ?? ""),
      permanentSameAsCurrent: formData.get("permanentSameAsCurrent") ?? undefined,
      permanentAddressLine: String(formData.get("permanentAddressLine") ?? ""),
      permanentCity: String(formData.get("permanentCity") ?? ""),
      permanentState: String(formData.get("permanentState") ?? ""),
      permanentCountry: String(formData.get("permanentCountry") ?? formData.get("currentCountry") ?? "IN"),
      permanentPostalCode: String(formData.get("permanentPostalCode") ?? ""),
    });

    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid profile payload",
      };
    }

    const permanentSameAsCurrent = Boolean(parsed.data.permanentSameAsCurrent);
    const currentAddress = {
      addressLine: parsed.data.currentAddressLine?.trim() || "",
      city: parsed.data.currentCity?.trim() || "",
      state: parsed.data.currentState?.trim() || "",
      country: normalizeAddressCountry(parsed.data.currentCountry),
      postalCode: parsed.data.currentPostalCode?.trim() || "",
    };
    const permanentAddress = permanentSameAsCurrent
      ? currentAddress
      : {
          addressLine: parsed.data.permanentAddressLine?.trim() || "",
          city: parsed.data.permanentCity?.trim() || "",
          state: parsed.data.permanentState?.trim() || "",
          country: normalizeAddressCountry(parsed.data.permanentCountry ?? parsed.data.currentCountry),
          postalCode: parsed.data.permanentPostalCode?.trim() || "",
        };

    const updated = await db.user.update({
      where: { id: currentUser.id },
      data: {
        fullName: parsed.data.fullName.trim(),
        phoneNumber: parsed.data.phoneNumber?.trim() || null,
        secondaryPhoneNumber: parsed.data.secondaryPhoneNumber?.trim() || null,
        currentAddressLine: currentAddress.addressLine || null,
        currentCity: currentAddress.city || null,
        currentState: currentAddress.state || null,
        currentCountry: currentAddress.country,
        currentPostalCode: currentAddress.postalCode || null,
        permanentAddressLine: permanentAddress.addressLine || null,
        permanentCity: permanentAddress.city || null,
        permanentState: permanentAddress.state || null,
        permanentCountry: permanentAddress.country,
        permanentPostalCode: permanentAddress.postalCode || null,
        currentAddress: toAddressSummary(currentAddress),
        permanentAddress: toAddressSummary(permanentAddress),
        permanentSameAsCurrent,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        designation: true,
        userType: true,
        functionalRole: true,
      },
    });

    await createSession({
      id: updated.id,
      username: updated.username,
      name: updated.fullName,
      fullName: updated.fullName,
      email: updated.email,
      designation: updated.designation ?? null,
      userType: updated.userType,
      functionalRole: updated.functionalRole ?? "UNASSIGNED",
    });

    revalidatePath("/profile");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Profile updated successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
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

export async function changePasswordAction(
  _prevState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  try {
    const currentUser = await requireUserForAction();

    const parsed = passwordSchema.safeParse({
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });

    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid password payload",
      };
    }

    const user = await db.user.findUnique({ where: { id: currentUser.id } });
    if (!user) {
      return { success: false, message: "User not found." };
    }

    const isValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, message: "Current password is incorrect." };
    }

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
    revalidatePath("/change-password");

    return {
      success: true,
      message: "Password updated successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}
