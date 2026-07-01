import { Fragment } from "react";
import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { ContactListAccordion } from "@/components/ui/contact-list-accordion";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { WarnerDeliverableFiltersClient } from "@/components/billing-reports/warner-deliverable-filters";
import { UniversalTimeEntryFilters } from "@/components/billing-reports/universal-time-entry-filters";
import { BillingDonePopover } from "@/components/billing-reports/billing-done-popover";
import { NoScrollFilter } from "@/components/billing-reports/no-scroll-filter";
import { AmazonTitleClosureTable as AmazonTitleClosureTableClient } from "@/components/billing-reports/amazon-title-closure-table";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewBillingReports } from "@/lib/permissions";
import {
  completeAmazonMonthlyBillingAction,
  completeAmazonTitleClosureAction,
  completeClientMonthBillingAction,
  completeMovieBillingAction,
} from "@/lib/actions/movie-actions";
import { completeProjectBillingAction } from "@/lib/actions/project-actions";
import {
  FILMIK_CLIENT_ID,
  ROYAL_CARIBBEAN_CLIENT_ID,
  SONY_PICTURES_CLASSICS_CLIENT_ID,
  isBillingReportClientExcluded,
} from "@/lib/billing-reports/config";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import {
  buildGenericBillingReportFilters,
  buildGenericBillingSummaryHistoryFilters,
  formatUsd as formatGenericUsd,
  getGenericBillingReportData,
  getGenericBillingSummaryHistoryData,
  type GenericBillingReportBlock,
  type GenericBillingReportData,
  type GenericBillingSummaryHistoryData,
} from "@/lib/billing-reports/generic";
import {
  buildFilmikBillingReportFilters,
  formatUsd as formatFilmikUsd,
  getFilmikBillingReportData,
  getFilmikBillingReportMonthLabel,
  type FilmikBillingReportData,
} from "@/lib/billing-reports/filmik";
import {
  buildRoyalBillingFilters,
  buildRoyalHistoryFilters,
  getRoyalBillingReportData,
  getRoyalHistoryData,
  formatUsd as formatRoyalUsd,
  type RoyalBillingData,
  type RoyalHistoryData,
  ROYAL_CARIBBEAN_CLIENT_NAME,
} from "@/lib/billing-reports/royal";
import {
  buildSonyNewsletterBillingFilters,
  buildSonyPicturesReportFilters,
  buildSonyBillingSummaryHistoryFilters,
  formatUsd as formatSonyUsd,
  getSonyNewsletterBillingData,
  getSonyPicturesReportData,
  getSonyBillingSummaryHistoryData,
  type SonyNewsletterBillingData,
  type SonyPicturesReportData,
  type SonyBillingSummaryHistoryData,
} from "@/lib/billing-reports/sony";
import {
  buildClientTitleSummaryFilters,
  getSonyTitleSummaryData,
  getWarnerTitleSummaryData,
  type ClientTitleSummaryData,
} from "@/lib/billing-reports/title-summary";
import {
  buildAmazonBillingReportFilters,
  buildBillingHistoryFilters,
  buildWarnerDomesticDeliverableFilters,
  getBillingReportCatalogForClient,
  GENERIC_TITLE_REPORTS,
  formatUsd,
  getAmazonBillingReportData,
  getBillingHistoryData,
  getWarnerDomesticDeliverableData,
  getWarnerIntlDeliverableData,
  getWarnerOtherDeliverableData,
  getWarnerPortalReportData,
  getUniversalBillingSummaryData,
  isWarnerBillingReportClient,
  normalizeAmazonReportType,
  type AmazonReportType,
  type BillingHistoryData,
  type WarnerDomesticDeliverableData,
  type WarnerPortalReportData,
  type UniversalBillingSummaryData,
} from "@/lib/billing-reports/amazon";

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

const BILLING_REPORT_DETAIL_PAGE_SIZE = 20;
const BILLING_HISTORY_PAGE_SIZE = 10;

function normalizePaginationKey(value: string) {
  return (
    value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "section"
  );
}

function getBillingHistoryPageParam(sectionKey: string) {
  return `billingHistoryPage_${normalizePaginationKey(sectionKey)}`;
}

function getPaginatedBillingHistoryRows<T>(
  rows: T[],
  searchParams: BillingReportPageSearchParams,
  sectionKey: string,
) {
  const pageParam = getBillingHistoryPageParam(sectionKey);
  return {
    pageParam,
    page: paginateItems(
      rows,
      parsePageParam(getSearchParamValue(searchParams, pageParam)),
      BILLING_HISTORY_PAGE_SIZE,
    ),
  };
}

function BillingHistoryPagination<T>({
  clientId,
  searchParams,
  sectionKey,
  pageData,
}: {
  clientId: string;
  searchParams: BillingReportPageSearchParams;
  sectionKey: string;
  pageData: ReturnType<typeof paginateItems<T>>;
}) {
  return (
    <PaginationControls
      basePath={`/billing-reports/${clientId}`}
      currentPage={pageData.currentPage}
      totalPages={pageData.totalPages}
      totalItems={pageData.totalItems}
      pageSize={pageData.pageSize}
      searchParams={searchParams}
      pageParam={getBillingHistoryPageParam(sectionKey)}
      anchor={`#${normalizePaginationKey(sectionKey)}`}
    />
  );
}

type BillingContactNotice = {
  id: string;
  assignmentLevel: string;
  billingReportType: string | null;
  project: { id: string; name: string } | null;
  contactPerson: {
    name: string;
    email: string;
    country?: { isoCode: string | null } | null;
  };
};

function formatBillTo(contact: {
  name: string;
  email: string;
  country?: { isoCode: string | null } | null;
}) {
  const countryCode = contact.country?.isoCode;
  return `Bill To: ${contact.name}${countryCode ? ` (${countryCode})` : ""} (${contact.email})`;
}

