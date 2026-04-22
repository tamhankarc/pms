"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireUserTypesForAction } from "@/lib/auth";
import { normalizeAddressCountry, toAddressSummary } from "@/lib/address";

const operationalRoles = [
  "DEVELOPER",
  "QA",
  "DESIGNER",
  "LOCALIZATION",
  "DEVOPS",
  "PROJECT_MANAGER",
  "DIRECTOR",
  "OTHER",
] as const;

const functionalRoles = [
  ...operationalRoles,
  "BILLING",
] as const;

const userTypes = [
  "ADMIN",
  "MANAGER",
  "TEAM_LEAD",
  "EMPLOYEE",
  "REPORT_VIEWER",
  "ACCOUNTS",
  "HR",
] as const;

type FunctionalRole = (typeof functionalRoles)[number];

export type UserFormState = {
  success?: boolean;
  error?: string;
};

const baseSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(2),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(50)
    .regex(/^[a-z0-9._-]+$/i, "Username can only contain letters, numbers, dot, underscore, and hyphen."),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  userType: z.enum(userTypes),
  functionalRole: z.enum(functionalRoles),
  employeeCode: z.string().trim().max(50).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  joiningDate: z.string().optional().or(z.literal("")),
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
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

function validateUserTypeRoleCombination(userType: typeof userTypes[number], functionalRole: FunctionalRole) {
  if (userType === "ACCOUNTS" && functionalRole !== "BILLING") {
    throw new Error("Accounts users must use the Billing functional role.");
  }
  if (userType !== "ACCOUNTS" && functionalRole === "BILLING") {
    throw new Error("The Billing functional role can only be used with the Accounts user type.");
  }
}

