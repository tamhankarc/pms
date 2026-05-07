import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { WarnerDeliverableFiltersClient } from "@/components/billing-reports/warner-deliverable-filters";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewBillingReports } from "@/lib/permissions";
import { isBillingReportClientExcluded } from "@/lib/billing-reports/config";
import {
  buildGenericBillingReportFilters,
  formatUsd as formatGenericUsd,
  getGenericBillingReportData,
  type GenericBillingReportBlock,
  type GenericBillingReportData,
} from "@/lib/billing-reports/generic";
import {
  buildSonyPicturesReportFilters,
  formatUsd as formatSonyUsd,
  getSonyPicturesReportData,
  type SonyPicturesReportData,
} from "@/lib/billing-reports/sony";
import {
  buildAmazonBillingReportFilters,
  buildWarnerDomesticDeliverableFilters,
  getBillingReportCatalogForClient,
  formatUsd,
  getAmazonBillingReportData,
  getWarnerDomesticDeliverableData,
  getWarnerIntlDeliverableData,
  getWarnerOtherDeliverableData,
  isWarnerBillingReportClient,
  normalizeAmazonReportType,
  type AmazonReportType,
  type WarnerDomesticDeliverableData,
} from "@/lib/billing-reports/amazon";

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function ReportTab({
  clientId,
  reportType,
  activeReport,
  label,
}: {
  clientId: string;
  reportType: AmazonReportType;
  activeReport: AmazonReportType;
  label: string;
}) {
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

function ExportButtons({
  clientId,
  reportType,
  filters,
}: {
  clientId: string;
  reportType: AmazonReportType;
  filters: {
    fromDate?: string;
    toDate?: string;
    movieId?: string;
    assetTypeId?: string;
    countryId?: string;
  };
}) {
  const query = buildQueryString({
    report: reportType,
    fromDate: filters.fromDate ?? "",
    toDate: filters.toDate ?? "",
    movieId: filters.movieId ?? "",
    assetTypeId: filters.assetTypeId ?? "",
    countryId: filters.countryId ?? "",
  });

  return (
    <div className="flex flex-wrap gap-3">
      <Link
        className="btn-secondary"
        href={`/billing-reports/${clientId}/export?format=excel&${query}`}
      >
        Export Excel
      </Link>
      <Link
        className="btn-secondary"
        href={`/billing-reports/${clientId}/export?format=pdf&${query}`}
      >
        Export PDF
      </Link>
    </div>
  );
}

function TimeEntryReportFilters({
  clientId,
  reportType,
  data,
}: {
  clientId: string;
  reportType: AmazonReportType;
  data: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>>;
}) {
  return (
    <form
      method="get"
      action={`/billing-reports/${clientId}`}
      className="card p-5"
    >
      <input type="hidden" name="report" value={reportType} />
      <div className="grid gap-4 md:grid-cols-[160px_160px_1fr_1fr_auto] md:items-end">
        <div>
          <label className="label" htmlFor="fromDate">
            Date from
          </label>
          <input
            id="fromDate"
            name="fromDate"
            type="date"
            className="input"
            defaultValue={data.filters.fromDate}
          />
        </div>
        <div>
          <label className="label" htmlFor="toDate">
            Date to
          </label>
          <input
            id="toDate"
            name="toDate"
            type="date"
            className="input"
            defaultValue={data.filters.toDate}
          />
        </div>
        <div>
          <label className="label" htmlFor="movieId">
            Title
          </label>
          <SearchableCombobox
            id="movieId"
            name="movieId"
            defaultValue={data.filters.movieId}
            options={[
              { value: "all", label: "All titles" },
              ...data.movieOptions.map((movie) => ({
                value: movie.id,
                label: movie.title,
              })),
            ]}
            placeholder="All titles"
            searchPlaceholder="Search titles..."
            emptyLabel="No titles found."
          />
        </div>
        <div>
          <label className="label" htmlFor="assetTypeId">
            Asset Type
          </label>
          <SearchableCombobox
            id="assetTypeId"
            name="assetTypeId"
            defaultValue={data.filters.assetTypeId}
            options={[
              { value: "all", label: "All asset types" },
              ...data.assetTypeOptions.map((assetType) => ({
                value: assetType.id,
                label: assetType.name,
              })),
            ]}
            placeholder="All asset types"
            searchPlaceholder="Search asset types..."
            emptyLabel="No asset types found."
          />
        </div>
        <button className="btn-primary" type="submit">
          Apply
        </button>
      </div>
    </form>
  );
}

function TimeEntryReportDetailsTable({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>>;
}) {
  const isLocalization = data.reportType === "localization";
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Date</th>
            <th className="table-cell">Title Name</th>
            <th className="table-cell">Asset Name</th>
            {isLocalization ? (
              <th className="table-cell">Territory/Variant</th>
            ) : null}
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
              {isLocalization ? (
                <td className="table-cell">{row.territoryVariant ?? "-"}</td>
              ) : null}
              <td className="table-cell">{row.assetType}</td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatUsd(row.cost)}
              </td>
              <td className="table-cell">{row.contactPerson}</td>
            </tr>
          ))}
          {data.rows.length === 0 ? (
            <tr>
              <td
                colSpan={isLocalization ? 7 : 6}
                className="table-cell text-center text-sm text-slate-500"
              >
                No records found for the selected filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function TimeEntryReportSummaryTable({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>>;
}) {
  const totalAssets = data.summaryRows.reduce(
    (sum, row) => sum + row.totalAssets,
    0,
  );
  const totalCost = data.summaryRows.reduce(
    (sum, row) => sum + row.totalCost,
    0,
  );
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
              <td className="table-cell font-medium text-slate-900">
                {row.totalAssets}
              </td>
              <td className="table-cell font-medium text-slate-900">
                {formatUsd(row.totalCost)}
              </td>
            </tr>
          ))}
          {data.summaryRows.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="table-cell text-center text-sm text-slate-500"
              >
                No summary available.
              </td>
            </tr>
          ) : (
            <tr className="bg-slate-50">
              <td className="table-cell font-semibold text-slate-900">Total</td>
              <td className="table-cell font-semibold text-slate-900">
                {totalAssets}
              </td>
              <td className="table-cell font-semibold text-slate-900">
                {formatUsd(totalCost)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReportTabs({
  clientId,
  activeReport,
  clientName,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  clientName: string;
}) {
  const reportCatalog = getBillingReportCatalogForClient(clientName, clientId);
  const tabs = reportCatalog
    ? (Object.entries(reportCatalog) as Array<
        [AmazonReportType, { title: string }]
      >)
    : [];
  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-3">
        {tabs.map(([reportType, report]) => (
          <ReportTab
            key={reportType}
            clientId={clientId}
            reportType={reportType}
            activeReport={activeReport}
            label={report.title}
          />
        ))}
      </div>
    </div>
  );
}

function TimeEntryReportsWorkspace({
  clientId,
  activeReport,
  data,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>>;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs
        clientId={clientId}
        activeReport={activeReport}
        clientName={data.client.name}
      />
      {!data.projectFound ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Project <span className="font-semibold">{data.projectName}</span> was
          not found for this client. Please create or rename the project before
          using this report.
        </div>
      ) : null}
      <TimeEntryReportFilters
        clientId={clientId}
        reportType={activeReport}
        data={data}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.reportTitle}</h2>
          <p className="section-subtitle">
            Detailed billing records from time entries.
          </p>
        </div>
        <ExportButtons
          clientId={clientId}
          reportType={activeReport}
          filters={data.filters}
        />
      </div>
      <TimeEntryReportDetailsTable data={data} />
      <div>
        <h2 className="section-title mb-3">Summary by Asset Type</h2>
        <TimeEntryReportSummaryTable data={data} />
      </div>
    </div>
  );
}

