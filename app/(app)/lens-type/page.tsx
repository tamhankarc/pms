import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageLensTypes, canViewCostData } from "@/lib/permissions";
import { toggleLensTypeStatusAction } from "@/lib/actions/lens-type-actions";
import {
  DEFAULT_PAGE_SIZE,
  paginateItems,
  parsePageParam,
} from "@/lib/pagination";

function formatUsd(value: { toString: () => string } | number | string) {
  const amount = Number(value.toString());
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default async function LensTypesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const currentUser = await requireUser();
  if (!canManageLensTypes(currentUser)) redirect("/dashboard");
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";
  const rows = await db.lensType.findMany({
    where: {
      ...(q ? { name: { contains: q } } : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
    },
    orderBy: { name: "asc" },
  });
  const pageData = paginateItems(
    rows,
    parsePageParam(params.page),
    DEFAULT_PAGE_SIZE,
  );
  const canSeeCosts = canViewCostData(currentUser);
  return (
    <div>
      <PageHeader
        title="Lens Types"
        description="Create and manage Lens Types and their USD costs for Time Entries, Estimates, and Billing Reports."
        actions={
          <Link href="/lens-type/new" className="btn-primary">
            Create Lens Type
          </Link>
        }
      />
      <div className="mb-6 card p-4">
        <AutoSubmitFilterForm
          className="grid gap-3 md:grid-cols-[1fr_180px]"
          method="get"
        >
          <input
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Search by lens type name"
          />
          <SearchableCombobox
            id="status"
            name="status"
            defaultValue={status}
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active only" },
              { value: "inactive", label: "Inactive only" },
            ]}
            placeholder="All statuses"
            searchPlaceholder="Search statuses..."
            emptyLabel="No status found."
          />
        </AutoSubmitFilterForm>
      </div>
      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Lens Type</th>
              {canSeeCosts ? <th className="table-cell">Cost</th> : null}
              <th className="table-cell">Status</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageData.items.map((row) => (
              <tr key={row.id}>
                <td className="table-cell font-medium text-slate-900">
                  {row.name}
                </td>
                {canSeeCosts ? (
                  <td className="table-cell font-medium text-slate-900">
                    {formatUsd(row.cost)}
                  </td>
                ) : null}
                <td className="table-cell">
                  <span
                    className={row.isActive ? "badge-emerald" : "badge-slate"}
                  >
                    {row.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="table-cell">
                  <div className="flex gap-2">
                    <Link
                      href={`/lens-type/${row.id}`}
                      className="btn-secondary text-xs"
                    >
                      Edit
                    </Link>
                    <form action={toggleLensTypeStatusAction}>
                      <input type="hidden" name="lensTypeId" value={row.id} />
                      <button className="btn-secondary text-xs">
                        {row.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={canSeeCosts ? 4 : 3}
                  className="table-cell text-center text-sm text-slate-500"
                >
                  No lens types found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <PaginationControls
          basePath="/lens-type"
          currentPage={pageData.currentPage}
          totalPages={pageData.totalPages}
          totalItems={pageData.totalItems}
          pageSize={pageData.pageSize}
          searchParams={{ q, status }}
        />
      </div>
    </div>
  );
}
