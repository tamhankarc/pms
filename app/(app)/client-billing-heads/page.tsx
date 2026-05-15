import { canManageClientBillingHeads, canViewCostData } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toggleMovieBillingHeadStatusAction } from "@/lib/actions/movie-billing-head-actions";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

function formatHeadType(type: string) {
  return type === "FIXED_COMPULSORY" ? "Fixed - Compulsory" : "Fixed - Optional";
}

function formatActiveCost(isActive: boolean, value: unknown) {
  return isActive ? `$${Number(value).toFixed(2)}` : "—";
}

function BillingRegionInfo({
  isActive,
  headType,
  cost,
  canadaCost,
  canSeeCosts,
}: {
  isActive: boolean;
  headType: string;
  cost: unknown;
  canadaCost?: unknown;
  canSeeCosts: boolean;
}) {
  return (
    <div className="space-y-1 text-xs leading-5 text-slate-600">
      <div><span className="font-semibold text-slate-700">Status:</span> {isActive ? "Active" : "Inactive"}</div>
      <div><span className="font-semibold text-slate-700">Head Type:</span> {isActive ? formatHeadType(headType) : "—"}</div>
      {canSeeCosts ? <div><span className="font-semibold text-slate-700">Head Cost:</span> {formatActiveCost(isActive, cost)}</div> : null}
      {canSeeCosts && canadaCost !== undefined ? <div><span className="font-semibold text-slate-700">Canada Cost:</span> {formatActiveCost(isActive, canadaCost)}</div> : null}
    </div>
  );
}

export default async function MovieBillingHeadsPage({
 searchParams }: { searchParams?: Promise<{ q?: string; clientId?: string; status?: string; page?: string }> }) {
  const currentUser = await requireUser();
  if (!canManageClientBillingHeads(currentUser)) redirect("/dashboard");

  const canSeeCosts = canViewCostData(currentUser);
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const clientId = params.clientId ?? "all";
  const status = params.status ?? "all";
  const page = parsePageParam(params.page);
  const [clients, heads] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.movieBillingHead.findMany({
      where: {
        ...(q ? { name: { contains: q } } : {}),
        ...(clientId !== "all" ? { clientId } : {}),
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
      },
      include: { client: true },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    }),
  ]);
  const { items, currentPage, totalPages, totalItems, pageSize } = paginateItems(heads, page, DEFAULT_PAGE_SIZE);
  return (
    <div>
      <PageHeader title="Billing Heads" description="Create and maintain client-specific billing heads." actions={<Link href="/client-billing-heads/new" className="btn-primary">Create Billing Head</Link>} />
      <div className="mb-6 card p-4"><form className="grid gap-3 md:grid-cols-[1fr_220px_180px_auto]" method="get"><input className="input" name="q" defaultValue={q} placeholder="Search by billing head" /><SearchableCombobox id="clientId" name="clientId" defaultValue={clientId} options={[{ value: "all", label: "All clients" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} placeholder="All clients" searchPlaceholder="Search clients..." emptyLabel="No client found." /><SearchableCombobox id="status" name="status" defaultValue={status} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active only" }, { value: "inactive", label: "Inactive only" }]} placeholder="All statuses" searchPlaceholder="Search statuses..." emptyLabel="No status found." /><button className="btn-secondary" type="submit">Apply</button></form></div>
      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Billing Head</th>
              <th className="table-cell">Client</th>
              {canSeeCosts ? <th className="table-cell">Cost Type</th> : null}
              <th className="table-cell">Domestic Billing</th>
              <th className="table-cell">INTL Billing</th>
              <th className="table-cell">Other Billing</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((head) => (
              <tr key={head.id}>
                <td className="table-cell"><div className="font-medium text-slate-900">{head.name}</div></td>
                <td className="table-cell">{head.client.name}</td>
                {canSeeCosts ? <td className="table-cell">{head.costType === "WHOLE_COST" ? "Whole cost" : "Per-unit cost"}</td> : null}
                <td className="table-cell"><BillingRegionInfo isActive={head.domesticActive} headType={head.domesticCompulsionType ?? head.compulsionType} cost={head.domesticCost} canSeeCosts={canSeeCosts} /></td>
                <td className="table-cell"><BillingRegionInfo isActive={head.intlActive} headType={head.intlCompulsionType ?? head.compulsionType} cost={head.intlCost} canadaCost={head.intlCanadaCost} canSeeCosts={canSeeCosts} /></td>
                <td className="table-cell"><BillingRegionInfo isActive={head.otherActive} headType={head.otherCompulsionType ?? head.compulsionType} cost={head.otherCost} canSeeCosts={canSeeCosts} /></td>
                <td className="table-cell"><span className={head.isActive ? "badge-emerald" : "badge-slate"}>{head.isActive ? "Active" : "Inactive"}</span></td>
                <td className="table-cell"><div className="flex gap-2"><Link href={`/client-billing-heads/${head.id}`} className="btn-secondary text-xs">Edit</Link><form action={toggleMovieBillingHeadStatusAction}><input type="hidden" name="id" value={head.id} /><button className="btn-secondary text-xs">{head.isActive ? "Deactivate" : "Activate"}</button></form></div></td>
              </tr>
            ))}
            {heads.length === 0 ? <tr><td colSpan={canSeeCosts ? 8 : 7} className="table-cell text-center text-sm text-slate-500">No billing heads found.</td></tr> : null}
          </tbody>
        </table>
        <PaginationControls basePath="/client-billing-heads" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ q, clientId, status }} />
      </div>    </div>
  );
}
