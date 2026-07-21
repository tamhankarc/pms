"use server";

import { revalidatePath } from "next/cache";
import { requireUserForAction } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { applyLeaveBalanceTransition } from "@/lib/leave-migration";
import { getIstDateKey, isValidIstDateKey } from "@/lib/ist";

export async function applyLeaveBalanceTransitionAction(formData: FormData) {
  const actor = await requireUserForAction();
  if (!isAdmin(actor) || actor.functionalRole !== "OTHER")
    throw new Error("Only Admin + Other can apply the leave balance transition.");
  const confirmation = String(formData.get("confirmation") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const cutoverDateKey = String(formData.get("cutoverDateKey") || getIstDateKey()).trim();
  if (!isValidIstDateKey(cutoverDateKey)) throw new Error("Enter a valid IST cutover date.");
  if (cutoverDateKey > getIstDateKey()) throw new Error("The migration cutover date cannot be in the future.");
  if (confirmation !== "MIGRATE") throw new Error('Type "MIGRATE" to confirm the transition.');
  if (!note) throw new Error("A migration note is required.");
  await applyLeaveBalanceTransition({ cutoverDateKey, actorId: actor.id, note });
  revalidatePath("/leave-admin");
  revalidatePath("/leave-admin/leave-balance-transition");
  revalidatePath("/leave-admin/leave-ledger");
  revalidatePath("/leave-requests");
  revalidatePath("/dashboard");
  revalidatePath("/hr-reports");
}
