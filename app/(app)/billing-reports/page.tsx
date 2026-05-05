import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewBillingReports } from "@/lib/permissions";

export default async function BillingReportsPage() {
  const user = await requireUser();
  if (!canViewBillingReports(user)) redirect("/dashboard");

  const clients = await db.client.findMany({
    where: { isActive: true, projects: { some: { isActive: true, status: "ACTIVE" } } },
    select: {
      id: true,
      name: true,
      isActive: true,
      projects: { select: { id: true } },
      movies: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Billing Reports"
        description="Select a client to open the billing report workspace. Detailed billing calculations will be added in the next phase."
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Clients</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{clients.length}</p>
          <p className="mt-1 text-sm text-slate-500">Available for billing report setup</p>
        </div>
        <div className="card p-5 md:col-span-2">
          <p className="text-sm font-semibold text-slate-900">Placeholder</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This page currently lists all clients and links to their individual report pages. Client-specific billing report logic can be added here without changing the navigation structure.
          </p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Client</th>
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
