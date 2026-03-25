import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "@/components/forms/client-form";
import { createClientAction, toggleClientStatusAction } from "@/lib/actions/client-actions";
import { db } from "@/lib/db";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";

  const clients = await db.client.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { code: { contains: q } },
            ],
          }
        : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
    },
    include: {
      projects: true,
      movies: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Create and maintain client masters. Projects are always linked to a client, while movie association remains optional."
      />

      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]" method="get">
          <input
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Search by client name or code"
          />
          <select className="input" name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <button className="btn-secondary" type="submit">Apply</button>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
        <div className="table-wrap">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Client</th>
                <th className="table-cell">Code</th>
                <th className="table-cell">Projects</th>
                <th className="table-cell">Movies</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">{client.name}</div>
                    <div className="text-xs text-slate-500">
                      Created {client.createdAt.toLocaleDateString()}
                    </div>
                  </td>
                  <td className="table-cell">{client.code || "—"}</td>
                  <td className="table-cell">{client.projects.length}</td>
                  <td className="table-cell">{client.movies.length}</td>
                  <td className="table-cell">
                    <span className={client.isActive ? "badge-emerald" : "badge-slate"}>
                      {client.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <Link className="btn-secondary text-xs" href={`/clients/${client.id}`}>
                        Edit
                      </Link>
                      <form action={toggleClientStatusAction}>
                        <input type="hidden" name="clientId" value={client.id} />
                        <button className="btn-secondary text-xs">
                          {client.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-sm text-slate-500">
                    No clients found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <ClientForm mode="create" action={createClientAction} />
      </div>
    </div>
  );
}
