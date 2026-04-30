import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { db } from "@/lib/db";
import { createMovieAction, toggleMovieStatusAction } from "@/lib/actions/movie-actions";
import { MovieForm } from "@/components/forms/movie-form";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

function formatMovieWorkflowStatus(status: string) {
  if (status === "COMPLETED_BILLED") return "Completed & Billed";
  if (status === "COMPLETED") return "Completed";
  return "Working";
}

export default async function MoviesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; clientId?: string; page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";
  const clientId = params.clientId ?? "all";
  const page = parsePageParam(params.page);

  const [clients, countries, billingHeads, movies] = await Promise.all([
    db.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.movieBillingHead.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, clientId: true, costType: true } }),
    db.movie.findMany({
      where: {
        ...(q ? { title: { contains: q } } : {}),
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
        ...(clientId !== "all" ? { clientId } : {}),
      },
      include: { client: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const { items: paginatedMovies, currentPage, totalPages, totalItems, pageSize } = paginateItems(movies, page, DEFAULT_PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Movies"
        description="Create and manage movies. Each movie belongs to exactly one client. Movie code is generated automatically."
      />

      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]" method="get">
          <input className="input" name="q" defaultValue={q} placeholder="Search by movie title" />
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
          <SearchableCombobox
            id="clientId"
            name="clientId"
            defaultValue={clientId}
            options={[
              { value: "all", label: "All clients" },
              ...clients.map((client) => ({ value: client.id, label: client.name })),
            ]}
            placeholder="All clients"
            searchPlaceholder="Search clients..."
            emptyLabel="No client found."
          />
          <button className="btn-secondary" type="submit">
            Apply
          </button>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="table-wrap">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Movie</th>
                <th className="table-cell">Client</th>
                <th className="table-cell">Billing Region</th>
                <th className="table-cell">Movie Status</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedMovies.map((movie) => (
                <tr key={movie.id}>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">{movie.title}</div>
                  </td>
                  <td className="table-cell">{movie.client.name}</td>
                  <td className="table-cell">{[movie.billingDomestic ? "Domestic" : null, movie.billingIntl ? "INTL" : null, movie.billingOther ? "Other" : null].filter(Boolean).join(", ") || "—"}</td>
                  <td className="table-cell"><span className="badge-blue">{formatMovieWorkflowStatus(movie.status)}</span></td>
                  <td className="table-cell">
                    <span className={movie.isActive ? "badge-emerald" : "badge-slate"}>
                      {movie.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <Link href={`/movies/${movie.id}`} className="btn-secondary text-xs">
                        Edit
                      </Link>
                      <form action={toggleMovieStatusAction}>
                        <input type="hidden" name="movieId" value={movie.id} />
                        <button className="btn-secondary text-xs">
                          {movie.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {movies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-sm text-slate-500">
                    No movies found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <PaginationControls basePath="/movies" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ q, status, clientId }} />
        </div>

        <MovieForm clients={clients} countries={countries} billingHeads={billingHeads} action={createMovieAction} title="Create movie" submitLabel="Create movie" />
      </div>
    </div>
  );
}