function WarnerDeliverableFilters({
  clientId,
  data,
}: {
  clientId: string;
  data: WarnerDomesticDeliverableData;
}) {
  const hasCountryFilter = data.reportType === "other-deliverable";
  const movieEmptyLabel =
    data.reportType === "domestic-deliverable"
      ? "No active Working/Completed Domestic movies found."
      : data.reportType === "intl-deliverable"
        ? "No active Working/Completed INTL movies found."
        : "No active Working/Completed Other/Canada movies found.";

  return (
    <WarnerDeliverableFiltersClient
      clientId={clientId}
      reportType={data.reportType}
      movieId={data.filters.movieId}
      countryId={data.filters.countryId}
      movieOptions={data.movieOptions.map((movie) => ({
        value: movie.id,
        label: movie.title,
      }))}
      countryOptions={data.countryOptions.map((country) => ({
        value: country.id,
        label: country.name,
      }))}
      hasCountryFilter={hasCountryFilter}
      movieEmptyLabel={movieEmptyLabel}
    />
  );
}

function WarnerDomesticTable({
  data,
}: {
  data: WarnerDomesticDeliverableData;
}) {
  const canShowRows = Boolean(
    data.selectedMovie &&
    (data.reportType !== "other-deliverable" || data.selectedCountry),
  );

  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Billing Head / Project</th>
            <th className="table-cell">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {!data.selectedMovie ? (
            <tr>
              <td
                colSpan={2}
                className="table-cell text-center text-sm text-slate-500"
              >
                Select an active movie to view deliverables.
              </td>
            </tr>
          ) : null}
          {data.reportType === "other-deliverable" &&
          data.selectedMovie &&
          !data.selectedCountry ? (
            <tr>
              <td
                colSpan={2}
                className="table-cell text-center text-sm text-slate-500"
              >
                Select a country with time entries for the selected movie to
                view deliverables.
              </td>
            </tr>
          ) : null}
          {canShowRows
            ? data.rows.map((row, index) => (
                <tr key={`${row.group}-${row.label}-${index}`}>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">
                      {row.label}
                    </div>
                    {row.meta?.startsWith("Countries:") ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {row.meta}
                      </div>
                    ) : null}
                  </td>
                  <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                    {formatUsd(row.cost)}
                  </td>
                </tr>
              ))
            : null}
          {canShowRows ? (
            <tr className="bg-slate-100">
              <td className="table-cell font-semibold text-slate-900">Total</td>
              <td className="table-cell font-semibold text-slate-900">
                {formatUsd(data.totalCost)}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function WarnerDeliverableWorkspace({
  clientId,
  activeReport,
  data,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: WarnerDomesticDeliverableData;
}) {
  const requiresCountry = data.reportType === "other-deliverable";
  const subtitle = requiresCountry
    ? data.selectedMovie && data.selectedCountry
      ? `Deliverable billing for ${data.selectedMovie.title} / ${data.selectedCountry.name}.`
      : "Select a movie and country to view deliverable billing."
    : data.selectedMovie
      ? `Deliverable billing for ${data.selectedMovie.title}.`
      : "Select a movie to view deliverable billing.";
  return (
    <div className="space-y-6">
      <ReportTabs
        clientId={clientId}
        activeReport={activeReport}
        clientName={data.client.name}
      />
      <WarnerDeliverableFilters clientId={clientId} data={data} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.reportTitle}</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>
        <ExportButtons
          clientId={clientId}
          reportType={data.reportType}
          filters={{
            movieId: data.filters.movieId,
            countryId: data.filters.countryId,
          }}
        />
      </div>
      <WarnerDomesticTable data={data} />
    </div>
  );
}

function SonyPicturesReportFilters({
  clientId,
  reportType,
  data,
}: {
  clientId: string;
  reportType: AmazonReportType;
  data: SonyPicturesReportData;
}) {
  return (
    <form
      method="get"
      action={`/billing-reports/${clientId}`}
      className="card p-5"
    >
      <input type="hidden" name="report" value={reportType} />
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label className="label" htmlFor="movieId">
            Movie
          </label>
          <SearchableCombobox
            id="movieId"
            name="movieId"
            defaultValue={data.filters.movieId}
            options={data.movieOptions.map((movie) => ({
              value: movie.id,
              label: movie.title,
            }))}
            placeholder="Select movie"
            searchPlaceholder="Search movies..."
            emptyLabel="No active Working/Completed movies with time entries found."
          />
        </div>
        <button className="btn-primary" type="submit">
          Apply
        </button>
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Only active Working/Completed movies with one or more Time Entries are
        listed.
      </p>
    </form>
  );
}

function SonyPicturesExportButtons({
  clientId,
  reportType,
  data,
}: {
  clientId: string;
  reportType: AmazonReportType;
  data: SonyPicturesReportData;
}) {
  const query = buildQueryString({
    report: reportType,
    movieId: data.filters.movieId,
  });
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        className="btn-secondary"
        href={`/billing-reports/${clientId}/export?format=excel&${query}`}
      >
        Export Excel
      </Link>
      <Link
        className="btn-secondary"
        href={`/billing-reports/${clientId}/export?format=pdf&${query}`}
      >
        Export PDF
      </Link>
    </div>
  );
}

