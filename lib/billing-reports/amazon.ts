import { db } from "@/lib/db";
import {
  FILMIK_CLIENT_ID,
  ROYAL_CARIBBEAN_CLIENT_ID,
  SONY_PICTURES_CLASSICS_CLIENT_ID,
  SONY_PICTURES_CLIENT_ID,
  WARNER_BROS_CLIENT_ID,
} from "@/lib/billing-reports/config";
import { getLensBillingAdjustments } from "@/lib/billing-reports/lens";
import type { MovieStatus } from "@prisma/client";

export type AmazonReportType =
  | "social-assets"
  | "localization"
  | "wbhe-status"
  | "domestic-deliverable"
  | "intl-deliverable"
  | "other-deliverable"
  | "portals"
  | "dvd-sites"
  | "spe-main"
  | "canada-other"
  | "newsletters"
  | "billing-summary"
  | "billing-history"
  | "billing-summary-history";

export type AmazonBillingReportFilters = {
  fromDate: string;
  toDate: string;
  movieId: string;
  assetTypeId: string;
  assetNameId: string;
  countryId: string;
};

export type BillingReportContactPerson = {
  id?: string;
  name: string;
  email: string | null;
  countryCode?: string | null;
  country?: { isoCode: string | null } | null;
};

export type AmazonBillingReportRow = {
  date: string;
  titleName: string;
  assetName: string;
  territoryVariant?: string;
  assetType: string;
  cost: number;
  contactPerson: string;
  contactPersons: BillingReportContactPerson[];
};

export type AmazonBillingReportSummaryRow = {
  assetType: string;
  totalAssets: number;
  totalCost: number;
};

export type UniversalTitleSummaryRow = {
  movieId: string;
  titleName: string;
  status: string;
  totalAssets: number;
  totalCountries: number;
  contactPersons: BillingReportContactPerson[];
};

export type AmazonBillingReportData = {
  client: { id: string; name: string };
  reportType: AmazonReportType;
  reportTitle: string;
  projectName: string;
  filters: AmazonBillingReportFilters;
  movieOptions: { id: string; title: string; status?: string }[];
  assetTypeOptions: { id: string; name: string; movieIds?: string[] }[];
  rows: AmazonBillingReportRow[];
  summaryRows: AmazonBillingReportSummaryRow[];
  titleSummaryRows: UniversalTitleSummaryRow[];
  completedTitleSummaryRows: UniversalTitleSummaryRow[];
  countryOptions: { id: string; name: string; movieIds?: string[] }[];
  contactPersons: string;
  projectFound: boolean;
};

export type WarnerDeliverableFilters = {
  movieId: string;
  countryId: string;
};

export type WarnerDomesticDeliverableFilters = WarnerDeliverableFilters;

export type WarnerDomesticDeliverableLine = {
  label: string;
  cost: number;
  group: "Fixed - Compulsory" | "Fixed - Optional" | "Fixed Full Projects";
  meta?: string;
};

export type WarnerDomesticDeliverableData = {
  client: { id: string; name: string; hourlyCost: unknown };
  reportType:
    | "domestic-deliverable"
    | "intl-deliverable"
    | "other-deliverable"
    | "portals"
    | "newsletters";
  reportTitle: string;
  filters: WarnerDeliverableFilters;
  movieOptions: { id: string; title: string; status: string }[];
  countryOptions: { id: string; name: string; isoCode: string | null }[];
  selectedMovie: {
    id: string;
    title: string;
    billingDomestic?: boolean;
    billingIntl?: boolean;
    billingOther?: boolean;
    contactPersons?: BillingReportContactPerson[];
  } | null;
  selectedCountry: { id: string; name: string; isoCode: string | null } | null;
  rows: WarnerDomesticDeliverableLine[];
  totalCost: number;
  titleBlocks?: Array<{
    selectedMovie: {
      id: string;
      title: string;
      billingDomestic?: boolean;
      billingIntl?: boolean;
      billingOther?: boolean;
      contactPersons?: BillingReportContactPerson[];
    };
    selectedCountry: {
      id: string;
      name: string;
      isoCode: string | null;
    } | null;
    rows: WarnerDomesticDeliverableLine[];
    totalCost: number;
  }>;
};

export const AMAZON_CLIENT_NAME = "Amazon Studios";
export const UNIVERSAL_CLIENT_NAME = "Universal Pictures International";
export const WARNER_CLIENT_NAME = "Warner Bros. Entertainment Inc.";
export const SONY_PICTURES_CLIENT_NAME = "Sony Pictures Entertainment";
export const SONY_PICTURES_CLASSICS_CLIENT_NAME = "Sony Pictures Classics";
export const FILMIK_CLIENT_NAME = "Filmik";

const UNIVERSAL_SOCIAL_QC_PROJECT_ID = "cmnh2yn940001l504enjioq52";
const UNIVERSAL_SOCIAL_LOCALIZATION_PROJECT_ID = "cmnh2z3ao0003l504jbrpa6ic";

export type BillingReportDefinition = {
  title: string;
  projectName: string;
  includeLanguage: boolean;
  includeCountry: boolean;
  poAssignmentMode?:
    | "TITLE"
    | "TITLE_BILLING_REPORT"
    | "TITLE_PROJECT"
    | "PROJECT"
    | "BILLING_REPORT";
  kind?:
    | "time-entry"
    | "time-entry-summary"
    | "deliverable"
    | "placeholder"
    | "generic-movie"
    | "generic-summary-history"
    | "generic-filmik"
    | "sony-movie"
    | "sony-newsletters"
    | "sony-summary-history"
    | "billing-history"
    | "warner-portals";
};

export const AMAZON_REPORTS: Partial<
  Record<AmazonReportType, BillingReportDefinition>
> = {
  "social-assets": {
    title: "Amazon Social Assets",
    projectName: "AMZ Social QC",
    includeLanguage: false,
    includeCountry: false,
    kind: "time-entry",
  },
  localization: {
    title: "Amazon Localization",
    projectName: "AMZ Social Localization",
    includeLanguage: true,
    includeCountry: false,
    kind: "time-entry",
  },
  "billing-history": {
    title: "Billing Summary & History",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "billing-history",
  },
};

export const ROYAL_REPORTS: Partial<
  Record<AmazonReportType, BillingReportDefinition>
> = {
  "social-assets": {
    title: "Billing",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "placeholder",
  },
  "billing-summary": {
    title: "Summary",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "placeholder",
  },
  "billing-history": {
    title: "History",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "placeholder",
  },
};

export const UNIVERSAL_REPORTS: Partial<
  Record<AmazonReportType, BillingReportDefinition>
> = {
  "social-assets": {
    title: "Social QA",
    projectName: "UNI Social QC",
    includeLanguage: false,
    includeCountry: false,
    kind: "time-entry",
  },
  localization: {
    title: "Localization",
    projectName: "UNI Social Localization",
    includeLanguage: false,
    includeCountry: true,
    kind: "time-entry",
  },
  "billing-summary": {
    title: "Billing Summary & History",
    projectName: "UNI Social Localization",
    includeLanguage: false,
    includeCountry: true,
    kind: "time-entry-summary",
  },
};

export const WARNER_REPORTS: Partial<
  Record<AmazonReportType, BillingReportDefinition>
> = {
  "domestic-deliverable": {
    title: "Domestic Deliverable",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "deliverable",
    poAssignmentMode: "TITLE_BILLING_REPORT",
  },
  "intl-deliverable": {
    title: "Intl Deliverable",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "deliverable",
    poAssignmentMode: "TITLE_BILLING_REPORT",
  },
  "other-deliverable": {
    title: "Other Deliverable",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "deliverable",
    poAssignmentMode: "TITLE_BILLING_REPORT",
  },
  "wbhe-status": {
    title: "WBHE Status",
    projectName: "WB Home Entertainment (Social)",
    includeLanguage: false,
    includeCountry: false,
    kind: "time-entry",
    poAssignmentMode: "TITLE_BILLING_REPORT",
  },
  portals: {
    title: "Portals",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "warner-portals",
    poAssignmentMode: "TITLE_PROJECT",
  },
  "dvd-sites": {
    title: "DVD Sites",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "warner-portals",
    poAssignmentMode: "TITLE_PROJECT",
  },
  "billing-history": {
    title: "Billing Summary & History",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "billing-history",
  },
};

export const SONY_PICTURES_REPORTS: Partial<
  Record<AmazonReportType, BillingReportDefinition>
> = {
  "spe-main": {
    title: "SPE Billing",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "sony-movie",
  },
  "canada-other": {
    title: "SPE US Ticketing, Canada & Other",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "sony-movie",
  },
  newsletters: {
    title: "Newsletters",
    projectName: "Newsletters",
    includeLanguage: false,
    includeCountry: false,
    kind: "sony-newsletters",
  },
  "billing-summary-history": {
    title: "Billing Summary & History",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "sony-summary-history",
  },
};

export const SONY_PICTURES_CLASSICS_REPORTS: Partial<
  Record<AmazonReportType, BillingReportDefinition>
> = {
  "social-assets": {
    title: "Sony Pictures Classics Billing",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "generic-movie",
  },
  "billing-history": {
    title: "Billing Summary & History",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "billing-history",
  },
};

export const FILMIK_REPORTS: Partial<
  Record<AmazonReportType, BillingReportDefinition>
> = {
  "social-assets": {
    title: "Filmik Billing",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "generic-filmik",
  },
  "billing-history": {
    title: "Billing Summary & History",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "billing-history",
  },
};

export const GENERIC_TITLE_REPORTS: Partial<
  Record<AmazonReportType, BillingReportDefinition>
> = {
  "social-assets": {
    title: "Billing",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "generic-movie",
  },
  "billing-summary-history": {
    title: "Billing Summary & History",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "generic-summary-history",
  },
};

export function getBillingReportCatalogForClient(
  clientName: string,
  clientId?: string,
) {
  const normalizedClientName = clientName.trim().toLowerCase();
  if (normalizedClientName === AMAZON_CLIENT_NAME.toLowerCase())
    return AMAZON_REPORTS;
  if (normalizedClientName === UNIVERSAL_CLIENT_NAME.toLowerCase())
    return UNIVERSAL_REPORTS;
  if (normalizedClientName === WARNER_CLIENT_NAME.toLowerCase())
    return WARNER_REPORTS;
  if (
    clientId === SONY_PICTURES_CLIENT_ID ||
    normalizedClientName === SONY_PICTURES_CLIENT_NAME.toLowerCase()
  )
    return SONY_PICTURES_REPORTS;
  if (
    clientId === SONY_PICTURES_CLASSICS_CLIENT_ID ||
    normalizedClientName === SONY_PICTURES_CLASSICS_CLIENT_NAME.toLowerCase()
  )
    return SONY_PICTURES_CLASSICS_REPORTS;
  if (
    clientId === FILMIK_CLIENT_ID ||
    normalizedClientName === FILMIK_CLIENT_NAME.toLowerCase()
  )
    return FILMIK_REPORTS;
  if (
    clientId === ROYAL_CARIBBEAN_CLIENT_ID ||
    normalizedClientName === "royal caribbean cruises"
  )
    return ROYAL_REPORTS;
  return null;
}

export function isConfiguredBillingReportClient(clientName: string) {
  return Boolean(getBillingReportCatalogForClient(clientName));
}

export function isWarnerBillingReportClient(clientName: string) {
  return clientName.trim().toLowerCase() === WARNER_CLIENT_NAME.toLowerCase();
}

export function normalizeAmazonReportType(
  value: string | null | undefined,
  clientName?: string,
  clientId?: string,
): AmazonReportType {
  const allowed =
    getBillingReportCatalogForClient(clientName ?? "", clientId) ??
    AMAZON_REPORTS;
  if (value && Object.prototype.hasOwnProperty.call(allowed, value))
    return value as AmazonReportType;

  const firstConfiguredReport = Object.keys(allowed)[0] as
    | AmazonReportType
    | undefined;
  if (firstConfiguredReport) return firstConfiguredReport;

  return isWarnerBillingReportClient(clientName ?? "")
    ? "wbhe-status"
    : "social-assets";
}

