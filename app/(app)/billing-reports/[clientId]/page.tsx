import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewBillingReports } from "@/lib/permissions";
import {
  buildAmazonBillingReportFilters,
  getBillingReportCatalogForClient,
  formatUsd,
  getAmazonBillingReportData,
  normalizeAmazonReportType,
  type AmazonReportType,
} from "@/lib/billing-reports/amazon";

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function ReportTab({ clientId, reportType, activeReport, label }: { clientId: string; reportType: AmazonReportType; activeReport: AmazonReportType; label: string }) {
  const isActive = reportType === activeReport;
  return (
    <Link
      href={`/billing-reports/${clientId}?report=${reportType}`}
      className={isActive ? "btn-primary" : "btn-secondary"}
    >
      {label}
    </Link>
  );
}

function ExportButtons({ clientId, reportType, filters }: { clientId: string; reportType: AmazonReportType; filters: { fromDate: string; toDate: string; movieId: string; assetTypeId: string } }) {
  const query = buildQueryString({
    report: reportType,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    movieId: filters.movieId,
    assetTypeId: filters.assetTypeId,
  });

  return (
    <div className="flex flex-wrap gap-3">
      <Link className="btn-secondary" href={`/billing-reports/${clientId}/export?format=excel&${query}`}>
        Export Excel
      </Link>
      <Link className="btn-secondary" href={`/billing-reports/${clientId}/export?format=pdf&${query}`}>
        Export PDF
      </Link>
    </div>
  );
}

function AmazonReportFilters({ clientId, reportType, data }: { clientId: string; reportType: AmazonReportType; data: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>> }) {
  return (
    <form method="get" action={`/billing-reports/${clientId}`} className="card p-5">
      <input type="hidden" name="report" value={reportType} />
      <div className="grid gap-4 md:grid-cols-[160px_160px_1fr_1fr_auto] md:items-end">
        <div>
          <label className="label" htmlFor="fromDate">Date from</label>
          <input id="fromDate" name="fromDate" type="date" className="input" defaultValue={data.filters.fromDate} />
        </div>
        <div>
          <label className="label" htmlFor="toDate">Date to</label>
          <input id="toDate" name="toDate" type="date" className="input" defaultValue={data.filters.toDate} />
        </div>
        <div>
          <label className="label" htmlFor="movieId">Title</label>
          <SearchableCombobox
            id="movieId"
            name="movieId"
            defaultValue={data.filters.movieId}
            options={[{ value: "all", label: "All titles" }, ...data.movieOptions.map((movie) => ({ value: movie.id, label: movie.title }))]}
            placeholder="All titles"
            searchPlaceholder="Search titles..."
            emptyLabel="No titles found."
          />
        </div>
        <div>
          <label className="label" htmlFor="assetTypeId">Asset Type</label>
          <SearchableCombobox
            id="assetTypeId"
            name="assetTypeId"
            defaultValue={data.filters.assetTypeId}
            options={[{ value: "all", label: "All asset types" }, ...data.assetTypeOptions.map((assetType) => ({ value: assetType.id, label: assetType.name }))]}
            placeholder="All asset types"
            searchPlaceholder="Search asset types..."
            emptyLabel="No asset types found."
          />
        </div>
        <button className="btn-primary" type="submit">Apply</button>
      </div>
    </form>
  );
}