function SonyPicturesReportTable({ data }: { data: SonyPicturesReportData }) {
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Project</th>
            <th className="table-cell">Contact Person</th>
            <th className="table-cell">Billing Model</th>
            <th className="table-cell">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {!data.selectedMovie ? (
            <tr>
              <td
                colSpan={4}
                className="table-cell text-center text-sm text-slate-500"
              >
                Select a movie to view billing records.
              </td>
            </tr>
          ) : null}
          {data.selectedMovie && data.projectRows.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="table-cell text-center text-sm text-slate-500"
              >
                No projects have Time Entries for the selected movie.
              </td>
            </tr>
          ) : null}
          {data.projectRows.map((row) => (
            <tr key={row.projectId}>
              <td className="table-cell">
                <div className="font-medium text-slate-900">
                  {row.projectName}
                </div>
                {row.countryList ? (
                  <div className="mt-1 text-xs text-slate-500">
                    Countries: {row.countryList}
                  </div>
                ) : null}
              </td>
              <td className="table-cell">{row.contactPerson}</td>
              <td className="table-cell">
                <span className="badge-blue">{row.billingModel}</span>
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatSonyUsd(row.cost)}
              </td>
            </tr>
          ))}
          {data.chargeRows.length ? (
            <tr className="bg-slate-50">
              <td
                colSpan={4}
                className="table-cell text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
              >
                Movie Charges
              </td>
            </tr>
          ) : null}
          {data.chargeRows.map((row) => (
            <tr key={row.label}>
              <td className="table-cell font-medium text-slate-900">
                {row.label}
              </td>
              <td className="table-cell">-</td>
              <td className="table-cell">
                <span className="badge-blue">Movie Charge</span>
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatSonyUsd(row.cost)}
              </td>
            </tr>
          ))}
          {data.selectedMovie ? (
            <tr className="bg-slate-100">
              <td
                className="table-cell font-semibold text-slate-900"
                colSpan={3}
              >
                Total
              </td>
              <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
                {formatSonyUsd(data.totalCost)}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function SonyPicturesReportWorkspace({
  clientId,
  activeReport,
  data,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: SonyPicturesReportData;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs
        clientId={clientId}
        activeReport={activeReport}
        clientName={data.client.name}
      />
      <SonyPicturesReportFilters
        clientId={clientId}
        reportType={activeReport}
        data={data}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.client.name} Billing</h2>
        </div>
        <SonyPicturesExportButtons
          clientId={clientId}
          reportType={activeReport}
          data={data}
        />
      </div>
      {data.selectedMovie ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Movie:{" "}
          <span className="font-semibold text-slate-900">
            {data.selectedMovie.title}
          </span>
        </div>
      ) : null}
      <SonyPicturesReportTable data={data} />
    </div>
  );
}

