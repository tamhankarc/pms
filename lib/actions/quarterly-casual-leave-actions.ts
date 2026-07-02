"use server";

import { revalidatePath } from "next/cache";
import { requireUserForAction } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import {
  ensureQuarterlyCasualLeaveCreditsForAllEligibleUsers,
  rectifyApprovedLeaveRequestAllocation,
} from "@/lib/quarterly-casual-leaves";
import { getIstDateKey } from "@/lib/ist";

function requireAdminOther(user: Awaited<ReturnType<typeof requireUserForAction>>) {
  if (!isAdmin(user) || user.functionalRole !== "OTHER") {
    throw new Error("Only Admin users with functional role Other can run quarterly leave maintenance.");
  }
}

export async function runQuarterlyCasualLeaveCreditAction(formData: FormData) {
  const user = await requireUserForAction();
  requireAdminOther(user);
  const asOfDateKey = String(formData.get("asOfDateKey") || getIstDateKey());
  const year = Number(asOfDateKey.slice(0, 4));
  await ensureQuarterlyCasualLeaveCreditsForAllEligibleUsers(
    year,
    asOfDateKey,
    user.id,
    "ADMIN",
  );
  revalidatePath("/leave-admin");
  revalidatePath("/leave-admin/quarterly-casual-leaves");
  revalidatePath("/leave-requests");
  revalidatePath("/dashboard");
}

export async function rectifySingleApprovedLeaveAction(formData: FormData) {
  const user = await requireUserForAction();
  requireAdminOther(user);
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Leave request is required.");
  await rectifyApprovedLeaveRequestAllocation(id);
  revalidatePath("/leave-admin");
  revalidatePath("/leave-admin/quarterly-casual-leaves");
  revalidatePath("/leave-requests");
  revalidatePath("/leave-approvals");
  revalidatePath("/dashboard");
}

export async function rectifyAllApprovedLeaveAction(formData: FormData) {
  const user = await requireUserForAction();
  requireAdminOther(user);
  const ids = String(formData.get("ids") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const id of ids) {
    await rectifyApprovedLeaveRequestAllocation(id);
  }
  revalidatePath("/leave-admin");
  revalidatePath("/leave-admin/quarterly-casual-leaves");
  revalidatePath("/leave-requests");
  revalidatePath("/leave-approvals");
  revalidatePath("/dashboard");
}

