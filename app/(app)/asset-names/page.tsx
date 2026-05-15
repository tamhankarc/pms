import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageAssetNames } from "@/lib/permissions";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";
import { toggleAssetNameStatusAction } from "@/lib/actions/asset-name-actions";

const UNIVERSAL_PICTURES_CLIENT_ID = "cmnh2xr1s0004l204ia5u5zj3";

export default async function AssetNamesPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string; movieId?: string; page?: string }> }) {
  const user = await requireUser();
  if (!canManageAssetNames(user)) redirect("/dashboard");
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";
  const selectedMovieId = params.movieId ?? "all";
  const page = parsePageParam(params.page);
  const movies = await db.movie.findMany({
    where: { clientId: UNIVERSAL_PICTURES_CLIENT_ID, isActive: true },
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
  });
  const validMovieIds = new Set(movies.map((movie) => movie.id));
  const effectiveMovieId = selectedMovieId !== "all" && validMovieIds.has(selectedMovieId) ? selectedMovieId : "all";
  const assetNames = await db.assetName.findMany({
    where: {
      clientId: UNIVERSAL_PICTURES_CLIENT_ID,
      ...(q ? { name: { contains: q } } : {}),
      ...(effectiveMovieId !== "all" ? { movieId: effectiveMovieId } : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
    },
    include: { movie: { select: { title: true } } },
    orderBy: [{ movie: { title: "asc" } }, { name: "asc" }],
  });
  const { items, currentPage, totalPages, totalItems, pageSize } = paginateItems(assetNames, page, DEFAULT_PAGE_SIZE);
  return <div>
    <PageHeader title="Asset Names" description="Create and manage Universal Pictures International asset names used in Time Entries and Estimates." actions={<Link href="/asset-names/new" className="btn-primary">Create Asset Name</Link>} />
    <div className="mb-6 card p-4">
      <form className="grid gap-3 md:grid-cols-[1fr_260px_180px_auto]" method="get">
        <input className="input" name="q" defaultValue={q} placeholder="Search by asset name" />
        <SearchableCombobox
          id="movieId"
          name="movieId"
          defaultValue={effectiveMovieId}
          options={[{ value: "all", label: "All movies" }, ...movies.map((movie) => ({ value: movie.id, label: movie.title }))]}
          placeholder="Select movie"
          searchPlaceholder="Search movies..."
          emptyLabel="No movie found."
        />
        <select className="input" name="status" defaultValue={status}><option value="all">All statuses</option><option value="active">Active only</option><option value="inactive">Inactive only</option></select>
        <button className="btn-secondary" type="submit">Apply</button>
      </form>
    </div>
    <div className="table-wrap">
      <table className="table-base"><thead className="table-head"><tr><th className="table-cell">Asset Name</th><th className="table-cell">Movie</th><th className="table-cell">Client</th><th className="table-cell">Status</th><th className="table-cell">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
        {items.map((assetName) => (<tr key={assetName.id}><td className="table-cell font-medium text-slate-900">{assetName.name}</td><td className="table-cell">{assetName.movie.title}</td><td className="table-cell">Universal Pictures International</td><td className="table-cell"><span className={assetName.isActive ? "badge-emerald" : "badge-slate"}>{assetName.isActive ? "Active" : "Inactive"}</span></td><td className="table-cell"><div className="flex gap-2"><Link href={`/asset-names/${assetName.id}`} className="btn-secondary text-xs">Edit</Link><form action={toggleAssetNameStatusAction}><input type="hidden" name="assetNameId" value={assetName.id} /><button className="btn-secondary text-xs">{assetName.isActive ? "Deactivate" : "Activate"}</button></form></div></td></tr>))}
        {assetNames.length === 0 ? <tr><td colSpan={5} className="table-cell text-center text-sm text-slate-500">No asset names found.</td></tr> : null}
      </tbody></table>
      <PaginationControls basePath="/asset-names" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ q, status, movieId: effectiveMovieId !== "all" ? effectiveMovieId : undefined }} />
    </div>
  </div>;
}