export function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDefaultMonthRange() {
  const now = new Date();
  return {
    fromDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: toDateInputValue(
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
    ),
  };
}

export function normalizeDateInput(
  value: string | null | undefined,
  fallback: string,
) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function buildAmazonBillingReportFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  const defaults = getDefaultMonthRange();
  const getValue = (key: string) => {
    if (searchParams instanceof URLSearchParams)
      return searchParams.get(key) ?? undefined;
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const monthValue = getValue("month");
  const monthRange = monthValue ? getMonthRangeFromDateInput(monthValue) : null;

  return {
    fromDate:
      monthRange?.fromDate ??
      normalizeDateInput(getValue("fromDate"), defaults.fromDate),
    toDate:
      monthRange?.toDate ??
      normalizeDateInput(getValue("toDate"), defaults.toDate),
    movieId: getValue("movieId") || "all",
    assetTypeId: getValue("assetTypeId") || "all",
    assetNameId: getValue("assetNameId") || getValue("assetTypeId") || "all",
    countryId: getValue("countryId") || "all",
  } satisfies AmazonBillingReportFilters;
}

export function buildWarnerDeliverableFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  const getValue = (key: string) => {
    if (searchParams instanceof URLSearchParams)
      return searchParams.get(key) ?? undefined;
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    movieId: getValue("movieId") || "all",
    countryId: getValue("countryId") || "",
  } satisfies WarnerDeliverableFilters;
}

export function buildWarnerDomesticDeliverableFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  return buildWarnerDeliverableFilters(searchParams);
}

function buildContactPersonLabel(
  contactPersons: {
    name: string;
    email: string | null;
    countryCode?: string | null;
    country?: { isoCode: string | null } | null;
  }[],
) {
  if (!contactPersons.length) return "-";
  return contactPersons
    .map(
      (person) =>
        `${person.name}${(person.countryCode ?? person.country?.isoCode) ? ` (${person.countryCode ?? person.country?.isoCode})` : ""}${person.email ? ` (${person.email})` : ""}`,
    )
    .join(", ");
}

