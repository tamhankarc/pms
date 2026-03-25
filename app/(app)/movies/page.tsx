import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { createMovieAction, toggleMovieStatusAction } from "@/lib/actions/movie-actions";
import { MovieForm } from "@/components/forms/movie-form";

export default async function MoviesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; clientId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";
  const clientId = params.clientId ?? "all";

  const [clients, movies] = await Promise.all([
    db.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.movie.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { code: { contains: q } },
              ],
            }
          : {}),
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
        ...(clientId !== "all" ? { clientId } : {}),
      },
      include: { client: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Movies"
        description="Create and manage movies. Each movie belongs to exactly one client."
      />

      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]" method="get">
          <input className="input" name="q" defaultValue={q} placeholder="Search by movie title or code" />
          <select className="input" name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <select className="input" name="clientId" defaultValue={clientId}>
            <option value="all">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
          <button className="btn-secondary" type="submit">Apply</button>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="table-wrap">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Movie</th>
                <th className="table-cell">Client</th>
                <th className="table-cell">Code</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movies.map((movie) => (
                <tr key={movie.id}>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">{movie.title}</div>
                    <div className="text-xs text-slate-500">{movie.description || "—"}</div>
                  </td>
                  <td className="table-cell">{movie.client.name}</td>
                  <td className="table-cell">{movie.code || "—"}</td>
                  <td className="table-cell">
                    <span className={movie.isActive ? "badge-emerald" : "badge-slate"}>
                      {movie.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <Link href={`/movies/${movie.id}`} className="btn-secondary text-xs">Edit</Link>
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
                  <td colSpan={5} className="table-cell text-center text-sm text-slate-500">
                    No movies found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <MovieForm
          clients={clients}
          action={createMovieAction}
          title="Create movie"
          submitLabel="Create movie"
        />
      </div>
    </div>
  );
}
