import { canManageMovieBillingHeads, canViewCostData } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { MovieBillingHeadAssignmentListFilters } from "@/components/forms/movie-billing-head-assignment-list-filters";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toggleMovieBillingHeadAssignmentStatusAction } from "@/lib/actions/movie-billing-head-assignment-actions";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

function formatMoney(value: unknown) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function formatHeadCost(row: { country: { isoCode: string | null; name: string }; billingHead: { domesticCost: unknown; intlCost: unknown; otherCost: unknown; otherActive?: boolean } }) {
  const iso = (row.country.isoCode ?? "").toUpperCase();
  const countryName = row.country.name.trim().toLowerCase();
  const isDomestic = iso === "US" || countryName === "united states" || countryName === "usa";
  if (row.billingHead.otherActive) return formatMoney(row.billingHead.otherCost);
  return formatMoney(isDomestic ? row.billingHead.domesticCost : row.billingHead.intlCost);
}

export default async function MovieBillingHeadsPage({
 searchParams }: { searchParams?: Promise<{ q?: string; clientId?: string; movieId?: string; status?: string; page?: string }> }) {
  const currentUser = await requireUser();
  if (!canManageMovieBillingHeads(currentUser)) redirect("/dashboard");

  const canSeeCosts = canViewCostData(currentUser);
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const clientId = params.clientId ?? "all";
  const movieId = params.movieId ?? "all";
  const status = params.status ?? "all";
  const page = parsePageParam(params.page);

  const [clients, movies, rows] = await Promise.all([
    db.client.findMany({ where: { isActive: true, movieBillingHeads: { some: { isActive: true, OR: [{ domesticActive: true, domesticCompulsionType: "FIXED_OPTIONAL" }, { intlActive: true, intlCompulsionType: "FIXED_OPTIONAL" }, { otherActive: true, otherCompulsionType: "FIXED_OPTIONAL" }] } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.movie.findMany({ where: { isActive: true, status: "WORKING" }, orderBy: { title: "asc" }, select: { id: true, clientId: true, title: true } }),
    db.movieBillingHeadAssignment.findMany({
      where: {
        ...(clientId !== "all" ? { clientId } : {}),
        ...(movieId !== "all" ? { movieId } : {}),
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
        <MovieBillingHeadAssignmentListFilters q={q} clientId={clientId} movieId={movieId} status={status} clients={clients} movies={movies} />
      </div>
      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head"><tr><th className="table-cell">Client</th><th className="table-cell">Country</th><th className="table-cell">Movie</th><th className="table-cell">Billing Head</th>{canSeeCosts ? <th className="table-cell">Cost Type</th> : null}{canSeeCosts ? <th className="table-cell">Cost</th> : null}{canSeeCosts ? <th className="table-cell">Units</th> : null}<th className="table-cell">Status</th><th className="table-cell">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((row) => (
              <tr key={row.id}>
                <td className="table-cell">{row.client.name}</td>
                <td className="table-cell">{row.country.name}</td>
                <td className="table-cell"><div className="font-medium text-slate-900">{row.movie.title}</div></td>
                <td className="table-cell">{row.billingHead.name}</td>
                {canSeeCosts ? <td className="table-cell">{row.billingHead.costType === "PER_UNIT_COST" ? "Per-unit cost" : "Whole cost"}</td> : null}
                {canSeeCosts ? <td className="table-cell">{formatHeadCost(row)}</td> : null}
                {canSeeCosts ? <td className="table-cell">{row.billingHead.costType === "PER_UNIT_COST" ? Number(row.units ?? 0) : "—"}</td> : null}
                <td className="table-cell"><span className={row.isActive ? "badge-emerald" : "badge-slate"}>{row.isActive ? "Active" : "Inactive"}</span></td>
                <td className="table-cell">
                  <div className="flex gap-2">
                    <Link href={`/movie-billing-heads/${row.id}`} className="btn-secondary text-xs">{row.movie.status === "COMPLETED_BILLED" ? "View" : "Edit"}</Link>
                    {row.movie.status === "COMPLETED_BILLED" ? (
                      <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">Billed</span>
                    ) : (
                      <form action={toggleMovieBillingHeadAssignmentStatusAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button className="btn-secondary text-xs">{row.isActive ? "Deactivate" : "Activate"}</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={canSeeCosts ? 9 : 6} className="table-cell text-center text-sm text-slate-500">No movie billing heads found.</td></tr> : null}
          </tbody>
        </table>
        <PaginationControls basePath="/movie-billing-heads" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ q, clientId, movieId, status }} />
      </div>
    </div>
  );
}
