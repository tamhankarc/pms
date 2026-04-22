import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateLeaveYearProfile } from "@/lib/ems-queries";
import { getIstDateKey } from "@/lib/ist";
import { isHR } from "@/lib/permissions";
import { updateLeaveAdminUserAction } from "@/lib/actions/hr-leave-admin-actions";

export default async function LeaveAdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const user = await requireUser();
  if (!isHR(user)) {
    return <div className="space-y-6"><PageHeader title="Leave Administration" description="Only HR can access this page." /></div>;
  }
  const routeParams = await params;
  const query = (await searchParams) ?? {};
  const returnTo = query.returnTo || "/leave-admin";
  const target = await db.user.findUnique({ where: { id: routeParams.id }, select: { id: true, fullName: true, userType: true, functionalRole: true } });
  if (!target) notFound();
  const year = Number(getIstDateKey().slice(0, 4));
  const profile = await getOrCreateLeaveYearProfile(target.id, year);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Leave Administration · ${target.fullName}`}
        description="Update casual leaves, earned leaves, shift, and employment status."
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
            <input className="input" value={`${target.userType.replaceAll("_", " ")} · ${(target.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}`} readOnly />
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
            <select className="input" id="shift" name="shift" defaultValue={profile.shift}><option value="DAY">Day</option><option value="NIGHT">Night</option></select>
          </div>
          <div>
            <label className="label" htmlFor="employmentStatus">Employment status</label>
            <select className="input" id="employmentStatus" name="employmentStatus" defaultValue={profile.employmentStatus}><option value="PROBATION">Probation</option><option value="PERMANENT">Permanent</option></select>
          </div>
        </div>
        <button className="btn-primary" type="submit">Save details</button>
      </form>
    </div>
  );
}