function PlaceholderConfiguredReport({
  clientId,
  activeReport,
  clientName,
  title,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  clientName: string;
  title: string;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs
        clientId={clientId}
        activeReport={activeReport}
        clientName={clientName}
      />
      <div className="card p-6">
        <h2 className="section-title">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Placeholder text for {title}. This report will be updated later.
        </p>
      </div>
    </div>
  );
}

function GenericBillingReportFilters({
  clientId,
  reportType,
  data,
}: {
  clientId: string;
  reportType?: AmazonReportType;
  data: GenericBillingReportData;
}) {
  return (
    <form
      method="get"
      action={`/billing-reports/${clientId}`}
      className="card p-5"
    >
      {reportType ? (
        <input type="hidden" name="report" value={reportType} />
      ) : null}
      <div
        className={
          data.movieSpecific
            ? "grid gap-4 md:grid-cols-[180px_180px_1fr_auto] md:items-end"
            : "grid gap-4 md:grid-cols-[180px_180px_auto_1fr] md:items-end"
        }
      >
        <div>
          <label className="label" htmlFor="fromDate">
            Date from
          </label>
          <input
            id="fromDate"
            name="fromDate"
            type="date"
            className="input"
            defaultValue={data.filters.fromDate}
          />
        </div>
        <div>
          <label className="label" htmlFor="toDate">
            Date to
          </label>
          <input
            id="toDate"
            name="toDate"
            type="date"
            className="input"
            defaultValue={data.filters.toDate}
          />
        </div>
        {data.movieSpecific ? (
          <div>
            <label className="label" htmlFor="movieId">
              Movie
            </label>
            <SearchableCombobox
              id="movieId"
              name="movieId"
              defaultValue={data.filters.movieId}
              options={data.movieOptions.map((movie) => ({
                value: movie.id,
                label: movie.title,
              }))}
              placeholder="Select movie"
              searchPlaceholder="Search movies..."
              emptyLabel="No movies found."
            />
          </div>
        ) : null}
        <button className="btn-primary" type="submit">
          Apply
        </button>
        {!data.movieSpecific ? (
          <p className="text-sm text-slate-500 md:text-right">
            Date range is used for Hourly project costs.
          </p>
        ) : null}
      </div>
      {data.movieSpecific ? (
        <p className="mt-3 text-sm text-slate-500">
          Date range is used for Hourly project costs. Report rows are limited
          to projects with time entries for the selected movie.
        </p>
      ) : null}
    </form>
  );
}

