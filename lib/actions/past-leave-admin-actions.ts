"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/permissions";
import { getPastApprovedLeaveDeletePreview } from "@/lib/leave-admin-ledger";

function requireAdminOther(user: Awaited<ReturnType<typeof requireUserForAction>>) {
  if (!isAdmin(user) || user.functionalRole !== "OTHER") {
    throw new Error("Only Admin users with functional role Other can delete past approved leaves.");
  }
}

export async function deletePastApprovedLeaveAction(formData: FormData) {
  const user = await requireUserForAction();
  requireAdminOther(user);

  const id = String(formData.get("id") || "").trim();
  const confirmText = String(formData.get("confirmText") || "").trim().toUpperCase();
  if (!id) throw new Error("Leave request is required.");
  if (confirmText !== "DELETE") {
    throw new Error("Type DELETE to confirm this old approved leave deletion.");
  }

  const preview = await getPastApprovedLeaveDeletePreview(id);
  if (!preview) throw new Error("Leave request not found.");

  await db.$transaction(async (tx) => {
    if (preview.casualToRestore > 0 || preview.earnedToRestore > 0) {
      await tx.leaveYearProfile.update({
        where: { id: preview.profile.id },
        data: {
          casualLeaves: {
            increment: new Prisma.Decimal(preview.casualToRestore.toFixed(2)),
          },
          earnedLeaves: {
            increment: new Prisma.Decimal(preview.earnedToRestore.toFixed(2)),
          },
        },
      });
    }

    await tx.leaveRequest.delete({ where: { id: preview.request.id } });
  });

  revalidatePath("/leave-admin");
  revalidatePath("/leave-admin/leave-ledger");
  revalidatePath("/leave-requests");
  revalidatePath("/leave-approvals");
  revalidatePath("/dashboard");

  redirect("/leave-admin#past-approved-leaves");
}