function BillingContactNotices({
  contacts,
  activeReport,
}: {
  contacts: BillingContactNotice[];
  activeReport: string;
}) {
  const clientContacts = contacts.filter(
    (item) => item.assignmentLevel === "CLIENT",
  );
  const reportContacts = contacts.filter(
    (item) =>
      item.assignmentLevel === "CLIENT_BILLING_REPORT" &&
      item.billingReportType === activeReport,
  );
  const projectContacts = contacts.filter(
    (item) => item.assignmentLevel === "CLIENT_PROJECT" && item.project,
  );
  if (
    !clientContacts.length &&
    !reportContacts.length &&
    !projectContacts.length
  )
    return null;
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      {[...clientContacts, ...reportContacts].map((item) => (
        <div key={item.id} className="font-medium text-slate-900">
          {formatBillTo(item.contactPerson)}
        </div>
      ))}
      {projectContacts.length ? (
        <div className="mt-2 space-y-1">
          {projectContacts.map((item) => (
            <div key={item.id}>
              <span className="font-semibold">{item.project?.name}:</span>{" "}
              {formatBillTo(item.contactPerson)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const FLYHOUSE_CLIENT_ID = "cmnh8c2c00000l2044e37c8rg";

type BillingReportPageSearchParams = Record<
  string,
  string | string[] | undefined
>;

function getSearchParamValue(
  searchParams: BillingReportPageSearchParams,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildBillingReportPaginationSearchParams(
  searchParams: BillingReportPageSearchParams,
) {
  const preserved: Record<string, string | undefined> = {};
  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === "detailPage") return;
    const normalizedValue = Array.isArray(value) ? value[0] : value;
    if (normalizedValue) preserved[key] = normalizedValue;
  });
  return preserved;
}

function BillingDoneButton({
  movieId,
  returnTo,
  label = "Update Billing Status",
  billingMonth,
  amount,
}: {
  movieId: string;
  returnTo: string;
  label?: string;
  billingMonth?: string;
  amount?: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <BillingDonePopover label={label}>
      <form action={completeMovieBillingAction} className="space-y-3">
        <input type="hidden" name="movieId" value={movieId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {billingMonth ? (
          <input type="hidden" name="billingMonth" value={billingMonth} />
        ) : null}
        {typeof amount === "number" ? (
          <input type="hidden" name="amount" value={String(amount)} />
        ) : null}
        <div>
          <label className="label" htmlFor={`billingDate-${movieId}`}>
            Billing date
          </label>
          <input
            id={`billingDate-${movieId}`}
            name="billingDate"
            type="date"
            className="input"
            defaultValue={today}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor={`invoiceNumber-${movieId}`}>
            Invoice number
          </label>
          <input
            id={`invoiceNumber-${movieId}`}
            name="invoiceNumber"
            className="input"
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          Billing Done
        </button>
      </form>
    </BillingDonePopover>
  );
}

function ProjectBillingDoneButton({
  projectId,
  returnTo,
  label = "Billing Done",
  billingMonth,
  amount,
}: {
  projectId: string;
  returnTo: string;
  label?: string;
  billingMonth?: string;
  amount?: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <BillingDonePopover label={label}>
      <form action={completeProjectBillingAction} className="space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {billingMonth ? (
          <input type="hidden" name="billingMonth" value={billingMonth} />
        ) : null}
        {typeof amount === "number" ? (
          <input type="hidden" name="amount" value={String(amount)} />
        ) : null}
        <div>
          <label className="label" htmlFor={`projectBillingDate-${projectId}`}>
            Billing date
          </label>
          <input
            id={`projectBillingDate-${projectId}`}
            name="billingDate"
            type="date"
            className="input"
            defaultValue={today}
            required
          />
        </div>
        <div>
          <label
            className="label"
            htmlFor={`projectInvoiceNumber-${projectId}`}
          >
            Invoice number
          </label>
          <input
            id={`projectInvoiceNumber-${projectId}`}
            name="invoiceNumber"
            className="input"
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          Billing Done
        </button>
      </form>
    </BillingDonePopover>
  );
}

function MonthBillingDoneButton({
  clientId,
  month,
  returnTo,
}: {
  clientId: string;
  month: string;
  returnTo: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <BillingDonePopover label="Billing Done">
      <form action={completeClientMonthBillingAction} className="space-y-3">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div>
          <label className="label" htmlFor={`billingDate-${clientId}-${month}`}>
            Billing date
          </label>
          <input
            id={`billingDate-${clientId}-${month}`}
            name="billingDate"
            type="date"
            className="input"
            defaultValue={today}
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          Billing Done
        </button>
      </form>
    </BillingDonePopover>
  );
}

function AmazonMonthlyBillingDoneButton({
  movieId,
  billingMonth,
  socialAssetsCost,
  localizationCost,
  totalCost,
  returnTo,
}: {
  movieId: string;
  billingMonth: string;
  socialAssetsCost?: number;
  localizationCost?: number;
  totalCost?: number;
  returnTo: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <BillingDonePopover label="Mark Month Billed">
      <form action={completeAmazonMonthlyBillingAction} className="space-y-3">
        <input type="hidden" name="movieId" value={movieId} />
        <input type="hidden" name="billingReportType" value="amazon-month" />
        <input type="hidden" name="billingMonth" value={billingMonth} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {typeof socialAssetsCost === "number" ? (
          <input
            type="hidden"
            name="socialAssetsCost"
            value={String(socialAssetsCost)}
          />
        ) : null}
        {typeof localizationCost === "number" ? (
          <input
            type="hidden"
            name="localizationCost"
            value={String(localizationCost)}
          />
        ) : null}
        {typeof totalCost === "number" ? (
          <input type="hidden" name="amount" value={String(totalCost)} />
        ) : null}
        <div>
          <label
            className="label"
            htmlFor={`amazonBillingDate-${movieId}-${billingMonth}`}
          >
            Billing date
          </label>
          <input
            id={`amazonBillingDate-${movieId}-${billingMonth}`}
            name="billingDate"
            type="date"
            className="input"
            defaultValue={today}
            required
          />
        </div>
        <div>
          <label
            className="label"
            htmlFor={`amazonInvoiceNumber-${movieId}-${billingMonth}`}
          >
            Invoice number
          </label>
          <input
            id={`amazonInvoiceNumber-${movieId}-${billingMonth}`}
            name="invoiceNumber"
            className="input"
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          Mark Month Billed
        </button>
      </form>
    </BillingDonePopover>
  );
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
    assetNameId?: string;
    countryId?: string;
    month?: string;
    year?: string;
    projectMonth?: string;
    portalsMonth?: string;
    dvdMonth?: string;
    newsletterMonth?: string;
    amazonHistoryMonth?: string;
    closedTitlesYear?: string;
  };
}) {
  const query = buildQueryString({
    report: reportType,
    fromDate: filters.fromDate ?? "",
    toDate: filters.toDate ?? "",
    movieId: filters.movieId ?? "",
    assetTypeId: filters.assetTypeId ?? "",
    assetNameId: filters.assetNameId ?? "",
    countryId: filters.countryId ?? "",
    month: filters.month ?? "",
    year: filters.year ?? "",
    projectMonth: filters.projectMonth ?? "",
    portalsMonth: filters.portalsMonth ?? "",
    dvdMonth: filters.dvdMonth ?? "",
    newsletterMonth: filters.newsletterMonth ?? "",
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
  const isUniversal = data.client.name === "Universal Pictures International";

  if (isUniversal) {
    return (
      <UniversalTimeEntryFilters
        clientId={clientId}
        reportType={reportType}
        data={data}
      />
    );
  }

  return (
    <AutoSubmitFilterForm
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
      </div>
    </AutoSubmitFilterForm>
  );
}

function getUniversalReportTotals(
  rows: NonNullable<
    Awaited<ReturnType<typeof getAmazonBillingReportData>>
  >["rows"],
) {
  return {
    assets: new Set(
      rows
        .map((row) => row.assetName)
        .filter((value) => value && value !== "-"),
    ).size,
    countries: new Set(
      rows
        .map((row) => row.territoryVariant ?? "")
        .filter((value) => value && value !== "-"),
    ).size,
  };
}

function TimeEntryReportDetailsTable({
  clientId,
  data,
  detailPage,
  searchParams,
}: {
  clientId: string;
  data: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>>;
  detailPage: number;
  searchParams: BillingReportPageSearchParams;
}) {
  const isLocalization = data.reportType === "localization";
  const isUniversal = data.client.name === "Universal Pictures International";
  const isUniversalSocial = isUniversal && data.reportType === "social-assets";
  const isUniversalLocalization = isUniversal && isLocalization;
  const showCost = !isUniversal;
  const renderTable = (
    rows: typeof data.rows,
    keyPrefix: string,
    totalRows: typeof data.rows = rows,
  ) => {
    const totals = getUniversalReportTotals(totalRows);
    const colSpan = isUniversalLocalization
      ? 5
      : isLocalization
        ? 7
        : isUniversalSocial
          ? 5
          : 6;
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
              {!isUniversalLocalization ? (
                <th className="table-cell">Asset Type</th>
              ) : null}
              {showCost ? <th className="table-cell">Cost</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr
                key={`${keyPrefix}-${row.date}-${row.titleName}-${row.assetName}-${index}`}
              >
                <td className="table-cell whitespace-nowrap">{row.date}</td>
                <td className="table-cell">
                  <div className="font-medium text-slate-900">
                    {row.titleName}
                  </div>
                  <ContactListAccordion contacts={row.contactPersons} />
                </td>
                <td className="table-cell">{row.assetName}</td>
                {isLocalization ? (
                  <td className="table-cell">{row.territoryVariant ?? "-"}</td>
                ) : null}
                {!isUniversalLocalization ? (
                  <td className="table-cell">{row.assetType}</td>
                ) : null}
                {showCost ? (
                  <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                    {formatUsd(row.cost)}
                  </td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="table-cell text-center text-sm text-slate-500"
                >
                  No records found for the selected filters.
                </td>
              </tr>
            ) : null}
            {isUniversalSocial && rows.length > 0 ? (
              <tr className="bg-slate-100">
                <td
                  colSpan={3}
                  className="table-cell font-semibold text-slate-900"
                >
                  Total Unique Assets
                </td>
                <td className="table-cell font-semibold text-slate-900">
                  {totals.assets}
                </td>
              </tr>
            ) : null}
            {isUniversalLocalization && rows.length > 0 ? (
              <>
                <tr className="bg-slate-100">
                  <td
                    colSpan={3}
                    className="table-cell font-semibold text-slate-900"
                  >
                    Total Unique Assets
                  </td>
                  <td className="table-cell font-semibold text-slate-900">
                    {totals.assets}
                  </td>
                </tr>
                <tr className="bg-slate-100">
                  <td
                    colSpan={3}
                    className="table-cell font-semibold text-slate-900"
                  >
                    Total Unique Territory/Variant
                  </td>
                  <td className="table-cell font-semibold text-slate-900">
                    {totals.countries}
                  </td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  };

  const paginatedRows = paginateItems(
    data.rows,
    detailPage,
    BILLING_REPORT_DETAIL_PAGE_SIZE,
  );

  return (
    <div className="space-y-3" id="detail-records">
      {renderTable(paginatedRows.items, "all", data.rows)}
      <PaginationControls
        basePath={`/billing-reports/${clientId}`}
        currentPage={paginatedRows.currentPage}
        totalPages={paginatedRows.totalPages}
        totalItems={paginatedRows.totalItems}
        pageSize={paginatedRows.pageSize}
        searchParams={buildBillingReportPaginationSearchParams(searchParams)}
        pageParam="detailPage"
        anchor="#detail-records"
      />
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
  const isUniversalLocalization =
    data.client.name === "Universal Pictures International" &&
    data.reportType === "localization";
  if (isUniversalLocalization) {
    return (
      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Total Unique Assets</th>
              <th className="table-cell">Total Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="table-cell font-medium text-slate-900">
                {totalAssets}
              </td>
              <td className="table-cell font-medium text-slate-900">
                {formatUsd(totalCost)}
              </td>
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
                colSpan={2}
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
  useGenericTitleReports = false,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  clientName: string;
  useGenericTitleReports?: boolean;
}) {
  const reportCatalog =
    getBillingReportCatalogForClient(clientName, clientId) ??
    (useGenericTitleReports ? GENERIC_TITLE_REPORTS : null);
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

function UniversalTitleSummaryBlock({
  title,
  rows,
  includeCountries = false,
  showAction = false,
  clientId,
  returnMovieId = "all",
}: {
  title: string;
  rows: Array<{
    movieId: string;
    titleName: string;
    totalAssets?: number;
    totalCountries?: number;
    socialAssets?: number;
    socialCost?: number;
    localizationAssets?: number;
    localizationCountries?: number;
    localizationCost?: number;
    poNumber?: string;
    contactPersons: Array<{ id?: string; name: string; email: string | null }>;
  }>;
  includeCountries?: boolean;
  showAction?: boolean;
  clientId?: string;
  returnMovieId?: string;
}) {
  const isCostSummary = rows.some(
    (row) =>
      row.socialAssets !== undefined || row.localizationAssets !== undefined,
  );

  if (isCostSummary) {
    const totals = rows.reduce(
      (sum, row) => ({
        socialAssets: sum.socialAssets + Number(row.socialAssets ?? 0),
        socialCost: sum.socialCost + Number(row.socialCost ?? 0),
        localizationAssets:
          sum.localizationAssets + Number(row.localizationAssets ?? 0),
        localizationCountries:
          sum.localizationCountries + Number(row.localizationCountries ?? 0),
        localizationCost:
          sum.localizationCost + Number(row.localizationCost ?? 0),
      }),
      {
        socialAssets: 0,
        socialCost: 0,
        localizationAssets: 0,
        localizationCountries: 0,
        localizationCost: 0,
      },
    );
    const colSpan = showAction ? 8 : 7;

    return (
      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell" rowSpan={2}>
                Title Name
              </th>
              <th className="table-cell text-center" colSpan={2}>
                Social QA
              </th>
              <th className="table-cell text-center" colSpan={3}>
                Localization
              </th>
              <th className="table-cell" rowSpan={2}>
                PO Number
              </th>
              {showAction ? (
                <th className="table-cell" rowSpan={2}>
                  Action
                </th>
              ) : null}
            </tr>
            <tr>
              <th className="table-cell">Total Unique Assets</th>
              <th className="table-cell">Cost</th>
              <th className="table-cell">Total Unique Assets</th>
              <th className="table-cell">Total Unique Territory/Variant</th>
              <th className="table-cell">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={`${title}-${row.movieId}`}>
                <td className="table-cell">
                  <div className="font-medium text-slate-900">
                    {row.titleName}
                  </div>
                  <ContactListAccordion contacts={row.contactPersons} />
                </td>
                <td className="table-cell">{row.socialAssets ?? 0}</td>
                <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                  {formatUsd(Number(row.socialCost ?? 0))}
                </td>
                <td className="table-cell">{row.localizationAssets ?? 0}</td>
                <td className="table-cell">{row.localizationCountries ?? 0}</td>
                <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                  {formatUsd(Number(row.localizationCost ?? 0))}
                </td>
                <td className="table-cell">{row.poNumber || "-"}</td>
                {showAction ? (
                  <td className="table-cell">
                    {clientId ? (
                      <BillingDoneButton
                        movieId={row.movieId}
                        returnTo={`/billing-reports/${clientId}?report=billing-summary&movieId=${returnMovieId}`}
                        label="Billing Done"
                      />
                    ) : (
                      "-"
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="table-cell text-center text-sm text-slate-500"
                >
                  No titles found for the selected filters.
                </td>
              </tr>
            ) : (
              <tr className="bg-slate-100">
                <td className="table-cell font-semibold text-slate-900">
                  Total
                </td>
                <td className="table-cell font-semibold text-slate-900">-</td>
                <td className="table-cell font-semibold text-slate-900">
                  {totals.socialAssets}
                </td>
                <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
                  {formatUsd(totals.socialCost)}
                </td>
                <td className="table-cell font-semibold text-slate-900">
                  {totals.localizationAssets}
                </td>
                <td className="table-cell font-semibold text-slate-900">
                  {totals.localizationCountries}
                </td>
                <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
                  {formatUsd(totals.localizationCost)}
                </td>
                {showAction ? <td className="table-cell">-</td> : null}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const totalAssets = rows.reduce(
    (sum, row) => sum + Number(row.totalAssets ?? 0),
    0,
  );
  const totalCountries = rows.reduce(
    (sum, row) => sum + Number(row.totalCountries ?? 0),
    0,
  );

  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Title Name</th>
            <th className="table-cell">Total Unique Assets</th>
            {includeCountries ? (
              <th className="table-cell">Total Unique Territory/Variant</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={`${title}-${row.movieId}`}>
              <td className="table-cell">
                <div className="font-medium text-slate-900">
                  {row.titleName}
                </div>
                <ContactListAccordion contacts={row.contactPersons} />
              </td>
              <td className="table-cell">{row.totalAssets ?? 0}</td>
              {includeCountries ? (
                <td className="table-cell">{row.totalCountries ?? 0}</td>
              ) : null}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={includeCountries ? 3 : 2}
                className="table-cell text-center text-sm text-slate-500"
              >
                No titles found for the selected filters.
              </td>
            </tr>
          ) : (
            <tr className="bg-slate-100">
              <td className="table-cell font-semibold text-slate-900">Total</td>
              <td className="table-cell font-semibold text-slate-900">
                {totalAssets}
              </td>
              {includeCountries ? (
                <td className="table-cell font-semibold text-slate-900">
                  {totalCountries}
                </td>
              ) : null}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TimeEntryReportsWorkspace({
  clientId,
  activeReport,
  data,
  detailPage,
  searchParams,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: NonNullable<Awaited<ReturnType<typeof getAmazonBillingReportData>>>;
  detailPage: number;
  searchParams: BillingReportPageSearchParams;
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
      {data.client.name === "Universal Pictures International" ? (
        <div className="space-y-3">
          <h2 className="section-title">Title Summary</h2>
          <UniversalTitleSummaryBlock
            title="active"
            rows={data.titleSummaryRows}
            includeCountries={data.reportType === "localization"}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.reportTitle}</h2>
          <p className="section-subtitle">
            Detailed billing records from time entries.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ExportButtons
            clientId={clientId}
            reportType={activeReport}
            filters={data.filters}
          />
          {data.client.name === "Amazon Studios" &&
          data.filters.movieId !== "all" ? (
            <BillingDoneButton
              movieId={data.filters.movieId}
              label="Close Title / PO"
              returnTo={`/billing-reports/${clientId}?report=${activeReport}&movieId=${data.filters.movieId}&fromDate=${data.filters.fromDate}&toDate=${data.filters.toDate}&assetTypeId=${data.filters.assetTypeId}`}
            />
          ) : null}
        </div>
      </div>
      <TimeEntryReportDetailsTable
        clientId={clientId}
        data={data}
        detailPage={detailPage}
        searchParams={searchParams}
      />
      {data.client.name !== "Universal Pictures International" ? (
        <div>
          <h2 className="section-title mb-3">Summary by Asset Type</h2>
          <TimeEntryReportSummaryTable data={data} />
        </div>
      ) : null}
    </div>
  );
}

function UniversalBillingSummaryFilters({
  clientId,
  data,
}: {
  clientId: string;
  data: UniversalBillingSummaryData;
}) {
  return (
    <AutoSubmitFilterForm
      method="get"
      action={`/billing-reports/${clientId}`}
      className="card p-5"
    >
      <input type="hidden" name="report" value="billing-summary" />
      <div className="grid gap-4 md:grid-cols-[1fr_max-content] md:items-end">
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
              ...data.titleOptions.map((movie) => ({
                value: movie.id,
                label: movie.title,
              })),
            ]}
            placeholder="All titles"
            searchPlaceholder="Search titles..."
            emptyLabel="No Working/Completed titles found."
          />
        </div>
      </div>
    </AutoSubmitFilterForm>
  );
}

function UniversalBillingSummaryTable({
  data,
}: {
  data: UniversalBillingSummaryData;
}) {
  return (
    <UniversalTitleSummaryBlock
      title="active"
      rows={data.rows}
      showAction
      clientId={data.client.id}
      returnMovieId={data.filters.movieId}
    />
  );
}

function UniversalBillingSummaryWorkspace({
  clientId,
  activeReport,
  data,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: UniversalBillingSummaryData;
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
          Projects <span className="font-semibold">UNI Social QC</span> and{" "}
          <span className="font-semibold">UNI Social Localization</span> were
          not found for this client.
        </div>
      ) : null}
      <UniversalBillingSummaryFilters clientId={clientId} data={data} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.reportTitle}</h2>
          <p className="section-subtitle">
            Unique assets and countries/territories by Working/Completed title.
          </p>
        </div>
        <ExportButtons
          clientId={clientId}
          reportType={activeReport}
          filters={{ movieId: data.filters.movieId }}
        />
      </div>
      <UniversalBillingSummaryTable data={data} />
      <div className="space-y-3">
        <h2 className="section-title">Completed & Billed Title Summary</h2>
        <UniversalTitleSummaryBlock
          title="completed"
          rows={data.completedTitleSummaryRows}
        />
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
  const hasCountryFilter = false;
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
      movieOptions={[
        { value: "all", label: "All Titles" },
        ...data.movieOptions.map((movie) => ({
          value: movie.id,
          label: movie.title,
        })),
      ]}
      countryOptions={[]}
      hasCountryFilter={hasCountryFilter}
      movieEmptyLabel={movieEmptyLabel}
    />
  );
}

function WarnerDomesticTable({
  data,
  rows = data.rows,
  totalCost = data.totalCost,
}: {
  data: WarnerDomesticDeliverableData;
  rows?: WarnerDomesticDeliverableData["rows"];
  totalCost?: number;
}) {
  const canShowRows = Boolean(
    data.selectedMovie &&
    (data.reportType !== "other-deliverable" ||
      data.selectedCountry ||
      data.filters.countryId === ""),
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
          !data.selectedCountry &&
          data.filters.countryId !== "" ? (
            <tr>
              <td
                colSpan={2}
                className="table-cell text-center text-sm text-slate-500"
              >
                Select a country with time entries for the selected title, or
                choose All Countries, to view deliverables.
              </td>
            </tr>
          ) : null}
          {canShowRows
            ? rows.map((row, index) => (
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
                {formatUsd(totalCost)}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}


function ClientTitleSummaryFilters({
  clientId,
  activeReport,
  data,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: ClientTitleSummaryData;
}) {
  return (
    <AutoSubmitFilterForm
      method="get"
      action={`/billing-reports/${clientId}`}
      className="card p-5"
    >
      <input type="hidden" name="report" value={activeReport} />
      <div>
        <label className="label" htmlFor="movieId">
          Title
        </label>
        <SearchableCombobox
          id="movieId"
          name="movieId"
          defaultValue={data.filters.movieId}
          options={[
            { value: "all", label: "All Titles" },
            ...data.movieOptions.map((movie) => ({
              value: movie.id,
              label: movie.title,
            })),
          ]}
          placeholder="All Titles"
          searchPlaceholder="Search titles..."
          emptyLabel="No titles found."
        />
      </div>
    </AutoSubmitFilterForm>
  );
}

function ClientTitleSummaryExportButtons({
  clientId,
  activeReport,
  data,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: ClientTitleSummaryData;
}) {
  const query = buildQueryString({
    report: activeReport,
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

function ClientTitleSummaryBlockTable({
  block,
}: {
  block: ClientTitleSummaryData["titleBlocks"][number]["blocks"][number];
}) {
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
          {block.rows.length ? (
            block.rows.map((row, index) => (
              <tr key={`${row.label}-${index}`}>
                <td className="table-cell">
                  <div className="font-medium text-slate-900">{row.label}</div>
                  {row.meta ? (
                    <div className="mt-1 text-xs text-slate-500">{row.meta}</div>
                  ) : null}
                </td>
                <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                  {formatUsd(row.cost)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="table-cell text-center text-sm text-slate-500">
                No rows found.
              </td>
            </tr>
          )}
          <tr className="bg-slate-100">
            <td className="table-cell font-semibold text-slate-900">Total</td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
              {formatUsd(block.totalCost)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ClientTitleSummaryWorkspace({
  clientId,
  activeReport,
  data,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: ClientTitleSummaryData;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs
        clientId={clientId}
        activeReport={activeReport}
        clientName={data.client.name}
      />
      <ClientTitleSummaryFilters clientId={clientId} activeReport={activeReport} data={data} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.reportTitle}</h2>
          <p className="section-subtitle">
            Per-title summary of configured client-specific report blocks.
          </p>
        </div>
        <ClientTitleSummaryExportButtons clientId={clientId} activeReport={activeReport} data={data} />
      </div>
      {data.titleBlocks.length ? (
        <div className="space-y-6">
          {data.titleBlocks.map((titleBlock) => (
            <section key={titleBlock.movie.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{titleBlock.movie.title}</h3>
                <ContactListAccordion contacts={titleBlock.contactPersons} />
              </div>
              {titleBlock.blocks.map((block) => (
                <div key={block.reportType} className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700">{block.reportTitle}</h4>
                  <ClientTitleSummaryBlockTable block={block} />
                </div>
              ))}
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
                Title Total: {formatUsd(titleBlock.totalCost)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          No title summary rows found for the selected filter.
        </div>
      )}
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
  const requiresCountry = false;
  const subtitle = requiresCountry
    ? data.selectedMovie && data.selectedCountry
      ? `Deliverable billing for ${data.selectedMovie.title} / ${data.selectedCountry.name}.`
      : data.selectedMovie && data.filters.countryId === ""
        ? `Deliverable billing for ${data.selectedMovie.title} / All Countries.`
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
        <div className="flex flex-wrap gap-3">
          <ExportButtons
            clientId={clientId}
            reportType={data.reportType}
            filters={{
              movieId: data.filters.movieId,
            }}
          />
          {data.selectedMovie &&
          data.filters.movieId !== "all" &&
          ((data.reportType === "domestic-deliverable" &&
            data.selectedMovie.billingDomestic) ||
            (data.reportType === "intl-deliverable" &&
              data.selectedMovie.billingIntl &&
              !data.selectedMovie.billingDomestic) ||
            (data.reportType === "other-deliverable" &&
              data.selectedMovie.billingOther)) ? (
            <BillingDoneButton
              movieId={data.selectedMovie.id}
              returnTo={`/billing-reports/${clientId}?report=${data.reportType}&movieId=${data.filters.movieId}`}
            />
          ) : null}
        </div>
      </div>
      {data.titleBlocks?.length ? (
        <div className="space-y-6">
          {data.titleBlocks.map((block) => (
            <div
              key={`${block.selectedMovie.id}-${block.selectedCountry?.id ?? "all"}`}
              className="space-y-3"
            >
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {block.selectedMovie.title}
                  {block.selectedCountry
                    ? ` / ${block.selectedCountry.name}`
                    : ""}
                </h3>
                <ContactListAccordion
                  contacts={block.selectedMovie.contactPersons}
                />
              </div>
              <WarnerDomesticTable
                data={{
                  ...data,
                  selectedMovie: block.selectedMovie,
                  selectedCountry: block.selectedCountry,
                }}
                rows={block.rows}
                totalCost={block.totalCost}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {data.selectedMovie ? (
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {data.selectedMovie.title}
              </h3>
              <ContactListAccordion
                contacts={data.selectedMovie.contactPersons}
              />
            </div>
          ) : null}
          <WarnerDomesticTable data={data} />
        </div>
      )}
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
    <AutoSubmitFilterForm
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
            options={[
              ...(data.movieOptions.length > 1
                ? [{ value: "all", label: "All Titles" }]
                : []),
              ...data.movieOptions.map((movie) => ({
                value: movie.id,
                label: movie.title,
              })),
            ]}
            disabled={data.movieOptions.length <= 1}
            placeholder={
              data.movieOptions.length > 1 ? "All Titles" : "Select title"
            }
            searchPlaceholder="Search titles..."
            emptyLabel="No active Working/Completed titles with time entries found."
          />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Only active Working/Completed titles with one or more Ticketing Time
        Entries are listed.
      </p>
    </AutoSubmitFilterForm>
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
            <th className="table-cell">Billing Header / Project</th>
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
                Select a title to view billing records.
              </td>
            </tr>
          ) : null}
          {data.selectedMovie && data.projectRows.length === 0 ? (
            <tr>
              <td
                colSpan={2}
                className="table-cell text-center text-sm text-slate-500"
              >
                No valid billing headers are available for the selected title.
              </td>
            </tr>
          ) : null}
          {data.projectRows.map((row) => (
            <tr key={row.projectId}>
              <td className="table-cell">
                <div className="font-medium text-slate-900">
                  {row.projectName}
                </div>
                {row.lensDetails?.length ? (
                  <div className="mt-1 space-y-1 text-xs text-slate-500">
                    <div className="font-medium text-slate-600">
                      Lens Type / Countries
                    </div>
                    {row.lensDetails.map((detail) => (
                      <div key={detail}>{detail}</div>
                    ))}
                  </div>
                ) : data.showCountryList && row.countryList ? (
                  <div className="mt-1 text-xs text-slate-500">
                    Countries: {row.countryList}
                  </div>
                ) : null}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatSonyUsd(row.cost)}
              </td>
            </tr>
          ))}
          {data.chargeRows.length ? (
            <tr className="bg-slate-50">
              <td
                colSpan={2}
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
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatSonyUsd(row.cost)}
              </td>
            </tr>
          ))}
          {data.selectedMovie ? (
            <tr className="bg-slate-100">
              <td className="table-cell font-semibold text-slate-900">Total</td>
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
          <ContactListAccordion contacts={data.contactPersons} />
        </div>
      ) : null}
      {data.titleBlocks.length ? (
        <div className="space-y-6">
          {data.titleBlocks.map((block) => (
            <section
              key={block.movie.id}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {block.movie.title}
                </h3>
                <ContactListAccordion contacts={block.contactPersons} />
              </div>
              <SonyPicturesReportTable
                data={{
                  ...data,
                  selectedMovie: block.movie,
                  projectRows: block.projectRows,
                  chargeRows: block.chargeRows,
                  totalCost: block.totalCost,
                  titleBlocks: [],
                }}
              />
            </section>
          ))}
        </div>
      ) : (
        <SonyPicturesReportTable data={data} />
      )}
    </div>
  );
}

function SonyNewsletterSummaryHistoryTable({
  rows,
}: {
  rows: SonyBillingSummaryHistoryData["newsletterRows"];
}) {
  return (
    <table className="table-base">
      <thead className="table-head">
        <tr>
          <th className="table-cell">Newsletter Type</th>
          <th className="table-cell">Count</th>
          <th className="table-cell">Billing Month</th>
          <th className="table-cell">Cost</th>
          <th className="table-cell">PO Number</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr
            key={`${row.newsletterType}-${row.billingMonth ?? row.billingDate ?? "summary"}`}
          >
            <td className="table-cell font-medium text-slate-900">
              {row.newsletterType}
            </td>
            <td className="table-cell">{row.count ?? "-"}</td>
            <td className="table-cell">
              {row.billingMonth ?? row.billingDate ?? "-"}
            </td>
            <td className="table-cell">{formatSonyUsd(row.cost)}</td>
            <td className="table-cell">{row.poNumber || "-"}</td>
          </tr>
        ))}
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={5}
              className="table-cell text-center text-sm text-slate-500"
            >
              No newsletter billing records available.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function SonyNonTitleProjectSummaryTable({
  clientId,
  data,
  rows,
}: {
  clientId: string;
  data: SonyBillingSummaryHistoryData;
  rows: SonyBillingSummaryHistoryData["nonTitleProjectRows"];
}) {
  const hasBillingMonth = rows.some((row) => row.billingMonth);
  const returnTo = `/billing-reports/${clientId}?report=billing-summary-history&year=${data.filters.year}&projectMonth=${data.filters.projectMonth ?? ""}`;

  return (
    <table className="table-base">
      <thead className="table-head">
        <tr>
          <th className="table-cell">Project (Project Status)</th>
          <th className="table-cell">Billing Model</th>
          <th className="table-cell">Cost</th>
          {hasBillingMonth ? <th className="table-cell">Billing Month</th> : null}
          <th className="table-cell">PO Number</th>
          <th className="table-cell">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.itemId}>
            <td className="table-cell font-medium text-slate-900">
              {row.title ?? row.projectName} ({row.projectStatus ?? row.status})
            </td>
            <td className="table-cell">{row.billingModel ?? "-"}</td>
            <td className="table-cell">{formatSonyUsd(row.cost)}</td>
            {hasBillingMonth ? (
              <td className="table-cell">{row.billingMonth ?? "-"}</td>
            ) : null}
            <td className="table-cell">{row.poNumber ?? "-"}</td>
            <td className="table-cell">
              <ProjectBillingDoneButton
                projectId={row.projectId}
                label="Billing Done"
                returnTo={returnTo}
                billingMonth={row.billingMonth}
                amount={row.cost}
              />
            </td>
          </tr>
        ))}
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={5 + (hasBillingMonth ? 1 : 0)}
              className="table-cell text-center text-sm text-slate-500"
            >
              No non-title project billing records available.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function SonyBillingSummaryHistoryTable({
  data,
  clientId,
  rows,
  includeAction,
}: {
  data: SonyBillingSummaryHistoryData;
  clientId: string;
  rows: SonyBillingSummaryHistoryData["summaryRows"];
  includeAction: boolean;
}) {
  const reportColumns = rows[0]?.reportValues ?? [];
  const hasBillingMonth = rows.some((row) => row.billingMonth);
  const emptyColSpan =
    1 +
    Math.max(reportColumns.length, 1) * (hasBillingMonth ? 3 : 2) +
    (includeAction ? 1 : 0);
  return (
    <table className="table-base">
      <thead className="table-head">
        <tr>
          <th className="table-cell" rowSpan={2}>
            Title Name
          </th>
          {reportColumns.map((report) => (
            <th
              key={report.reportType}
              className="table-cell text-center"
              colSpan={hasBillingMonth ? 3 : 2}
            >
              {report.reportTitle}
            </th>
          ))}
          {includeAction ? (
            <th className="table-cell" rowSpan={2}>
              Action
            </th>
          ) : null}
        </tr>
        <tr>
          {reportColumns.map((report) => (
            <Fragment key={report.reportType}>
              <th className="table-cell">Cost</th>
              {hasBillingMonth ? (
                <th className="table-cell">Billing Month</th>
              ) : null}
              <th className="table-cell">PO Number</th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.movieId}>
            <td className="table-cell font-medium text-slate-900">
              {row.title} ({row.status})
            </td>
            {(row.reportValues ?? []).map((report) => (
              <Fragment key={`${row.movieId}-${report.reportType}`}>
                <td className="table-cell">{formatSonyUsd(report.cost)}</td>
                {hasBillingMonth ? (
                  <td className="table-cell">{row.billingMonth ?? "-"}</td>
                ) : null}
                <td className="table-cell">{report.poNumber || "-"}</td>
              </Fragment>
            ))}
            {includeAction ? (
              <td className="table-cell">
                <BillingDoneButton
                  movieId={row.movieId}
                  label="Billing Done"
                  returnTo={`/billing-reports/${clientId}?report=billing-summary-history&year=${data.filters.year}`}
                />
              </td>
            ) : null}
          </tr>
        ))}
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={emptyColSpan}
              className="table-cell text-center text-sm text-slate-500"
            >
              No billing records available.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function SonyBillingSummaryHistoryWorkspace({
  clientId,
  activeReport,
  data,
  searchParams,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: SonyBillingSummaryHistoryData;
  searchParams: BillingReportPageSearchParams;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs
        clientId={clientId}
        activeReport={activeReport}
        clientName={data.client.name}
      />
      <div className="flex justify-end">
        <ExportButtons
          clientId={clientId}
          reportType={activeReport}
          filters={{
            year: data.filters.year,
            projectMonth: data.filters.projectMonth,
            portalsMonth: data.filters.portalsMonth,
            dvdMonth: data.filters.dvdMonth,
            newsletterMonth: data.filters.newsletterMonth,
          }}
        />
      </div>

      {(() => {
        const pagination = getPaginatedBillingHistoryRows(
          data.summaryRows,
          searchParams,
          "sony-billing-summary",
        );
        return (
          <section
            id="sony_billing_summary"
            className="table-wrap scroll-mt-24"
          >
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="section-title">Billing Summary</h2>
              <p className="section-subtitle">
                Titles which have not been marked Completed &amp; Billed.
              </p>
            </div>
            <SonyBillingSummaryHistoryTable
              data={data}
              clientId={clientId}
              rows={pagination.page.items}
              includeAction
            />
            <BillingHistoryPagination
              clientId={clientId}
              searchParams={searchParams}
              sectionKey="sony-billing-summary"
              pageData={pagination.page}
            />
          </section>
        );
      })()}

      <section
        className="table-wrap scroll-mt-24"
        id="sony_newsletters_summary"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="section-title">Newsletters</h2>
              <p className="section-subtitle">
                Newsletter billing split by Newsletter type for the selected
                month.
              </p>
            </div>
            <BillingHistoryMonthFilter
              clientId={clientId}
              searchParams={searchParams}
              paramName="newsletterMonth"
              value={
                data.filters.newsletterMonth ??
                new Date().toISOString().slice(0, 7)
              }
            />
          </div>
        </div>
        {(() => {
          const pagination = getPaginatedBillingHistoryRows(
            data.newsletterRows,
            searchParams,
            "sony-newsletters-summary",
          );
          return (
            <>
              <SonyNewsletterSummaryHistoryTable rows={pagination.page.items} />
              <BillingHistoryPagination
                clientId={clientId}
                searchParams={searchParams}
                sectionKey="sony-newsletters-summary"
                pageData={pagination.page}
              />
            </>
          );
        })()}
      </section>

      {data.nonTitleProjectRows.length
        ? (() => {
            const pagination = getPaginatedBillingHistoryRows(
              data.nonTitleProjectRows,
              searchParams,
              "sony-non-title-project-billing-summary",
            );
            return (
              <section
                id="sony_non_title_project_billing_summary"
                className="table-wrap scroll-mt-24"
              >
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="section-title">Project Billing Summary</h2>
                      <p className="section-subtitle">
                        Non-title projects using project-specific POs for this
                        client. Projects already included in title-based billing
                        are excluded.
                      </p>
                    </div>
                    <BillingHistoryMonthFilter
                      clientId={clientId}
                      searchParams={searchParams}
                      paramName="projectMonth"
                      value={data.filters.projectMonth ?? new Date().toISOString().slice(0, 7)}
                    />
                  </div>
                </div>
                <SonyNonTitleProjectSummaryTable
                  clientId={clientId}
                  data={data}
                  rows={pagination.page.items}
                />
                <BillingHistoryPagination
                  clientId={clientId}
                  searchParams={searchParams}
                  sectionKey="sony-non-title-project-billing-summary"
                  pageData={pagination.page}
                />
              </section>
            );
          })()
        : null}

      <section
        className="table-wrap scroll-mt-24"
        id="sony_newsletters_history"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="section-title">Newsletters Billing History</h2>
          <p className="section-subtitle">
            Newsletter billing records for the selected billing year.
          </p>
        </div>
        {(() => {
          const pagination = getPaginatedBillingHistoryRows(
            data.newsletterHistoryRows,
            searchParams,
            "sony-newsletters-history",
          );
          return (
            <>
              <SonyNewsletterSummaryHistoryTable rows={pagination.page.items} />
              <BillingHistoryPagination
                clientId={clientId}
                searchParams={searchParams}
                sectionKey="sony-newsletters-history"
                pageData={pagination.page}
              />
            </>
          );
        })()}
      </section>

      <section className="table-wrap scroll-mt-24" id="sony_billing_history">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="section-title">Billing Summary & History</h2>
              <p className="section-subtitle">
                Titles marked Completed &amp; Billed for the selected billing
                year.
              </p>
            </div>
            <AutoSubmitFilterForm
              method="get"
              action={`/billing-reports/${clientId}`}
              className="w-full sm:w-44"
            >
              <input
                type="hidden"
                name="report"
                value="billing-summary-history"
              />
              <label className="label" htmlFor="sonyHistoryYear">
                Year
              </label>
              <SearchableCombobox
                id="sonyHistoryYear"
                name="year"
                defaultValue={data.filters.year}
                options={Array.from({ length: 7 }, (_, index) =>
                  String(new Date().getFullYear() - index),
                ).map((year) => ({ value: year, label: year }))}
                placeholder="Select year"
                searchPlaceholder="Search years..."
                emptyLabel="No year found."
              />
            </AutoSubmitFilterForm>
          </div>
        </div>
        {(() => {
          const pagination = getPaginatedBillingHistoryRows(
            data.historyRows,
            searchParams,
            "sony-billing-history",
          );
          return (
            <>
              <SonyBillingSummaryHistoryTable
                data={data}
                clientId={clientId}
                rows={pagination.page.items}
                includeAction={false}
              />
              <BillingHistoryPagination
                clientId={clientId}
                searchParams={searchParams}
                sectionKey="sony-billing-history"
                pageData={pagination.page}
              />
            </>
          );
        })()}
      </section>
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
    <AutoSubmitFilterForm
      method="get"
      action={`/billing-reports/${clientId}`}
      className="card p-5"
    >
      <input type="hidden" name="report" value={reportType} />
      <div className="grid gap-4 md:grid-cols-[220px_auto_1fr] md:items-end">
        <div>
          <label className="label" htmlFor="month">
            Month
          </label>
          <input
            id="month"
            name="month"
            type="month"
            className="input"
            defaultValue={data.filters.month}
          />
        </div>
        <p className="text-sm text-slate-500 md:text-right">
          Newsletter billing is calculated from Time Entries for the selected
          month.
        </p>
      </div>
    </AutoSubmitFilterForm>
  );
}

function SonyNewsletterExportButtons({
  clientId,
  reportType,
  data,
}: {
  clientId: string;
  reportType: AmazonReportType;
  data: SonyNewsletterBillingData;
}) {
  const query = buildQueryString({
    report: reportType,
    month: data.filters.month,
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

function SonyNewsletterBillingTable({
  data,
}: {
  data: SonyNewsletterBillingData;
}) {
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
              <td
                colSpan={2}
                className="table-cell text-center text-sm text-slate-500"
              >
                Newsletter project was not found for this client.
              </td>
            </tr>
          ) : null}
          {data.project && data.rows.length === 0 ? (
            <tr>
              <td
                colSpan={2}
                className="table-cell text-center text-sm text-slate-500"
              >
                No newsletter Time Entries found for the selected month.
              </td>
            </tr>
          ) : null}
          {data.rows.map((row) => (
            <tr key={row.newsletterType}>
              <td className="table-cell font-medium text-slate-900">
                {row.newsletterType}
              </td>
              <td className="table-cell font-medium text-slate-900">
                {row.count}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatSonyUsd(row.cost)}
              </td>
            </tr>
          ))}
          {data.project ? (
            <tr className="bg-slate-50">
              <td className="table-cell font-semibold text-slate-900">Total</td>
              <td className="table-cell font-semibold text-slate-900">
                {data.totalCount}
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
      <ReportTabs
        clientId={clientId}
        activeReport={activeReport}
        clientName={data.client.name}
      />
      <SonyNewsletterBillingFilters
        clientId={clientId}
        reportType={activeReport}
        data={data}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">
            {data.client.name} Newsletters Billing
          </h2>
          <p className="section-subtitle">Month: {data.filters.month}</p>
        </div>
        <SonyNewsletterExportButtons
          clientId={clientId}
          reportType={activeReport}
          data={data}
        />
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
    <AutoSubmitFilterForm
      method="get"
      action={`/billing-reports/${clientId}`}
      className="card p-5"
    >
      <input type="hidden" name="report" value={reportType} />
      <div className="grid gap-4 md:grid-cols-[220px_auto_1fr] md:items-end">
        <div>
          <label className="label" htmlFor="month">
            Month
          </label>
          <input
            id="month"
            name="month"
            type="month"
            className="input"
            defaultValue={data.filters.month}
          />
        </div>
        <p className="text-sm text-slate-500 md:text-right">
          Resource counts and project hours are calculated for the selected
          month.
        </p>
      </div>
    </AutoSubmitFilterForm>
  );
}

function FilmikExportButtons({
  clientId,
  reportType,
  data,
}: {
  clientId: string;
  reportType: AmazonReportType;
  data: FilmikBillingReportData;
}) {
  const query = buildQueryString({
    report: reportType,
    month: data.filters.month,
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

function FilmikResourceCostBlock({ data }: { data: FilmikBillingReportData }) {
  return (
    <section className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Resource Type</th>
            <th className="table-cell">Count</th>
            <th className="table-cell">Per Resource Client Cost</th>
            <th className="table-cell">Per Resource Vendor Cost</th>
            <th className="table-cell">Client Cost</th>
            <th className="table-cell">Vendor Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.resourceRows.map((row) => (
            <tr key={row.resourceTypeId}>
              <td className="table-cell font-medium text-slate-900">
                {row.resourceTypeName}
              </td>
              <td className="table-cell font-medium text-slate-900">
                {row.count}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatFilmikUsd(row.perResourceClientCost)}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatFilmikUsd(row.perResourceVendorCost)}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatFilmikUsd(row.clientCost)}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatFilmikUsd(row.vendorCost)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50">
            <td className="table-cell font-semibold text-slate-900">Total</td>
            <td className="table-cell font-semibold text-slate-900">
              {data.resourceTotalCount}
            </td>
            <td className="table-cell">-</td>
            <td className="table-cell">-</td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
              {formatFilmikUsd(data.resourceTotalClientCost)}
            </td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
              {formatFilmikUsd(data.resourceTotalVendorCost)}
            </td>
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
            <th className="table-cell">Client Cost</th>
            <th className="table-cell">Vendor Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.combinedRows.map((row) => (
            <tr key={row.key}>
              <td className="table-cell">
                <div className="font-medium text-slate-900">{row.name}</div>
                <ContactListAccordion contacts={row.contactPerson} />
              </td>
              <td className="table-cell font-medium text-slate-900">
                {row.key === "resource-cost"
                  ? row.quantity
                  : `${row.quantity.toFixed(2)}h`}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatFilmikUsd(row.clientCost)}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {row.vendorCost > 0 ? formatFilmikUsd(row.vendorCost) : "-"}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50">
            <td className="table-cell font-semibold text-slate-900" colSpan={2}>
              Total
            </td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
              {formatFilmikUsd(data.combinedTotalClientCost)}
            </td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
              {formatFilmikUsd(data.combinedTotalVendorCost)}
            </td>
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
      <ReportTabs
        clientId={clientId}
        activeReport={activeReport}
        clientName={data.client.name}
      />
      <FilmikBillingReportFilters
        clientId={clientId}
        reportType={activeReport}
        data={data}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.reportTitle}</h2>
          <p className="section-subtitle">
            Month: {getFilmikBillingReportMonthLabel(data)}
          </p>
        </div>
        <FilmikExportButtons
          clientId={clientId}
          reportType={activeReport}
          data={data}
        />
      </div>
      <div>
        <h3 className="mb-3 text-base font-semibold text-slate-900">
          Resource Cost
        </h3>
        <FilmikResourceCostBlock data={data} />
      </div>
      <div>
        <h3 className="mb-3 text-base font-semibold text-slate-900">
          Project + Resource Cost
        </h3>
        <FilmikCombinedCostBlock data={data} />
      </div>
    </div>
  );
}

function WarnerPortalReportWorkspace({
  clientId,
  activeReport,
  data,
  searchParams,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: WarnerPortalReportData;
  searchParams: BillingReportPageSearchParams;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs
        clientId={clientId}
        activeReport={activeReport}
        clientName={data.client.name}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">{data.reportTitle}</h2>
          <p className="section-subtitle">
            Active Warner portal projects marked Add to Billing for the selected
            month.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <BillingHistoryMonthFilter
            clientId={clientId}
            searchParams={searchParams}
            paramName="month"
            value={data.filters.month}
          />
          <ExportButtons
            clientId={clientId}
            reportType={activeReport}
            filters={{ month: data.filters.month }}
          />
        </div>
      </div>
      <WarnerPortalProjectsTable
        clientId={clientId}
        searchParams={searchParams}
        reportKey={activeReport}
        rows={data.rows}
      />
    </div>
  );
}

function WarnerPortalProjectsTable({
  clientId,
  searchParams,
  reportKey,
  rows,
}: {
  clientId: string;
  searchParams: BillingReportPageSearchParams;
  reportKey: AmazonReportType;
  rows: WarnerPortalReportData["rows"];
}) {
  const summaryPagination = getPaginatedBillingHistoryRows(
    rows,
    searchParams,
    `${reportKey}-summary`,
  );
  const hasHourlyRows = rows.some((row) => row.billingModel === "Hourly");
  const isDvdSites = reportKey === "dvd-sites";

  return (
    <div className="space-y-6">
      <section
        id={normalizePaginationKey(`${reportKey}-summary`)}
        className="space-y-3 scroll-mt-24"
      >
        <div className="table-wrap">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Project</th>
                {isDvdSites ? <th className="table-cell">Titles</th> : null}
                {hasHourlyRows ? <th className="table-cell">Hours</th> : null}
                <th className="table-cell">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaryPagination.page.items.map((row) => (
                <tr key={row.projectId}>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">
                      {row.projectName}
                    </div>
                    <ContactListAccordion contacts={row.contactPersons} />
                  </td>
                  {isDvdSites ? (
                    <td className="table-cell text-sm text-slate-700">
                      {row.titles.length ? row.titles.join(", ") : "-"}
                    </td>
                  ) : null}
                  {hasHourlyRows ? (
                    <td className="table-cell">
                      {row.billingModel === "Hourly"
                        ? row.totalHours.toFixed(2)
                        : "-"}
                    </td>
                  ) : null}
                  <td className="table-cell">
                    <BillingHistoryCostCell value={row.cost} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={(hasHourlyRows ? 3 : 2) + (isDvdSites ? 1 : 0)}
                    className="table-cell text-center text-sm text-slate-500"
                  >
                    No projects are available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <BillingHistoryPagination
          clientId={clientId}
          searchParams={searchParams}
          sectionKey={`${reportKey}-summary`}
          pageData={summaryPagination.page}
        />
      </section>

      {rows.map((project) => {
        const detailPagination = getPaginatedBillingHistoryRows(
          project.detailRows,
          searchParams,
          `${reportKey}-${project.projectId}`,
        );
        return (
          <section
            key={project.projectId}
            id={normalizePaginationKey(`${reportKey}-${project.projectId}`)}
            className="space-y-3 scroll-mt-24"
          >
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {project.projectName}
              </h3>
              <ContactListAccordion contacts={project.contactPersons} />
              <p className="text-sm text-slate-500">
                {project.billingMonth} · {project.totalHours.toFixed(2)} hours ·{" "}
                {formatUsd(project.cost)}
              </p>
            </div>
            <div className="table-wrap">
              <table className="table-base">
                <thead className="table-head">
                  <tr>
                    <th className="table-cell">Date</th>
                    {isDvdSites ? <th className="table-cell">Title</th> : null}
                    <th className="table-cell">Task Name</th>
                    <th className="table-cell">Task Description</th>
                    <th className="table-cell">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailPagination.page.items.map((row) => (
                    <tr key={row.id}>
                      <td className="table-cell whitespace-nowrap">
                        {row.date}
                      </td>
                      {isDvdSites ? (
                        <td className="table-cell text-sm text-slate-700">
                          {row.title}
                        </td>
                      ) : null}
                      <td className="table-cell font-medium text-slate-900">
                        {row.taskName}
                      </td>
                      <td className="table-cell">{row.taskDescription}</td>
                      <td className="table-cell">{row.hours.toFixed(2)}</td>
                    </tr>
                  ))}
                  {project.detailRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isDvdSites ? 5 : 4}
                        className="table-cell text-center text-sm text-slate-500"
                      >
                        No time entries found for this project/month.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <BillingHistoryPagination
              clientId={clientId}
              searchParams={searchParams}
              sectionKey={`${reportKey}-${project.projectId}`}
              pageData={detailPagination.page}
            />
          </section>
        );
      })}
    </div>
  );
}

function BillingHistoryMonthFilter({
  clientId,
  searchParams,
  paramName,
  value,
  label = "Billing Month",
}: {
  clientId: string;
  searchParams: BillingReportPageSearchParams;
  paramName: string;
  value: string;
  label?: string;
}) {
  const hiddenInputs = Object.entries(searchParams).flatMap(
    ([key, rawValue]) => {
      if (key === paramName || key.startsWith("billingHistoryPage_")) return [];
      const values = Array.isArray(rawValue)
        ? rawValue
        : rawValue
          ? [rawValue]
          : [];
      return values.map((entryValue) => ({ name: key, value: entryValue }));
    },
  );

  return (
    <NoScrollFilter
      action={`/billing-reports/${clientId}`}
      className="w-full sm:w-52"
      label={label}
      name={paramName}
      value={value}
      type="month"
      hiddenInputs={hiddenInputs}
    />
  );
}

function BillingHistoryYearFilter({
  clientId,
  searchParams,
  paramName,
  value,
  label = "Year",
}: {
  clientId: string;
  searchParams: BillingReportPageSearchParams;
  paramName: string;
  value: string;
  label?: string;
}) {
  const hiddenInputs = Object.entries(searchParams).flatMap(
    ([key, rawValue]) => {
      if (key === paramName || key.startsWith("billingHistoryPage_")) return [];
      const values = Array.isArray(rawValue)
        ? rawValue
        : rawValue
          ? [rawValue]
          : [];
      return values.map((entryValue) => ({ name: key, value: entryValue }));
    },
  );

  return (
    <NoScrollFilter
      action={`/billing-reports/${clientId}`}
      className="w-full sm:w-40"
      label={label}
      name={paramName}
      value={value}
      type="number"
      min="2000"
      max="2100"
      hiddenInputs={hiddenInputs}
    />
  );
}

function BillingHistoryFilters({
  clientId,
  activeReport,
  data,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: BillingHistoryData;
}) {
  return (
    <AutoSubmitFilterForm
      method="get"
      action={`/billing-reports/${clientId}`}
      className="card p-5"
    >
      <input type="hidden" name="report" value={activeReport} />
      <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
        <div>
          <label className="label" htmlFor="year">
            Year
          </label>
          <input
            id="year"
            name="year"
            type="number"
            min="2000"
            max="2100"
            className="input"
            defaultValue={data.filters.year}
          />
        </div>
        <p className="text-sm text-slate-500">
          Completed & Billed titles are shown for the selected billing year.
        </p>
      </div>
    </AutoSubmitFilterForm>
  );
}

function BillingHistoryCostCell({ value }: { value?: number }) {
  return (
    <span className="whitespace-nowrap">
      {typeof value === "number" ? formatUsd(value) : "-"}
    </span>
  );
}

function BillingHistoryTitleReportTable({
  data,
  clientId,
  activeReport,
  rows,
  includeAction,
}: {
  data: BillingHistoryData;
  clientId: string;
  activeReport: AmazonReportType;
  rows: BillingHistoryData["summaryRows"];
  includeAction: boolean;
}) {
  const returnTo = `/billing-reports/${clientId}?report=${activeReport}&year=${data.filters.year}`;
  const isTitleCountryMode = data.client.poAssignmentMode === "TITLE_COUNTRY";
  const reportColumns = rows[0]?.reportValues ?? [];
  const emptyColSpan =
    1 + Math.max(reportColumns.length, 1) * 2 + (includeAction ? 1 : 0);

  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell" rowSpan={2}>
              Title Name
            </th>
            {reportColumns.map((report) => (
              <th
                key={report.reportType}
                className="table-cell text-center"
                colSpan={2}
              >
                {report.reportTitle}
              </th>
            ))}
            {includeAction ? (
              <th className="table-cell" rowSpan={2}>
                Action
              </th>
            ) : null}
          </tr>
          <tr>
            {reportColumns.map((report) => (
              <Fragment key={report.reportType}>
                <th className="table-cell">Cost</th>
                <th className="table-cell">PO Number</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.itemId}>
              {!isTitleCountryMode || row.showTitleCell !== false ? (
                <td
                  className="table-cell font-medium text-slate-900"
                  rowSpan={isTitleCountryMode ? row.titleRowSpan : undefined}
                >
                  {row.itemName} ({row.titleStatus ?? row.status})
                </td>
              ) : null}
              {(row.reportValues ?? []).map((report) => (
                <Fragment key={`${row.itemId}-${report.reportType}`}>
                  <td className="table-cell">
                    <BillingHistoryCostCell value={report.cost} />
                  </td>
                  <td className="table-cell">{report.poNumber || "-"}</td>
                </Fragment>
              ))}
              {includeAction ? (
                <td className="table-cell">
                  {row.movieId && (!isTitleCountryMode || row.showTitleCell !== false) ? (
                    <BillingDoneButton
                      movieId={row.movieId}
                      label="Billing Done"
                      returnTo={returnTo}
                    />
                  ) : (
                    "-"
                  )}
                </td>
              ) : null}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={emptyColSpan}
                className="table-cell text-center text-sm text-slate-500"
              >
                No billing records available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function BillingHistoryProjectTable({
  data,
  clientId,
  activeReport,
  rows,
  includeAction,
  poAssignmentMode,
}: {
  data: BillingHistoryData;
  clientId: string;
  activeReport: AmazonReportType;
  rows: BillingHistoryData["summaryRows"];
  includeAction: boolean;
  poAssignmentMode?: string;
}) {
  const returnTo = `/billing-reports/${clientId}?report=${activeReport}&year=${data.filters.year}&projectMonth=${data.filters.projectMonth}`;
  const effectivePoAssignmentMode =
    poAssignmentMode ?? data.client.poAssignmentMode;
  const isTitleProject = effectivePoAssignmentMode === "TITLE_PROJECT";
  const isAmazonMonthlyRow = rows.some(
    (row) => row.billingReportType && row.movieId,
  );
  const hideBillingModel = clientId === FILMIK_CLIENT_ID || isAmazonMonthlyRow;
  const hasBillingMonth = rows.some((row) => row.billingMonth);
  const hasInvoiceNumber = rows.some((row) => row.invoiceNumber);
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">
              {isAmazonMonthlyRow
                ? "Title - Billing Report"
                : isTitleProject
                  ? "Project - Title (Project Status)"
                  : "Project (Project Status)"}
            </th>
            {isTitleProject ? (
              <th className="table-cell">Title Status</th>
            ) : null}
            {!isTitleProject && !hideBillingModel ? (
              <th className="table-cell">Billing Model</th>
            ) : null}
            <th className="table-cell">Cost</th>
            {hasBillingMonth ? (
              <th className="table-cell">Billing Month</th>
            ) : null}
            <th className="table-cell">PO Number</th>
            {hasInvoiceNumber ? (
              <th className="table-cell">Invoice Number</th>
            ) : null}
            {includeAction ? <th className="table-cell">Action</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.itemId}>
              <td className="table-cell font-medium text-slate-900">
                {row.itemName} (
                {isAmazonMonthlyRow
                  ? row.status
                  : (row.projectStatus ?? row.status)}
                )
              </td>
              {isTitleProject ? (
                <td className="table-cell">{row.titleStatus ?? "-"}</td>
              ) : null}
              {!isTitleProject && !hideBillingModel ? (
                <td className="table-cell">{row.billingModel ?? "-"}</td>
              ) : null}
              <td className="table-cell">
                <BillingHistoryCostCell value={row.cost} />
              </td>
              {hasBillingMonth ? (
                <td className="table-cell">{row.billingMonth ?? "-"}</td>
              ) : null}
              <td className="table-cell">{row.poNumber || "-"}</td>
              {hasInvoiceNumber ? (
                <td className="table-cell">{row.invoiceNumber ?? "-"}</td>
              ) : null}
              {includeAction ? (
                <td className="table-cell">
                  {row.billingReportType && row.movieId && row.billingMonth ? (
                    <AmazonMonthlyBillingDoneButton
                      movieId={row.movieId}
                      billingMonth={row.billingMonth}
                      socialAssetsCost={row.socialAssetsCost}
                      localizationCost={row.localizationCost}
                      totalCost={row.totalCost ?? row.cost}
                      returnTo={returnTo}
                    />
                  ) : row.projectId ? (
                    <ProjectBillingDoneButton
                      projectId={row.projectId}
                      label="Billing Done"
                      returnTo={returnTo}
                      billingMonth={row.billingMonth}
                      amount={row.cost}
                    />
                  ) : (
                    "-"
                  )}
                </td>
              ) : null}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={
                  3 +
                  (isTitleProject || !hideBillingModel ? 1 : 0) +
                  (hasBillingMonth ? 1 : 0) +
                  (hasInvoiceNumber ? 1 : 0) +
                  (includeAction ? 1 : 0)
                }
                className="table-cell text-center text-sm text-slate-500"
              >
                No billing records available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function BillingHistoryDefaultTable({
  data,
  clientId,
  activeReport,
  rows,
  includeAction,
  poAssignmentMode,
}: {
  data: BillingHistoryData;
  clientId: string;
  activeReport: AmazonReportType;
  rows: BillingHistoryData["summaryRows"];
  includeAction: boolean;
  poAssignmentMode?: string;
}) {
  const returnTo = `/billing-reports/${clientId}?report=${activeReport}&year=${data.filters.year}&projectMonth=${data.filters.projectMonth}`;
  const effectivePoAssignmentMode =
    poAssignmentMode ?? data.client.poAssignmentMode;
  const isAmazonTitleClosure = clientId === "cmnh294gs0000l504iifuarli";
  const isTitleCountryMode = effectivePoAssignmentMode === "TITLE_COUNTRY";
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">
              {effectivePoAssignmentMode === "BILLING_REPORT"
                ? "Billing Report"
                : "Title"}
            </th>
            <th className="table-cell">Type / Billing Region</th>
            {isTitleCountryMode ? (
              <th className="table-cell">Country/Countries</th>
            ) : null}
            <th className="table-cell">PO Number</th>
            {includeAction ? (
              <th className="table-cell">Status</th>
            ) : (
              <th className="table-cell">Billing Date</th>
            )}
            {includeAction ? <th className="table-cell">Action</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.itemId}>
              {!isTitleCountryMode || row.showTitleCell !== false ? (
                <td
                  className="table-cell font-medium text-slate-900"
                  rowSpan={isTitleCountryMode ? row.titleRowSpan : undefined}
                >
                  {row.itemName}
                </td>
              ) : null}
              <td className="table-cell">{row.billingRegion}</td>
              {isTitleCountryMode ? (
                <td className="table-cell">{row.countryLabel ?? "-"}</td>
              ) : null}
              <td className="table-cell">{row.poNumber || "-"}</td>
              <td className="table-cell">
                {includeAction ? row.status : row.billingDate}
              </td>
              {includeAction ? (
                <td className="table-cell">
                  {(row.itemType === "TITLE" || row.itemType === "TITLE_COUNTRY") && row.movieId && row.showTitleCell !== false ? (
                    <BillingDoneButton
                      movieId={row.movieId}
                      label={
                        isAmazonTitleClosure
                          ? "Close Title / PO"
                          : "Billing Done"
                      }
                      returnTo={returnTo}
                    />
                  ) : row.itemType === "PROJECT" && row.projectId ? (
                    <ProjectBillingDoneButton
                      projectId={row.projectId}
                      label="Billing Done"
                      returnTo={returnTo}
                      billingMonth={row.billingMonth}
                      amount={row.cost}
                    />
                  ) : (
                    "-"
                  )}
                </td>
              ) : null}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={(includeAction ? 5 : 4) + (isTitleCountryMode ? 1 : 0)}
                className="table-cell text-center text-sm text-slate-500"
              >
                No billing records available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AmazonMonthlyBillingSummaryTable({
  data,
  clientId,
  activeReport,
  rows,
  includeAction,
}: {
  data: BillingHistoryData;
  clientId: string;
  activeReport: AmazonReportType;
  rows: BillingHistoryData["summaryRows"];
  includeAction: boolean;
}) {
  const returnTo = `/billing-reports/${clientId}?report=${activeReport}&projectMonth=${data.filters.projectMonth}&amazonHistoryMonth=${data.filters.amazonHistoryMonth}&closedTitlesYear=${data.filters.closedTitlesYear}`;
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Title</th>
            <th className="table-cell">Billing Month</th>
            <th className="table-cell">PO Number</th>
            <th className="table-cell">Social Assets Cost</th>
            <th className="table-cell">Localization Cost</th>
            <th className="table-cell">Total Cost</th>
            {includeAction ? <th className="table-cell">Action</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.itemId}>
              <td className="table-cell font-medium text-slate-900">
                {row.titleName ?? row.itemName}
              </td>
              <td className="table-cell">{row.billingMonth ?? "-"}</td>
              <td className="table-cell">{row.poNumber || "-"}</td>
              <td className="table-cell">
                <BillingHistoryCostCell value={row.socialAssetsCost} />
              </td>
              <td className="table-cell">
                <BillingHistoryCostCell value={row.localizationCost} />
              </td>
              <td className="table-cell font-semibold text-slate-900">
                <BillingHistoryCostCell value={row.totalCost ?? row.cost} />
              </td>
              {includeAction ? (
                <td className="table-cell">
                  {row.movieId && row.billingMonth ? (
                    <AmazonMonthlyBillingDoneButton
                      movieId={row.movieId}
                      billingMonth={row.billingMonth}
                      socialAssetsCost={row.socialAssetsCost}
                      localizationCost={row.localizationCost}
                      totalCost={row.totalCost ?? row.cost}
                      returnTo={returnTo}
                    />
                  ) : (
                    "-"
                  )}
                </td>
              ) : null}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={includeAction ? 7 : 6}
                className="table-cell text-center text-sm text-slate-500"
              >
                No monthly billing records available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AmazonMonthlyBillingHistoryTable({
  rows,
}: {
  rows: BillingHistoryData["summaryRows"];
}) {
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Title</th>
            <th className="table-cell">PO Number</th>
            <th className="table-cell">Social Assets Cost</th>
            <th className="table-cell">Localization Cost</th>
            <th className="table-cell">Total Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.itemId}>
              <td className="table-cell font-medium text-slate-900">
                {row.titleName ?? row.itemName}
              </td>
              <td className="table-cell">{row.poNumber || "-"}</td>
              <td className="table-cell">
                <BillingHistoryCostCell value={row.socialAssetsCost} />
              </td>
              <td className="table-cell">
                <BillingHistoryCostCell value={row.localizationCost} />
              </td>
              <td className="table-cell font-semibold text-slate-900">
                <BillingHistoryCostCell value={row.totalCost ?? row.cost} />
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="table-cell text-center text-sm text-slate-500"
              >
                No monthly billing history found for this month.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AmazonTitleClosureTable({
  data,
  clientId,
  activeReport,
  rows,
  includeAction,
}: {
  data: BillingHistoryData;
  clientId: string;
  activeReport: AmazonReportType;
  rows: BillingHistoryData["summaryRows"];
  includeAction: boolean;
}) {
  const returnTo = `/billing-reports/${clientId}?report=${activeReport}&projectMonth=${data.filters.projectMonth}&amazonHistoryMonth=${data.filters.amazonHistoryMonth}&closedTitlesYear=${data.filters.closedTitlesYear}`;
  return (
    <AmazonTitleClosureTableClient
      rows={rows}
      includeAction={includeAction}
      returnTo={returnTo}
      action={completeAmazonTitleClosureAction}
    />
  );
}

function BillingHistorySectionTable({
  data,
  clientId,
  activeReport,
  rows,
  includeAction,
  poAssignmentMode,
  sectionKey,
}: {
  data: BillingHistoryData;
  clientId: string;
  activeReport: AmazonReportType;
  rows: BillingHistoryData["summaryRows"];
  includeAction: boolean;
  poAssignmentMode: string;
  sectionKey?: string;
}) {
  if (clientId === "cmnh294gs0000l504iifuarli") {
    if (sectionKey === "amazon-monthly-billing") {
      return (
        <AmazonMonthlyBillingSummaryTable
          data={data}
          clientId={clientId}
          activeReport={activeReport}
          rows={rows}
          includeAction={includeAction}
        />
      );
    }
    if (sectionKey === "amazon-monthly-billing-history") {
      return <AmazonMonthlyBillingHistoryTable rows={rows} />;
    }
    if (
      sectionKey === "amazon-title-closure" ||
      sectionKey === "amazon-closed-titles"
    ) {
      return (
        <AmazonTitleClosureTable
          data={data}
          clientId={clientId}
          activeReport={activeReport}
          rows={rows}
          includeAction={includeAction}
        />
      );
    }
  }
  if (poAssignmentMode === "TITLE_BILLING_REPORT") {
    return (
      <BillingHistoryTitleReportTable
        data={data}
        clientId={clientId}
        activeReport={activeReport}
        rows={rows}
        includeAction={includeAction}
      />
    );
  }

  if (poAssignmentMode === "TITLE_PROJECT" || poAssignmentMode === "PROJECT") {
    return (
      <BillingHistoryProjectTable
        data={data}
        clientId={clientId}
        activeReport={activeReport}
        rows={rows}
        includeAction={includeAction}
        poAssignmentMode={poAssignmentMode}
      />
    );
  }

  return (
    <BillingHistoryDefaultTable
      data={data}
      clientId={clientId}
      activeReport={activeReport}
      rows={rows}
      includeAction={includeAction}
      poAssignmentMode={poAssignmentMode}
    />
  );
}

/* function BillingHistorySummaryTable({
  data,
  clientId,
  activeReport,
}: {
  data: BillingHistoryData;
  clientId: string;
  activeReport: AmazonReportType;
}) {
  if (data.client.poAssignmentMode === "TITLE_BILLING_REPORT") {
    return (
      <BillingHistoryTitleReportTable
        data={data}
        clientId={clientId}
        activeReport={activeReport}
        rows={data.summaryRows}
        includeAction
      />
    );
  }
  if (
    data.client.poAssignmentMode === "TITLE_PROJECT" ||
    data.client.poAssignmentMode === "PROJECT"
  ) {
    return (
      <BillingHistoryProjectTable
        data={data}
        clientId={clientId}
        activeReport={activeReport}
        rows={data.summaryRows}
        includeAction
      />
    );
  }
  return (
    <BillingHistoryDefaultTable
      data={data}
      clientId={clientId}
      activeReport={activeReport}
      rows={data.summaryRows}
      includeAction
    />
  );
}

function BillingHistoryTable({
  data,
  clientId,
  activeReport,
}: {
  data: BillingHistoryData;
  clientId: string;
  activeReport: AmazonReportType;
}) {
  if (data.client.poAssignmentMode === "TITLE_BILLING_REPORT") {
    return (
      <BillingHistoryTitleReportTable
        data={data}
        clientId={clientId}
        activeReport={activeReport}
        rows={data.historyRows}
        includeAction={false}
      />
    );
  }
  if (
    data.client.poAssignmentMode === "TITLE_PROJECT" ||
    data.client.poAssignmentMode === "PROJECT"
  ) {
    return (
      <BillingHistoryProjectTable
        data={data}
        clientId={clientId}
        activeReport={activeReport}
        rows={data.historyRows}
        includeAction={false}
      />
    );
  }
  return (
    <BillingHistoryDefaultTable
      data={data}
      clientId={clientId}
      activeReport={activeReport}
      rows={data.historyRows}
      includeAction={false}
    />
  );
} */

function BillingHistoryWorkspace({
  clientId,
  activeReport,
  clientName,
  data,
  searchParams,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  clientName: string;
  data: BillingHistoryData;
  searchParams: BillingReportPageSearchParams;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs
        clientId={clientId}
        activeReport={activeReport}
        clientName={clientName}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {clientId === "cmnh294gs0000l504iifuarli" ? null : (
          <BillingHistoryFilters
            clientId={clientId}
            activeReport={activeReport}
            data={data}
          />
        )}
        <ExportButtons
          clientId={clientId}
          reportType={activeReport}
          filters={{
            year: data.filters.year,
            projectMonth: data.filters.projectMonth,
            portalsMonth: data.filters.portalsMonth,
            dvdMonth: data.filters.dvdMonth,
            newsletterMonth: data.filters.newsletterMonth,
            amazonHistoryMonth: data.filters.amazonHistoryMonth,
            closedTitlesYear: data.filters.closedTitlesYear,
          }}
        />
      </div>
      {data.summarySections?.length
        ? data.summarySections.map((section, index) => {
            const pagination = getPaginatedBillingHistoryRows(
              section.rows,
              searchParams,
              `summary-${section.key}`,
            );
            return (
              <section
                key={section.key}
                id={normalizePaginationKey(`summary-${section.key}`)}
                className="space-y-3 scroll-mt-24"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="section-title">{section.title}</h2>
                    <p className="section-subtitle">
                      {index === 0
                        ? "Pending billing records as per the billing section PO Assignment Mode."
                        : "Pending records for this billing section."}
                    </p>
                  </div>
                  {section.monthFilterParam && section.monthFilterValue ? (
                    <BillingHistoryMonthFilter
                      clientId={clientId}
                      searchParams={searchParams}
                      paramName={section.monthFilterParam}
                      value={section.monthFilterValue}
                      label={section.monthFilterLabel ?? "Billing Month"}
                    />
                  ) : null}
                </div>
                <BillingHistorySectionTable
                  data={data}
                  clientId={clientId}
                  activeReport={activeReport}
                  rows={pagination.page.items}
                  includeAction
                  poAssignmentMode={section.poAssignmentMode}
                  sectionKey={section.key}
                />
                <BillingHistoryPagination
                  clientId={clientId}
                  searchParams={searchParams}
                  sectionKey={`summary-${section.key}`}
                  pageData={pagination.page}
                />
              </section>
            );
          })
        : (() => {
            const pagination = getPaginatedBillingHistoryRows(
              data.summaryRows,
              searchParams,
              "billing-summary",
            );
            return (
              <section id="billing_summary" className="space-y-3 scroll-mt-24">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="section-title">Billing Summary</h2>
                    <p className="section-subtitle">
                      Pending billing records as per the client PO Assignment
                      Mode.
                    </p>
                  </div>
                  {data.client.poAssignmentMode === "PROJECT" ||
                  clientId === FILMIK_CLIENT_ID ? (
                    <BillingHistoryMonthFilter
                      clientId={clientId}
                      searchParams={searchParams}
                      paramName="projectMonth"
                      value={data.filters.projectMonth}
                    />
                  ) : null}
                </div>
                <BillingHistorySectionTable
                  data={data}
                  clientId={clientId}
                  activeReport={activeReport}
                  rows={pagination.page.items}
                  includeAction
                  poAssignmentMode={data.client.poAssignmentMode}
                />
                <BillingHistoryPagination
                  clientId={clientId}
                  searchParams={searchParams}
                  sectionKey="billing-summary"
                  pageData={pagination.page}
                />
              </section>
            );
          })()}
      {data.historySections?.length
        ? data.historySections.map((section) => {
            const pagination = getPaginatedBillingHistoryRows(
              section.rows,
              searchParams,
              `history-${section.key}`,
            );
            return (
              <section
                key={section.key}
                id={normalizePaginationKey(`history-${section.key}`)}
                className="space-y-3 scroll-mt-24"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="section-title">{section.title}</h2>
                    <p className="section-subtitle">
                      {section.monthFilterValue
                        ? `Month: ${section.monthFilterValue}`
                        : section.yearFilterValue
                          ? `Year: ${section.yearFilterValue}`
                          : `Year: ${data.filters.year}`}
                    </p>
                  </div>
                  {section.monthFilterParam && section.monthFilterValue ? (
                    <BillingHistoryMonthFilter
                      clientId={clientId}
                      searchParams={searchParams}
                      paramName={section.monthFilterParam}
                      value={section.monthFilterValue}
                      label={section.monthFilterLabel ?? "Billing Month"}
                    />
                  ) : section.yearFilterParam && section.yearFilterValue ? (
                    <BillingHistoryYearFilter
                      clientId={clientId}
                      searchParams={searchParams}
                      paramName={section.yearFilterParam}
                      value={section.yearFilterValue}
                      label={section.yearFilterLabel ?? "Year"}
                    />
                  ) : null}
                </div>
                <BillingHistorySectionTable
                  data={data}
                  clientId={clientId}
                  activeReport={activeReport}
                  rows={pagination.page.items}
                  includeAction={false}
                  poAssignmentMode={section.poAssignmentMode}
                  sectionKey={section.key}
                />
                <BillingHistoryPagination
                  clientId={clientId}
                  searchParams={searchParams}
                  sectionKey={`history-${section.key}`}
                  pageData={pagination.page}
                />
              </section>
            );
          })
        : (() => {
            const pagination = getPaginatedBillingHistoryRows(
              data.historyRows,
              searchParams,
              "billing-history",
            );
            return (
              <section id="billing_history" className="space-y-3 scroll-mt-24">
                <div>
                  <h2 className="section-title">
                    {data.client.name} Billing Summary & History
                  </h2>
                  <p className="section-subtitle">Year: {data.filters.year}</p>
                </div>
                <BillingHistorySectionTable
                  data={data}
                  clientId={clientId}
                  activeReport={activeReport}
                  rows={pagination.page.items}
                  includeAction={false}
                  poAssignmentMode={data.client.poAssignmentMode}
                />
                <BillingHistoryPagination
                  clientId={clientId}
                  searchParams={searchParams}
                  sectionKey="billing-history"
                  pageData={pagination.page}
                />
              </section>
            );
          })()}
    </div>
  );
}

function RoyalReportTabs({
  clientId,
  activeReport,
}: {
  clientId: string;
  activeReport: AmazonReportType;
}) {
  const tabs: Array<[AmazonReportType, string]> = [
    ["social-assets", "Billing"],
    ["billing-summary", "Summary"],
    ["billing-history", "History"],
  ];
  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-3">
        {tabs.map(([reportType, label]) => (
          <ReportTab
            key={reportType}
            clientId={clientId}
            reportType={reportType}
            activeReport={activeReport}
            label={label}
          />
        ))}
      </div>
    </div>
  );
}

function RoyalHistoryFilters({
  clientId,
  data,
}: {
  clientId: string;
  data: RoyalHistoryData;
}) {
  return (
    <AutoSubmitFilterForm
      method="get"
      action={`/billing-reports/${clientId}`}
      className="card p-5"
    >
      <input type="hidden" name="report" value="billing-history" />
      <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
        <div>
          <label className="label" htmlFor="year">
            Year
          </label>
          <input
            id="year"
            name="year"
            type="number"
            min="2000"
            max="2100"
            className="input"
            defaultValue={data.filters.year}
          />
        </div>
        <p className="text-sm text-slate-500">
          Billed Royal Caribbean months are shown for the selected year.
        </p>
      </div>
    </AutoSubmitFilterForm>
  );
}

function RoyalHistoryWorkspace({
  clientId,
  data,
  searchParams,
}: {
  clientId: string;
  data: RoyalHistoryData;
  searchParams: BillingReportPageSearchParams;
}) {
  return (
    <div className="space-y-6">
      <RoyalReportTabs clientId={clientId} activeReport="billing-history" />
      <RoyalHistoryFilters clientId={clientId} data={data} />
      <div>
        <h2 className="section-title">
          {data.client.name} Billing Summary & History
        </h2>
        <p className="section-subtitle">Year: {data.filters.year}</p>
      </div>
      {data.monthBlocks.map((block) => {
        const pagination = getPaginatedBillingHistoryRows(
          block.rows,
          searchParams,
          `royal-history-${block.month}`,
        );
        return (
          <section
            key={block.month}
            id={normalizePaginationKey(`royal-history-${block.month}`)}
            className="space-y-4 scroll-mt-24"
          >
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Month: {block.month}
              </h3>
              <p className="text-sm text-slate-500">
                Billing date: {block.billingDate}
              </p>
            </div>
            <RoyalBillingReportTable
              data={{
                client: data.client,
                filters: { month: block.month },
                rows: pagination.page.items,
                totals: block.totals,
                isBilled: true,
                billingDate: block.billingDate,
              }}
            />
            <BillingHistoryPagination
              clientId={clientId}
              searchParams={searchParams}
              sectionKey={`royal-history-${block.month}`}
              pageData={pagination.page}
            />
          </section>
        );
      })}
      {data.monthBlocks.length === 0 ? (
        <div className="card p-6 text-sm text-slate-500">
          No billed months found for this year.
        </div>
      ) : null}
    </div>
  );
}

function RoyalBillingReportFilters({
  clientId,
  data,
  activeReport,
}: {
  clientId: string;
  data: RoyalBillingData;
  activeReport: AmazonReportType;
}) {
  return (
    <AutoSubmitFilterForm
      method="get"
      action={`/billing-reports/${clientId}`}
      className="card p-5"
    >
      <input type="hidden" name="report" value={activeReport} />
      <div className="grid gap-4 md:grid-cols-[220px_auto_1fr] md:items-end">
        <div>
          <label className="label" htmlFor="month">
            Month
          </label>
          <input
            id="month"
            name="month"
            type="month"
            className="input"
            defaultValue={data.filters.month}
          />
        </div>
        <p className="text-sm text-slate-500 md:text-right">
          Fixed monthly excess hours are calculated for the selected month.
        </p>
      </div>
    </AutoSubmitFilterForm>
  );
}

function RoyalExportButtons({
  clientId,
  data,
}: {
  clientId: string;
  data: RoyalBillingData;
}) {
  const query = buildQueryString({
    report: "social-assets",
    month: data.filters.month,
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

function RoyalBillingReportTable({
  data,
  includePoNumber = true,
}: {
  data: RoyalBillingData;
  includePoNumber?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Billing Header / Project</th>
            <th className="table-cell">Cost Type</th>
            <th className="table-cell">Project Hours</th>
            <th className="table-cell">Fixed Monthly Hours</th>
            <th className="table-cell">Additional Hours</th>
            <th className="table-cell">Project Cost</th>
            <th className="table-cell">Excess Hours</th>
            <th className="table-cell">Excess Cost</th>
            <th className="table-cell">Total Cost</th>
            {includePoNumber ? <th className="table-cell">PO Number</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.rows.map((row) => (
            <tr key={row.projectId}>
              <td className="table-cell">
                <div className="font-medium text-slate-900">
                  {row.projectName}
                </div>
                <ContactListAccordion contacts={row.contactPerson} />
              </td>
              <td className="table-cell">
                <span className="badge-blue">{row.billingModel}</span>
              </td>
              <td className="table-cell font-medium text-slate-900">
                {row.projectHours.toFixed(2)}
              </td>
              <td className="table-cell">
                {row.fixedMonthlyHours == null
                  ? "-"
                  : row.fixedMonthlyHours.toFixed(2)}
              </td>
              <td className="table-cell">
                {row.additionalHours == null
                  ? "-"
                  : row.additionalHours.toFixed(2)}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {row.projectCost == null
                  ? "-"
                  : formatRoyalUsd(row.projectCost)}
              </td>
              <td className="table-cell">
                {row.excessHours > 0 ? row.excessHours.toFixed(2) : "-"}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {row.excessHours > 0 ? formatRoyalUsd(row.excessCost) : "-"}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatRoyalUsd(row.totalCost)}
              </td>
              {includePoNumber ? (
                <td className="table-cell">{row.poNumber || "-"}</td>
              ) : null}
            </tr>
          ))}
          <tr className="bg-slate-50">
            <td className="table-cell font-semibold text-slate-900" colSpan={5}>
              Total
            </td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
              {formatRoyalUsd(data.totals.projectCost)}
            </td>
            <td className="table-cell font-semibold text-slate-900">
              {data.totals.excessHours.toFixed(2)}
            </td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
              {formatRoyalUsd(data.totals.excessCost)}
            </td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
              {formatRoyalUsd(data.totals.totalCost)}
            </td>
            {includePoNumber ? <td className="table-cell">-</td> : null}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RoyalBillingSummaryTable({ data }: { data: RoyalBillingData }) {
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Billing Header / Project</th>
            <th className="table-cell">Project Hours</th>
            <th className="table-cell">Total Cost</th>
            <th className="table-cell">PO Number</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.rows.map((row) => (
            <tr key={row.projectId}>
              <td className="table-cell">
                <div className="font-medium text-slate-900">
                  {row.projectName}
                </div>
                <ContactListAccordion contacts={row.contactPerson} />
              </td>
              <td className="table-cell font-medium text-slate-900">
                {row.projectHours.toFixed(2)}
              </td>
              <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                {formatRoyalUsd(row.totalCost)}
              </td>
              <td className="table-cell">{row.poNumber || "-"}</td>
            </tr>
          ))}
          <tr className="bg-slate-50">
            <td className="table-cell font-semibold text-slate-900">Total</td>
            <td className="table-cell font-semibold text-slate-900">
              {data.rows
                .reduce((total, row) => total + row.projectHours, 0)
                .toFixed(2)}
            </td>
            <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
              {formatRoyalUsd(data.totals.totalCost)}
            </td>
            <td className="table-cell">-</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RoyalBillingReportWorkspace({
  clientId,
  activeReport,
  data,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: RoyalBillingData;
}) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedOlderMonth = data.filters.month < currentMonth;
  const returnTo = `/billing-reports/${clientId}?report=social-assets&month=${data.filters.month}`;
  return (
    <div className="space-y-6">
      <RoyalReportTabs clientId={clientId} activeReport={activeReport} />
      <RoyalBillingReportFilters
        clientId={clientId}
        data={data}
        activeReport={activeReport}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">
            {data.client.name}{" "}
            {activeReport === "billing-summary" ? "Summary" : "Billing"}
          </h2>
          <p className="section-subtitle">Month: {data.filters.month}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeReport === "social-assets" ? (
            <RoyalExportButtons clientId={clientId} data={data} />
          ) : null}
          {activeReport === "social-assets" &&
          selectedOlderMonth &&
          !data.isBilled ? (
            <MonthBillingDoneButton
              clientId={clientId}
              month={data.filters.month}
              returnTo={returnTo}
            />
          ) : null}
        </div>
      </div>
      {activeReport === "billing-summary" ? (
        <RoyalBillingSummaryTable data={data} />
      ) : data.isBilled ? (
        <div className="card p-6 text-sm text-slate-600">
          This month has already been billed
          {data.billingDate ? ` on ${data.billingDate}` : ""}; please find
          details in Billing Summary & History report.
        </div>
      ) : (
        <RoyalBillingReportTable data={data} includePoNumber={false} />
      )}
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
    <AutoSubmitFilterForm
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
              options={[
                ...(data.movieOptions.length > 1
                  ? [{ value: "all", label: "All Titles" }]
                  : []),
                ...data.movieOptions.map((movie) => ({
                  value: movie.id,
                  label: movie.title,
                })),
              ]}
              disabled={data.movieOptions.length <= 1}
              placeholder={
                data.movieOptions.length > 1 ? "All Titles" : "Select title"
              }
              searchPlaceholder="Search titles..."
              emptyLabel="No titles found."
            />
          </div>
        ) : null}
        {!data.movieSpecific ? (
          <p className="text-sm text-slate-500 md:text-right">
            Date range is used for Hourly project costs.
          </p>
        ) : null}
      </div>
      {data.movieSpecific ? (
        <p className="mt-3 text-sm text-slate-500">
          Date range is used only for Hourly project costs. Leave both dates
          blank to calculate from all available records.
        </p>
      ) : null}
    </AutoSubmitFilterForm>
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
  showTotalHoursColumn = false,
}: {
  block: GenericBillingReportBlock;
  showTotalHoursColumn?: boolean;
}) {
  // const isCountryBlock = block.key === "fixedPerCountry";
  const showTotalHours =
    showTotalHoursColumn &&
    block.rows.some((row) => row.totalHours !== undefined);
  const totalDeveloperCost = block.rows.reduce(
    (sum, row) => sum + Number(row.developerCost ?? 0),
    0,
  );
  const totalProjectCost = block.rows.reduce(
    (sum, row) => sum + row.projectCost,
    0,
  );
  const totalCost = block.rows.reduce((sum, row) => sum + row.cost, 0);
  let totalLabelColSpan = 2;
  if (block.showDeveloperCost) totalLabelColSpan += 2;

  return (
    <section className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Project</th>
            <th className="table-cell">Status</th>
            {showTotalHours ? (
              <th className="table-cell">Total Hours</th>
            ) : null}
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
                <div>{row.projectName}</div>
                <ContactListAccordion contacts={row.contactPerson} />
                {row.lensDetails?.length ? (
                  <div className="mt-1 space-y-1 text-xs font-normal text-slate-500">
                    <div className="font-medium text-slate-600">
                      Lens Type / Countries
                    </div>
                    {row.lensDetails.map((detail) => (
                      <div key={detail}>{detail}</div>
                    ))}
                  </div>
                ) : (
                  row.countryList && (
                    <div className="mt-1 space-y-1 text-xs font-normal text-slate-500">
                      <div className="font-medium text-slate-600">
                        Countries
                      </div>
                      {row.countryList || "-"}
                    </div>
                  )
                )}
              </td>
              <td className="table-cell">
                <div className="badge-blue">{row.status}</div>
              </td>
              {showTotalHours ? (
                <td className="table-cell whitespace-nowrap">
                  {Number(row.totalHours ?? 0).toFixed(2)}
                </td>
              ) : null}
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
            {showTotalHours ? (
              <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
                {block.rows
                  .reduce((sum, row) => sum + Number(row.totalHours ?? 0), 0)
                  .toFixed(2)}
              </td>
            ) : null}
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

function GenericTitleMergedBlock({
  titleBlock,
  showTotalHoursColumn = false,
}: {
  titleBlock: NonNullable<GenericBillingReportData["titleBlocks"]>[number];
  showTotalHoursColumn?: boolean;
}) {
  const rows = titleBlock.blocks.flatMap((block) =>
    block.rows.map((row) => ({ ...row, billingModel: block.title })),
  );
  const showTotalHours =
    showTotalHoursColumn && rows.some((row) => row.totalHours !== undefined);
  const showDeveloperCost = rows.some((row) => row.developerCost !== undefined);
  const totalHours = rows.reduce(
    (sum, row) => sum + Number(row.totalHours ?? 0),
    0,
  );
  const totalDeveloperCost = rows.reduce(
    (sum, row) => sum + Number(row.developerCost ?? 0),
    0,
  );
  const totalProjectCost = rows.reduce((sum, row) => sum + row.projectCost, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {titleBlock.movie.title}
            </h3>
            <ContactListAccordion
              contacts={titleBlock.contactPersons ?? titleBlock.contactPerson}
            />
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            Total: {formatGenericUsd(titleBlock.totalCost)}
          </span>
        </div>
      </div>
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Project</th>
            <th className="table-cell">Billing Model</th>
            <th className="table-cell">Status</th>
            {showTotalHours ? (
              <th className="table-cell">Total Hours</th>
            ) : null}
            {showDeveloperCost ? (
              <th className="table-cell">Developer Cost</th>
            ) : null}
            {showDeveloperCost ? (
              <th className="table-cell">Project Cost</th>
            ) : null}
            <th className="table-cell">
              {showDeveloperCost ? "Total Cost" : "Cost"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={`${row.projectId}-${row.billingModel}`}>
              <td className="table-cell font-medium text-slate-900">
                <div>{row.projectName}</div>
                <ContactListAccordion contacts={row.contactPerson} />
                {row.lensDetails?.length ? (
                  <div className="mt-1 space-y-1 text-xs font-normal text-slate-500">
                    <div className="font-medium text-slate-600">
                      Lens Type / Countries
                    </div>
                    {row.lensDetails.map((detail) => (
                      <div key={detail}>{detail}</div>
                    ))}
                  </div>
                ) : row.countryList ? (
                  <div className="mt-1 space-y-1 text-xs font-normal text-slate-500">
                    <div className="font-medium text-slate-600">Countries</div>
                    {row.countryList}
                  </div>
                ) : null}
              </td>
              <td className="table-cell">{row.billingModel}</td>
              <td className="table-cell">
                <div className="badge-blue">{row.status}</div>
              </td>
              {showTotalHours ? (
                <td className="table-cell whitespace-nowrap">
                  {Number(row.totalHours ?? 0).toFixed(2)}
                </td>
              ) : null}
              {showDeveloperCost ? (
                <td className="table-cell whitespace-nowrap font-medium text-slate-900">
                  {row.developerCost !== undefined
                    ? formatGenericUsd(Number(row.developerCost ?? 0))
                    : "-"}
                </td>
              ) : null}
              {showDeveloperCost ? (
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
            <td className="table-cell font-semibold text-slate-900" colSpan={3}>
              Total
            </td>
            {showTotalHours ? (
              <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
                {totalHours.toFixed(2)}
              </td>
            ) : null}
            {showDeveloperCost ? (
              <td className="table-cell whitespace-nowrap font-semibold text-slate-900">
                {formatGenericUsd(totalDeveloperCost)}
              </td>
            ) : null}
            {showDeveloperCost ? (
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

function GenericSummaryHistoryTable({
  data,
  clientId,
  rows,
  includeAction,
}: {
  data: GenericBillingSummaryHistoryData;
  clientId: string;
  rows: GenericBillingSummaryHistoryData["summaryRows"];
  includeAction: boolean;
}) {
  const isProjectMode = data.client.poAssignmentMode === "PROJECT";
  const isTitleProjectMode = data.client.poAssignmentMode === "TITLE_PROJECT";
  const isSonyPicturesClassics = clientId === SONY_PICTURES_CLASSICS_CLIENT_ID;
  const isTitleCountryMode = data.client.poAssignmentMode === "TITLE_COUNTRY";
  const hasBillingMonth = rows.some((row) => row.billingMonth);
  const returnTo = `/billing-reports/${clientId}?report=billing-summary-history&year=${data.filters.year}`;

  if (isProjectMode || isTitleProjectMode) {
    return (
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">
              {isTitleProjectMode
                ? "Project - Title (Project Status)"
                : "Project (Project Status)"}
            </th>
            {isTitleProjectMode ? (
              <th className="table-cell">Title Status</th>
            ) : null}
            {isProjectMode ? (
              <th className="table-cell">Billing Model</th>
            ) : null}
            <th className="table-cell">Cost</th>
            {hasBillingMonth ? (
              <th className="table-cell">Billing Month</th>
            ) : null}
            <th className="table-cell">PO Number</th>
            {includeAction ? <th className="table-cell">Action</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.itemId}>
              <td className="table-cell font-medium text-slate-900">
                {row.title} ({row.projectStatus ?? row.status})
              </td>
              {isTitleProjectMode ? (
                <td className="table-cell">{row.titleStatus ?? "-"}</td>
              ) : null}
              {isProjectMode ? (
                <td className="table-cell">{row.billingModel ?? "-"}</td>
              ) : null}
              <td className="table-cell">
                {typeof row.cost === "number"
                  ? formatGenericUsd(row.cost)
                  : "-"}
              </td>
              {hasBillingMonth ? (
                <td className="table-cell">{row.billingMonth ?? "-"}</td>
              ) : null}
              <td className="table-cell">{row.poNumber ?? "-"}</td>
              {includeAction ? (
                <td className="table-cell">
                  {row.projectId ? (
                    <ProjectBillingDoneButton
                      projectId={row.projectId}
                      label="Billing Done"
                      returnTo={returnTo}
                      billingMonth={row.billingMonth}
                      amount={row.cost}
                    />
                  ) : (
                    "-"
                  )}
                </td>
              ) : null}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={
                  3 +
                  (isTitleProjectMode ? 1 : isProjectMode ? 1 : 0) +
                  (hasBillingMonth ? 1 : 0) +
                  (includeAction ? 1 : 0)
                }
                className="table-cell text-center text-sm text-slate-500"
              >
                No billing records available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    );
  }

  return (
    <table className="table-base">
      <thead className="table-head">
        <tr>
          <th className="table-cell">Title</th>
          {!isSonyPicturesClassics ? (
            <th className="table-cell">Billing Region</th>
          ) : null}
          {isTitleCountryMode ? (
            <th className="table-cell">Country/Countries</th>
          ) : null}
          <th className="table-cell">Cost</th>
          <th className="table-cell">PO Number</th>
          {includeAction ? (
            <th className="table-cell">Status</th>
          ) : (
            <th className="table-cell">Billing Date</th>
          )}
          {includeAction ? <th className="table-cell">Action</th> : null}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.itemId}>
            {!isTitleCountryMode || row.showTitleCell !== false ? (
              <td
                className="table-cell font-medium text-slate-900"
                rowSpan={isTitleCountryMode ? row.titleRowSpan : undefined}
              >
                {row.title}
              </td>
            ) : null}
            {!isSonyPicturesClassics ? (
              <td className="table-cell">{row.billingRegions}</td>
            ) : null}
            {isTitleCountryMode ? (
              <td className="table-cell">{row.countryLabel ?? "-"}</td>
            ) : null}
            <td className="table-cell">
              {typeof row.cost === "number" ? formatGenericUsd(row.cost) : "-"}
            </td>
            <td className="table-cell">{row.poNumber ?? "-"}</td>
            <td className="table-cell">
              {includeAction ? row.status : row.billingDate}
            </td>
            {includeAction ? (
              <td className="table-cell">
                {row.movieId && row.showTitleCell !== false ? (
                  <BillingDoneButton
                    movieId={row.movieId}
                    label="Billing Done"
                    returnTo={returnTo}
                  />
                ) : (
                  "-"
                )}
              </td>
            ) : null}
          </tr>
        ))}
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={
                (includeAction ? 5 : 4) +
                (isSonyPicturesClassics ? 0 : 1) +
                (isTitleCountryMode ? 1 : 0)
              }
              className="table-cell text-center text-sm text-slate-500"
            >
              No billing records available.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function GenericNonTitleProjectSummaryTable({
  clientId,
  data,
  rows,
}: {
  clientId: string;
  data: GenericBillingSummaryHistoryData;
  rows: GenericBillingSummaryHistoryData["nonTitleProjectRows"];
}) {
  const hasBillingMonth = rows.some((row) => row.billingMonth);
  const returnTo = `/billing-reports/${clientId}?report=billing-summary-history&year=${data.filters.year}&projectMonth=${data.filters.projectMonth}`;

  return (
    <table className="table-base">
      <thead className="table-head">
        <tr>
          <th className="table-cell">Project (Project Status)</th>
          <th className="table-cell">Billing Model</th>
          <th className="table-cell">Cost</th>
          {hasBillingMonth ? (
            <th className="table-cell">Billing Month</th>
          ) : null}
          <th className="table-cell">PO Number</th>
          <th className="table-cell">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.itemId}>
            <td className="table-cell font-medium text-slate-900">
              {row.title} ({row.projectStatus ?? row.status})
            </td>
            <td className="table-cell">{row.billingModel ?? "-"}</td>
            <td className="table-cell">
              {typeof row.cost === "number" ? formatGenericUsd(row.cost) : "-"}
            </td>
            {hasBillingMonth ? (
              <td className="table-cell">{row.billingMonth ?? "-"}</td>
            ) : null}
            <td className="table-cell">{row.poNumber ?? "-"}</td>
            <td className="table-cell">
              {row.projectId ? (
                <ProjectBillingDoneButton
                  projectId={row.projectId}
                  label="Billing Done"
                  returnTo={returnTo}
                  billingMonth={row.billingMonth}
                  amount={row.cost}
                />
              ) : (
                "-"
              )}
            </td>
          </tr>
        ))}
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={5 + (hasBillingMonth ? 1 : 0)}
              className="table-cell text-center text-sm text-slate-500"
            >
              No non-title project billing records available.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function GenericBillingSummaryHistoryWorkspace({
  clientId,
  activeReport,
  data,
  searchParams,
}: {
  clientId: string;
  activeReport: AmazonReportType;
  data: GenericBillingSummaryHistoryData;
  searchParams: BillingReportPageSearchParams;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs
        clientId={clientId}
        activeReport={activeReport}
        clientName={data.client.name}
        useGenericTitleReports
      />
      <div className="flex justify-end">
        <ExportButtons
          clientId={clientId}
          reportType={activeReport}
          filters={{
            year: data.filters.year,
            projectMonth: data.filters.projectMonth,
          }}
        />
      </div>
      {(() => {
        const pagination = getPaginatedBillingHistoryRows(
          data.summaryRows,
          searchParams,
          "generic-billing-summary",
        );
        return (
          <section
            id="generic_billing_summary"
            className="table-wrap scroll-mt-24"
          >
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="section-title">Billing Summary</h2>
                  <p className="section-subtitle">
                    Pending billing records as per the client PO Assignment
                    Mode.
                  </p>
                </div>
                {data.client.poAssignmentMode === "PROJECT" ? (
                  <BillingHistoryMonthFilter
                    clientId={clientId}
                    searchParams={searchParams}
                    paramName="projectMonth"
                    value={data.filters.projectMonth}
                  />
                ) : null}
              </div>
            </div>
            <GenericSummaryHistoryTable
              data={data}
              clientId={clientId}
              rows={pagination.page.items}
              includeAction
            />
            <BillingHistoryPagination
              clientId={clientId}
              searchParams={searchParams}
              sectionKey="generic-billing-summary"
              pageData={pagination.page}
            />
          </section>
        );
      })()}
      {data.nonTitleProjectRows.length
        ? (() => {
            const pagination = getPaginatedBillingHistoryRows(
              data.nonTitleProjectRows,
              searchParams,
              "generic-non-title-project-billing-summary",
            );
            return (
              <section
                id="generic_non_title_project_billing_summary"
                className="table-wrap scroll-mt-24"
              >
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="section-title">Project Billing Summary</h2>
                      <p className="section-subtitle">
                        Non-title projects using project-specific POs for this
                        client. Projects already included in title-based billing
                        are excluded.
                      </p>
                    </div>
                    <BillingHistoryMonthFilter
                      clientId={clientId}
                      searchParams={searchParams}
                      paramName="projectMonth"
                      value={data.filters.projectMonth}
                    />
                  </div>
                </div>
                <GenericNonTitleProjectSummaryTable
                  clientId={clientId}
                  data={data}
                  rows={pagination.page.items}
                />
                <BillingHistoryPagination
                  clientId={clientId}
                  searchParams={searchParams}
                  sectionKey="generic-non-title-project-billing-summary"
                  pageData={pagination.page}
                />
              </section>
            );
          })()
        : null}
      <section id="generic_billing_history" className="table-wrap scroll-mt-24">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="section-title">Billing Summary & History</h2>
              <p className="section-subtitle">
                Completed &amp; Billed records for the selected billing year.
              </p>
            </div>
            <AutoSubmitFilterForm
              method="get"
              action={`/billing-reports/${clientId}`}
              className="w-full sm:w-44"
            >
              <input
                type="hidden"
                name="report"
                value="billing-summary-history"
              />
              <label className="label" htmlFor="genericHistoryYear">
                Year
              </label>
              <SearchableCombobox
                id="genericHistoryYear"
                name="year"
                defaultValue={data.filters.year}
                options={Array.from({ length: 7 }, (_, index) =>
                  String(new Date().getFullYear() - index),
                ).map((year) => ({ value: year, label: year }))}
                placeholder="Select year"
                searchPlaceholder="Search years..."
                emptyLabel="No year found."
              />
            </AutoSubmitFilterForm>
          </div>
        </div>
        {(() => {
          const pagination = getPaginatedBillingHistoryRows(
            data.historyRows,
            searchParams,
            "generic-billing-history",
          );
          return (
            <>
              <GenericSummaryHistoryTable
                data={data}
                clientId={clientId}
                rows={pagination.page.items}
                includeAction={false}
              />
              <BillingHistoryPagination
                clientId={clientId}
                searchParams={searchParams}
                sectionKey="generic-billing-history"
                pageData={pagination.page}
              />
            </>
          );
        })()}
      </section>
    </div>
  );
}

function GenericBillingReportWorkspace({
  clientId,
  reportType,
  data,
  clientName,
  showGenericReportTabs = false,
}: {
  clientId: string;
  reportType?: AmazonReportType;
  data: GenericBillingReportData;
  clientName?: string;
  showGenericReportTabs?: boolean;
}) {
  return (
    <div className="space-y-6">
      {reportType && clientName ? (
        <ReportTabs
          clientId={clientId}
          activeReport={reportType}
          clientName={clientName}
          useGenericTitleReports={showGenericReportTabs || data.movieSpecific}
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
        <div className="flex flex-wrap gap-3">
          <GenericExportButtons
            clientId={clientId}
            reportType={reportType}
            data={data}
          />
        </div>
      </div>
      {data.titleBlocks?.length ? (
        <div className="space-y-6">
          {data.titleBlocks.map((titleBlock) => (
            <GenericTitleMergedBlock
              key={titleBlock.movie.id}
              titleBlock={titleBlock}
              showTotalHoursColumn={data.client.id === FLYHOUSE_CLIENT_ID}
            />
          ))}
        </div>
      ) : data.selectedMovie && data.blocks.length ? (
        <GenericTitleMergedBlock
          titleBlock={{
            movie: data.selectedMovie,
            contactPerson: "",
            contactPersons: data.contactPersons,
            blocks: data.blocks,
            totalCost: data.blocks.reduce(
              (sum, block) =>
                sum +
                block.rows.reduce((blockSum, row) => blockSum + row.cost, 0),
              0,
            ),
          }}
          showTotalHoursColumn={data.client.id === FLYHOUSE_CLIENT_ID}
        />
      ) : data.blocks.length ? (
        data.blocks.map((block) => (
          <GenericBillingModelBlock
            key={block.key}
            block={block}
            showTotalHoursColumn={data.client.id === FLYHOUSE_CLIENT_ID}
          />
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
  const detailPage = parsePageParam(
    getSearchParamValue(resolvedSearchParams, "detailPage"),
  );

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      isActive: true,
      hourlyCost: true,
      showMoviesInEntries: true,
      poAssignmentMode: true,
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
          _count: { select: { timeEntries: true } },
        },
        orderBy: { name: "asc" },
      },
      movies: {
        select: {
          id: true,
          status: true,
          isActive: true,
          _count: { select: { timeEntries: true } },
        },
      },
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

  const configuredReportCatalog = getBillingReportCatalogForClient(
    client.name,
    client.id,
  );
  const usesGenericTitleReports =
    !configuredReportCatalog && client.showMoviesInEntries;
  const usesGenericProjectReports =
    !configuredReportCatalog && client.poAssignmentMode === "PROJECT";
  const usesGenericReportCatalog =
    usesGenericTitleReports || usesGenericProjectReports;
  const hasGenericBillingData = usesGenericProjectReports
    ? client.projects.length > 0
    : client.projects.some((project) => project._count.timeEntries > 0) ||
      client.movies.some((movie) => movie.isActive);
  if (usesGenericReportCatalog && !hasGenericBillingData)
    redirect("/billing-reports");
  const reportCatalog =
    configuredReportCatalog ??
    (usesGenericReportCatalog ? GENERIC_TITLE_REPORTS : null);
  const requestedReport = Array.isArray(resolvedSearchParams.report)
    ? resolvedSearchParams.report[0]
    : resolvedSearchParams.report;
  const activeReport = reportCatalog
    ? requestedReport &&
      Object.prototype.hasOwnProperty.call(reportCatalog, requestedReport)
      ? (requestedReport as AmazonReportType)
      : (Object.keys(reportCatalog)[0] as AmazonReportType)
    : normalizeAmazonReportType(requestedReport, client.name, client.id);
  const filters = buildAmazonBillingReportFilters(resolvedSearchParams);
  const billingHistoryFilters =
    buildBillingHistoryFilters(resolvedSearchParams);
  const genericFilters = buildGenericBillingReportFilters(resolvedSearchParams);
  const genericBillingSummaryHistoryFilters =
    buildGenericBillingSummaryHistoryFilters(resolvedSearchParams);
  const sonyPicturesFilters =
    buildSonyPicturesReportFilters(resolvedSearchParams);
  const sonyNewsletterFilters =
    buildSonyNewsletterBillingFilters(resolvedSearchParams);
  const sonyBillingSummaryHistoryFilters =
    buildSonyBillingSummaryHistoryFilters(resolvedSearchParams);
  const filmikFilters = buildFilmikBillingReportFilters(resolvedSearchParams);
  const royalFilters = buildRoyalBillingFilters(resolvedSearchParams);
  const royalHistoryFilters = buildRoyalHistoryFilters(resolvedSearchParams);
  const domesticFilters =
    buildWarnerDomesticDeliverableFilters(resolvedSearchParams);
  const activeReportDefinition = reportCatalog?.[activeReport];
  const billingHistoryData =
    activeReportDefinition?.kind === "billing-history"
      ? await getBillingHistoryData({
          clientId,
          filters: billingHistoryFilters,
        })
      : null;
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
  const titleSummaryFilters = buildClientTitleSummaryFilters(resolvedSearchParams);
  const titleSummaryData =
    activeReportDefinition?.kind === "title-summary"
      ? client.id === "cmn66av4j0001l104077m5vxz"
        ? await getWarnerTitleSummaryData({ clientId, filters: titleSummaryFilters })
        : client.id === "cmn66d3q40002l104n6wvefvl"
          ? await getSonyTitleSummaryData({ clientId, filters: titleSummaryFilters })
          : null
      : null;
  const warnerPortalReportData =
    isWarnerBillingReportClient(client.name) &&
    (activeReport === "portals" || activeReport === "dvd-sites")
      ? await getWarnerPortalReportData({
          clientId,
          month: getSearchParamValue(resolvedSearchParams, "month"),
          projectType: activeReport === "dvd-sites" ? "DVD" : "PORTAL",
          reportType: activeReport === "dvd-sites" ? "dvd-sites" : "portals",
          reportTitle: activeReport === "dvd-sites" ? "DVD Sites" : "Portals",
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
  const sonyBillingSummaryHistoryData =
    activeReportDefinition?.kind === "sony-summary-history"
      ? await getSonyBillingSummaryHistoryData({
          clientId,
          filters: sonyBillingSummaryHistoryFilters,
        })
      : null;
  const genericBillingSummaryHistoryData =
    activeReportDefinition?.kind === "generic-summary-history"
      ? await getGenericBillingSummaryHistoryData({
          clientId,
          filters: genericBillingSummaryHistoryFilters,
        })
      : null;
  const filmikBillingReportData =
    client.id === FILMIK_CLIENT_ID &&
    activeReportDefinition?.kind === "generic-filmik"
      ? await getFilmikBillingReportData(filmikFilters)
      : null;
  const isRoyalCaribbeanClient =
    client.id === ROYAL_CARIBBEAN_CLIENT_ID ||
    client.name.trim().toLowerCase() ===
      ROYAL_CARIBBEAN_CLIENT_NAME.toLowerCase();
  const royalBillingReportData =
    isRoyalCaribbeanClient && activeReport !== "billing-history"
      ? await getRoyalBillingReportData({ clientId, filters: royalFilters })
      : null;
  const royalHistoryData =
    isRoyalCaribbeanClient && activeReport === "billing-history"
      ? await getRoyalHistoryData({ clientId, filters: royalHistoryFilters })
      : null;
  const isSonyPicturesClassicsReport =
    client.id === SONY_PICTURES_CLASSICS_CLIENT_ID;
  const genericBillingOptions =
    activeReportDefinition?.kind === "generic-movie"
      ? {
          movieSpecific: !usesGenericProjectReports,
          openDateRange: isSonyPicturesClassicsReport,
        }
      : undefined;
  const effectiveGenericFilters = isSonyPicturesClassicsReport
    ? {
        ...genericFilters,
        fromDate: getSearchParamValue(resolvedSearchParams, "fromDate") ?? "",
        toDate: getSearchParamValue(resolvedSearchParams, "toDate") ?? "",
        movieId: getSearchParamValue(resolvedSearchParams, "movieId") ?? "all",
      }
    : genericFilters;
  const billingContactNotices = await db.billingContactAssignment.findMany({
    where: { clientId },
    select: {
      id: true,
      assignmentLevel: true,
      billingReportType: true,
      project: { select: { id: true, name: true } },
      contactPerson: {
        select: {
          name: true,
          email: true,
          country: { select: { isoCode: true } },
        },
      },
    },
    orderBy: [{ assignmentLevel: "asc" }, { updatedAt: "desc" }],
  });

  const genericBillingReportData =
    !reportCatalog || genericBillingOptions
      ? await getGenericBillingReportData({
          clientId,
          filters: effectiveGenericFilters,
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
      <BillingContactNotices
        contacts={billingContactNotices}
        activeReport={activeReport}
      />
      {timeEntryReportData ? (
        <TimeEntryReportsWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={timeEntryReportData}
          detailPage={detailPage}
          searchParams={resolvedSearchParams}
        />
      ) : billingHistoryData ? (
        <BillingHistoryWorkspace
          clientId={clientId}
          activeReport={activeReport}
          clientName={client.name}
          data={billingHistoryData}
          searchParams={resolvedSearchParams}
        />
      ) : universalBillingSummaryData ? (
        <UniversalBillingSummaryWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={universalBillingSummaryData}
        />
      ) : titleSummaryData ? (
        <ClientTitleSummaryWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={titleSummaryData}
        />
      ) : warnerPortalReportData ? (
        <WarnerPortalReportWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={warnerPortalReportData}
          searchParams={resolvedSearchParams}
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
      ) : sonyBillingSummaryHistoryData ? (
        <SonyBillingSummaryHistoryWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={sonyBillingSummaryHistoryData}
          searchParams={resolvedSearchParams}
        />
      ) : genericBillingSummaryHistoryData ? (
        <GenericBillingSummaryHistoryWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={genericBillingSummaryHistoryData}
          searchParams={resolvedSearchParams}
        />
      ) : royalBillingReportData ? (
        <RoyalBillingReportWorkspace
          clientId={clientId}
          activeReport={activeReport}
          data={royalBillingReportData}
        />
      ) : royalHistoryData ? (
        <RoyalHistoryWorkspace
          clientId={clientId}
          data={royalHistoryData}
          searchParams={resolvedSearchParams}
        />
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
          showGenericReportTabs={usesGenericReportCatalog}
        />
      )}
    </div>
  );
}