function GenericExportButtons({
  clientId,
  reportType,
  data,
}: {
  clientId: string;
  reportType?: AmazonReportType;
  data: GenericBillingReportData;
}) {
  const query = buildQueryString({
    report: reportType ?? "",
    fromDate: data.filters.fromDate,
    toDate: data.filters.toDate,
    movieId: data.filters.movieId,
  });
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        className="btn-secondary"
        href={`/billing-reports/${clientId}/export?format=excel&${query}`}
      >
        Export Excel
      </Link>
      <Link
        className="btn-secondary"
        href={`/billing-reports/${clientId}/export?format=pdf&${query}`}
      >
        Export PDF
      </Link>
    </div>
  );
}

function GenericBillingModelBlock({
  block,
}: {
  block: GenericBillingReportBlock;
}) {
  const isCountryBlock = block.key === "fixedPerCountry";
  const totalDeveloperCost = block.rows.reduce(
    (sum, row) => sum + Number(row.developerCost ?? 0),
    0,
  );
  const totalProjectCost = block.rows.reduce(
    (sum, row) => sum + row.projectCost,
    0,
  );
  const totalCost = block.rows.reduce((sum, row) => sum + row.cost, 0);
  const totalLabelColSpan = 3;

  return (
    <section className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Project</th>
            <th className="table-cell">Contact Person</th>
            {isCountryBlock ? (
              <th className="table-cell">Country List</th>
            ) : (
              <th className="table-cell">Status</th>
            )}
            {block.showDeveloperCost ? (
              <th className="table-cell">Developer Cost</th>
            ) : null}
            {block.showDeveloperCost ? (
              <th className="table-cell">Project Cost</th>
            ) : null}
            <th className="table-cell">
              {block.showDeveloperCost ? "Total Cost" : "Cost"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {block.rows.map((row) => (
            <tr key={row.projectId}>
              <td className="table-cell font-medium text-slate-900">
                {row.projectName}
              </td>
              <td className="table-cell">{row.contactPerson}</td>
              {isCountryBlock ? (
                <td className="table-cell">{row.countryList || "-"}</td>
              ) : (
                <td className="table-cell">
                  <span className="badge-blue">{row.status}</span>
                </td>
              )}
              {block.showDeveloperCost ? (
                <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                  {row.developerCost !== undefined
                    ? formatGenericUsd(Number(row.developerCost ?? 0))
                    : "-"}
                </td>
              ) : null}
              {block.showDeveloperCost ? (
                <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                  {formatGenericUsd(row.projectCost)}
                </td>
              ) : null}
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatGenericUsd(row.cost)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50">
            <td
              className="table-cell font-semibold text-slate-900"
              colSpan={totalLabelColSpan}
            >
              Total
            </td>
            {block.showDeveloperCost ? (
              <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
                {formatGenericUsd(totalDeveloperCost)}
              </td>
            ) : null}
            {block.showDeveloperCost ? (
              <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
                {formatGenericUsd(totalProjectCost)}
              </td>
            ) : null}
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
              {formatGenericUsd(totalCost)}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function GenericBillingReportWorkspace({
  clientId,
  reportType,
  data,
  clientName,
}: {
  clientId: string;
  reportType?: AmazonReportType;
  data: GenericBillingReportData;
  clientName?: string;
}) {
  return (
    <div className="space-y-6">
      {reportType && clientName ? (
        <ReportTabs
          clientId={clientId}
          activeReport={reportType}
          clientName={clientName}
        />
      ) : null}
      <GenericBillingReportFilters
        clientId={clientId}
        reportType={reportType}
        data={data}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.client.name} Billing</h2>
        </div>
        <GenericExportButtons
          clientId={clientId}
          reportType={reportType}
          data={data}
        />
      </div>
      {data.selectedMovie ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Movie:{" "}
          <span className="font-semibold text-slate-900">
            {data.selectedMovie.title}
          </span>
        </div>
      ) : null}
      {data.blocks.length ? (
        data.blocks.map((block) => (
          <GenericBillingModelBlock key={block.key} block={block} />
        ))
      ) : (
        <div className="card p-6 text-sm text-slate-600">
          No billing records are available for the selected filters.
        </div>
      )}
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

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      isActive: true,
      hourlyCost: true,
      projects: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          billingModel: true,
          isActive: true,
          status: true,
          fixedContractHours: true,
          fixedMonthlyHours: true,
          additionalCharges: true,
          partialBillingCost: true,
          perCountryCharges: true,
          developerCount: true,
          perDeveloperCost: true,
        },
        orderBy: { name: "asc" },
      },
      movies: { select: { id: true, status: true, isActive: true } },
      movieBillingHeads: { select: { id: true } },
      movieBillingHeadAssignments: { select: { id: true } },
    },
  });
  if (
    !client ||
    !client.isActive ||
    isBillingReportClientExcluded(client.id) ||
    !client.projects.some(
      (project) => project.isActive && project.status === "ACTIVE",
    )
  )
    redirect("/billing-reports");

  const activeReport = normalizeAmazonReportType(
    Array.isArray(resolvedSearchParams.report)
      ? resolvedSearchParams.report[0]
      : resolvedSearchParams.report,
    client.name,
  );
  const filters = buildAmazonBillingReportFilters(resolvedSearchParams);
  const genericFilters = buildGenericBillingReportFilters(resolvedSearchParams);
  const sonyPicturesFilters =
    buildSonyPicturesReportFilters(resolvedSearchParams);
  const domesticFilters =
    buildWarnerDomesticDeliverableFilters(resolvedSearchParams);
  const reportCatalog = getBillingReportCatalogForClient(
    client.name,
    client.id,
  );
  const activeReportDefinition = reportCatalog?.[activeReport];
  const timeEntryReportData =
    activeReportDefinition?.kind === "time-entry"
      ? await getAmazonBillingReportData({
          clientId,
          reportType: activeReport,
          filters,
        })
      : null;
  const domesticDeliverableData =
    isWarnerBillingReportClient(client.name) &&
    activeReport === "domestic-deliverable"
      ? await getWarnerDomesticDeliverableData({
          clientId,
          filters: domesticFilters,
        })
      : null;
  const intlDeliverableData =
    isWarnerBillingReportClient(client.name) &&
    activeReport === "intl-deliverable"
      ? await getWarnerIntlDeliverableData({
          clientId,
          filters: domesticFilters,
        })
      : null;
  const otherDeliverableData =
    isWarnerBillingReportClient(client.name) &&
    activeReport === "other-deliverable"
      ? await getWarnerOtherDeliverableData({
          clientId,
          filters: domesticFilters,
        })
      : null;
  const sonyPicturesReportData =
    activeReportDefinition?.kind === "sony-movie"
      ? await getSonyPicturesReportData({
          clientId,
          filters: sonyPicturesFilters,
        })
      : null;
  const genericBillingOptions =
    activeReportDefinition?.kind === "generic-movie"
      ? { movieSpecific: true }
      : activeReportDefinition?.kind === "generic-filmik"
        ? { includeDeveloperCosts: true }
        : undefined;
  const genericBillingReportData =
    !reportCatalog || genericBillingOptions
      ? await getGenericBillingReportData({
          clientId,
          filters: genericFilters,
          options: genericBillingOptions,
        })
      : null;

  return (
    <div>
      <PageHeader
        title={`${client.name} Billing Report`}
        description={
          reportCatalog
            ? "Use the report tabs to review configured billing records."
            : "Review configured client billing records."
        }
        actions={
          <Link className="btn-secondary" href="/billing-reports">
            Back to Billing Reports
          </Link>
        }
      />
      {timeEntryReportData ? (
        <TimeEntryReportsWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={timeEntryReportData}
        />
      ) : sonyPicturesReportData ? (
        <SonyPicturesReportWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={sonyPicturesReportData}
        />
      ) : domesticDeliverableData ||
        intlDeliverableData ||
        otherDeliverableData ? (
        <WarnerDeliverableWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={
            (domesticDeliverableData ||
              intlDeliverableData ||
              otherDeliverableData)!
          }
        />
      ) : activeReportDefinition?.kind === "placeholder" ? (
        <PlaceholderConfiguredReport
          clientId={clientId}
          activeReport={activeReport}
          clientName={client.name}
          title={activeReportDefinition.title}
        />
      ) : (
        <GenericBillingReportWorkspace
          clientId={clientId}
          reportType={reportCatalog ? activeReport : undefined}
          clientName={reportCatalog ? client.name : undefined}
          data={genericBillingReportData!}
        />
      )}
    </div>
  );
}
