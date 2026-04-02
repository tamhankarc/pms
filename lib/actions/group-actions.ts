"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserTypesForAction } from "@/lib/auth";

export type EmployeeGroupFormState = {
  success?: boolean;
  error?: string;
};

const groupSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Group name is required."),
  description: z.string().optional(),
  userIds: z.array(z.string()).optional().default([]),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

const REMOVED_FEATURE_MESSAGE =
  "Employee Groups have been removed. Use Sub Projects and personnel assignment instead.";

export async function createEmployeeGroupAction(
  _prevState: EmployeeGroupFormState,
  formData: FormData,
): Promise<EmployeeGroupFormState> {
  try {
    await requireUserTypesForAction(["ADMIN", "MANAGER", "TEAM_LEAD"]);

    const parsed = groupSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") || "",
      userIds: formData.getAll("userIds").map(String),
      isActive: formData.get("isActive") ?? "on",
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid employee group payload.",
      };
    }

    revalidatePath("/sub-project");
    revalidatePath("/projects");
    return {
      success: false,
      error: REMOVED_FEATURE_MESSAGE,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function updateEmployeeGroupAction(
  _prevState: EmployeeGroupFormState,
  formData: FormData,
): Promise<EmployeeGroupFormState> {
  try {
    await requireUserTypesForAction(["ADMIN", "MANAGER", "TEAM_LEAD"]);

    const parsed = groupSchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      description: formData.get("description") || "",
      userIds: formData.getAll("userIds").map(String),
      isActive: formData.get("isActive") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return {
        success: false,
        error: parsed.success
          ? "Employee group is required."
          : parsed.error.issues[0]?.message,
      };
    }

    revalidatePath("/sub-project");
    revalidatePath("/projects");
    return {
      success: false,
      error: REMOVED_FEATURE_MESSAGE,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function toggleEmployeeGroupStatusAction(formData: FormData) {
  await requireUserTypesForAction(["ADMIN", "MANAGER", "TEAM_LEAD"]);

  const groupId = String(formData.get("groupId") || "");
  if (!groupId) throw new Error("Employee group is required.");

  throw new Error(REMOVED_FEATURE_MESSAGE);
}