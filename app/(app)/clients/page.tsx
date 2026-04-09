import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { ClientForm } from "@/components/forms/client-form";
import { createClientAction, toggleClientStatusAction } from "@/lib/actions/client-actions";
import { db } from "@/lib/db";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; showCreate?: string; page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";
  const showCreate = params.showCreate === "1";
  const page = parsePageParam(params.page);

  const allClients = await db.client.findMany({
    where: {
      ...(q
        ? {
            name: { contains: q },
          }
        : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
    },
    include: {
      projects: true,
      movies: true,
      projectTypes: true,
    },
    orderBy: { name: "asc" },
  });

  const { items: clients, currentPage, totalPages, totalItems, pageSize } = paginateItems(allClients, page, DEFAULT_PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Create and maintain client masters and control whether Movies, Countries, Languages, and Project Types are used in downstream forms."
        actions={
          showCreate ? (
            <Link href="/clients" className="btn-secondary">
              Close
            </Link>
          ) : (
            <Link href="/clients?showCreate=1" className="btn-primary">
              Create client
            </Link>
          )
        }
      />

      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]" method="get">
          <input className="input" name="q" defaultValue={q} placeholder="Search by client name" />
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
            emptyLabel="No statuses found."
          />
          <div className="flex gap-3">
            {showCreate ? <input type="hidden" name="showCreate" value="1" /> : null}
            <button className="btn-secondary" type="submit">
              Apply
            </button>
          </div>
        </form>
      </div>

      <div className={`grid gap-6 ${showCreate ? "xl:grid-cols-[1.25fr_0.85fr]" : "grid-cols-1"}`}>
        <div className="table-wrap">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Client</th>
                <th className="table-cell">Projects</th>
                <th className="table-cell">Movies</th>
                <th className="table-cell">Project Types</th>
                <th className="table-cell">Entry fields</th>
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
                  <td className="table-cell">{client.projects.length}</td>
                  <td className="table-cell">{client.movies.length}</td>
                  <td className="table-cell">
                    {client.enableProjectTypes ? client.projectTypes.length : "Disabled"}
                  </td>
                  <td className="table-cell">
                    <div className="text-xs text-slate-600">
                      Countries: {client.showCountriesInTimeEntries ? "Required" : "Hidden"}
                    </div>
                    <div className="text-xs text-slate-600">
                      Languages: {client.showLanguagesInEntries ? "Required" : "Hidden"}
                    </div>
                    <div className="text-xs text-slate-600">
                      Movies: {client.showMoviesInEntries ? "Optional" : "Hidden"}
                    </div>
                  </td>
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

              {allClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center text-sm text-slate-500">
                    No clients found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <PaginationControls basePath="/clients" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ q, status, showCreate: showCreate ? "1" : undefined }} />
        </div>

        {showCreate ? <ClientForm mode="create" action={createClientAction} /> : null}
      </div>
    </div>
  );
}