function buildAddressPayload(parsed: z.infer<typeof baseSchema>) {
  const currentAddress = {
    addressLine: parsed.currentAddressLine?.trim() || "",
    city: parsed.currentCity?.trim() || "",
    state: parsed.currentState?.trim() || "",
    country: normalizeAddressCountry(parsed.currentCountry),
    postalCode: parsed.currentPostalCode?.trim() || "",
  };

  const permanentSameAsCurrent = Boolean(parsed.permanentSameAsCurrent);
  const permanentAddress = permanentSameAsCurrent
    ? currentAddress
    : {
        addressLine: parsed.permanentAddressLine?.trim() || "",
        city: parsed.permanentCity?.trim() || "",
        state: parsed.permanentState?.trim() || "",
        country: normalizeAddressCountry(parsed.permanentCountry ?? parsed.currentCountry),
        postalCode: parsed.permanentPostalCode?.trim() || "",
      };

  return {
    currentAddress,
    permanentAddress,
    permanentSameAsCurrent,
  };
}

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  try {
    const actor = await requireUserTypesForAction(["ADMIN", "HR"]);

    const parsed = baseSchema.safeParse({
      fullName: formData.get("fullName"),
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
      userType: formData.get("userType"),
      functionalRole: formData.get("functionalRole"),
      employeeCode: formData.get("employeeCode") || "",
      designation: formData.get("designation") || "",
      joiningDate: formData.get("joiningDate") || "",
      phoneNumber: formData.get("phoneNumber") || "",
      secondaryPhoneNumber: formData.get("secondaryPhoneNumber") || "",
      currentAddressLine: formData.get("currentAddressLine") || "",
      currentCity: formData.get("currentCity") || "",
      currentState: formData.get("currentState") || "",
      currentCountry: formData.get("currentCountry") || "IN",
      currentPostalCode: formData.get("currentPostalCode") || "",
      permanentSameAsCurrent: formData.get("permanentSameAsCurrent") ?? undefined,
      permanentAddressLine: formData.get("permanentAddressLine") || "",
      permanentCity: formData.get("permanentCity") || "",
      permanentState: formData.get("permanentState") || "",
      permanentCountry: formData.get("permanentCountry") || formData.get("currentCountry") || "IN",
      permanentPostalCode: formData.get("permanentPostalCode") || "",
      isActive: formData.get("isActive") ?? "on",
    });

    if (!parsed.success || !parsed.data.password) {
      return {
        success: false,
        error: parsed.success ? "Password is required." : parsed.error.issues[0]?.message,
      };
    }

    if (actor.userType !== "ADMIN" && (parsed.data.userType === "MANAGER" || parsed.data.userType === "ADMIN" || parsed.data.userType === "HR")) {
      return { success: false, error: "Only Admin can create Manager, Admin, or HR users." };
    }

    validateUserTypeRoleCombination(parsed.data.userType, parsed.data.functionalRole);
    const { currentAddress, permanentAddress, permanentSameAsCurrent } = buildAddressPayload(parsed.data);
    const passwordHash = await hashPassword(parsed.data.password);

    await db.user.create({
      data: {
        fullName: parsed.data.fullName,
        username: parsed.data.username.toLowerCase(),
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        userType: parsed.data.userType,
        functionalRole: parsed.data.functionalRole,
        employeeCode: parsed.data.employeeCode?.trim() || null,
        designation: parsed.data.designation?.trim() || null,
        joiningDate: parsed.data.joiningDate ? new Date(parsed.data.joiningDate) : null,
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
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/users");
    revalidatePath("/team-lead-assignments");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateUserAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  try {
    const actor = await requireUserTypesForAction(["ADMIN", "HR"]);
    const parsed = baseSchema.safeParse({
      id: formData.get("id"),
      fullName: formData.get("fullName"),
      username: formData.get("username"),
      email: formData.get("email"),
      userType: formData.get("userType"),
      functionalRole: formData.get("functionalRole"),
      employeeCode: formData.get("employeeCode") || "",
      designation: formData.get("designation") || "",
      joiningDate: formData.get("joiningDate") || "",
      phoneNumber: formData.get("phoneNumber") || "",
      secondaryPhoneNumber: formData.get("secondaryPhoneNumber") || "",
      currentAddressLine: formData.get("currentAddressLine") || "",
      currentCity: formData.get("currentCity") || "",
      currentState: formData.get("currentState") || "",
      currentCountry: formData.get("currentCountry") || "IN",
      currentPostalCode: formData.get("currentPostalCode") || "",
      permanentSameAsCurrent: formData.get("permanentSameAsCurrent") ?? undefined,
      permanentAddressLine: formData.get("permanentAddressLine") || "",
      permanentCity: formData.get("permanentCity") || "",
      permanentState: formData.get("permanentState") || "",
      permanentCountry: formData.get("permanentCountry") || formData.get("currentCountry") || "IN",
      permanentPostalCode: formData.get("permanentPostalCode") || "",
      isActive: formData.get("isActive") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return {
        success: false,
        error: parsed.success ? "User is required." : parsed.error.issues[0]?.message,
      };
    }

    if (actor.userType !== "ADMIN" && (parsed.data.userType === "MANAGER" || parsed.data.userType === "ADMIN" || parsed.data.userType === "HR")) {
      return { success: false, error: "Only Admin can assign Manager, Admin, or HR user type." };
    }

    validateUserTypeRoleCombination(parsed.data.userType, parsed.data.functionalRole);
    const { currentAddress, permanentAddress, permanentSameAsCurrent } = buildAddressPayload(parsed.data);

    await db.user.update({
      where: { id: parsed.data.id },
      data: {
        fullName: parsed.data.fullName,
        username: parsed.data.username.toLowerCase(),
        email: parsed.data.email.toLowerCase(),
        userType: parsed.data.userType,
        functionalRole: parsed.data.functionalRole,
        employeeCode: parsed.data.employeeCode?.trim() || null,
        designation: parsed.data.designation?.trim() || null,
        joiningDate: parsed.data.joiningDate ? new Date(parsed.data.joiningDate) : null,
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
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/users");
    revalidatePath(`/users/${parsed.data.id}`);
    revalidatePath("/team-lead-assignments");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function toggleUserStatusAction(formData: FormData) {
  await requireUserTypesForAction(["ADMIN", "HR"]);
  const userId = String(formData.get("userId") || "");
  if (!userId) throw new Error("User is required.");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found.");

  await db.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
}

const teamLeadAssignmentSchema = z.object({
  teamLeadId: z.string().min(1),
  employeeId: z.string().min(1),
});

export type TeamLeadAssignmentState = {
  success?: boolean;
  error?: string;
};

export async function assignTeamLeadAction(
  _prevState: TeamLeadAssignmentState,
  formData: FormData,
): Promise<TeamLeadAssignmentState> {
  try {
    const actor = await requireUserTypesForAction(["ADMIN", "HR"]);

    const parsed = teamLeadAssignmentSchema.safeParse({
      teamLeadId: formData.get("teamLeadId"),
      employeeId: formData.get("employeeId"),
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid assignment payload" };
    }

    const employee = await db.user.findUnique({
      where: { id: parsed.data.employeeId },
      select: { id: true, userType: true, functionalRole: true },
    });

    if (!employee || employee.userType !== "EMPLOYEE") {
      return { success: false, error: "Selected user is not an employee." };
    }

    const supervisor = await db.user.findUnique({
      where: { id: parsed.data.teamLeadId },
      select: { id: true, userType: true, functionalRole: true },
    });

    const validSupervisor =
      supervisor &&
      (
        supervisor.userType === "TEAM_LEAD" ||
        (supervisor.userType === "MANAGER" && supervisor.functionalRole === employee.functionalRole)
      );

    if (!validSupervisor) {
      return {
        success: false,
        error: "Selected supervisor must be a Team Lead or a Manager with the same functional role as the employee.",
      };
    }

    await db.employeeTeamLead.upsert({
      where: {
        employeeId_teamLeadId: {
          employeeId: parsed.data.employeeId,
          teamLeadId: parsed.data.teamLeadId,
        },
      },
      create: {
        employeeId: parsed.data.employeeId,
        teamLeadId: parsed.data.teamLeadId,
        assignedById: actor.id,
      },
      update: {
        assignedById: actor.id,
      },
    });

    revalidatePath("/team-lead-assignments");
    revalidatePath("/users");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}