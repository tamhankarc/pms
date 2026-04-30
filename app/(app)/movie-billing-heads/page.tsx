import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";
import { toggleMovieBillingHeadAssignmentStatusAction } from "@/lib/actions/movie-billing-head-assignment-actions";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

function formatMoney(value: unknown) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function formatHeadCost(row: { country: { isoCode: string | null; name: string }; billingHead: { domesticCost: unknown; intlCost: unknown } }) {
  const iso = (row.country.isoCode ?? "").toUpperCase();
  const countryName = row.country.name.trim().toLowerCase();
  const isDomestic = iso === "US" || countryName === "united states" || countryName === "usa";
  return formatMoney(isDomestic ? row.billingHead.domesticCost : row.billingHead.intlCost);
}

export default async function MovieBillingHeadsPage({ searchParams }: { searchParams?: Promise<{ q?: string; clientId?: string; countryId?: string; status?: string; page?: string }> }) {
  await requireUserTypes(["ADMIN"]);
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const clientId = params.clientId ?? "all";
  const countryId = params.countryId ?? "all";
  const status = params.status ?? "all";
  const page = parsePageParam(params.page);

  const [clients, countries, rows] = await Promise.all([
    db.client.findMany({ where: { isActive: true, movieBillingHeads: { some: { isActive: true, OR: [{ domesticActive: true, domesticCompulsionType: "FIXED_OPTIONAL" }, { intlActive: true, intlCompulsionType: "FIXED_OPTIONAL" }] } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, isoCode: true } }),
    db.movieBillingHeadAssignment.findMany({
      where: {
        ...(clientId !== "all" ? { clientId } : {}),
        ...(countryId !== "all" ? { countryId } : {}),
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
        ...(q ? { OR: [{ movie: { title: { contains: q } } }, { billingHead: { name: { contains: q } } }, { client: { name: { contains: q } } }] } : {}),
      },
      include: { client: true, country: true, movie: true, billingHead: true },
      orderBy: [{ client: { name: "asc" } }, { movie: { title: "asc" } }, { billingHead: { name: "asc" } }],
    }),
  ]);

  const { items, currentPage, totalPages, totalItems, pageSize } = paginateItems(rows, page, DEFAULT_PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Movie Billing Heads" description="Assign Fixed - Optional billing heads to Working movies by client and country." actions={<Link href="/movie-billing-heads/new" className="btn-primary">Create Movie Billing Head</Link>} />
      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_220px_220px_180px_auto]" method="get">
          <input className="input" name="q" defaultValue={q} placeholder="Search by client, movie, or billing head" />
          <SearchableCombobox id="clientId" name="clientId" defaultValue={clientId} options={[{ value: "all", label: "All clients" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} placeholder="All clients" searchPlaceholder="Search clients..." emptyLabel="No client found." />
          <SearchableCombobox id="countryId" name="countryId" defaultValue={countryId} options={[{ value: "all", label: "All countries" }, ...countries.map((country) => ({ value: country.id, label: country.isoCode ? `${country.name} (${country.isoCode})` : country.name }))]} placeholder="All countries" searchPlaceholder="Search countries..." emptyLabel="No country found." />
          <SearchableCombobox id="status" name="status" defaultValue={status} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active only" }, { value: "inactive", label: "Inactive only" }]} placeholder="All statuses" searchPlaceholder="Search statuses..." emptyLabel="No status found." />
          <button className="btn-secondary" type="submit">Apply</button>
        </form>
      </div>
      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head"><tr><th className="table-cell">Client</th><th className="table-cell">Country</th><th className="table-cell">Movie</th><th className="table-cell">Billing Head</th><th className="table-cell">Cost Type</th><th className="table-cell">Cost</th><th className="table-cell">Units</th><th className="table-cell">Status</th><th className="table-cell">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((row) => (
              <tr key={row.id}>
                <td className="table-cell">{row.client.name}</td>
                <td className="table-cell">{row.country.name}</td>
                <td className="table-cell"><div className="font-medium text-slate-900">{row.movie.title}</div></td>
                <td className="table-cell">{row.billingHead.name}</td>
                <td className="table-cell">{row.billingHead.costType === "PER_UNIT_COST" ? "Per-unit cost" : "Whole cost"}</td>
                <td className="table-cell">{formatHeadCost(row)}</td>
                <td className="table-cell">{row.billingHead.costType === "PER_UNIT_COST" ? Number(row.units ?? 0) : "—"}</td>
                <td className="table-cell"><span className={row.isActive ? "badge-emerald" : "badge-slate"}>{row.isActive ? "Active" : "Inactive"}</span></td>
                <td className="table-cell"><div className="flex gap-2"><Link href={`/movie-billing-heads/${row.id}`} className="btn-secondary text-xs">Edit</Link><form action={toggleMovieBillingHeadAssignmentStatusAction}><input type="hidden" name="id" value={row.id} /><button className="btn-secondary text-xs">{row.isActive ? "Deactivate" : "Activate"}</button></form></div></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={9} className="table-cell text-center text-sm text-slate-500">No movie billing heads found.</td></tr> : null}
          </tbody>
        </table>
        <PaginationControls basePath="/movie-billing-heads" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ q, clientId, countryId, status }} />
      </div>
    </div>
  );
}
