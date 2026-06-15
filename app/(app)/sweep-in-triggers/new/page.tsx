import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SweepInTriggerForm } from "@/components/sweep-in-triggers/sweep-in-trigger-form";
import { createSweepInTriggerAction } from "@/lib/actions/sweep-in-trigger-actions";
import { requireUser } from "@/lib/auth";
import {
  canCreateSweepInTriggers,
  getSweepInSelectableUsers,
} from "@/lib/sweep-in-triggers";

export default async function NewSweepInTriggerPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const currentUser = await requireUser();
  if (!canCreateSweepInTriggers(currentUser)) redirect("/sweep-in-triggers");

  const params = (await searchParams) ?? {};
  const users = await getSweepInSelectableUsers(currentUser);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Sweep-In Login Trigger"
        description="Select the attendance date, the early login time, and the users who should receive this special Mark-In update."
      />

      {params.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {params.error}
        </div>
      ) : null}

      <SweepInTriggerForm
        action={createSweepInTriggerAction}
        submitLabel="Create Trigger"
        users={users.map((user) => ({
          value: user.id,
          label: user.fullName,
          keywords: `${user.username} ${user.email} ${user.employeeCode ?? ""} ${user.functionalRole ?? ""}`,
        }))}
      />
    </div>
  );
}
