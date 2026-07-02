import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateLeaveYearProfile } from "@/lib/ems-queries";
import { getIstDateKey } from "@/lib/ist";
import { canAccessMenuItem, isHR } from "@/lib/permissions";
import { formatUserTypeLabel } from "@/lib/display-labels";
import { updateLeaveAdminUserAction } from "@/lib/actions/hr-leave-admin-actions";

export default async function LeaveAdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const user = await requireUser();
  if (!isHR(user) && !canAccessMenuItem(user, "leave-admin")) {
    return <div className="space-y-6"><PageHeader title="Leave Administration" description="Only Administration/HR can access this page." /></div>;
  }
  const routeParams = await params;
  const query = (await searchParams) ?? {};
  const returnTo = query.returnTo || "/leave-admin";
  const target = await db.user.findUnique({ where: { id: routeParams.id }, select: { id: true, fullName: true, userType: true, functionalRole: true } });
  if (!target) notFound();
  const year = Number(getIstDateKey().slice(0, 4));
  const profile = await getOrCreateLeaveYearProfile(target.id, year);

  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Leave Administration · ${target.fullName}`}
        description="Update leave balance, shift, and employment status. Probation and Consultant users always use unpaid leave."
        actions={<Link className="btn-secondary" href={returnTo}>Back to Leave Administration</Link>}
      />

      <form action={updateLeaveAdminUserAction} className="card p-6 space-y-5">
        <input type="hidden" name="userId" value={target.id} />
        <input type="hidden" name="year" value={String(year)} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">User</label>
            <input className="input" value={target.fullName} readOnly />
          </div>
          <div>
            <label className="label">Role</label>
            <input className="input" value={`${formatUserTypeLabel(target.userType)} · ${(target.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}`} readOnly />
          </div>
          <div>
            <label className="label" htmlFor="casualLeaves">Casual leaves</label>
            <input className="input" id="casualLeaves" name="casualLeaves" type="number" min="0" step="0.01" defaultValue={Number(profile.casualLeaves).toFixed(2)} required />
          </div>
          <div>
            <label className="label" htmlFor="earnedLeaves">Earned leaves</label>
            <input className="input" id="earnedLeaves" name="earnedLeaves" type="number" min="0" step="0.01" defaultValue={Number(profile.earnedLeaves).toFixed(2)} required />
          </div>
          <div>
            <label className="label" htmlFor="shift">Shift</label>
            <SearchableCombobox
              id="shift"
              name="shift"
              defaultValue={profile.shift}
              options={[
                { value: "DAY", label: "Day" },
                { value: "NIGHT", label: "Night" },
              ]}
              placeholder="Select shift"
              searchPlaceholder="Search shifts..."
              emptyLabel="No shift found."
            />
          </div>
          <div>
            <label className="label" htmlFor="employmentStatus">Employment status</label>
            <SearchableCombobox
              id="employmentStatus"
              name="employmentStatus"
              defaultValue={profile.employmentStatus}
              options={[
                { value: "PROBATION", label: "Probation" },
                { value: "PERMANENT", label: "Permanent" },
                { value: "CONSULTANT", label: "Consultant" },
              ]}
              placeholder="Select employment status"
              searchPlaceholder="Search employment statuses..."
              emptyLabel="No employment status found."
            />
            <p className="mt-1 text-xs text-slate-500">Probation and Consultant users always have 0 Casual and Earned leaves; approved leave is unpaid.</p>
          </div>
        </div>
        <button className="btn-primary" type="submit">Save details</button>
      </form>
    </div>
  );
}