export async function getAmazonBillingReportData({
  clientId,
  reportType,
  filters,
}: {
  clientId: string;
  reportType: AmazonReportType;
  filters: AmazonBillingReportFilters;
}): Promise<AmazonBillingReportData | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });

  if (!client) return null;

  const reportCatalog = getBillingReportCatalogForClient(
    client.name,
    client.id,
  );
  if (!reportCatalog) return null;

  const reportConfig = reportCatalog[reportType];
  if (
    !reportConfig ||
    (reportConfig.kind !== "time-entry" &&
      reportConfig.kind !== "time-entry-summary")
  )
    return null;

  const project = await db.project.findFirst({
    where: {
      clientId,
      addToBilling: true,
      name: reportConfig.projectName,
    },
    select: {
      id: true,
      name: true,
      projectCost: true,
      contactPersons: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          country: { select: { isoCode: true } },
        },
      },
    },
  });

  if (!project) {
    return {
      client,
      reportType,
      reportTitle: reportConfig.title,
      projectName: reportConfig.projectName,
      filters,
      movieOptions: [],
      assetTypeOptions: [],
      rows: [],
      summaryRows: [],
      titleSummaryRows: [],
      completedTitleSummaryRows: [],
      countryOptions: [],
      contactPersons: "-",
      projectFound: false,
    };
  }

  const isUniversalClientForOptions =
    client.name.trim().toLowerCase() === UNIVERSAL_CLIENT_NAME.toLowerCase();
  const isWarnerWbheStatus =
    client.id === WARNER_BROS_CLIENT_ID && reportType === "wbhe-status";

  const projectEntriesForOptions = await db.timeEntry.findMany({
    where: {
      projectId: project.id,
      movie: {
        status: { in: ["WORKING", "COMPLETED"] },
        ...(isWarnerWbheStatus ? { billingSocial: true } : {}),
      },
    },
    select: {
      movieId: true,
      movie: {
        select: {
          id: true,
          title: true,
          status: true,
          contactPersons: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              email: true,
              country: { select: { isoCode: true } },
            },
          },
        },
      },
      assetType: { select: { id: true, name: true } },
      assetName: { select: { id: true, name: true } },
      country: { select: { id: true, name: true } },
    },
    orderBy: { workDate: "desc" },
  });

  const movieOptionMap = new Map<string, { id: string; title: string }>();
  const assetTypeOptionMap = new Map<
    string,
    { id: string; name: string; movieIds: Set<string> }
  >();
  const countryOptionMap = new Map<
    string,
    { id: string; name: string; movieIds: Set<string> }
  >();

  for (const entry of projectEntriesForOptions) {
    if (entry.movie && entry.movie.status !== "COMPLETED_BILLED") {
      movieOptionMap.set(entry.movie.id, {
        id: entry.movie.id,
        title: entry.movie.title,
      });
    }

    const movieId = entry.movieId ?? entry.movie?.id ?? "";
    if (entry.assetName && isUniversalClientForOptions) {
      const current = assetTypeOptionMap.get(entry.assetName.id) ?? {
        id: entry.assetName.id,
        name: entry.assetName.name,
        movieIds: new Set<string>(),
      };
      if (movieId) current.movieIds.add(movieId);
      assetTypeOptionMap.set(entry.assetName.id, current);
    } else if (entry.assetType) {
      const current = assetTypeOptionMap.get(entry.assetType.id) ?? {
        id: entry.assetType.id,
        name: entry.assetType.name,
        movieIds: new Set<string>(),
      };
      if (movieId) current.movieIds.add(movieId);
      assetTypeOptionMap.set(entry.assetType.id, current);
    }
    if (entry.country) {
      const current = countryOptionMap.get(entry.country.id) ?? {
        id: entry.country.id,
        name: entry.country.name,
        movieIds: new Set<string>(),
      };
      if (movieId) current.movieIds.add(movieId);
      countryOptionMap.set(entry.country.id, current);
    }
  }

  const optionMatchesSelectedMovie = (movieIds: Set<string>) =>
    filters.movieId === "all" || movieIds.has(filters.movieId);

  const effectiveFilters = { ...filters };
  if (isUniversalClientForOptions && effectiveFilters.assetNameId !== "all") {
    const selectedAssetName = assetTypeOptionMap.get(
      effectiveFilters.assetNameId,
    );
    if (
      !selectedAssetName ||
      !optionMatchesSelectedMovie(selectedAssetName.movieIds)
    ) {
      effectiveFilters.assetNameId = "all";
    }
  } else if (
    !isUniversalClientForOptions &&
    effectiveFilters.assetTypeId !== "all"
  ) {
    const selectedAssetType = assetTypeOptionMap.get(
      effectiveFilters.assetTypeId,
    );
    if (
      !selectedAssetType ||
      !optionMatchesSelectedMovie(selectedAssetType.movieIds)
    ) {
      effectiveFilters.assetTypeId = "all";
    }
  }
  if (effectiveFilters.countryId !== "all") {
    const selectedCountry = countryOptionMap.get(effectiveFilters.countryId);
    if (
      !selectedCountry ||
      !optionMatchesSelectedMovie(selectedCountry.movieIds)
    ) {
      effectiveFilters.countryId = "all";
    }
  }
  filters = effectiveFilters;

  const movieOptions = Array.from(movieOptionMap.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
  const assetTypeOptions = Array.from(assetTypeOptionMap.values())
    .map((option) => ({
      id: option.id,
      name: option.name,
      movieIds: Array.from(option.movieIds),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const countryOptions = Array.from(countryOptionMap.values())
    .map((option) => ({
      id: option.id,
      name: option.name,
      movieIds: Array.from(option.movieIds),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const fromBoundary = filters.fromDate
    ? new Date(`${filters.fromDate}T00:00:00`)
    : null;
  const toBoundary = filters.toDate
    ? new Date(`${filters.toDate}T23:59:59.999`)
    : null;
  const isUniversalClient =
    client.name.trim().toLowerCase() === UNIVERSAL_CLIENT_NAME.toLowerCase();
  const isAmazonClient =
    client.name.trim().toLowerCase() === AMAZON_CLIENT_NAME.toLowerCase();

  const entries = await db.timeEntry.findMany({
    where: {
      projectId: project.id,
      ...(fromBoundary || toBoundary
        ? {
            workDate: {
              ...(fromBoundary ? { gte: fromBoundary } : {}),
              ...(toBoundary ? { lte: toBoundary } : {}),
            },
          }
        : {}),
      movie: {
        status: { in: ["WORKING", "COMPLETED"] },
        ...(isWarnerWbheStatus ? { billingSocial: true } : {}),
      },
      ...(filters.movieId !== "all" ? { movieId: filters.movieId } : {}),
      ...(isUniversalClient && filters.assetNameId !== "all"
        ? { assetNameId: filters.assetNameId }
        : {}),
      ...(!isUniversalClient && filters.assetTypeId !== "all"
        ? { assetTypeId: filters.assetTypeId }
        : {}),
      ...(filters.countryId !== "all" ? { countryId: filters.countryId } : {}),
    },
    include: {
      movie: {
        select: {
          id: true,
          title: true,
          status: true,
          contactPersons: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              email: true,
              country: { select: { isoCode: true } },
            },
          },
        },
      },
      assetType: { select: { name: true, cost: true } },
      language: { select: { name: true, code: true } },
      country: { select: { name: true, isoCode: true } },
      assetName: { select: { name: true } },
    },
    orderBy: [
      { workDate: "asc" },
      { movie: { title: "asc" } },
      { taskName: "asc" },
    ],
  });

  const projectContactPersons = project.contactPersons.map((person) => ({
    id: person.id,
    name: person.name,
    email: person.email,
  }));
  const selectedTitleContactPersons =
    filters.movieId !== "all" ? (entries[0]?.movie?.contactPersons ?? []) : [];
  const contactPersons = selectedTitleContactPersons.length
    ? buildContactPersonLabel(selectedTitleContactPersons)
    : buildContactPersonLabel(projectContactPersons);

  const isUniversalLocalization =
    client.name.trim().toLowerCase() === UNIVERSAL_CLIENT_NAME.toLowerCase() &&
    reportType === "localization";

  const rows: AmazonBillingReportRow[] = entries.map((entry) => {
    const rowContactPersons = entry.movie?.contactPersons.length
      ? entry.movie.contactPersons
      : projectContactPersons;
    return {
      date: formatDisplayDate(entry.workDate),
      titleName: entry.movie?.title ?? "-",
      assetName: isAmazonClient
        ? entry.taskName || entry.assetName?.name || "-"
        : entry.assetName?.name || entry.taskName || "-",
      territoryVariant: isUniversalLocalization
        ? (entry.country?.name ?? "-")
        : reportConfig.includeLanguage
          ? (entry.language?.name ?? entry.country?.name ?? "-")
          : undefined,
      assetType: isUniversalLocalization
        ? "Assets"
        : (entry.assetType?.name ?? "-"),
      cost: isUniversalLocalization
        ? Number(project.projectCost ?? 0)
        : Number(entry.assetType?.cost ?? 0),
      contactPerson: buildContactPersonLabel(rowContactPersons),
      contactPersons: rowContactPersons,
    };
  });

  const summaryMap = new Map<string, AmazonBillingReportSummaryRow>();
  for (const row of rows) {
    const current = summaryMap.get(row.assetType) ?? {
      assetType: row.assetType,
      totalAssets: 0,
      totalCost: 0,
    };
    current.totalAssets += 1;
    current.totalCost += row.cost;
    summaryMap.set(row.assetType, current);
  }

  type TitleSummaryEntry = {
    movieId: string | null;
    taskName: string | null;
    movie: {
      id: string;
      title: string;
      status: string;
      contactPersons?: BillingReportContactPerson[];
    } | null;
    assetName: {
      name: string;
    } | null;
    country: {
      name: string;
    } | null;
  };

  const buildTitleSummaryRows = (
    entryList: TitleSummaryEntry[],
  ): UniversalTitleSummaryRow[] => {
    const map = new Map<
      string,
      {
        movieId: string;
        titleName: string;
        status: string;
        assets: Set<string>;
        countries: Set<string>;
        contactPersons: BillingReportContactPerson[];
      }
    >();
    for (const entry of entryList) {
      if (!entry.movie) continue;
      const current = map.get(entry.movie.title) ?? {
        movieId: entry.movieId ?? "",
        titleName: entry.movie.title,
        status: entry.movie.status ?? "",
        assets: new Set<string>(),
        countries: new Set<string>(),
        contactPersons: entry.movie.contactPersons ?? [],
      };
      const asset = entry.assetName?.name || entry.taskName || "";
      if (asset.trim()) current.assets.add(asset.trim());
      if (entry.country?.name) current.countries.add(entry.country.name);
      map.set(entry.movie.title, current);
    }
    return Array.from(map.values())
      .map((value) => ({
        movieId: value.movieId,
        titleName: value.titleName,
        status: value.status,
        totalAssets: value.assets.size,
        totalCountries: value.countries.size,
        contactPersons: value.contactPersons,
      }))
      .sort((a, b) => a.titleName.localeCompare(b.titleName));
  };

  const completedEntries = isUniversalClient
    ? await db.timeEntry.findMany({
        where: {
          projectId: project.id,
          ...(fromBoundary || toBoundary
            ? {
                workDate: {
                  ...(fromBoundary ? { gte: fromBoundary } : {}),
                  ...(toBoundary ? { lte: toBoundary } : {}),
                },
              }
            : {}),
          movie: { status: "COMPLETED_BILLED" },
          ...(filters.movieId !== "all" ? { movieId: filters.movieId } : {}),
          ...(isUniversalClient && filters.assetNameId !== "all"
            ? { assetNameId: filters.assetNameId }
            : {}),
          ...(filters.countryId !== "all"
            ? { countryId: filters.countryId }
            : {}),
        },
        include: {
          movie: {
            select: {
              id: true,
              title: true,
              status: true,
              contactPersons: {
                orderBy: { name: "asc" },
                select: {
                  id: true,
                  name: true,
                  email: true,
                  country: { select: { isoCode: true } },
                },
              },
            },
          },
          assetName: { select: { name: true } },
          country: { select: { name: true } },
        },
        orderBy: [{ movie: { title: "asc" } }, { workDate: "asc" }],
      })
    : [];

  return {
    client,
    reportType,
    reportTitle: reportConfig.title,
    projectName: project.name,
    filters,
    movieOptions,
    assetTypeOptions,
    rows,
    summaryRows: Array.from(summaryMap.values()).sort((a, b) =>
      a.assetType.localeCompare(b.assetType),
    ),
    titleSummaryRows: isUniversalClient ? buildTitleSummaryRows(entries) : [],
    completedTitleSummaryRows: isUniversalClient
      ? buildTitleSummaryRows(completedEntries)
      : [],
    countryOptions,
    contactPersons,
    projectFound: true,
  };
}

export type UniversalBillingSummaryRow = {
  movieId: string;
  titleName: string;
  status: string;
  socialAssets: number;
  socialCost: number;
  localizationAssets: number;
  localizationCountries: number;
  localizationCost: number;
  poNumber: string;
  contactPersons: BillingReportContactPerson[];
};

export type UniversalBillingSummaryData = {
  client: { id: string; name: string };
  reportType: "billing-summary";
  reportTitle: string;
  filters: AmazonBillingReportFilters;
  titleOptions: { id: string; title: string; status: string }[];
  rows: UniversalBillingSummaryRow[];
  completedTitleSummaryRows: UniversalBillingSummaryRow[];
  projectFound: boolean;
};

export function getMonthRangeFromDateInput(
  monthValue: string | null | undefined,
) {
  const now = new Date();
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const safeMonth =
    monthValue && /^\d{4}-\d{2}$/.test(monthValue) ? monthValue : fallback;
  const [yearText, monthText] = safeMonth.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  return {
    month: safeMonth,
    fromDate: toDateInputValue(new Date(year, monthIndex, 1)),
    toDate: toDateInputValue(new Date(year, monthIndex + 1, 0)),
  };
}

function getUniversalCategoryCost(
  count: number,
  project:
    | {
        universalSmallCost: unknown;
        universalMediumCost: unknown;
        universalLargeCost: unknown;
        universalExtraLargeCost: unknown;
      }
    | undefined,
) {
  if (!project || count <= 0) return 0;
  if (count <= 19) return Number(project.universalSmallCost ?? 0);
  if (count <= 34) return Number(project.universalMediumCost ?? 0);
  if (count <= 69) return Number(project.universalLargeCost ?? 0);
  return Number(project.universalExtraLargeCost ?? 0);
}

export async function getUniversalBillingSummaryData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: AmazonBillingReportFilters;
}): Promise<UniversalBillingSummaryData | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });
  if (!client) return null;

  const reportConfig = UNIVERSAL_REPORTS["billing-summary"];
  if (!reportConfig) return null;

  const summaryProjects = await db.project.findMany({
    where: {
      clientId,
      addToBilling: true,
      id: {
        in: [
          UNIVERSAL_SOCIAL_QC_PROJECT_ID,
          UNIVERSAL_SOCIAL_LOCALIZATION_PROJECT_ID,
        ],
      },
    },
    select: {
      id: true,
      universalSmallCost: true,
      universalMediumCost: true,
      universalLargeCost: true,
      universalExtraLargeCost: true,
    },
  });

  const summaryProjectIds = summaryProjects.map((project) => project.id);
  const poNumberByMovie = new Map<string, string>();
  const poNumberByProject = new Map<string, string>();
  const poNumberByReport = new Map<string, string>();
  const poNumberByMovieProject = new Map<string, string>();
  const poNumberByMovieReport = new Map<string, string>();
  const poAssignments = await db.purchaseOrderAssignment.findMany({
    where: {
      clientId,
      purchaseOrder: { status: { not: "CANCELLED" } },
    },
    select: {
      movieId: true,
      projectId: true,
      billingReportType: true,
      purchaseOrder: { select: { poNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const assignment of poAssignments) {
    const poNumber = assignment.purchaseOrder.poNumber;
    if (assignment.movieId && !poNumberByMovie.has(assignment.movieId)) {
      poNumberByMovie.set(assignment.movieId, poNumber);
    }
    if (assignment.projectId && !poNumberByProject.has(assignment.projectId)) {
      poNumberByProject.set(assignment.projectId, poNumber);
    }
    if (
      assignment.billingReportType &&
      !poNumberByReport.has(assignment.billingReportType)
    ) {
      poNumberByReport.set(assignment.billingReportType, poNumber);
    }
    if (assignment.movieId && assignment.projectId) {
      const key = `${assignment.movieId}:${assignment.projectId}`;
      if (!poNumberByMovieProject.has(key)) {
        poNumberByMovieProject.set(key, poNumber);
      }
    }
    if (assignment.movieId && assignment.billingReportType) {
      const key = `${assignment.movieId}:${assignment.billingReportType}`;
      if (!poNumberByMovieReport.has(key)) {
        poNumberByMovieReport.set(key, poNumber);
      }
    }
  }

  const getSummaryPoNumber = (movieId: string) => {
    const values = new Set<string>();
    const add = (value: string | undefined) => {
      if (value) values.add(value);
    };

    add(poNumberByMovieReport.get(`${movieId}:billing-summary`));
    for (const projectId of summaryProjectIds) {
      add(poNumberByMovieProject.get(`${movieId}:${projectId}`));
    }
    add(poNumberByMovie.get(movieId));
    add(poNumberByReport.get("billing-summary"));
    for (const projectId of summaryProjectIds) {
      add(poNumberByProject.get(projectId));
    }

    return values.size ? Array.from(values).join(", ") : "-";
  };

  const socialProject = summaryProjects.find(
    (project) => project.id === UNIVERSAL_SOCIAL_QC_PROJECT_ID,
  );
  const localizationProject = summaryProjects.find(
    (project) => project.id === UNIVERSAL_SOCIAL_LOCALIZATION_PROJECT_ID,
  );

  if (!summaryProjectIds.length) {
    return {
      client,
      reportType: "billing-summary",
      reportTitle: reportConfig.title,
      filters,
      titleOptions: [],
      rows: [],
      completedTitleSummaryRows: [],
      projectFound: false,
    };
  }

  const titleOptions = await db.movie.findMany({
    where: {
      clientId,
      isActive: true,
      status: { in: ["WORKING", "COMPLETED"] },
      timeEntries: { some: { projectId: { in: summaryProjectIds } } },
    },
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
  });

  const buildRows = async (
    statuses: Array<"WORKING" | "COMPLETED" | "COMPLETED_BILLED">,
  ) => {
    const entries = await db.timeEntry.findMany({
      where: {
        projectId: { in: summaryProjectIds },
        movieId: { not: null },
        movie: { status: { in: statuses } },
        ...(filters.movieId !== "all" ? { movieId: filters.movieId } : {}),
      },
      select: {
        projectId: true,
        taskName: true,
        movie: {
          select: {
            id: true,
            title: true,
            status: true,
            contactPersons: {
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                email: true,
                country: { select: { isoCode: true } },
              },
            },
          },
        },
        assetName: { select: { name: true } },
        country: { select: { name: true } },
      },
      orderBy: [{ movie: { title: "asc" } }, { workDate: "asc" }],
    });

    const map = new Map<
      string,
      {
        movieId: string;
        titleName: string;
        status: string;
        socialAssets: Set<string>;
        localizationAssets: Set<string>;
        localizationCountries: Set<string>;
        contactPersons: BillingReportContactPerson[];
      }
    >();

    for (const entry of entries) {
      if (!entry.movie) continue;
      const current = map.get(entry.movie.id) ?? {
        movieId: entry.movie.id,
        titleName: entry.movie.title,
        status: entry.movie.status,
        socialAssets: new Set<string>(),
        localizationAssets: new Set<string>(),
        localizationCountries: new Set<string>(),
        contactPersons: entry.movie.contactPersons ?? [],
      };
      const asset = (entry.assetName?.name ?? entry.taskName ?? "").trim();
      if (entry.projectId === UNIVERSAL_SOCIAL_QC_PROJECT_ID && asset) {
        current.socialAssets.add(asset);
      }
      if (entry.projectId === UNIVERSAL_SOCIAL_LOCALIZATION_PROJECT_ID) {
        if (asset) current.localizationAssets.add(asset);
        if (entry.country?.name)
          current.localizationCountries.add(entry.country.name);
      }
      map.set(entry.movie.id, current);
    }

    return Array.from(map.values())
      .map((value) => {
        const socialAssets = value.socialAssets.size;
        const localizationAssets = value.localizationAssets.size;
        const localizationCountries = value.localizationCountries.size;
        return {
          movieId: value.movieId,
          titleName: `${value.titleName} (${formatMovieStatus(value.status)})`,
          status: value.status,
          socialAssets,
          socialCost: getUniversalCategoryCost(socialAssets, socialProject),
          localizationAssets,
          localizationCountries,
          localizationCost:
            getUniversalCategoryCost(localizationAssets, localizationProject) *
            localizationCountries,
          poNumber: getSummaryPoNumber(value.movieId),
          contactPersons: value.contactPersons,
        } satisfies UniversalBillingSummaryRow;
      })
      .sort((a, b) => a.titleName.localeCompare(b.titleName));
  };

  const [rows, completedTitleSummaryRows] = await Promise.all([
    buildRows(["WORKING", "COMPLETED"]),
    buildRows(["COMPLETED_BILLED"]),
  ]);

  return {
    client,
    reportType: "billing-summary",
    reportTitle: reportConfig.title,
    filters,
    titleOptions: titleOptions.map((movie) => ({
      id: movie.id,
      title: `${movie.title} (${formatMovieStatus(movie.status)})`,
      status: movie.status,
    })),
    rows,
    completedTitleSummaryRows,
    projectFound: true,
  };
}

function getMovieBillingUnits(movie: { billingUnitsJson: string | null }) {
  if (!movie.billingUnitsJson) return new Map<string, number>();
  try {
    const parsed = JSON.parse(movie.billingUnitsJson) as Record<
      string,
      unknown
    >;
    return new Map(
      Object.entries(parsed).map(([key, value]) => [key, Number(value || 0)]),
    );
  } catch {
    return new Map<string, number>();
  }
}

function calculateBillingHeadCost(
  costType: "WHOLE_COST" | "PER_UNIT_COST",
  cost: unknown,
  units: number | null | undefined,
) {
  const baseCost = Number(cost ?? 0);
  if (costType === "PER_UNIT_COST") return baseCost * Number(units || 0);
  return baseCost;
}

function formatMovieStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace("COMPLETED BILLED", "COMPLETED & BILLED");
}

function isUsCountry(country: { isoCode: string | null; name: string }) {
  return (
    (country.isoCode ?? "").toUpperCase() === "US" ||
    country.name.trim().toLowerCase() === "united states" ||
    country.name.trim().toLowerCase() === "usa"
  );
}

function isCanadaCountry(country: { isoCode: string | null; name: string }) {
  return (
    (country.isoCode ?? "").toUpperCase() === "CA" ||
    country.name.trim().toLowerCase() === "canada"
  );
}

async function getWarnerDeliverableEntryCountries(clientId: string) {
  return db.timeEntry.findMany({
    where: {
      project: { clientId },
      movieId: { not: null },
      countryId: { not: null },
    },
    select: {
      movieId: true,
      country: { select: { name: true, isoCode: true } },
      assetName: { select: { name: true } },
      taskName: true,
    },
  });
}

async function getWarnerIntlDeliverableEligibleMovieIds(clientId: string) {
  const entries = await getWarnerDeliverableEntryCountries(clientId);

  const eligibleMovieIds = new Set<string>();
  for (const entry of entries) {
    if (!entry.movieId || !entry.country) continue;
    if (isUsCountry(entry.country) || isCanadaCountry(entry.country)) continue;
    eligibleMovieIds.add(entry.movieId);
  }

  return Array.from(eligibleMovieIds);
}

async function getWarnerOtherDeliverableEligibleMovieIds(clientId: string) {
  const entries = await getWarnerDeliverableEntryCountries(clientId);
  const nonUsMovieIds = new Set<string>();
  const canadaMovieIds = new Set<string>();

  for (const entry of entries) {
    if (!entry.movieId || !entry.country) continue;
    if (!isUsCountry(entry.country)) nonUsMovieIds.add(entry.movieId);
    if (isCanadaCountry(entry.country)) canadaMovieIds.add(entry.movieId);
  }

  return {
    nonUsMovieIds: Array.from(nonUsMovieIds),
    canadaMovieIds: Array.from(canadaMovieIds),
  };
}

function getDeliverableReportTitle(
  reportType:
    | "domestic-deliverable"
    | "intl-deliverable"
    | "other-deliverable"
    | "portals"
    | "newsletters",
) {
  if (reportType === "intl-deliverable") return "Intl Deliverable";
  if (reportType === "other-deliverable") return "Other Deliverable";
  return "Domestic Deliverable";
}

async function getWarnerDeliverableData({
  clientId,
  filters,
  reportType,
  includeCompletedBilled = false,
}: {
  clientId: string;
  filters: WarnerDeliverableFilters;
  reportType:
    | "domestic-deliverable"
    | "intl-deliverable"
    | "other-deliverable"
    | "portals"
    | "newsletters";
  includeCompletedBilled?: boolean;
}): Promise<WarnerDomesticDeliverableData | null> {
  const isDomestic = reportType === "domestic-deliverable";
  const isIntl = reportType === "intl-deliverable";
  const isOther = reportType === "other-deliverable";
  const reportTitle = getDeliverableReportTitle(reportType);
  const allowedMovieStatuses: MovieStatus[] = includeCompletedBilled
    ? ["WORKING", "COMPLETED", "COMPLETED_BILLED"]
    : ["WORKING", "COMPLETED"];

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, hourlyCost: true },
  });
  if (!client) return null;

  const intlEligibleMovieIds = isIntl
    ? await getWarnerIntlDeliverableEligibleMovieIds(clientId)
    : null;
  const otherEligibleMovieIds = isOther
    ? await getWarnerOtherDeliverableEligibleMovieIds(clientId)
    : null;

  const movieOptions = await db.movie.findMany({
    where: {
      clientId,
      isActive: true,
      status: { in: allowedMovieStatuses },
      billingRegion: { not: "SOCIAL" as const },
      ...(!isDomestic
        ? { timeEntries: { some: { project: { clientId } } } }
        : {}),
      ...(isDomestic
        ? { billingDomestic: true }
        : isIntl
          ? { billingIntl: true, id: { in: intlEligibleMovieIds ?? [] } }
          : {
              OR: [
                {
                  billingOther: true,
                  id: { in: otherEligibleMovieIds?.nonUsMovieIds ?? [] },
                },
                {
                  billingIntl: true,
                  id: { in: otherEligibleMovieIds?.canadaMovieIds ?? [] },
                },
              ],
            }),
    },
    select: {
      id: true,
      title: true,
      status: true,
      billingOther: true,
      billingIntl: true,
    },
    orderBy: { title: "asc" },
  });

  const selectedMovieId = filters.movieId || "all";
  const selectedMovie = selectedMovieId
    ? await db.movie.findFirst({
        where: {
          id: selectedMovieId,
          clientId,
          isActive: true,
          status: { in: allowedMovieStatuses },
          billingRegion: { not: "SOCIAL" as const },
          ...(!isDomestic
            ? { timeEntries: { some: { project: { clientId } } } }
            : {}),
          ...(isDomestic
            ? { billingDomestic: true }
            : isIntl
              ? {
                  billingIntl: true,
                  AND: [{ id: { in: intlEligibleMovieIds ?? [] } }],
                }
              : {
                  OR: [
                    {
                      billingOther: true,
                      id: { in: otherEligibleMovieIds?.nonUsMovieIds ?? [] },
                    },
                    {
                      billingIntl: true,
                      id: { in: otherEligibleMovieIds?.canadaMovieIds ?? [] },
                    },
                  ],
                }),
        },
        select: {
          id: true,
          title: true,
          status: true,
          clientId: true,
          billingUnitsJson: true,
          billingDomestic: true,
          billingOther: true,
          billingIntl: true,
          contactPersons: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              email: true,
              country: { select: { isoCode: true } },
            },
          },
        },
      })
    : null;

  const mappedMovieOptions = movieOptions.map((movie) => ({
    id: movie.id,
    title: `${movie.title} (${formatMovieStatus(movie.status)})`,
    status: movie.status,
  }));

  const emptyData = (
    countryOptions: WarnerDomesticDeliverableData["countryOptions"] = [],
    selectedCountry: WarnerDomesticDeliverableData["selectedCountry"] = null,
  ): WarnerDomesticDeliverableData => ({
    client,
    reportType,
    reportTitle,
    filters: { movieId: selectedMovieId, countryId: filters.countryId || "" },
    movieOptions: mappedMovieOptions,
    countryOptions,
    selectedMovie: null,
    selectedCountry,
    rows: [],
    totalCost: 0,
    titleBlocks: [],
  });

  if (filters.movieId === "all") {
    const titleBlocks: NonNullable<
      WarnerDomesticDeliverableData["titleBlocks"]
    > = [];
    for (const movie of movieOptions) {
      const blockData = await getWarnerDeliverableData({
        clientId,
        reportType,
        filters: { movieId: movie.id, countryId: filters.countryId || "" },
      });
      if (
        blockData?.selectedMovie &&
        (blockData.rows.length > 0 || blockData.totalCost > 0)
      ) {
        titleBlocks.push({
          selectedMovie: blockData.selectedMovie,
          selectedCountry: blockData.selectedCountry,
          rows: blockData.rows,
          totalCost: blockData.totalCost,
        });
      }
    }
    return {
      client,
      reportType,
      reportTitle,
      filters: { movieId: "all", countryId: filters.countryId || "" },
      movieOptions: mappedMovieOptions,
      countryOptions: [],
      selectedMovie: null,
      selectedCountry: null,
      rows: [],
      totalCost: titleBlocks.reduce((sum, block) => sum + block.totalCost, 0),
      titleBlocks,
    };
  }

  if (!selectedMovie) return emptyData();

  let countryOptions: WarnerDomesticDeliverableData["countryOptions"] = [];
  let selectedCountry: WarnerDomesticDeliverableData["selectedCountry"] = null;
  let aggregateOtherCountries = false;

  if (!isDomestic) {
    const countryEntries = await db.timeEntry.findMany({
      where: {
        movieId: selectedMovie.id,
        project: { clientId },
        countryId: { not: null },
      },
      select: {
        country: { select: { id: true, name: true, isoCode: true } },
      },
    });

    const countryMap = new Map<
      string,
      { id: string; name: string; isoCode: string | null }
    >();
    for (const entry of countryEntries) {
      if (!entry.country) continue;
      const country = entry.country;
      if (isUsCountry(country)) continue;
      if (isIntl && isCanadaCountry(country)) continue;
      if (
        isOther &&
        !selectedMovie.billingOther &&
        !(selectedMovie.billingIntl && isCanadaCountry(country))
      )
        continue;
      countryMap.set(country.id, country);
    }
    countryOptions = Array.from(countryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    if (isOther) {
      aggregateOtherCountries = Boolean(
        !filters.countryId &&
        selectedMovie.billingOther &&
        countryOptions.length > 1,
      );
      const selectedCountryId = aggregateOtherCountries
        ? ""
        : filters.countryId || countryOptions[0]?.id || "";
      selectedCountry = selectedCountryId
        ? (countryOptions.find((country) => country.id === selectedCountryId) ??
          null)
        : null;

      if (!aggregateOtherCountries && !selectedCountry) {
        return {
          client,
          reportType,
          reportTitle,
          filters: {
            movieId: selectedMovie.id,
            countryId: filters.countryId || "",
          },
          movieOptions: mappedMovieOptions,
          countryOptions,
          selectedMovie: {
            id: selectedMovie.id,
            title: `${selectedMovie.title} (${formatMovieStatus(selectedMovie.status)})`,
            billingDomestic: selectedMovie.billingDomestic,
            billingIntl: selectedMovie.billingIntl,
            billingOther: selectedMovie.billingOther,
            contactPersons: selectedMovie.contactPersons,
          },
          selectedCountry: null,
          rows: [],
          totalCost: 0,
        };
      }
    }
  }

  const billingRegion: "domestic" | "intl" | "other" = isDomestic
    ? "domestic"
    : isOther
      ? "other"
      : "intl";
  const billingHeadRegion: "domestic" | "intl" | "other" = billingRegion;
  const unitsByHeadId = getMovieBillingUnits(selectedMovie);

  function getHeadCost(head: {
    domesticCost: unknown;
    intlCost: unknown;
    intlCanadaCost?: unknown;
    otherCost?: unknown;
  }) {
    if (billingHeadRegion === "domestic") return head.domesticCost;
    if (billingHeadRegion === "other") return head.otherCost ?? 0;
    return head.intlCost;
  }
  const rows: WarnerDomesticDeliverableLine[] = [];

  const compulsoryHeads = await db.movieBillingHead.findMany({
    where: {
      clientId,
      isActive: true,
      ...(billingHeadRegion === "domestic"
        ? { domesticActive: true, domesticCompulsionType: "FIXED_COMPULSORY" }
        : billingHeadRegion === "other"
          ? { otherActive: true, otherCompulsionType: "FIXED_COMPULSORY" }
          : { intlActive: true, intlCompulsionType: "FIXED_COMPULSORY" }),
    },
    orderBy: { name: "asc" },
  });

  for (const head of compulsoryHeads) {
    if (isIntl && head.name.trim().toLowerCase() === "ticketing") {
      rows.push({
        label: head.name,
        cost: Number(head.intlCost ?? 0),
        group: "Fixed - Compulsory",
        meta: undefined,
      });
      continue;
    }

    const units =
      unitsByHeadId.get(head.id) ?? (head.costType === "PER_UNIT_COST" ? 0 : 1);
    rows.push({
      label: head.name,
      cost: calculateBillingHeadCost(head.costType, getHeadCost(head), units),
      group: "Fixed - Compulsory",
      meta: isIntl
        ? undefined
        : head.costType === "PER_UNIT_COST"
          ? `Per-unit × ${units}`
          : "Whole cost",
    });
  }

  const optionalAssignmentWhere =
    isIntl || aggregateOtherCountries
      ? {
          clientId,
          movieId: selectedMovie.id,
          isActive: true,
          countryId: { in: countryOptions.map((country) => country.id) },
          billingHead: {
            is: {
              isActive: true,
              ...(isIntl
                ? {
                    intlActive: true,
                    intlCompulsionType: "FIXED_OPTIONAL" as const,
                  }
                : {
                    otherActive: true,
                    otherCompulsionType: "FIXED_OPTIONAL" as const,
                  }),
            },
          },
        }
      : {
          clientId,
          movieId: selectedMovie.id,
          isActive: true,
          ...(isDomestic
            ? { country: { is: { isoCode: "US" } } }
            : { countryId: selectedCountry?.id ?? "" }),
          billingHead: {
            is: {
              isActive: true,
              ...(billingHeadRegion === "domestic"
                ? {
                    domesticActive: true,
                    domesticCompulsionType: "FIXED_OPTIONAL" as const,
                  }
                : billingHeadRegion === "other"
                  ? {
                      otherActive: true,
                      otherCompulsionType: "FIXED_OPTIONAL" as const,
                    }
                  : {
                      intlActive: true,
                      intlCompulsionType: "FIXED_OPTIONAL" as const,
                    }),
            },
          },
        };

  const optionalAssignments = await db.movieBillingHeadAssignment.findMany({
    where: optionalAssignmentWhere,
    include: {
      billingHead: true,
      country: { select: { id: true, name: true, isoCode: true } },
    },
    orderBy: { billingHead: { name: "asc" } },
  });

  if (isIntl || aggregateOtherCountries) {
    const assignmentsByHead = new Map<string, typeof optionalAssignments>();
    for (const assignment of optionalAssignments) {
      const current = assignmentsByHead.get(assignment.billingHeadId) ?? [];
      current.push(assignment);
      assignmentsByHead.set(assignment.billingHeadId, current);
    }

    for (const assignments of assignmentsByHead.values()) {
      const firstAssignment = assignments[0];
      if (!firstAssignment) continue;
      const countries = assignments
        .map((assignment) => assignment.country)
        .filter(
          (
            country,
          ): country is { id: string; name: string; isoCode: string | null } =>
            Boolean(country),
        )
        .map((country) =>
          country.isoCode
            ? `${country.name} (${country.isoCode})`
            : country.name,
        )
        .sort((a, b) => a.localeCompare(b));
      const totalCost = assignments.reduce((sum, assignment) => {
        const units = Number(assignment.units ?? 0);
        return (
          sum +
          calculateBillingHeadCost(
            assignment.billingHead.costType,
            aggregateOtherCountries
              ? getHeadCost(assignment.billingHead)
              : assignment.billingHead.intlCost,
            units,
          )
        );
      }, 0);
      rows.push({
        label: firstAssignment.billingHead.name,
        cost: totalCost,
        group: "Fixed - Optional",
        meta: countries.length
          ? `Countries: ${Array.from(new Set(countries)).join(", ")}`
          : undefined,
      });
    }
  } else {
    for (const assignment of optionalAssignments) {
      const units = Number(assignment.units ?? 0);
      rows.push({
        label: assignment.billingHead.name,
        cost: calculateBillingHeadCost(
          assignment.billingHead.costType,
          getHeadCost(assignment.billingHead),
          units,
        ),
        group: "Fixed - Optional",
        meta:
          assignment.billingHead.costType === "PER_UNIT_COST"
            ? `Per-unit × ${units}`
            : "Whole cost",
      });
    }
  }

  const fixedFullProjects = await db.project.findMany({
    where: {
      clientId,
      addToBilling: true,
      billingModel: "FIXED_FULL",
      timeEntries: {
        some: {
          movieId: selectedMovie.id,
          ...(isDomestic
            ? {}
            : isIntl
              ? {
                  countryId: {
                    in: countryOptions.map((country) => country.id),
                  },
                }
              : aggregateOtherCountries
                ? {
                    countryId: {
                      in: countryOptions.map((country) => country.id),
                    },
                  }
                : { countryId: selectedCountry?.id ?? "" }),
        },
      },
    },
    select: {
      id: true,
      name: true,
      status: true,
      fixedContractHours: true,
      additionalCharges: true,
    },
    orderBy: { name: "asc" },
  });

  const lensAdjustments = await getLensBillingAdjustments({
    projectIds: fixedFullProjects.map((project) => project.id),
    movieId: selectedMovie.id,
    ...(isIntl || aggregateOtherCountries
      ? { countryIds: countryOptions.map((country) => country.id) }
      : isDomestic
        ? {}
        : selectedCountry
          ? { countryIds: [selectedCountry.id] }
          : {}),
  });

  for (const project of fixedFullProjects) {
    const lens = lensAdjustments.get(project.id);
    const fixedHoursCost =
      Number(project.fixedContractHours ?? 0) * Number(client.hourlyCost ?? 0);
    const additionalCharges = Number(project.additionalCharges ?? 0);
    rows.push({
      label: `${project.name} (${project.status.replaceAll("_", " ")})${lens ? ` (${lens.lensNames.join(", ")})` : ""}`,
      cost: lens ? lens.cost : fixedHoursCost + additionalCharges,
      group: "Fixed Full Projects",
      meta: lens
        ? `Lens Types: ${lens.lensNames.join(", ")}`
        : `${Number(project.fixedContractHours ?? 0)} hrs × ${formatUsd(Number(client.hourlyCost ?? 0))}${additionalCharges > 0 ? ` + ${formatUsd(additionalCharges)} additional` : ""}`,
    });
  }

  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);

  return {
    client,
    reportType,
    reportTitle,
    filters: {
      movieId: selectedMovie.id,
      countryId: selectedCountry?.id ?? "",
    },
    movieOptions: mappedMovieOptions,
    countryOptions,
    selectedMovie: {
      id: selectedMovie.id,
      title: `${selectedMovie.title} (${formatMovieStatus(selectedMovie.status)})`,
      billingDomestic: selectedMovie.billingDomestic,
      billingIntl: selectedMovie.billingIntl,
      billingOther: selectedMovie.billingOther,
      contactPersons: selectedMovie.contactPersons,
    },
    selectedCountry,
    rows,
    totalCost,
  };
}

