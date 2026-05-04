import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewBillingReports } from "@/lib/permissions";

export default async function ClientBillingReportPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const user = await requireUser();
  if (!canViewBillingReports(user)) redirect("/dashboard");

  const { clientId } = await params;
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      isActive: true,
      hourlyCost: true,
      projects: { select: { id: true, billingModel: true, isActive: true } },
      movies: { select: { id: true, status: true, isActive: true } },
      movieBillingHeads: { select: { id: true } },
      movieBillingHeadAssignments: { select: { id: true } },
    },
  });

  if (!client) redirect("/billing-reports");

  const fixedFullProjects = client.projects.filter((project) => project.billingModel === "FIXED_FULL").length;
  const workingMovies = client.movies.filter((movie) => movie.status === "WORKING" && movie.isActive).length;

  return (
    <div>
      <PageHeader
        title={`${client.name} Billing Report`}
        description="Placeholder billing report page for this client. The detailed billing calculations and export layout will be added in the next phase."
        actions={<Link className="btn-secondary" href="/billing-reports">Back to Billing Reports</Link>}
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{client.isActive ? "Active" : "Inactive"}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Projects</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{client.projects.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Fixed Full Projects</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{fixedFullProjects}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Working Movies</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{workingMovies}</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="section-title">Report Placeholder</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Billing report content for <span className="font-semibold text-slate-900">{client.name}</span> will appear here. This page is ready for client-specific report tables, date filters, billing head calculations, project costs, movie billing details, and exports.
        </p>
        <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="font-medium text-slate-900">Client hourly cost:</span> ${Number(client.hourlyCost).toFixed(2)}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="font-medium text-slate-900">Client billing heads:</span> {client.movieBillingHeads.length}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="font-medium text-slate-900">Movie billing assignments:</span> {client.movieBillingHeadAssignments.length}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="font-medium text-slate-900">Active movies:</span> {client.movies.filter((movie) => movie.isActive).length}
          </div>
        </div>
      </div>
    </div>
  );
}
