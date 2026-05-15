import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { WarnerDeliverableFiltersClient } from "@/components/billing-reports/warner-deliverable-filters";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewBillingReports } from "@/lib/permissions";
import { FILMIK_CLIENT_ID, isBillingReportClientExcluded } from "@/lib/billing-reports/config";
import {
  buildGenericBillingReportFilters,
  formatUsd as formatGenericUsd,
  getGenericBillingReportData,
  type GenericBillingReportBlock,
  type GenericBillingReportData,
} from "@/lib/billing-reports/generic";
import {
  buildFilmikBillingReportFilters,
  formatUsd as formatFilmikUsd,
  getFilmikBillingReportData,
  getFilmikBillingReportMonthLabel,
  type FilmikBillingReportData,
} from "@/lib/billing-reports/filmik";
import { buildRoyalBillingFilters, getRoyalBillingReportData, formatUsd as formatRoyalUsd, type RoyalBillingData, ROYAL_CARIBBEAN_CLIENT_NAME } from "@/lib/billing-reports/royal";
import {
  buildSonyNewsletterBillingFilters,
  buildSonyPicturesReportFilters,
  formatUsd as formatSonyUsd,
  getSonyNewsletterBillingData,
  getSonyPicturesReportData,
  type SonyNewsletterBillingData,
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
  getUniversalBillingSummaryData,
  isWarnerBillingReportClient,
  normalizeAmazonReportType,
  type AmazonReportType,
  type WarnerDomesticDeliverableData,
  type UniversalBillingSummaryData,
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
    month?: string;
  };
}) {
  const query = buildQueryString({
    report: reportType,
    fromDate: filters.fromDate ?? "",
    toDate: filters.toDate ?? "",
    movieId: filters.movieId ?? "",
    assetTypeId: filters.assetTypeId ?? "",
    countryId: filters.countryId ?? "",
    month: filters.month ?? "",
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

function getUniversalReportTotals(rows: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>>["rows"]) {
  return {
    assets: new Set(rows.map((row) => row.assetName).filter((value) => value && value !== "-")).size,
    countries: new Set(rows.map((row) => row.territoryVariant ?? "").filter((value) => value && value !== "-")).size,
  };
}

function TimeEntryReportDetailsTable({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>>;
}) {
  const isLocalization = data.reportType === "localization";
  const isUniversal = data.client.name === "Universal Pictures International";
  const isUniversalSocial = isUniversal && data.reportType === "social-assets";
  const isUniversalLocalization = isUniversal && isLocalization;
  const showCost = !isUniversal;
  const renderTable = (rows: typeof data.rows, keyPrefix: string) => {
    const totals = getUniversalReportTotals(rows);
    const colSpan = isUniversalLocalization ? 5 : isLocalization ? 7 : isUniversalSocial ? 5 : 6;
    return (
      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Date</th>
              <th className="table-cell">Title Name</th>
              <th className="table-cell">Asset Name</th>
              {isLocalization ? <th className="table-cell">Territory/Variant</th> : null}
              {!isUniversalLocalization ? <th className="table-cell">Asset Type</th> : null}
              {showCost ? <th className="table-cell">Cost</th> : null}
              <th className="table-cell">Contact Person</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={`${keyPrefix}-${row.date}-${row.titleName}-${row.assetName}-${index}`}>
                <td className="table-cell whitespace-nowrap">{row.date}</td>
                <td className="table-cell">{row.titleName}</td>
                <td className="table-cell">{row.assetName}</td>
                {isLocalization ? <td className="table-cell">{row.territoryVariant ?? "-"}</td> : null}
                {!isUniversalLocalization ? <td className="table-cell">{row.assetType}</td> : null}
                {showCost ? (
                  <td className="table-cell whitespace-nowrap font-medium text-slate-900">{formatUsd(row.cost)}</td>
                ) : null}
                <td className="table-cell">{row.contactPerson}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="table-cell text-center text-sm text-slate-500">
                  No records found for the selected filters.
                </td>
              </tr>
            ) : null}
            {isUniversalSocial && rows.length > 0 ? (
              <tr className="bg-slate-100">
                <td colSpan={4} className="table-cell font-semibold text-slate-900">Total Assets</td>
                <td className="table-cell font-semibold text-slate-900">{totals.assets}</td>
              </tr>
            ) : null}
            {isUniversalLocalization && rows.length > 0 ? (
              <>
                <tr className="bg-slate-100">
                  <td colSpan={4} className="table-cell font-semibold text-slate-900">Total Assets</td>
                  <td className="table-cell font-semibold text-slate-900">{totals.assets}</td>
                </tr>
                <tr className="bg-slate-100">
                  <td colSpan={4} className="table-cell font-semibold text-slate-900">Total Countries/Territories</td>
                  <td className="table-cell font-semibold text-slate-900">{totals.countries}</td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  };

  if (isUniversalLocalization && data.filters.movieId === "all") {
    const grouped = new Map<string, typeof data.rows>();
    for (const row of data.rows) {
      const titleRows = grouped.get(row.titleName) ?? [];
      titleRows.push(row);
      grouped.set(row.titleName, titleRows);
    }
    return (
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([titleName, rows]) => (
          <div key={titleName} className="space-y-3">
            <h3 className="text-base font-semibold text-slate-900">{titleName}</h3>
            {renderTable(rows, titleName)}
          </div>
        ))}
        {data.rows.length === 0 ? renderTable([], "empty") : null}
      </div>
    );
  }

  return renderTable(data.rows, "all");
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
  const isUniversalLocalization = data.client.name === "Universal Pictures International" && data.reportType === "localization";
  if (isUniversalLocalization) {
    return (
      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Total Assets</th>
              <th className="table-cell">Total Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="table-cell font-medium text-slate-900">{totalAssets}</td>
              <td className="table-cell font-medium text-slate-900">{formatUsd(totalCost)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
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
      {data.client.name !== "Universal Pictures International" ? (
        <div>
          <h2 className="section-title mb-3">Summary by Asset Type</h2>
          <TimeEntryReportSummaryTable data={data} />
        </div>
      ) : null}
    </div>
  );
}

function UniversalBillingSummaryFilters({ clientId, data }: { clientId: string; data: UniversalBillingSummaryData }) {
  const month = data.filters.fromDate.slice(0, 7);
  return (
    <form method="get" action={`/billing-reports/${clientId}`} className="card p-5">
      <input type="hidden" name="report" value="billing-summary" />
      <div className="grid gap-4 md:grid-cols-[220px_max-content] md:items-end">
        <div>
          <label className="label" htmlFor="month">Month</label>
          <input id="month" name="month" type="month" className="input" defaultValue={month} />
        </div>
        <button className="btn-primary w-full md:w-auto md:px-8" type="submit">
          Apply
        </button>
      </div>
    </form>
  );
}

function UniversalBillingSummaryTable({ data }: { data: UniversalBillingSummaryData }) {
  const totalAssets = data.rows.reduce((sum, row) => sum + row.totalAssets, 0);
  const totalCountries = data.rows.reduce((sum, row) => sum + row.totalCountries, 0);
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Title Name</th>
            <th className="table-cell">Total Assets</th>
            <th className="table-cell">Total Countries/Territories</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.rows.map((row) => (
            <tr key={row.titleName}>
              <td className="table-cell font-medium text-slate-900">{row.titleName}</td>
              <td className="table-cell">{row.totalAssets}</td>
              <td className="table-cell">{row.totalCountries}</td>
            </tr>
          ))}
          {data.rows.length === 0 ? (
            <tr><td colSpan={3} className="table-cell text-center text-sm text-slate-500">No records found for the selected month.</td></tr>
          ) : (
            <tr className="bg-slate-100">
              <td className="table-cell font-semibold text-slate-900">Total</td>
              <td className="table-cell font-semibold text-slate-900">{totalAssets}</td>
              <td className="table-cell font-semibold text-slate-900">{totalCountries}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function UniversalBillingSummaryWorkspace({ clientId, activeReport, data }: { clientId: string; activeReport: AmazonReportType; data: UniversalBillingSummaryData }) {
  return (
    <div className="space-y-6">
      <ReportTabs clientId={clientId} activeReport={activeReport} clientName={data.client.name} />
      {!data.projectFound ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Projects <span className="font-semibold">UNI Social QC</span> and <span className="font-semibold">UNI Social Localization</span> were not found for this client.
        </div>
      ) : null}
      <UniversalBillingSummaryFilters clientId={clientId} data={data} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.reportTitle}</h2>
          <p className="section-subtitle">Unique assets and countries/territories by title for the selected month.</p>
        </div>
        <ExportButtons clientId={clientId} reportType={activeReport} filters={{ month: data.filters.fromDate.slice(0, 7) }} />
      </div>
      <UniversalBillingSummaryTable data={data} />
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
      ? "No active Working/Completed Domestic titles found."
      : data.reportType === "intl-deliverable"
        ? "No active Working/Completed INTL titles found."
        : "No active Working/Completed Other/Canada titles found.";

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
                Select an active title to view deliverables.
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
                Select a country with time entries for the selected title to
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
      : "Select a title and country to view deliverable billing."
    : data.selectedMovie
      ? `Deliverable billing for ${data.selectedMovie.title}.`
      : "Select a title to view deliverable billing.";
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
            Title
          </label>
          <SearchableCombobox
            id="movieId"
            name="movieId"
            defaultValue={data.filters.movieId}
            options={data.movieOptions.map((movie) => ({
              value: movie.id,
              label: movie.title,
            }))}
            placeholder="Select title"
            searchPlaceholder="Search titles..."
            emptyLabel="No active Working/Completed titles with time entries found."
          />
        </div>
        <button className="btn-primary" type="submit">
          Apply
        </button>
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Only active Working/Completed titles with one or more Time Entries are
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
                Select a title to view billing records.
              </td>
            </tr>
          ) : null}
          {data.selectedMovie && data.projectRows.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="table-cell text-center text-sm text-slate-500"
              >
                No projects have Time Entries for the selected title.
              </td>
            </tr>
          ) : null}
          {data.projectRows.map((row) => (
            <tr key={row.projectId}>
              <td className="table-cell">
                <div className="font-medium text-slate-900">
                  {row.projectName}
                </div>
                {data.showCountryList && row.countryList ? (
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
                Title Charges
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
                <span className="badge-blue">Title Charge</span>
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
          <h2 className="section-title">{data.reportTitle}</h2>
        </div>
        <SonyPicturesExportButtons
          clientId={clientId}
          reportType={activeReport}
          data={data}
        />
      </div>
      {data.selectedMovie ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Title:{" "}
          <span className="font-semibold text-slate-900">
            {data.selectedMovie.title}
          </span>
        </div>
      ) : null}
      <SonyPicturesReportTable data={data} />
    </div>
  );
}

function SonyNewsletterBillingFilters({
  clientId,
  reportType,
  data,
}: {
  clientId: string;
  reportType: AmazonReportType;
  data: SonyNewsletterBillingData;
}) {
  return (
    <form method="get" action={`/billing-reports/${clientId}`} className="card p-5">
      <input type="hidden" name="report" value={reportType} />
      <div className="grid gap-4 md:grid-cols-[220px_auto_1fr] md:items-end">
        <div>
          <label className="label" htmlFor="month">Month</label>
          <input id="month" name="month" type="month" className="input" defaultValue={data.filters.month} />
        </div>
        <button className="btn-primary" type="submit">Apply</button>
        <p className="text-sm text-slate-500 md:text-right">Newsletter billing is calculated from Time Entries for the selected month.</p>
      </div>
    </form>
  );
}

function SonyNewsletterExportButtons({ clientId, reportType, data }: { clientId: string; reportType: AmazonReportType; data: SonyNewsletterBillingData }) {
  const query = buildQueryString({ report: reportType, month: data.filters.month });
  return (
    <div className="flex flex-wrap gap-3">
      <Link className="btn-secondary" href={`/billing-reports/${clientId}/export?format=excel&${query}`}>Export Excel</Link>
      <Link className="btn-secondary" href={`/billing-reports/${clientId}/export?format=pdf&${query}`}>Export PDF</Link>
    </div>
  );
}

function SonyNewsletterBillingTable({ data }: { data: SonyNewsletterBillingData }) {
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Newsletter Type</th>
            <th className="table-cell">Newsletter Count</th>
            <th className="table-cell">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {!data.project ? (
            <tr>
              <td colSpan={3} className="table-cell text-center text-sm text-slate-500">Newsletter project was not found for this client.</td>
            </tr>
          ) : null}
          {data.project && data.rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="table-cell text-center text-sm text-slate-500">No newsletter Time Entries found for the selected month.</td>
            </tr>
          ) : null}
          {data.rows.map((row) => (
            <tr key={row.newsletterType}>
              <td className="table-cell font-medium text-slate-900">{row.newsletterType}</td>
              <td className="table-cell font-medium text-slate-900">{row.count}</td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">{formatSonyUsd(row.cost)}</td>
            </tr>
          ))}
          {data.project ? (
            <tr className="bg-slate-50">
              <td className="table-cell font-semibold text-slate-900">Total</td>
              <td className="table-cell font-semibold text-slate-900">{data.totalCount}</td>
              <td className="table-cell whitespace-nowrap font-semibold text-slate-900">{formatSonyUsd(data.totalCost)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function SonyNewsletterBillingWorkspace({
  clientId,
  activeReport,
  data,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: SonyNewsletterBillingData;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs clientId={clientId} activeReport={activeReport} clientName={data.client.name} />
      <SonyNewsletterBillingFilters clientId={clientId} reportType={activeReport} data={data} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.client.name} Newsletters Billing</h2>
          <p className="section-subtitle">Month: {data.filters.month}</p>
        </div>
        <SonyNewsletterExportButtons clientId={clientId} reportType={activeReport} data={data} />
      </div>
      <SonyNewsletterBillingTable data={data} />
    </div>
  );
}

function FilmikBillingReportFilters({
  clientId,
  reportType,
  data,
}: {
  clientId: string;
  reportType: AmazonReportType;
  data: FilmikBillingReportData;
}) {
  return (
    <form method="get" action={`/billing-reports/${clientId}`} className="card p-5">
      <input type="hidden" name="report" value={reportType} />
      <div className="grid gap-4 md:grid-cols-[220px_auto_1fr] md:items-end">
        <div>
          <label className="label" htmlFor="month">Month</label>
          <input id="month" name="month" type="month" className="input" defaultValue={data.filters.month} />
        </div>
        <button className="btn-primary" type="submit">Apply</button>
        <p className="text-sm text-slate-500 md:text-right">Resource counts and project hours are calculated for the selected month.</p>
      </div>
    </form>
  );
}

function FilmikExportButtons({ clientId, reportType, data }: { clientId: string; reportType: AmazonReportType; data: FilmikBillingReportData }) {
  const query = buildQueryString({ report: reportType, month: data.filters.month });
  return (
    <div className="flex flex-wrap gap-3">
      <Link className="btn-secondary" href={`/billing-reports/${clientId}/export?format=excel&${query}`}>Export Excel</Link>
      <Link className="btn-secondary" href={`/billing-reports/${clientId}/export?format=pdf&${query}`}>Export PDF</Link>
    </div>
  );
}

function FilmikResourceCostBlock({ data }: { data: FilmikBillingReportData }) {
  return (
    <section className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Resource Type</th>
            <th className="table-cell">Count</th>
            <th className="table-cell">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.resourceRows.map((row) => (
            <tr key={row.resourceTypeId}>
              <td className="table-cell font-medium text-slate-900">{row.resourceTypeName}</td>
              <td className="table-cell font-medium text-slate-900">{row.count}</td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">{formatFilmikUsd(row.cost)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50">
            <td className="table-cell font-semibold text-slate-900">Total</td>
            <td className="table-cell font-semibold text-slate-900">{data.resourceTotalCount}</td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">{formatFilmikUsd(data.resourceTotalCost)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function FilmikCombinedCostBlock({ data }: { data: FilmikBillingReportData }) {
  return (
    <section className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Project / Resource</th>
            <th className="table-cell">Resources / Hours</th>
            <th className="table-cell">Cost</th>
            <th className="table-cell">Contact Person</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.combinedRows.map((row) => (
            <tr key={row.key}>
              <td className="table-cell font-medium text-slate-900">{row.name}</td>
              <td className="table-cell font-medium text-slate-900">{row.key === "resource-cost" ? row.quantity : `${row.quantity.toFixed(2)}h`}</td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">{formatFilmikUsd(row.cost)}</td>
              <td className="table-cell">{row.contactPerson}</td>
            </tr>
          ))}
          <tr className="bg-slate-50">
            <td className="table-cell font-semibold text-slate-900" colSpan={2}>Total</td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">{formatFilmikUsd(data.combinedTotalCost)}</td>
            <td className="table-cell">-</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function FilmikBillingReportWorkspace({
  clientId,
  activeReport,
  data,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: FilmikBillingReportData;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs clientId={clientId} activeReport={activeReport} clientName={data.client.name} />
      <FilmikBillingReportFilters clientId={clientId} reportType={activeReport} data={data} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.reportTitle}</h2>
          <p className="section-subtitle">Month: {getFilmikBillingReportMonthLabel(data)}</p>
        </div>
        <FilmikExportButtons clientId={clientId} reportType={activeReport} data={data} />
      </div>
      <div>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Resource Cost</h3>
        <FilmikResourceCostBlock data={data} />
      </div>
      <div>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Project + Resource Cost</h3>
        <FilmikCombinedCostBlock data={data} />
      </div>
    </div>
  );
}


function RoyalBillingReportFilters({ clientId, data }: { clientId: string; data: RoyalBillingData }) {
  return (
    <form method="get" action={`/billing-reports/${clientId}`} className="card p-5">
      <div className="grid gap-4 md:grid-cols-[220px_auto_1fr] md:items-end">
        <div>
          <label className="label" htmlFor="month">Month</label>
          <input id="month" name="month" type="month" className="input" defaultValue={data.filters.month} />
        </div>
        <button className="btn-primary" type="submit">Apply</button>
        <p className="text-sm text-slate-500 md:text-right">Fixed monthly excess hours are calculated for the selected month.</p>
      </div>
    </form>
  );
}

function RoyalExportButtons({ clientId, data }: { clientId: string; data: RoyalBillingData }) {
  const query = buildQueryString({ month: data.filters.month });
  return (
    <div className="flex flex-wrap gap-3">
      <Link className="btn-secondary" href={`/billing-reports/${clientId}/export?format=excel&${query}`}>Export Excel</Link>
      <Link className="btn-secondary" href={`/billing-reports/${clientId}/export?format=pdf&${query}`}>Export PDF</Link>
    </div>
  );
}

function RoyalBillingReportTable({ data }: { data: RoyalBillingData }) {
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Project</th>
            <th className="table-cell">Contact Person</th>
            <th className="table-cell">Billing Model</th>
            <th className="table-cell">Project Hours</th>
            <th className="table-cell">Fixed Monthly Hours</th>
            <th className="table-cell">Additional Hours</th>
            <th className="table-cell">Project Cost</th>
            <th className="table-cell">Excess Hours</th>
            <th className="table-cell">Excess Cost</th>
            <th className="table-cell">Total Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.rows.map((row) => (
            <tr key={row.projectId}>
              <td className="table-cell font-medium text-slate-900">{row.projectName}</td>
              <td className="table-cell">{row.contactPerson}</td>
              <td className="table-cell"><span className="badge-blue">{row.billingModel}</span></td>
              <td className="table-cell font-medium text-slate-900">{row.projectHours.toFixed(2)}</td>
              <td className="table-cell">{row.fixedMonthlyHours == null ? "-" : row.fixedMonthlyHours.toFixed(2)}</td>
              <td className="table-cell">{row.additionalHours == null ? "-" : row.additionalHours.toFixed(2)}</td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">{row.projectCost == null ? "-" : formatRoyalUsd(row.projectCost)}</td>
              <td className="table-cell">{row.excessHours > 0 ? row.excessHours.toFixed(2) : "-"}</td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">{row.excessHours > 0 ? formatRoyalUsd(row.excessCost) : "-"}</td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">{formatRoyalUsd(row.totalCost)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50">
            <td className="table-cell font-semibold text-slate-900" colSpan={6}>Total</td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">{formatRoyalUsd(data.totals.projectCost)}</td>
            <td className="table-cell font-semibold text-slate-900">{data.totals.excessHours.toFixed(2)}</td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">{formatRoyalUsd(data.totals.excessCost)}</td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">{formatRoyalUsd(data.totals.totalCost)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RoyalBillingReportWorkspace({ clientId, data }: { clientId: string; data: RoyalBillingData }) {
  return (
    <div className="space-y-6">
      <RoyalBillingReportFilters clientId={clientId} data={data} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="section-title">{data.client.name} Billing</h2><p className="section-subtitle">Month: {data.filters.month}</p></div>
        <RoyalExportButtons clientId={clientId} data={data} />
      </div>
      <RoyalBillingReportTable data={data} />
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
              Title
            </label>
            <SearchableCombobox
              id="movieId"
              name="movieId"
              defaultValue={data.filters.movieId}
              options={data.movieOptions.map((movie) => ({
                value: movie.id,
                label: movie.title,
              }))}
              placeholder="Select title"
              searchPlaceholder="Search titles..."
              emptyLabel="No titles found."
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
          to projects with time entries for the selected title.
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
          <h2 className="section-title">{data.reportTitle}</h2>
        </div>
        <GenericExportButtons
          clientId={clientId}
          reportType={reportType}
          data={data}
        />
      </div>
      {data.selectedMovie ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Title:{" "}
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
    client.id,
  );
  const filters = buildAmazonBillingReportFilters(resolvedSearchParams);
  const genericFilters = buildGenericBillingReportFilters(resolvedSearchParams);
  const sonyPicturesFilters =
    buildSonyPicturesReportFilters(resolvedSearchParams);
  const sonyNewsletterFilters =
    buildSonyNewsletterBillingFilters(resolvedSearchParams);
  const filmikFilters = buildFilmikBillingReportFilters(resolvedSearchParams);
  const royalFilters = buildRoyalBillingFilters(resolvedSearchParams);
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
  const universalBillingSummaryData =
    activeReportDefinition?.kind === "time-entry-summary"
      ? await getUniversalBillingSummaryData({ clientId, filters })
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
          variant: activeReport === "canada-other" ? "canada-other" : "main",
        })
      : null;
  const sonyNewsletterBillingData =
    activeReportDefinition?.kind === "sony-newsletters"
      ? await getSonyNewsletterBillingData({
          clientId,
          filters: sonyNewsletterFilters,
        })
      : null;
  const filmikBillingReportData =
    client.id === FILMIK_CLIENT_ID && activeReportDefinition?.kind === "generic-filmik"
      ? await getFilmikBillingReportData(filmikFilters)
      : null;
  const royalBillingReportData = client.name.trim().toLowerCase() === ROYAL_CARIBBEAN_CLIENT_NAME.toLowerCase()
    ? await getRoyalBillingReportData({ clientId, filters: royalFilters })
    : null;
  const genericBillingOptions =
    activeReportDefinition?.kind === "generic-movie"
      ? { movieSpecific: true }
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
      ) : universalBillingSummaryData ? (
        <UniversalBillingSummaryWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={universalBillingSummaryData}
        />
      ) : sonyPicturesReportData ? (
        <SonyPicturesReportWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={sonyPicturesReportData}
        />
      ) : sonyNewsletterBillingData ? (
        <SonyNewsletterBillingWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={sonyNewsletterBillingData}
        />
      ) : royalBillingReportData ? (
        <RoyalBillingReportWorkspace clientId={clientId} data={royalBillingReportData} />
      ) : filmikBillingReportData ? (
        <FilmikBillingReportWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={filmikBillingReportData}
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