export async function getWarnerDomesticDeliverableData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: WarnerDomesticDeliverableFilters;
}): Promise<WarnerDomesticDeliverableData | null> {
  return getWarnerDeliverableData({
    clientId,
    filters,
    reportType: "domestic-deliverable",
  });
}

export async function getWarnerIntlDeliverableData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: WarnerDeliverableFilters;
}): Promise<WarnerDomesticDeliverableData | null> {
  return getWarnerDeliverableData({
    clientId,
    filters,
    reportType: "intl-deliverable",
  });
}

export async function getWarnerOtherDeliverableData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: WarnerDeliverableFilters;
}): Promise<WarnerDomesticDeliverableData | null> {
  return getWarnerDeliverableData({
    clientId,
    filters,
    reportType: "other-deliverable",
  });
}

export type BillingHistoryFilters = {
  year: string;
  projectMonth: string;
  portalsMonth: string;
  dvdMonth: string;
  newsletterMonth: string;
};

export type BillingHistoryReportValue = {
  reportType: string;
  reportTitle: string;
  cost: number;
  poNumber: string;
};

export type BillingHistoryRow = {
  itemId: string;
  itemType: "TITLE" | "PROJECT" | "BILLING_REPORT" | "TITLE_PROJECT";
  itemName: string;
  titleName?: string;
  projectName?: string;
  billingRegion: string;
  billingDate: string;
  poNumber: string;
  status: string;
  titleStatus?: string;
  projectStatus?: string;
  billingModel?: string;
  billingMonth?: string;
  cost?: number;
  reportValues?: BillingHistoryReportValue[];
  movieId?: string;
  projectId?: string;
  billingReportType?: string;
  timeEntryCount: number;
  movieBillingHeadCount: number;
};

