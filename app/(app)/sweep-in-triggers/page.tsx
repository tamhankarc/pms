import Link from "next/link";
import { redirect } from "next/navigation";
import { Edit, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SweepInTriggerUserList } from "@/components/sweep-in-triggers/sweep-in-trigger-user-list";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canCreateSweepInTriggers,
  canEditSweepInTriggers,
  canViewSweepInTriggers,
  getVisibleSweepInTriggerWhere,
} from "@/lib/sweep-in-triggers";
import { formatDateInIst, formatTimeInIst } from "@/lib/ist";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

type SweepInTriggersSearchParams = Record<string, string | string[] | undefined>;

export default async function SweepInTriggersPage({
  searchParams,
}: {
  searchParams?: Promise<SweepInTriggersSearchParams>;
}) {
  const currentUser = await requireUser();
  if (!canViewSweepInTriggers(currentUser)) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const currentPage = parsePageParam(params.page);
  const visibleWhere = await getVisibleSweepInTriggerWhere(currentUser);

  const triggers = await db.sweepInTrigger.findMany({
    where: visibleWhere,
    include: {
      createdBy: {
        select: { fullName: true },
      },
      users: {
        include: {
          user: {
            select: { fullName: true },
          },
        },
        orderBy: {
          user: {
            fullName: "asc",
          },
        },
      },
    },
    orderBy: [{ triggerDate: "desc" }, { createdAt: "desc" }],
  });

  const { items, currentPage: page, totalPages, totalItems, pageSize } = paginateItems(
    triggers,
    currentPage,
    DEFAULT_PAGE_SIZE,
  );

  const canCreate = canCreateSweepInTriggers(currentUser);
  const canEdit = canEditSweepInTriggers(currentUser);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sweep-In Login Triggers"
        description="Create and review special early-login updates for selected users. Existing Mark-In records for selected users are updated immediately, and future Mark-In records for the trigger date use the trigger time for selected users only."
        actions={
          canCreate ? (
            <Link href="/sweep-in-triggers/new" className="btn-primary inline-flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              New Sweep-In Trigger
            </Link>
          ) : null
        }
      />

      {params.success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {params.success}
        </div>
      ) : null}

      {params.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {params.error}
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Date</th>
              <th className="table-cell">Login time</th>
              <th className="table-cell">Users</th>
              <th className="table-cell">Notes</th>
              <th className="table-cell">Added by</th>
              <th className="table-cell">Created at</th>
              <th className="table-cell">Updated at</th>
              {canEdit ? <th className="table-cell">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((trigger) => (
              <tr key={trigger.id}>
                <td className="table-cell font-medium text-slate-900">
                  {formatDateInIst(trigger.triggerDate)}
                </td>
                <td className="table-cell">{formatTimeInIst(trigger.markInAt)}</td>
                <td className="table-cell">
                  <SweepInTriggerUserList users={trigger.users.map((row) => row.user.fullName)} />
                </td>
                <td className="table-cell max-w-md whitespace-pre-wrap text-sm text-slate-700">
                  {trigger.notes}
                </td>
                <td className="table-cell">{trigger.createdBy.fullName}</td>
                <td className="table-cell">{formatDateInIst(trigger.createdAt)} {formatTimeInIst(trigger.createdAt)}</td>
                <td className="table-cell">{formatDateInIst(trigger.updatedAt)} {formatTimeInIst(trigger.updatedAt)}</td>
                {canEdit ? (
                  <td className="table-cell">
                    <Link
                      href={`/sweep-in-triggers/${trigger.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </td>
                ) : null}
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="table-cell text-center text-sm text-slate-500">
                  No sweep-in triggers found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <PaginationControls
          basePath="/sweep-in-triggers"
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          searchParams={params}
        />
      </div>
    </div>
  );
}
