import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAssignCopyDeckAccess } from "@/lib/permissions";
import { parseMenuKeysJson } from "@/lib/menu-access";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { setCopyDeckAccessAction } from "@/lib/actions/copy-deck-actions";

export default async function CopyDeckAccessPage() {
  const actor = await requireUser();
  if (!canAssignCopyDeckAccess(actor)) redirect("/copy-decks");
  const users = await db.user.findMany({
    where: { isActive: true, id: { not: actor.id } },
    select: { id: true, fullName: true, userType: true, functionalRole: true, extraMenuItemsJson: true },
    orderBy: { fullName: "asc" },
  });
  return <div className="space-y-6">
    <PageHeader title="Copy Deck Access" description="Grant or revoke additional Copy Deck access. Default role access is retained and cannot be revoked here." actions={<Link className="btn-secondary" href="/copy-decks">Back</Link>} />
    <div className="table-wrap"><table className="table-base"><thead className="table-head"><tr><th className="table-cell">User</th><th className="table-cell">Role</th><th className="table-cell">Access</th><th className="table-cell">Action</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{users.map((user) => {
        const defaultAccess =
          user.userType === "TEAM_LEAD" ||
          (user.userType === "MANAGER" && user.functionalRole === "PROJECT_MANAGER") ||
          (user.userType === "EMPLOYEE" && (user.functionalRole === "QA" || user.functionalRole === "LOCALIZATION")) ||
          (user.userType === "ADMIN" && user.functionalRole === "OTHER");
        const extra = parseMenuKeysJson(user.extraMenuItemsJson).includes("copy-decks");
        return <tr key={user.id}><td className="table-cell font-medium">{user.fullName}</td><td className="table-cell">{user.userType.replaceAll("_", " ")} · {user.functionalRole?.replaceAll("_", " ") ?? "Unassigned"}</td><td className="table-cell">{defaultAccess ? "Default" : extra ? "Additional" : "None"}</td><td className="table-cell">
          {defaultAccess ? <span className="text-sm text-slate-500">Role controlled</span> : <form action={setCopyDeckAccessAction}><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="enabled" value={extra ? "false" : "true"} /><button className="btn-secondary text-xs">{extra ? "Revoke" : "Grant"}</button></form>}
        </td></tr>;
      })}</tbody>
    </table></div>
  </div>;
}
