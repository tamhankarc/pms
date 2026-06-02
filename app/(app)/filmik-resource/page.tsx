import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { canManageAssetTypes, canViewCostData } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { db } from "@/lib/db";
import { toggleFilmikResourceStatusAction } from "@/lib/actions/filmik-resource-actions";
import { FILMIK_CLIENT_ID } from "@/lib/billing-reports/config";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

function formatUsd(value: { toString: () => string } | number | string) {
  const amount = Number(value.toString());
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(amount) ? amount : 0);
}

export default async function FilmikResourcesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const currentUser = await requireUser();
  if (!canManageAssetTypes(currentUser)) redirect("/dashboard");

  const canSeeCosts = canViewCostData(currentUser);
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";
  const page = parsePageParam(params.page);
  const resources = await db.filmikResourceType.findMany({
    where: {
      clientId: FILMIK_CLIENT_ID,
      ...(q ? { name: { contains: q } } : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
    },
    orderBy: { name: "asc" },
  });
  const { items: paginatedResources, currentPage, totalPages, totalItems, pageSize } = paginateItems(resources, page, DEFAULT_PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Filmik Resources"
        description="Create and manage Filmik resource types and their per-resource client/vendor monthly costs."
        actions={<Link href="/filmik-resource/new" className="btn-primary">Create Resource Type</Link>}
      />
      <div className="mb-6 card p-4">
        <AutoSubmitFilterForm className="grid gap-3 md:grid-cols-[1fr_180px_auto]" method="get">
          <input className="input" name="q" defaultValue={q} placeholder="Search by resource type" />
          <SearchableCombobox
            id="status"
            name="status"
            defaultValue={status}
            options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active only" }, { value: "inactive", label: "Inactive only" }]}
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
              <th className="table-cell">Resource Type</th>
              {canSeeCosts ? <th className="table-cell">Per Resource Client Cost</th> : null}
              {canSeeCosts ? <th className="table-cell">Per Resource Vendor Cost</th> : null}
              <th className="table-cell">Status</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedResources.map((resource) => (
              <tr key={resource.id}>
                <td className="table-cell"><div className="font-medium text-slate-900">{resource.name}</div></td>
                {canSeeCosts ? <td className="table-cell font-medium text-slate-900">{formatUsd(resource.cost)}</td> : null}
                {canSeeCosts ? <td className="table-cell font-medium text-slate-900">{formatUsd(resource.perResourceVendorCost)}</td> : null}
                <td className="table-cell"><span className={resource.isActive ? "badge-emerald" : "badge-slate"}>{resource.isActive ? "Active" : "Inactive"}</span></td>
                <td className="table-cell">
                  <div className="flex gap-2">
                    <Link href={`/filmik-resource/${resource.id}`} className="btn-secondary text-xs">Edit</Link>
                    <form action={toggleFilmikResourceStatusAction}>
                      <input type="hidden" name="resourceId" value={resource.id} />
                      <button className="btn-secondary text-xs">{resource.isActive ? "Deactivate" : "Activate"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {resources.length === 0 ? <tr><td colSpan={canSeeCosts ? 5 : 3} className="table-cell text-center text-sm text-slate-500">No Filmik resource types found.</td></tr> : null}
          </tbody>
        </table>
        <PaginationControls basePath="/filmik-resource" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ q, status }} />
      </div>
    </div>
  );
}