function AmazonReportDetailsTable({ data }: { data: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>> }) {
  const isLocalization = data.reportType === "localization";

  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Date</th>
            <th className="table-cell">Title Name</th>
            <th className="table-cell">Asset Name</th>
            {isLocalization ? <th className="table-cell">Territory/Variant</th> : null}
            <th className="table-cell">Asset Type</th>
            <th className="table-cell">Cost</th>
            <th className="table-cell">Contact Person</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.rows.map((row, index) => (
            <tr key={`${row.date}-${row.titleName}-${row.assetName}-${index}`}>
              <td className="table-cell whitespace-nowrap">{row.date}</td>
              <td className="table-cell">{row.titleName}</td>
              <td className="table-cell">{row.assetName}</td>
              {isLocalization ? <td className="table-cell">{row.territoryVariant ?? "-"}</td> : null}
              <td className="table-cell">{row.assetType}</td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">{formatUsd(row.cost)}</td>
              <td className="table-cell">{row.contactPerson}</td>
            </tr>
          ))}
          {data.rows.length === 0 ? (
            <tr>
              <td colSpan={isLocalization ? 7 : 6} className="table-cell text-center text-sm text-slate-500">
                No records found for the selected filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AmazonReportSummaryTable({ data }: { data: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>> }) {
  const totalAssets = data.summaryRows.reduce((sum, row) => sum + row.totalAssets, 0);
  const totalCost = data.summaryRows.reduce((sum, row) => sum + row.totalCost, 0);

  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Asset Type</th>
            <th className="table-cell">Total Assets</th>
            <th className="table-cell">Total Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.summaryRows.map((row) => (
            <tr key={row.assetType}>
              <td className="table-cell">{row.assetType}</td>
              <td className="table-cell font-medium text-slate-900">{row.totalAssets}</td>
              <td className="table-cell font-medium text-slate-900">{formatUsd(row.totalCost)}</td>
            </tr>
          ))}
          {data.summaryRows.length === 0 ? (
            <tr><td colSpan={3} className="table-cell text-center text-sm text-slate-500">No summary available.</td></tr>
          ) : (
            <tr className="bg-slate-50">
              <td className="table-cell font-semibold text-slate-900">Total</td>
              <td className="table-cell font-semibold text-slate-900">{totalAssets}</td>
              <td className="table-cell font-semibold text-slate-900">{formatUsd(totalCost)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AmazonReportsWorkspace({ clientId, activeReport, data }: { clientId: string; activeReport: AmazonReportType; data: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>> }) {
  const reportCatalog = getBillingReportCatalogForClient(data.client.name);
  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <ReportTab clientId={clientId} reportType="social-assets" activeReport={activeReport} label={reportCatalog?.["social-assets"].title ?? "Social Assets"} />
          <ReportTab clientId={clientId} reportType="localization" activeReport={activeReport} label={reportCatalog?.localization.title ?? "Localization"} />
        </div>
      </div>

      {!data.projectFound ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Project <span className="font-semibold">{data.projectName}</span> was not found for this client. Please create or rename the project before using this report.
        </div>
      ) : null}

      <AmazonReportFilters clientId={clientId} reportType={activeReport} data={data} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.reportTitle}</h2>
          <p className="section-subtitle">Detailed billing records from time entries.</p>
        </div>
        <ExportButtons clientId={clientId} reportType={activeReport} filters={data.filters} />
      </div>

      <AmazonReportDetailsTable data={data} />

      <div>
        <h2 className="section-title mb-3">Summary by Asset Type</h2>
        <AmazonReportSummaryTable data={data} />
      </div>
    </div>
  );
}

export default async function ClientBillingReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!canViewBillingReports(user)) redirect("/dashboard");

  const { clientId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const activeReport = normalizeAmazonReportType(Array.isArray(resolvedSearchParams.report) ? resolvedSearchParams.report[0] : resolvedSearchParams.report);
  const filters = buildAmazonBillingReportFilters(resolvedSearchParams);

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
  const reportCatalog = getBillingReportCatalogForClient(client.name);
  const configuredReportData = reportCatalog
    ? await getAmazonBillingReportData({ clientId, reportType: activeReport, filters })
    : null;

  return (
    <div>
      <PageHeader
        title={`${client.name} Billing Report`}
        description={reportCatalog ? "Use the report tabs to review billing records and export them to Excel or PDF." : "Placeholder billing report page for this client. Client-specific report tables can be added here."}
        actions={<Link className="btn-secondary" href="/billing-reports">Back to Billing Reports</Link>}
      />

      {configuredReportData ? (
        <AmazonReportsWorkspace clientId={clientId} activeReport={activeReport} data={configuredReportData} />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
