"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import {
  buildIstDateTimeUtc,
  canCreateSweepInTriggers,
  canEditSweepInTriggers,
  getAttendanceDateStartUtc,
  getSweepInSelectableUsers,
  getVisibleSweepInTriggerWhere,
  isDateKey,
  isTimeValue,
} from "@/lib/sweep-in-triggers";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getStringValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function redirectWithMessage(
  path: string,
  type: "success" | "error",
  message: string,
): never {
  const search = new URLSearchParams();
  search.set(type, message);
  redirect(`${path}?${search.toString()}`);
}

async function validatePayload({
  formData,
  allowedUserIds,
  redirectPath,
}: {
  formData: FormData;
  allowedUserIds: Set<string>;
  redirectPath: string;
}) {
  const triggerDate = getString(formData, "triggerDate");
  const triggerTime = getString(formData, "triggerTime");
  const notes = getString(formData, "notes");
  const selectedUserIds = Array.from(new Set(getStringValues(formData, "userIds")));

  if (!isDateKey(triggerDate)) {
    redirectWithMessage(redirectPath, "error", "Please select a valid trigger date.");
  }

  if (!isTimeValue(triggerTime)) {
    redirectWithMessage(redirectPath, "error", "Please select a valid login time.");
  }

  if (selectedUserIds.length === 0) {
    redirectWithMessage(redirectPath, "error", "Please select at least one user.");
  }

  if (selectedUserIds.some((userId) => !allowedUserIds.has(userId))) {
    redirectWithMessage(
      redirectPath,
      "error",
      "One or more selected users are not available for your access scope.",
    );
  }

  if (!notes) {
    redirectWithMessage(redirectPath, "error", "Notes are compulsory.");
  }

  return {
    triggerDate,
    triggerTime,
    notes,
    selectedUserIds,
    triggerDateStart: getAttendanceDateStartUtc(triggerDate),
    markInAt: buildIstDateTimeUtc(triggerDate, triggerTime),
  };
}

export async function createSweepInTriggerAction(formData: FormData) {
  const currentUser = await requireUserForAction();

  if (!canCreateSweepInTriggers(currentUser)) {
    redirect("/sweep-in-triggers");
  }

  const selectableUsers = await getSweepInSelectableUsers(currentUser);
  const allowedUserIds = new Set(selectableUsers.map((user) => user.id));
  const payload = await validatePayload({
    formData,
    allowedUserIds,
    redirectPath: "/sweep-in-triggers/new",
  });

  await db.$transaction(async (tx) => {
    const trigger = await tx.sweepInTrigger.create({
      data: {
        triggerDate: payload.triggerDateStart,
        triggerTime: payload.triggerTime,
        markInAt: payload.markInAt,
        notes: payload.notes,
        createdById: currentUser.id,
        users: {
          createMany: {
            data: payload.selectedUserIds.map((userId) => ({ userId })),
          },
        },
      },
    });

    await tx.attendanceLog.updateMany({
      where: {
        userId: { in: payload.selectedUserIds },
        type: "MARK_IN",
        attendanceDate: payload.triggerDateStart,
      },
      data: { markedAt: payload.markInAt },
    });

    return trigger;
  });

  revalidatePath("/sweep-in-triggers");
  revalidatePath("/dashboard");
  redirectWithMessage(
    "/sweep-in-triggers",
    "success",
    "Sweep-in trigger created and applied to existing Mark-In records for selected users.",
  );
}

export async function updateSweepInTriggerAction(formData: FormData) {
  const currentUser = await requireUserForAction();

  if (!canEditSweepInTriggers(currentUser)) {
    redirect("/sweep-in-triggers");
  }

  const triggerId = getString(formData, "triggerId");
  if (!triggerId) {
    redirectWithMessage("/sweep-in-triggers", "error", "Sweep-in trigger was not found.");
  }

  const visibleWhere = await getVisibleSweepInTriggerWhere(currentUser);
  const existing = await db.sweepInTrigger.findFirst({
    where: {
      AND: [{ id: triggerId }, visibleWhere],
    },
    include: {
      users: {
        select: { userId: true },
      },
    },
  });

  if (!existing) {
    redirectWithMessage("/sweep-in-triggers", "error", "Sweep-in trigger was not found or is outside your access scope.");
  }

  const existingUserIds = existing.users.map((user) => user.userId);
  const selectableUsers = await getSweepInSelectableUsers(currentUser, existingUserIds);
  const allowedUserIds = new Set(selectableUsers.map((user) => user.id));
  const payload = await validatePayload({
    formData,
    allowedUserIds,
    redirectPath: `/sweep-in-triggers/${triggerId}`,
  });

  await db.$transaction(async (tx) => {
    await tx.sweepInTrigger.update({
      where: { id: triggerId },
      data: {
        triggerDate: payload.triggerDateStart,
        triggerTime: payload.triggerTime,
        markInAt: payload.markInAt,
        notes: payload.notes,
      },
    });

    await tx.sweepInTriggerUser.deleteMany({
      where: { triggerId },
    });

    await tx.sweepInTriggerUser.createMany({
      data: payload.selectedUserIds.map((userId) => ({ triggerId, userId })),
    });

    await tx.attendanceLog.updateMany({
      where: {
        userId: { in: payload.selectedUserIds },
        type: "MARK_IN",
        attendanceDate: payload.triggerDateStart,
      },
      data: { markedAt: payload.markInAt },
    });
  });

  revalidatePath("/sweep-in-triggers");
  revalidatePath("/dashboard");
  redirectWithMessage(
    "/sweep-in-triggers",
    "success",
    "Sweep-in trigger updated and applied to existing Mark-In records for selected users.",
  );
}
