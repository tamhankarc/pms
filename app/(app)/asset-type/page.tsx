import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { db } from "@/lib/db";
import { createAssetTypeAction, toggleAssetTypeStatusAction } from "@/lib/actions/asset-type-actions";
import { AssetTypeForm } from "@/components/forms/asset-type-form";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

function formatUsd(value: { toString: () => string } | number | string) {
  const amount = Number(value.toString());
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(amount) ? amount : 0);
}

export default async function AssetTypesPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string; clientId?: string; page?: string }>; }) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";
  const clientId = params.clientId ?? "all";
  const page = parsePageParam(params.page);
  const [clients, assetTypes] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.assetType.findMany({ where: { ...(q ? { name: { contains: q } } : {}), ...(status === "active" ? { isActive: true } : {}), ...(status === "inactive" ? { isActive: false } : {}), ...(clientId !== "all" ? { clientId } : {}) }, include: { client: true }, orderBy: { name: "asc" } }),
  ]);
  const { items: paginatedAssetTypes, currentPage, totalPages, totalItems, pageSize } = paginateItems(assetTypes, page, DEFAULT_PAGE_SIZE);
  return (
    <div>
      <PageHeader title="Asset Types" description="Create and manage client-specific asset types with cost in US dollars. Asset Type code is generated automatically." actions={<Link href="/asset-type/new" className="btn-primary">Create Asset Type</Link>} />
      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]" method="get">
          <input className="input" name="q" defaultValue={q} placeholder="Search by asset type name" />
          <SearchableCombobox id="status" name="status" defaultValue={status} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active only" }, { value: "inactive", label: "Inactive only" }]} placeholder="All statuses" searchPlaceholder="Search statuses..." emptyLabel="No status found." />
          <SearchableCombobox id="clientId" name="clientId" defaultValue={clientId} options={[{ value: "all", label: "All clients" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} placeholder="All clients" searchPlaceholder="Search clients..." emptyLabel="No client found." />
          <button className="btn-secondary" type="submit">Apply</button>
        </form>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="table-wrap">
          <table className="table-base">
            <thead className="table-head"><tr><th className="table-cell">Asset Type</th><th className="table-cell">Client</th><th className="table-cell">Cost</th><th className="table-cell">Status</th><th className="table-cell">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAssetTypes.map((assetType) => (<tr key={assetType.id}><td className="table-cell"><div className="font-medium text-slate-900">{assetType.name}</div></td><td className="table-cell">{assetType.client.name}</td><td className="table-cell font-medium text-slate-900">{formatUsd(assetType.cost)}</td><td className="table-cell"><span className={assetType.isActive ? "badge-emerald" : "badge-slate"}>{assetType.isActive ? "Active" : "Inactive"}</span></td><td className="table-cell"><div className="flex gap-2"><Link href={`/asset-type/${assetType.id}`} className="btn-secondary text-xs">Edit</Link><form action={toggleAssetTypeStatusAction}><input type="hidden" name="assetTypeId" value={assetType.id} /><button className="btn-secondary text-xs">{assetType.isActive ? "Deactivate" : "Activate"}</button></form></div></td></tr>))}
              {assetTypes.length === 0 ? (<tr><td colSpan={5} className="table-cell text-center text-sm text-slate-500">No asset types found.</td></tr>) : null}
            </tbody>
          </table>
          <PaginationControls basePath="/asset-type" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ q, status, clientId }} />
        </div>
        <AssetTypeForm clients={clients} action={createAssetTypeAction} title="Create Asset Type" submitLabel="Create Asset Type" />
      </div>
    </div>
  );
}