export type WarnerPortalProjectDetailRow = {
  id: string;
  projectId: string;
  date: string;
  taskName: string;
  taskDescription: string;
  hours: number;
};

export type WarnerPortalProjectRow = {
  projectId: string;
  projectName: string;
  status: string;
  billingModel: string;
  totalHours: number;
  cost: number;
  poNumber: string;
  billingMonth: string;
  contactPersons: Array<{ id?: string; name: string; email: string | null }>;
  detailRows: WarnerPortalProjectDetailRow[];
};

export type WarnerPortalReportData = {
  client: { id: string; name: string };
  reportType: "portals" | "dvd-sites";
  reportTitle: string;
  filters: { month: string };
  rows: WarnerPortalProjectRow[];
  totalHours: number;
  totalCost: number;
};

export type BillingHistorySection = {
  key: string;
  title: string;
  poAssignmentMode:
    | "TITLE"
    | "TITLE_BILLING_REPORT"
    | "TITLE_PROJECT"
    | "PROJECT"
    | "BILLING_REPORT";
  rows: BillingHistoryRow[];
  monthFilterParam?: string;
  monthFilterValue?: string;
};

export type BillingHistoryData = {
  client: { id: string; name: string; poAssignmentMode: string };
  filters: BillingHistoryFilters;
  summaryRows: BillingHistoryRow[];
  portalRows?: WarnerPortalProjectRow[];
  summarySections?: BillingHistorySection[];
  historySections?: BillingHistorySection[];
  historyRows: BillingHistoryRow[];
  rows: BillingHistoryRow[];
};

export function buildBillingHistoryFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  const getValue = (key: string) => {
    if (searchParams instanceof URLSearchParams)
      return searchParams.get(key) ?? undefined;
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const currentYear = String(new Date().getFullYear());
  const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const year = getValue("year") || currentYear;
  const projectMonth = getValue("projectMonth") || currentMonth;
  const portalsMonth = getValue("portalsMonth") || projectMonth;
  const dvdMonth = getValue("dvdMonth") || portalsMonth;
  const newsletterMonth = getValue("newsletterMonth") || projectMonth;
  return {
    year: /^\d{4}$/.test(year) ? year : currentYear,
    projectMonth: /^\d{4}-\d{2}$/.test(projectMonth)
      ? projectMonth
      : currentMonth,
    portalsMonth: /^\d{4}-\d{2}$/.test(portalsMonth)
      ? portalsMonth
      : currentMonth,
    dvdMonth: /^\d{4}-\d{2}$/.test(dvdMonth) ? dvdMonth : currentMonth,
    newsletterMonth: /^\d{4}-\d{2}$/.test(newsletterMonth)
      ? newsletterMonth
      : currentMonth,
  } satisfies BillingHistoryFilters;
}

