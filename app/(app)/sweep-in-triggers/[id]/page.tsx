import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SweepInTriggerForm } from "@/components/sweep-in-triggers/sweep-in-trigger-form";
import { updateSweepInTriggerAction } from "@/lib/actions/sweep-in-trigger-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canEditSweepInTriggers,
  getSweepInSelectableUsers,
  getVisibleSweepInTriggerWhere,
} from "@/lib/sweep-in-triggers";
import { getIstDateKey } from "@/lib/ist";

function formatTimeValue(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export default async function EditSweepInTriggerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const currentUser = await requireUser();
  if (!canEditSweepInTriggers(currentUser)) redirect("/sweep-in-triggers");

  const { id } = await params;
  const query = (await searchParams) ?? {};
  const visibleWhere = await getVisibleSweepInTriggerWhere(currentUser);

  const trigger = await db.sweepInTrigger.findFirst({
    where: {
      AND: [{ id }, visibleWhere],
    },
    include: {
      users: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
              employeeCode: true,
              functionalRole: true,
            },
          },
        },
      },
    },
  });

  if (!trigger) redirect("/sweep-in-triggers?error=Sweep-in+trigger+was+not+found.");

  const selectedUserIds = trigger.users.map((row) => row.userId);
  const users = await getSweepInSelectableUsers(currentUser, selectedUserIds);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Sweep-In Login Trigger"
        description="Update the date, login time, selected users, or notes for this sweep-in trigger."
      />

      {query.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {query.error}
        </div>
      ) : null}

      <SweepInTriggerForm
        action={updateSweepInTriggerAction}
        submitLabel="Save Trigger"
        triggerId={trigger.id}
        defaultDate={getIstDateKey(trigger.triggerDate)}
        defaultTime={trigger.triggerTime || formatTimeValue(trigger.markInAt)}
        defaultUserIds={selectedUserIds}
        defaultNotes={trigger.notes}
        users={users.map((user) => ({
          value: user.id,
          label: user.fullName,
          keywords: `${user.username} ${user.email} ${user.employeeCode ?? ""} ${user.functionalRole ?? ""}`,
        }))}
      />
    </div>
  );
}
