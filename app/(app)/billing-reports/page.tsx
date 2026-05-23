import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewBillingReports } from "@/lib/permissions";
import { billingReportClientVisibilityWhere } from "@/lib/billing-reports/config";
import { getBillingReportCatalogForClient } from "@/lib/billing-reports/amazon";

export default async function BillingReportsPage() {
  const user = await requireUser();
  if (!canViewBillingReports(user)) redirect("/dashboard");

  const availableClients = await db.client.findMany({
    where: billingReportClientVisibilityWhere,
    select: {
      id: true,
      name: true,
      isActive: true,
      showMoviesInEntries: true,
      projects: { select: { id: true, _count: { select: { timeEntries: true } } } },
      movies: { select: { id: true, isActive: true, _count: { select: { timeEntries: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const clients = availableClients.filter((client) => {
    if (getBillingReportCatalogForClient(client.name, client.id) || !client.showMoviesInEntries) return true;
    return client.projects.some((project) => project._count.timeEntries > 0) || client.movies.some((movie) => movie.isActive);
  });

  return (
    <div>
      <PageHeader
        title="Billing Reports"
        description="Select a client to open the billing report workspace."
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Clients</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{clients.length}</p>
          <p className="mt-1 text-sm text-slate-500">Visible in billing reports</p>
        </div>
        <div className="card p-5 md:col-span-2">
          <p className="text-sm font-semibold text-slate-900">Billing report visibility</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Only clients with an active working project are listed. Clients added to the exclusion list in code are hidden from this page and from the menu.
          </p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Client</th>
              <th className="table-cell">Projects</th>
              <th className="table-cell">Titles</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => (
              <tr key={client.id}>
                <td className="table-cell">
                  <div className="font-medium text-slate-900">{client.name}</div>
                </td>
                <td className="table-cell">{client.projects.length}</td>
                <td className="table-cell">{client.movies.length}</td>
                <td className="table-cell"><span className={client.isActive ? "badge-emerald" : "badge-slate"}>{client.isActive ? "Active" : "Inactive"}</span></td>
                <td className="table-cell">
                  <Link className="btn-secondary text-xs" href={`/billing-reports/${client.id}`}>View Report</Link>
                </td>
              </tr>
            ))}
            {clients.length === 0 ? (
              <tr><td colSpan={5} className="table-cell text-center text-sm text-slate-500">No clients found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