function formatBillingRegion(value: string) {
  const labels: Record<string, string> = {
    DOMESTIC: "Domestic",
    INTL: "INTL",
    OTHER: "Other",
    SOCIAL: "Social",
    PORTAL: "Portal",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatMovieBillingRegions(movie: {
  billingDomestic?: boolean;
  billingIntl?: boolean;
  billingOther?: boolean;
  billingSocial?: boolean;
  billingPortal?: boolean;
  billingRegion?: string | null;
}) {
  const regions: string[] = [];
  if (movie.billingDomestic) regions.push("Domestic");
  if (movie.billingIntl) regions.push("INTL");
  if (movie.billingOther) regions.push("Other");
  if (movie.billingSocial) regions.push("Social");
  if (movie.billingPortal) regions.push("Portal");
  if (regions.length) return regions.join(", ");
  return movie.billingRegion ? formatBillingRegion(movie.billingRegion) : "-";
}

function isPortalOnlyBillingMovie(movie: {
  billingDomestic?: boolean;
  billingIntl?: boolean;
  billingOther?: boolean;
  billingSocial?: boolean;
  billingPortal?: boolean;
  billingRegion?: string | null;
}) {
  const hasNonPortalRegion = Boolean(
    movie.billingDomestic ||
    movie.billingIntl ||
    movie.billingOther ||
    movie.billingSocial,
  );
  if (hasNonPortalRegion) return false;
  return movie.billingPortal || movie.billingRegion === "PORTAL";
}

function formatEntityStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace("COMPLETED BILLED", "COMPLETED & BILLED");
}

function formatBillingModel(value: string) {
  const labels: Record<string, string> = {
    HOURLY: "Hourly",
    FIXED_FULL: "Fixed Full",
    FIXED_MONTHLY: "Fixed Monthly",
    FIXED_PER_COUNTRY: "Fixed Per Country",
    FIXED_COST: "Fixed Cost",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function parseYearMonth(value?: string | null) {
  const now = new Date();
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const safeValue = value && /^\d{4}-\d{2}$/.test(value) ? value : fallback;
  const [yearText, monthText] = safeValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return {
    value: safeValue,
    year,
    month,
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  };
}

function getReportLabel(reportType: string) {
  const labels: Record<string, string> = {
    "social-assets": "Social Assets",
    localization: "Localization",
    "wbhe-status": "WBHE Status",
    "domestic-deliverable": "Domestic Deliverable",
    "intl-deliverable": "Intl Deliverable",
    "other-deliverable": "Other Deliverable",
    portals: "Portals",
    "dvd-sites": "DVD Sites",
    "spe-main": "SPE Billing",
    "canada-other": "SPE US Ticketing, Canada & Other",
    newsletters: "Newsletters",
    "billing-summary": "Billing Summary",
  };
  return labels[reportType] ?? reportType.replaceAll("-", " ");
}

async function getGenericMovieBillingCostForSummary({
  clientId,
  movieId,
  projectId,
  includeCompletedBilled = false,
  billingMonth,
}: {
  clientId: string;
  movieId?: string;
  projectId?: string;
  includeCompletedBilled?: boolean;
  billingMonth?: string;
}) {
  const { getGenericBillingReportData } =
    await import("@/lib/billing-reports/generic");
  const monthRange = billingMonth ? parseYearMonth(billingMonth) : null;
  const defaults = getDefaultMonthRange();
  const openDateRange =
    clientId === SONY_PICTURES_CLASSICS_CLIENT_ID && !monthRange;
  const data = await getGenericBillingReportData({
    clientId,
    filters: {
      fromDate: openDateRange
        ? ""
        : monthRange
          ? `${monthRange.value}-01`
          : defaults.fromDate,
      toDate: openDateRange
        ? ""
        : monthRange
          ? new Date(monthRange.year, monthRange.month, 0)
              .toISOString()
              .slice(0, 10)
          : defaults.toDate,
      movieId: movieId ?? "all",
    },
    options: {
      movieSpecific: Boolean(movieId),
      openDateRange,
      includeCompletedBilled,
    },
  });

  if (!data) return 0;
  const blocks = data.titleBlocks?.length
    ? data.titleBlocks.flatMap((titleBlock) => titleBlock.blocks)
    : data.blocks;
  return blocks.reduce(
    (sum, block) =>
      sum +
      block.rows
        .filter((row) => !projectId || row.projectId === projectId)
        .reduce((rowSum, row) => rowSum + Number(row.cost ?? 0), 0),
    0,
  );
}

async function getFilmikBillingCostForSummary(
  projectId?: string,
  billingMonth?: string,
) {
  const { buildFilmikBillingReportFilters, getFilmikBillingReportData } =
    await import("@/lib/billing-reports/filmik");
  const filters = buildFilmikBillingReportFilters(
    billingMonth ? { month: billingMonth } : {},
  );
  const data = await getFilmikBillingReportData(filters);
  if (!data) return 0;
  if (projectId) {
    return data.combinedRows
      .filter((row) => row.key === projectId)
      .reduce((sum, row) => sum + Number(row.clientCost ?? 0), 0);
  }
  return Number(data.combinedTotalClientCost ?? 0);
}

async function getRoyalBillingCostForSummary({
  clientId,
  projectId,
}: {
  clientId: string;
  projectId?: string;
}) {
  const { buildRoyalBillingFilters, getRoyalBillingReportData } =
    await import("@/lib/billing-reports/royal");
  const filters = buildRoyalBillingFilters({});
  const data = await getRoyalBillingReportData({ clientId, filters });
  if (!data) return 0;
  if (projectId) {
    return data.rows
      .filter((row) => row.projectId === projectId)
      .reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0);
  }
  return Number(data.totals.totalCost ?? 0);
}

async function getProjectBillingCostForSummary({
  clientId,
  projectId,
  movieId,
  fallbackCost,
  includeCompletedBilled = false,
  billingMonth,
}: {
  clientId: string;
  projectId: string;
  movieId?: string;
  fallbackCost: number;
  includeCompletedBilled?: boolean;
  billingMonth?: string;
}) {
  let calculatedCost = 0;
  if (clientId === FILMIK_CLIENT_ID) {
    calculatedCost = await getFilmikBillingCostForSummary(
      projectId,
      billingMonth,
    );
  } else if (clientId === ROYAL_CARIBBEAN_CLIENT_ID) {
    calculatedCost = await getRoyalBillingCostForSummary({
      clientId,
      projectId,
    });
  } else {
    calculatedCost = await getGenericMovieBillingCostForSummary({
      clientId,
      movieId,
      projectId,
      includeCompletedBilled,
      billingMonth,
    });
  }
  return calculatedCost || fallbackCost;
}

function getDefaultBillingReportFiltersForSummary(
  movieId: string = "all",
): AmazonBillingReportFilters {
  const defaults = getDefaultMonthRange();
  return {
    fromDate: defaults.fromDate,
    toDate: defaults.toDate,
    movieId,
    assetTypeId: "all",
    assetNameId: "all",
    countryId: "all",
  };
}

async function getBillingReportCalculatedCostForSummary({
  clientId,
  reportType,
  movieId = "all",
  includeCompletedBilled = false,
  billingMonth,
}: {
  clientId: string;
  reportType: string;
  movieId?: string;
  includeCompletedBilled?: boolean;
  billingMonth?: string;
}) {
  if (reportType === "domestic-deliverable") {
    const data = await getWarnerDeliverableData({
      clientId,
      reportType: "domestic-deliverable",
      filters: { movieId, countryId: "" },
      includeCompletedBilled,
    });
    return Number(data?.totalCost ?? 0);
  }

  if (reportType === "intl-deliverable") {
    const data = await getWarnerDeliverableData({
      clientId,
      reportType: "intl-deliverable",
      filters: { movieId, countryId: "" },
      includeCompletedBilled,
    });
    return Number(data?.totalCost ?? 0);
  }

  if (reportType === "other-deliverable") {
    const data = await getWarnerDeliverableData({
      clientId,
      reportType: "other-deliverable",
      filters: { movieId, countryId: "" },
      includeCompletedBilled,
    });
    return Number(data?.totalCost ?? 0);
  }

  if (reportType === "portals" || reportType === "dvd-sites") {
    const data = await getWarnerPortalReportData({
      clientId,
      projectType: reportType === "dvd-sites" ? "DVD" : "PORTAL",
      reportType: reportType === "dvd-sites" ? "dvd-sites" : "portals",
      reportTitle: reportType === "dvd-sites" ? "DVD Sites" : "Portals",
    });
    return Number(data?.totalCost ?? 0);
  }

  if (reportType === "billing-summary") {
    const data = await getUniversalBillingSummaryData({
      clientId,
      filters: getDefaultBillingReportFiltersForSummary(movieId),
    });
    const rows = data?.rows ?? [];
    return rows.reduce(
      (sum, row) => sum + row.socialCost + row.localizationCost,
      0,
    );
  }

  const catalog = await db.client
    .findUnique({ where: { id: clientId }, select: { id: true, name: true } })
    .then((client) =>
      client ? getBillingReportCatalogForClient(client.name, client.id) : null,
    );
  const definition = catalog?.[reportType as AmazonReportType];

  if (definition?.kind === "generic-movie") {
    return getGenericMovieBillingCostForSummary({
      clientId,
      movieId,
      includeCompletedBilled,
    });
  }

  if (definition?.kind === "generic-filmik") {
    return getFilmikBillingCostForSummary(undefined, billingMonth);
  }

  const data = await getAmazonBillingReportData({
    clientId,
    reportType: reportType as AmazonReportType,
    filters: getDefaultBillingReportFiltersForSummary(movieId),
  });

  if (!data) return 0;

  return data.rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
}

export async function getWarnerPortalReportData({
  clientId,
  month,
  projectType = "PORTAL",
  reportType = projectType === "DVD" ? "dvd-sites" : "portals",
  reportTitle = projectType === "DVD" ? "DVD Sites" : "Portals",
}: {
  clientId: string;
  month?: string;
  projectType?: "PORTAL" | "DVD";
  reportType?: "portals" | "dvd-sites";
  reportTitle?: string;
}): Promise<WarnerPortalReportData | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, hourlyCost: true },
  });
  if (!client) return null;

  const monthRange = parseYearMonth(month);

  const projectTypeRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM Project
    WHERE clientId = ${clientId}
      AND isActive = 1
      AND addToBilling = 1
      AND warnerProjectType = ${projectType}
  `;
  const projectTypeIds = projectTypeRows.map((row) => row.id);

  const projects = projectTypeIds.length
    ? await db.project.findMany({
        where: {
          id: { in: projectTypeIds },
        },
        select: {
          id: true,
          name: true,
          status: true,
          billingModel: true,
          billingCycle: true,
          projectCost: true,
          perCountryCharges: true,
          fixedContractHours: true,
          fixedMonthlyHours: true,
          additionalCharges: true,
          partialBillingCost: true,
          contactPersons: {
            orderBy: { name: "asc" },
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  const projectIds = projects.map((project) => project.id);
  const poAssignments = projectIds.length
    ? await db.purchaseOrderAssignment.findMany({
        where: {
          clientId,
          projectId: { in: projectIds },
          OR: [
            { billingMonth: monthRange.month, billingYear: monthRange.year },
            { billingMonth: null, billingYear: null },
          ],
          purchaseOrder: { status: { not: "CANCELLED" } },
        },
        select: {
          projectId: true,
          billingMonth: true,
          billingYear: true,
          purchaseOrder: { select: { poNumber: true } },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const poByProject = new Map<string, string>();
  for (const assignment of poAssignments) {
    if (!assignment.projectId) continue;
    const isMonthSpecific =
      assignment.billingMonth === monthRange.month &&
      assignment.billingYear === monthRange.year;
    if (isMonthSpecific || !poByProject.has(assignment.projectId)) {
      poByProject.set(assignment.projectId, assignment.purchaseOrder.poNumber);
    }
  }

  const hourlyCost = Number(client.hourlyCost ?? 0);
  const fallbackProjectCost = (project: (typeof projects)[number]) => {
    if (project.billingModel === "FIXED_COST")
      return Number(project.projectCost ?? 0);
    if (project.billingModel === "FIXED_PER_COUNTRY")
      return Number(project.perCountryCharges ?? 0);
    if (project.billingModel === "FIXED_FULL") {
      return (
        Number(project.fixedContractHours ?? 0) * hourlyCost +
        Number(project.additionalCharges ?? 0) -
        Number(project.partialBillingCost ?? 0)
      );
    }
    if (project.billingModel === "FIXED_MONTHLY") {
      return Number(project.fixedMonthlyHours ?? 0) * hourlyCost;
    }
    return Number(project.projectCost ?? 0);
  };

  const timeEntries = projectIds.length
    ? await db.timeEntry.findMany({
        where: {
          projectId: { in: projectIds },
          workDate: { gte: monthRange.start, lt: monthRange.end },
        },
        select: {
          id: true,
          projectId: true,
          workDate: true,
          taskName: true,
          notes: true,
          minutesSpent: true,
        },
        orderBy: [
          { project: { name: "asc" } },
          { workDate: "asc" },
          { taskName: "asc" },
        ],
      })
    : [];

  const detailRowsByProject = new Map<string, WarnerPortalProjectDetailRow[]>();
  for (const entry of timeEntries) {
    const rows = detailRowsByProject.get(entry.projectId) ?? [];
    rows.push({
      id: entry.id,
      projectId: entry.projectId,
      date: formatDisplayDate(entry.workDate),
      taskName: entry.taskName || "-",
      taskDescription: entry.notes || "-",
      hours: Number(entry.minutesSpent ?? 0) / 60,
    });
    detailRowsByProject.set(entry.projectId, rows);
  }

  const minutesByProject = new Map<string, number>();
  for (const entry of timeEntries) {
    minutesByProject.set(
      entry.projectId,
      (minutesByProject.get(entry.projectId) ?? 0) +
        Number(entry.minutesSpent ?? 0),
    );
  }

  const rows = await Promise.all(
    projects.map(async (project) => {
      const totalHours = (minutesByProject.get(project.id) ?? 0) / 60;
      const calculatedCost = await getProjectBillingCostForSummary({
        clientId,
        projectId: project.id,
        fallbackCost: fallbackProjectCost(project),
        billingMonth: monthRange.value,
      });
      return {
        projectId: project.id,
        projectName: project.name,
        status: formatEntityStatus(project.status),
        billingModel: formatBillingModel(project.billingModel),
        totalHours,
        cost:
          project.billingModel === "HOURLY"
            ? totalHours * hourlyCost
            : calculatedCost,
        poNumber: poByProject.get(project.id) ?? "-",
        billingMonth: monthRange.value,
        contactPersons: project.contactPersons,
        detailRows: detailRowsByProject.get(project.id) ?? [],
      };
    }),
  );

  return {
    client: { id: client.id, name: client.name },
    reportType,
    reportTitle,
    filters: { month: monthRange.value },
    rows,
    totalHours: rows.reduce((sum, row) => sum + row.totalHours, 0),
    totalCost: rows.reduce((sum, row) => sum + row.cost, 0),
  };
}

export async function getBillingHistoryData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: BillingHistoryFilters;
}): Promise<BillingHistoryData | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, poAssignmentMode: true, hourlyCost: true },
  });
  if (!client) return null;

  const year = Number(filters.year);
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const poNumberByMovie = new Map<string, string>();
  const poNumberByProject = new Map<string, string>();
  const poNumberByReport = new Map<string, string>();
  const poNumberByMovieProject = new Map<string, string>();
  const poNumberByMovieReport = new Map<string, string>();
  const poAssignments = await db.purchaseOrderAssignment.findMany({
    where: {
      clientId,
      purchaseOrder: { status: { not: "CANCELLED" } },
    },
    select: {
      movieId: true,
      projectId: true,
      billingReportType: true,
      purchaseOrder: { select: { poNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const assignment of poAssignments) {
    const poNumber = assignment.purchaseOrder.poNumber;
    if (assignment.movieId && !poNumberByMovie.has(assignment.movieId)) {
      poNumberByMovie.set(assignment.movieId, poNumber);
    }
    if (assignment.projectId && !poNumberByProject.has(assignment.projectId)) {
      poNumberByProject.set(assignment.projectId, poNumber);
    }
    if (
      assignment.billingReportType &&
      !poNumberByReport.has(assignment.billingReportType)
    ) {
      poNumberByReport.set(assignment.billingReportType, poNumber);
    }
    if (assignment.movieId && assignment.projectId) {
      const key = `${assignment.movieId}:${assignment.projectId}`;
      if (!poNumberByMovieProject.has(key))
        poNumberByMovieProject.set(key, poNumber);
    }
    if (assignment.movieId && assignment.billingReportType) {
      const key = `${assignment.movieId}:${assignment.billingReportType}`;
      if (!poNumberByMovieReport.has(key))
        poNumberByMovieReport.set(key, poNumber);
    }
  }

  const movieSelect = {
    id: true,
    title: true,
    status: true,
    billingRegion: true,
    billingDomestic: true,
    billingIntl: true,
    billingOther: true,
    billingSocial: true,
    billingPortal: true,
    billingDate: true,
    _count: {
      select: {
        timeEntries: true,
        movieBillingHeadAssignments: true,
      },
    },
  } as const;

  const projectSelect = {
    id: true,
    name: true,
    status: true,
    billingModel: true,
    billingCycle: true,
    billingDate: true,
    projectCost: true,
    perCountryCharges: true,
    fixedContractHours: true,
    fixedMonthlyHours: true,
    additionalCharges: true,
    partialBillingCost: true,
    _count: {
      select: {
        timeEntries: true,
      },
    },
  } as const;

  const formatMoney = (value: number) => (Number.isFinite(value) ? value : 0);
  const getSimpleProjectCost = (project: {
    billingModel: string;
    projectCost?: unknown;
    perCountryCharges?: unknown;
    fixedContractHours?: unknown;
    fixedMonthlyHours?: unknown;
    additionalCharges?: unknown;
    partialBillingCost?: unknown;
  }) => {
    const hourlyCost = Number(client.hourlyCost ?? 0);
    if (project.billingModel === "FIXED_COST")
      return Number(project.projectCost ?? 0);
    if (project.billingModel === "FIXED_PER_COUNTRY")
      return Number(project.perCountryCharges ?? 0);
    if (project.billingModel === "FIXED_FULL") {
      return (
        Number(project.fixedContractHours ?? 0) * hourlyCost +
        Number(project.additionalCharges ?? 0) -
        Number(project.partialBillingCost ?? 0)
      );
    }
    if (project.billingModel === "FIXED_MONTHLY")
      return Number(project.fixedMonthlyHours ?? 0) * hourlyCost;
    return Number(project.projectCost ?? 0);
  };

  if (client.poAssignmentMode === "PROJECT") {
    const projectMonthRange = parseYearMonth(filters.projectMonth);
    const currentBillingMonth = projectMonthRange.month;
    const currentBillingYear = projectMonthRange.year;
    const [summaryProjects, oneTimeHistoryProjects, monthlyBillingRecords] =
      await Promise.all([
        db.project.findMany({
          where: {
            clientId,
            isActive: true,
            addToBilling: true,
            OR: [
              {
                billingCycle: "MONTHLY",
                status: { in: ["ACTIVE", "COMPLETED"] },
              },
              {
                billingCycle: "ONE_TIME",
                billingModel: { not: "FIXED_MONTHLY" },
                status: { in: ["ACTIVE", "COMPLETED"] },
              },
            ],
          },
          select: projectSelect,
          orderBy: { name: "asc" },
        }),
        db.project.findMany({
          where: {
            clientId,
            isActive: true,
            addToBilling: true,
            billingCycle: "ONE_TIME",
            billingModel: { not: "FIXED_MONTHLY" },
            status: "COMPLETED_BILLED",
            billingDate: { gte: start, lt: end },
          },
          select: projectSelect,
          orderBy: [{ billingDate: "desc" }, { name: "asc" }],
        }),
        db.billingRecord.findMany({
          where: {
            clientId,
            projectId: { not: null },
            billingYear: year,
          },
          include: {
            project: { select: projectSelect },
            purchaseOrder: { select: { poNumber: true } },
          },
          orderBy: [{ billingYear: "desc" }, { billingMonth: "desc" }],
        }),
      ]);
    const billedMonthlyKeys = new Set(
      monthlyBillingRecords
        .filter((record) => record.billingMonth && record.billingYear)
        .map(
          (record) =>
            `${record.projectId}:${record.billingYear}:${record.billingMonth}`,
        ),
    );
    const pendingSummaryProjects = summaryProjects.filter(
      (project) =>
        project.billingCycle !== "MONTHLY" ||
        !billedMonthlyKeys.has(
          `${project.id}:${currentBillingYear}:${currentBillingMonth}`,
        ),
    );
    const historyProjects = oneTimeHistoryProjects;

    const mapProjectRow = async (
      project: (typeof summaryProjects)[number],
      includeCompletedBilled = false,
      monthly?: {
        month: number;
        year: number;
        amount?: unknown;
        poNumber?: string | null;
        billingDate?: Date | null;
      },
    ): Promise<BillingHistoryRow> => ({
      itemId: monthly
        ? `${project.id}:${monthly.year}:${monthly.month}`
        : project.id,
      itemType: "PROJECT",
      itemName: project.name,
      projectId: project.id,
      billingRegion: "Project",
      billingModel: formatBillingModel(project.billingModel),
      cost: monthly
        ? formatMoney(Number(monthly.amount ?? 0))
        : formatMoney(
            await getProjectBillingCostForSummary({
              clientId,
              projectId: project.id,
              fallbackCost: getSimpleProjectCost(project),
              includeCompletedBilled,
              billingMonth:
                project.billingCycle === "MONTHLY"
                  ? projectMonthRange.value
                  : undefined,
            }),
          ),
      billingDate: monthly?.billingDate
        ? formatDisplayDate(monthly.billingDate)
        : project.billingDate
          ? formatDisplayDate(project.billingDate)
          : "-",
      billingMonth: monthly
        ? `${monthly.year}-${String(monthly.month).padStart(2, "0")}`
        : project.billingCycle === "MONTHLY"
          ? `${currentBillingYear}-${String(currentBillingMonth).padStart(2, "0")}`
          : undefined,
      poNumber: monthly?.poNumber ?? poNumberByProject.get(project.id) ?? "-",
      status: formatEntityStatus(project.status),
      timeEntryCount: project._count.timeEntries,
      movieBillingHeadCount: 0,
    });

    const summaryRows = await Promise.all(
      pendingSummaryProjects.map((project) => mapProjectRow(project)),
    );
    const historyRows = await Promise.all(
      historyProjects
        .map((project) => mapProjectRow(project, true))
        .concat(
          monthlyBillingRecords
            .filter((record) => record.project)
            .map((record) =>
              mapProjectRow(record.project!, true, {
                month: record.billingMonth ?? 0,
                year: record.billingYear ?? year,
                amount: record.amount,
                poNumber: record.purchaseOrder?.poNumber ?? null,
                billingDate: record.billingDate,
              }),
            ),
        ),
    );
    return { client, filters, summaryRows, historyRows, rows: historyRows };
  }

  if (client.poAssignmentMode === "TITLE_PROJECT") {
    const [summaryEntries, historyEntries] = await Promise.all([
      db.timeEntry.findMany({
        where: {
          project: {
            clientId,
            isActive: true,
            addToBilling: true,
            billingModel: { not: "FIXED_MONTHLY" },
          },
          movie: {
            clientId,
            isActive: true,
            status: { in: ["WORKING", "COMPLETED"] },
          },
        },
        select: {
          movie: { select: movieSelect },
          project: { select: projectSelect },
        },
      }),
      db.timeEntry.findMany({
        where: {
          project: {
            clientId,
            isActive: true,
            addToBilling: true,
            billingModel: { not: "FIXED_MONTHLY" },
            status: "COMPLETED_BILLED",
            billingDate: { gte: start, lt: end },
          },
          movie: { clientId, isActive: true },
        },
        select: {
          movie: { select: movieSelect },
          project: { select: projectSelect },
        },
      }),
    ]);

    type TitleProjectEntry = (typeof summaryEntries)[number] & {
      movie: NonNullable<(typeof summaryEntries)[number]["movie"]>;
      project: NonNullable<(typeof summaryEntries)[number]["project"]>;
    };

    const hasMovieAndProject = (
      entry: (typeof summaryEntries)[number],
    ): entry is TitleProjectEntry => Boolean(entry.movie && entry.project);

    const makeRows = async (
      entries: typeof summaryEntries,
      includeCompletedBilled = false,
    ) => {
      const byPair = new Map<string, TitleProjectEntry>();

      for (const entry of entries) {
        if (!hasMovieAndProject(entry)) continue;

        byPair.set(`${entry.movie.id}:${entry.project.id}`, entry);
      }

      return Promise.all(
        Array.from(byPair.values())
          .sort((a, b) =>
            `${a.project.name} ${a.movie.title}`.localeCompare(
              `${b.project.name} ${b.movie.title}`,
            ),
          )
          .map(async (entry): Promise<BillingHistoryRow> => {
            const movie = entry.movie;
            const project = entry.project;
            const key = `${movie.id}:${project.id}`;

            return {
              itemId: key,
              itemType: "TITLE_PROJECT",
              itemName: `${project.name} - ${movie.title}`,
              titleName: movie.title,
              projectName: project.name,
              movieId: movie.id,
              projectId: project.id,
              billingRegion: formatMovieBillingRegions(movie),
              billingModel: formatBillingModel(project.billingModel),
              billingDate: project.billingDate
                ? formatDisplayDate(project.billingDate)
                : "-",
              poNumber:
                poNumberByMovieProject.get(key) ??
                poNumberByProject.get(project.id) ??
                poNumberByMovie.get(movie.id) ??
                "-",
              status: formatEntityStatus(project.status),
              titleStatus: formatEntityStatus(movie.status),
              projectStatus: formatEntityStatus(project.status),
              cost: formatMoney(
                await getProjectBillingCostForSummary({
                  clientId,
                  projectId: project.id,
                  movieId: movie.id,
                  fallbackCost: getSimpleProjectCost(project),
                  includeCompletedBilled,
                }),
              ),
              timeEntryCount: project._count.timeEntries,
              movieBillingHeadCount: movie._count.movieBillingHeadAssignments,
            };
          }),
      );
    };

    const summaryRows = await makeRows(summaryEntries);
    const historyRows = await makeRows(historyEntries, true);
    return { client, filters, summaryRows, historyRows, rows: historyRows };
  }

  if (client.poAssignmentMode === "BILLING_REPORT") {
    const catalog =
      getBillingReportCatalogForClient(client.name, client.id) ?? {};
    const reportRows = await Promise.all(
      Object.entries(catalog)
        .filter(([reportType]) => !reportType.includes("history"))
        .map(async ([reportType, definition]) => ({
          itemId: reportType,
          itemType: "BILLING_REPORT" as const,
          itemName: definition?.title ?? getReportLabel(reportType),
          billingReportType: reportType,
          billingRegion: "Billing Report",
          billingDate: "-",
          poNumber: poNumberByReport.get(reportType) ?? "-",
          status: "Pending",
          cost: await getBillingReportCalculatedCostForSummary({
            clientId,
            reportType,
            billingMonth: filters.projectMonth,
          }),
          timeEntryCount: 0,
          movieBillingHeadCount: 0,
        })),
    );

    return {
      client,
      filters,
      summaryRows: reportRows,
      historyRows: [],
      rows: [],
    };
  }

  const [summaryMovies, historyMovies] = await Promise.all([
    db.movie.findMany({
      where: {
        clientId,
        isActive: true,
        status: { in: ["WORKING", "COMPLETED"] },
      },
      select: movieSelect,
      orderBy: { title: "asc" },
    }),
    db.movie.findMany({
      where: {
        clientId,
        isActive: true,
        status: "COMPLETED_BILLED",
        billingDate: { gte: start, lt: end },
      },
      select: movieSelect,
      orderBy: [{ billingDate: "desc" }, { title: "asc" }],
    }),
  ]);

  const mapMovieRow = (
    movie: (typeof summaryMovies)[number],
  ): BillingHistoryRow => ({
    itemId: movie.id,
    itemType: "TITLE",
    itemName: movie.title,
    movieId: movie.id,
    billingRegion: formatMovieBillingRegions(movie),
    billingDate: movie.billingDate ? formatDisplayDate(movie.billingDate) : "-",
    poNumber: poNumberByMovie.get(movie.id) ?? "-",
    status: formatEntityStatus(movie.status),
    titleStatus: formatEntityStatus(movie.status),
    timeEntryCount: movie._count.timeEntries,
    movieBillingHeadCount: movie._count.movieBillingHeadAssignments,
  });

  const shouldIgnorePortalOnlyTitles = client.id === WARNER_BROS_CLIENT_ID;
  const visibleSummaryMovies = shouldIgnorePortalOnlyTitles
    ? summaryMovies.filter((movie) => !isPortalOnlyBillingMovie(movie))
    : summaryMovies;
  const visibleHistoryMovies = shouldIgnorePortalOnlyTitles
    ? historyMovies.filter((movie) => !isPortalOnlyBillingMovie(movie))
    : historyMovies;

  const reportDefinitions = Object.entries(
    getBillingReportCatalogForClient(client.name, client.id) ?? {},
  ).filter(
    ([reportType, definition]) =>
      !reportType.includes("history") &&
      definition?.poAssignmentMode !== "TITLE_PROJECT" &&
      definition?.kind !== "warner-portals",
  );
  const withReportValues = async (
    row: BillingHistoryRow,
    includeCompletedBilled = false,
  ): Promise<BillingHistoryRow> =>
    client.poAssignmentMode === "TITLE_BILLING_REPORT"
      ? {
          ...row,
          cost: await getBillingReportCalculatedCostForSummary({
            clientId,
            reportType: "social-assets",
            movieId: row.movieId ?? "all",
            includeCompletedBilled,
            billingMonth: filters.projectMonth,
          }),
          reportValues: await Promise.all(
            reportDefinitions.map(async ([reportType, definition]) => ({
              reportType,
              reportTitle: definition?.title ?? getReportLabel(reportType),
              cost: await getBillingReportCalculatedCostForSummary({
                clientId,
                reportType,
                movieId: row.movieId ?? "all",
                includeCompletedBilled,
                billingMonth: filters.projectMonth,
              }),
              poNumber:
                poNumberByMovieReport.get(`${row.movieId}:${reportType}`) ??
                poNumberByMovie.get(row.movieId ?? "") ??
                poNumberByReport.get(reportType) ??
                "-",
            })),
          ),
        }
      : {
          ...row,
          cost: await getBillingReportCalculatedCostForSummary({
            clientId,
            reportType: "social-assets",
            movieId: row.movieId ?? "all",
            includeCompletedBilled,
            billingMonth: filters.projectMonth,
          }),
        };

  const summaryRows = await Promise.all(
    visibleSummaryMovies.map((movie) => withReportValues(mapMovieRow(movie))),
  );
  const historyRows = await Promise.all(
    visibleHistoryMovies.map((movie) =>
      withReportValues(mapMovieRow(movie), true),
    ),
  );
  const portalRows =
    client.id === WARNER_BROS_CLIENT_ID
      ? ((
          await getWarnerPortalReportData({
            clientId,
            month: filters.portalsMonth,
            projectType: "PORTAL",
            reportType: "portals",
            reportTitle: "Portals",
          })
        )?.rows ?? [])
      : undefined;
  const dvdRows =
    client.id === WARNER_BROS_CLIENT_ID
      ? ((
          await getWarnerPortalReportData({
            clientId,
            month: filters.dvdMonth,
            projectType: "DVD",
            reportType: "dvd-sites",
            reportTitle: "DVD Sites",
          })
        )?.rows ?? [])
      : undefined;
  const toProjectSummaryRows = (
    rows: WarnerPortalProjectRow[] | undefined,
    label: string,
  ) =>
    (rows ?? []).map(
      (row): BillingHistoryRow => ({
        itemId: `${label.toLowerCase().replaceAll(" ", "-")}:${row.projectId}:${row.billingMonth}`,
        itemType: "PROJECT",
        itemName: row.projectName,
        projectName: row.projectName,
        projectId: row.projectId,
        billingRegion: label,
        billingModel: row.billingModel,
        billingMonth: row.billingMonth,
        billingDate: "-",
        poNumber: row.poNumber,
        status: row.status,
        projectStatus: row.status,
        cost: row.cost,
        timeEntryCount: 0,
        movieBillingHeadCount: 0,
      }),
    );
  const portalSummaryRows = toProjectSummaryRows(portalRows, "Portals");
  const dvdSummaryRows = toProjectSummaryRows(dvdRows, "DVD Sites");
  const getWarnerProjectTypeBillingRecordRows = async (
    projectType: "PORTAL" | "DVD",
    label: string,
  ): Promise<BillingHistoryRow[]> => {
    if (client.id !== WARNER_BROS_CLIENT_ID) return [];
    const projectTypeRows = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM Project
      WHERE clientId = ${clientId}
        AND isActive = 1
        AND addToBilling = 1
        AND warnerProjectType = ${projectType}
    `;
    const projectTypeIds = projectTypeRows.map((row) => row.id);
    if (!projectTypeIds.length) return [];

    const records = (await db.billingRecord.findMany({
      where: {
        clientId,
        projectId: { in: projectTypeIds },
        billingYear: year,
      },
      include: {
        project: { select: projectSelect },
        purchaseOrder: { select: { poNumber: true } },
      },
      orderBy: [
        { billingYear: "desc" },
        { billingMonth: "desc" },
        { billingDate: "desc" },
      ],
    })) as Array<
      Awaited<ReturnType<typeof db.billingRecord.findMany>>[number] & {
        project: {
          id: string;
          name: string;
          status: string;
          billingModel: string;
          billingCycle: string;
          billingDate: Date | null;
          projectCost: unknown;
          perCountryCharges: unknown;
          fixedContractHours: unknown;
          fixedMonthlyHours: unknown;
          additionalCharges: unknown;
          partialBillingCost: unknown;
          _count: { timeEntries: number };
        } | null;
        purchaseOrder: { poNumber: string } | null;
      }
    >;
    return records
      .filter((record) => record.project)
      .map(
        (record): BillingHistoryRow => ({
          itemId: `${label.toLowerCase().replaceAll(" ", "-")}:${record.projectId}:${record.billingYear}:${record.billingMonth}`,
          itemType: "PROJECT",
          itemName: record.project?.name ?? "-",
          projectName: record.project?.name ?? "-",
          projectId: record.projectId ?? undefined,
          billingRegion: label,
          billingModel: record.project
            ? formatBillingModel(record.project.billingModel)
            : "-",
          billingMonth:
            record.billingYear && record.billingMonth
              ? `${record.billingYear}-${String(record.billingMonth).padStart(2, "0")}`
              : undefined,
          billingDate: formatDisplayDate(record.billingDate),
          poNumber:
            record.purchaseOrder?.poNumber ??
            poNumberByProject.get(record.projectId ?? "") ??
            "-",
          status: record.project
            ? formatEntityStatus(record.project.status)
            : "-",
          projectStatus: record.project
            ? formatEntityStatus(record.project.status)
            : "-",
          cost: Number(record.amount ?? 0),
          timeEntryCount: record.project?._count.timeEntries ?? 0,
          movieBillingHeadCount: 0,
        }),
      );
  };
  const portalHistoryRows = await getWarnerProjectTypeBillingRecordRows(
    "PORTAL",
    "Portals",
  );
  const dvdHistoryRows = await getWarnerProjectTypeBillingRecordRows(
    "DVD",
    "DVD Sites",
  );
  return {
    client,
    filters,
    summaryRows,
    portalRows,
    summarySections:
      client.id === WARNER_BROS_CLIENT_ID
        ? [
            {
              key: "title-billing-report",
              title: "Billing Summary",
              poAssignmentMode: "TITLE_BILLING_REPORT",
              rows: summaryRows,
            },
            {
              key: "portals",
              title: "Portals",
              poAssignmentMode: "PROJECT",
              rows: portalSummaryRows,
              monthFilterParam: "portalsMonth",
              monthFilterValue: filters.portalsMonth,
            },
            {
              key: "dvd-sites",
              title: "DVD Sites",
              poAssignmentMode: "PROJECT",
              rows: dvdSummaryRows,
              monthFilterParam: "dvdMonth",
              monthFilterValue: filters.dvdMonth,
            },
          ]
        : undefined,
    historySections:
      client.id === WARNER_BROS_CLIENT_ID
        ? [
            {
              key: "title-billing-report-history",
              title: `${client.name} Billing Summary & History`,
              poAssignmentMode: "TITLE_BILLING_REPORT",
              rows: historyRows,
            },
            {
              key: "portal-history",
              title: "Portals Billing History",
              poAssignmentMode: "TITLE_PROJECT",
              rows: portalHistoryRows,
            },
            {
              key: "dvd-sites-history",
              title: "DVD Sites Billing History",
              poAssignmentMode: "TITLE_PROJECT",
              rows: dvdHistoryRows,
            },
          ]
        : undefined,
    historyRows,
    rows: historyRows,
  };
}

export function sanitizeFileSegment(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "report"
  );
}

export function getExportTimestamp() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}
