import { db } from "@/lib/db";
import { FILMIK_CLIENT_ID, SONY_PICTURES_CLASSICS_CLIENT_ID, SONY_PICTURES_CLIENT_ID } from "@/lib/billing-reports/config";

export type AmazonReportType =
  | "social-assets"
  | "localization"
  | "wbhe-status"
  | "domestic-deliverable"
  | "intl-deliverable"
  | "other-deliverable"
  | "spe-main"
  | "canada-other"
  | "newsletters";

export type AmazonBillingReportFilters = {
  fromDate: string;
  toDate: string;
  movieId: string;
  assetTypeId: string;
};

export type AmazonBillingReportRow = {
  date: string;
  titleName: string;
  assetName: string;
  territoryVariant?: string;
  assetType: string;
  cost: number;
  contactPerson: string;
};

export type AmazonBillingReportSummaryRow = {
  assetType: string;
  totalAssets: number;
  totalCost: number;
};

export type AmazonBillingReportData = {
  client: { id: string; name: string };
  reportType: AmazonReportType;
  reportTitle: string;
  projectName: string;
  filters: AmazonBillingReportFilters;
  movieOptions: { id: string; title: string; status?: string }[];
  assetTypeOptions: { id: string; name: string }[];
  rows: AmazonBillingReportRow[];
  summaryRows: AmazonBillingReportSummaryRow[];
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
  reportType: "domestic-deliverable" | "intl-deliverable" | "other-deliverable"
  | "newsletters";
  reportTitle: string;
  filters: WarnerDeliverableFilters;
  movieOptions: { id: string; title: string; status: string }[];
  countryOptions: { id: string; name: string; isoCode: string | null }[];
  selectedMovie: { id: string; title: string } | null;
  selectedCountry: { id: string; name: string; isoCode: string | null } | null;
  rows: WarnerDomesticDeliverableLine[];
  totalCost: number;
};

export const AMAZON_CLIENT_NAME = "Amazon Studios";
export const UNIVERSAL_CLIENT_NAME = "Universal Pictures International";
export const WARNER_CLIENT_NAME = "Warner Bros. Entertainment Inc.";
export const SONY_PICTURES_CLIENT_NAME = "Sony Pictures Entertainment";
export const SONY_PICTURES_CLASSICS_CLIENT_NAME = "Sony Pictures Classics";
export const FILMIK_CLIENT_NAME = "Filmik";

export type BillingReportDefinition = {
  title: string;
  projectName: string;
  includeLanguage: boolean;
  includeCountry: boolean;
  kind?: "time-entry" | "deliverable" | "placeholder" | "generic-movie" | "generic-filmik" | "sony-movie" | "sony-newsletters";
};

export const AMAZON_REPORTS: Partial<Record<AmazonReportType, BillingReportDefinition>> = {
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
};

export const UNIVERSAL_REPORTS: Partial<Record<AmazonReportType, BillingReportDefinition>> = {
  "social-assets": {
    title: "UNI Social Status",
    projectName: "UNI Social QC",
    includeLanguage: false,
    includeCountry: false,
    kind: "time-entry",
  },
  localization: {
    title: "UNI Localization Status",
    projectName: "UNI Social Localization",
    includeLanguage: false,
    includeCountry: true,
    kind: "time-entry",
  },
};

export const WARNER_REPORTS: Partial<Record<AmazonReportType, BillingReportDefinition>> = {
  "wbhe-status": {
    title: "WBHE Status",
    projectName: "WB Home Entertainment (Social)",
    includeLanguage: false,
    includeCountry: false,
    kind: "time-entry",
  },
  "domestic-deliverable": {
    title: "Domestic Deliverable",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "deliverable",
  },
  "intl-deliverable": {
    title: "Intl Deliverable",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "deliverable",
  },
  "other-deliverable": {
    title: "Other Deliverable",
    projectName: "",
    includeLanguage: false,
    includeCountry: false,
    kind: "deliverable",
  },
};

export const SONY_PICTURES_REPORTS: Partial<Record<AmazonReportType, BillingReportDefinition>> = {
  "spe-main": { title: "SPE Billing", projectName: "", includeLanguage: false, includeCountry: false, kind: "sony-movie" },
  "canada-other": { title: "SPE Canada & Other", projectName: "", includeLanguage: false, includeCountry: false, kind: "sony-movie" },
  newsletters: { title: "Newsletters", projectName: "Newsletters", includeLanguage: false, includeCountry: false, kind: "sony-newsletters" },
};

export const SONY_PICTURES_CLASSICS_REPORTS: Partial<Record<AmazonReportType, BillingReportDefinition>> = {
  "social-assets": { title: "Sony Pictures Classics Billing", projectName: "", includeLanguage: false, includeCountry: false, kind: "generic-movie" },
};

export const FILMIK_REPORTS: Partial<Record<AmazonReportType, BillingReportDefinition>> = {
  "social-assets": { title: "Filmik Billing", projectName: "", includeLanguage: false, includeCountry: false, kind: "generic-filmik" },
};

export function getBillingReportCatalogForClient(clientName: string, clientId?: string) {
  const normalizedClientName = clientName.trim().toLowerCase();
  if (normalizedClientName === AMAZON_CLIENT_NAME.toLowerCase()) return AMAZON_REPORTS;
  if (normalizedClientName === UNIVERSAL_CLIENT_NAME.toLowerCase()) return UNIVERSAL_REPORTS;
  if (normalizedClientName === WARNER_CLIENT_NAME.toLowerCase()) return WARNER_REPORTS;
  if (clientId === SONY_PICTURES_CLIENT_ID || normalizedClientName === SONY_PICTURES_CLIENT_NAME.toLowerCase()) return SONY_PICTURES_REPORTS;
  if (clientId === SONY_PICTURES_CLASSICS_CLIENT_ID || normalizedClientName === SONY_PICTURES_CLASSICS_CLIENT_NAME.toLowerCase()) return SONY_PICTURES_CLASSICS_REPORTS;
  if (clientId === FILMIK_CLIENT_ID || normalizedClientName === FILMIK_CLIENT_NAME.toLowerCase()) return FILMIK_REPORTS;
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
  const allowed = getBillingReportCatalogForClient(clientName ?? "", clientId) ?? AMAZON_REPORTS;
  if (value && Object.prototype.hasOwnProperty.call(allowed, value)) return value as AmazonReportType;

  const firstConfiguredReport = Object.keys(allowed)[0] as AmazonReportType | undefined;
  if (firstConfiguredReport) return firstConfiguredReport;

  return isWarnerBillingReportClient(clientName ?? "") ? "wbhe-status" : "social-assets";
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
    toDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export function normalizeDateInput(value: string | null | undefined, fallback: string) {
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

export function buildAmazonBillingReportFilters(searchParams: URLSearchParams | Record<string, string | string[] | undefined>) {
  const defaults = getDefaultMonthRange();
  const getValue = (key: string) => {
    if (searchParams instanceof URLSearchParams) return searchParams.get(key) ?? undefined;
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    fromDate: normalizeDateInput(getValue("fromDate"), defaults.fromDate),
    toDate: normalizeDateInput(getValue("toDate"), defaults.toDate),
    movieId: getValue("movieId") || "all",
    assetTypeId: getValue("assetTypeId") || "all",
  } satisfies AmazonBillingReportFilters;
}

export function buildWarnerDeliverableFilters(searchParams: URLSearchParams | Record<string, string | string[] | undefined>) {
  const getValue = (key: string) => {
    if (searchParams instanceof URLSearchParams) return searchParams.get(key) ?? undefined;
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    movieId: getValue("movieId") || "",
    countryId: getValue("countryId") || "",
  } satisfies WarnerDeliverableFilters;
}

export function buildWarnerDomesticDeliverableFilters(searchParams: URLSearchParams | Record<string, string | string[] | undefined>) {
  return buildWarnerDeliverableFilters(searchParams);
}

function buildContactPersonLabel(contactPersons: { name: string; email: string }[]) {
  if (!contactPersons.length) return "-";
  return contactPersons.map((person) => `${person.name}${person.email ? ` (${person.email})` : ""}`).join(", ");
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

  const reportCatalog = getBillingReportCatalogForClient(client.name, client.id);
  if (!reportCatalog) return null;

  const reportConfig = reportCatalog[reportType];
  if (!reportConfig || reportConfig.kind !== "time-entry") return null;

  const project = await db.project.findFirst({
    where: {
      clientId,
      name: reportConfig.projectName,
    },
    select: {
      id: true,
      name: true,
      projectCost: true,
      contactPersons: {
        orderBy: { name: "asc" },
        select: { name: true, email: true },
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
      contactPersons: "-",
      projectFound: false,
    };
  }

  const projectEntriesForOptions = await db.timeEntry.findMany({
    where: { projectId: project.id },
    select: {
      movie: { select: { id: true, title: true } },
      assetType: { select: { id: true, name: true } },
    },
    orderBy: { workDate: "desc" },
  });

  const movieOptionMap = new Map<string, { id: string; title: string }>();
  const assetTypeOptionMap = new Map<string, { id: string; name: string }>();

  for (const entry of projectEntriesForOptions) {
    if (entry.movie) {
      movieOptionMap.set(entry.movie.id, { id: entry.movie.id, title: entry.movie.title });
    }
    if (entry.assetType) {
      assetTypeOptionMap.set(entry.assetType.id, { id: entry.assetType.id, name: entry.assetType.name });
    }
  }

  const movieOptions = Array.from(movieOptionMap.values()).sort((a, b) => a.title.localeCompare(b.title));
  const assetTypeOptions = Array.from(assetTypeOptionMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const fromBoundary = new Date(`${filters.fromDate}T00:00:00`);
  const toBoundary = new Date(`${filters.toDate}T23:59:59.999`);

  const entries = await db.timeEntry.findMany({
    where: {
      projectId: project.id,
      workDate: { gte: fromBoundary, lte: toBoundary },
      ...(filters.movieId !== "all" ? { movieId: filters.movieId } : {}),
      ...(filters.assetTypeId !== "all" ? { assetTypeId: filters.assetTypeId } : {}),
    },
    include: {
      movie: { select: { title: true } },
      assetType: { select: { name: true, cost: true } },
      language: { select: { name: true, code: true } },
      country: { select: { name: true, isoCode: true } },
    },
    orderBy: [{ workDate: "asc" }, { movie: { title: "asc" } }, { taskName: "asc" }],
  });

  const movieContactPersons = filters.movieId !== "all"
    ? await db.contactPerson.findMany({
        where: { clientId, movieId: filters.movieId },
        orderBy: { name: "asc" },
        select: { name: true, email: true },
      })
    : [];
  const contactPersons = movieContactPersons.length ? buildContactPersonLabel(movieContactPersons) : buildContactPersonLabel(project.contactPersons);

  const isUniversalLocalization = client.name.trim().toLowerCase() === UNIVERSAL_CLIENT_NAME.toLowerCase() && reportType === "localization";

  const rows: AmazonBillingReportRow[] = entries.map((entry) => ({
    date: formatDisplayDate(entry.workDate),
    titleName: entry.movie?.title ?? "-",
    assetName: entry.taskName || "-",
    territoryVariant: isUniversalLocalization ? entry.country?.name ?? "-" : reportConfig.includeLanguage ? entry.language?.name ?? entry.country?.name ?? "-" : undefined,
    assetType: isUniversalLocalization ? "Assets" : entry.assetType?.name ?? "-",
    cost: isUniversalLocalization ? Number(project.projectCost ?? 0) : Number(entry.assetType?.cost ?? 0),
    contactPerson: contactPersons,
  }));

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

  return {
    client,
    reportType,
    reportTitle: reportConfig.title,
    projectName: project.name,
    filters,
    movieOptions,
    assetTypeOptions,
    rows,
    summaryRows: Array.from(summaryMap.values()).sort((a, b) => a.assetType.localeCompare(b.assetType)),
    contactPersons,
    projectFound: true,
  };
}

function getMovieBillingUnits(movie: { billingUnitsJson: string | null }) {
  if (!movie.billingUnitsJson) return new Map<string, number>();
  try {
    const parsed = JSON.parse(movie.billingUnitsJson) as Record<string, unknown>;
    return new Map(Object.entries(parsed).map(([key, value]) => [key, Number(value || 0)]));
  } catch {
    return new Map<string, number>();
  }
}

function calculateBillingHeadCost(costType: "WHOLE_COST" | "PER_UNIT_COST", cost: unknown, units: number | null | undefined) {
  const baseCost = Number(cost ?? 0);
  if (costType === "PER_UNIT_COST") return baseCost * Number(units || 0);
  return baseCost;
}

function formatMovieStatus(status: string) {
  return status.replaceAll("_", " ").replace("COMPLETED BILLED", "COMPLETED & BILLED");
}

function isUsCountry(country: { isoCode: string | null; name: string }) {
  return (country.isoCode ?? "").toUpperCase() === "US" || country.name.trim().toLowerCase() === "united states" || country.name.trim().toLowerCase() === "usa";
}

function isCanadaCountry(country: { isoCode: string | null; name: string }) {
  return (country.isoCode ?? "").toUpperCase() === "CA" || country.name.trim().toLowerCase() === "canada";
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

function getDeliverableReportTitle(reportType: "domestic-deliverable" | "intl-deliverable" | "other-deliverable" | "newsletters") {
  if (reportType === "intl-deliverable") return "Intl Deliverable";
  if (reportType === "other-deliverable") return "Other Deliverable";
  return "Domestic Deliverable";
}

async function getWarnerDeliverableData({
  clientId,
  filters,
  reportType,
}: {
  clientId: string;
  filters: WarnerDeliverableFilters;
  reportType: "domestic-deliverable" | "intl-deliverable" | "other-deliverable"
  | "newsletters";
}): Promise<WarnerDomesticDeliverableData | null> {
  const isDomestic = reportType === "domestic-deliverable";
  const isIntl = reportType === "intl-deliverable";
  const isOther = reportType === "other-deliverable";
  const reportTitle = getDeliverableReportTitle(reportType);

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, hourlyCost: true },
  });
  if (!client) return null;

  const intlEligibleMovieIds = isIntl ? await getWarnerIntlDeliverableEligibleMovieIds(clientId) : null;
  const otherEligibleMovieIds = isOther ? await getWarnerOtherDeliverableEligibleMovieIds(clientId) : null;

  const movieOptions = await db.movie.findMany({
    where: {
      clientId,
      isActive: true,
      status: { in: ["WORKING", "COMPLETED"] },
      ...(!isDomestic ? { timeEntries: { some: { project: { clientId } } } } : {}),
      ...(isDomestic
        ? { billingDomestic: true }
        : isIntl
          ? { billingIntl: true, id: { in: intlEligibleMovieIds ?? [] } }
          : {
              OR: [
                { billingOther: true, id: { in: otherEligibleMovieIds?.nonUsMovieIds ?? [] } },
                { billingIntl: true, id: { in: otherEligibleMovieIds?.canadaMovieIds ?? [] } },
              ],
            }),
    },
    select: { id: true, title: true, status: true, billingOther: true, billingIntl: true },
    orderBy: { title: "asc" },
  });

  const selectedMovieId = filters.movieId || movieOptions[0]?.id || "";
  const selectedMovie = selectedMovieId
    ? await db.movie.findFirst({
        where: {
          id: selectedMovieId,
          clientId,
          isActive: true,
          status: { in: ["WORKING", "COMPLETED"] },
          ...(!isDomestic ? { timeEntries: { some: { project: { clientId } } } } : {}),
          ...(isDomestic
            ? { billingDomestic: true }
            : isIntl
              ? { billingIntl: true, AND: [{ id: { in: intlEligibleMovieIds ?? [] } }] }
              : {
              OR: [
                { billingOther: true, id: { in: otherEligibleMovieIds?.nonUsMovieIds ?? [] } },
                { billingIntl: true, id: { in: otherEligibleMovieIds?.canadaMovieIds ?? [] } },
              ],
            }),
        },
        select: { id: true, title: true, status: true, clientId: true, billingUnitsJson: true, billingOther: true, billingIntl: true },
      })
    : null;

  const mappedMovieOptions = movieOptions.map((movie) => ({
    id: movie.id,
    title: `${movie.title} (${formatMovieStatus(movie.status)})`,
    status: movie.status,
  }));

  const emptyData = (countryOptions: WarnerDomesticDeliverableData["countryOptions"] = [], selectedCountry: WarnerDomesticDeliverableData["selectedCountry"] = null): WarnerDomesticDeliverableData => ({
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
  });

  if (!selectedMovie) return emptyData();

  let countryOptions: WarnerDomesticDeliverableData["countryOptions"] = [];
  let selectedCountry: WarnerDomesticDeliverableData["selectedCountry"] = null;

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

    const countryMap = new Map<string, { id: string; name: string; isoCode: string | null }>();
    for (const entry of countryEntries) {
      if (!entry.country) continue;
      const country = entry.country;
      if (isUsCountry(country)) continue;
      if (isIntl && isCanadaCountry(country)) continue;
      if (isOther && !selectedMovie.billingOther && !(selectedMovie.billingIntl && isCanadaCountry(country))) continue;
      countryMap.set(country.id, country);
    }
    countryOptions = Array.from(countryMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    if (isOther) {
      const selectedCountryId = filters.countryId || countryOptions[0]?.id || "";
      selectedCountry = selectedCountryId
        ? countryOptions.find((country) => country.id === selectedCountryId) ?? null
        : null;

      if (!selectedCountry) {
        return {
          client,
          reportType,
          reportTitle,
          filters: { movieId: selectedMovie.id, countryId: filters.countryId || "" },
          movieOptions: mappedMovieOptions,
          countryOptions,
          selectedMovie: { id: selectedMovie.id, title: `${selectedMovie.title} (${formatMovieStatus(selectedMovie.status)})` },
          selectedCountry: null,
          rows: [],
          totalCost: 0,
        };
      }
    }
  }

  const billingRegion: "domestic" | "intl" | "other" = isDomestic ? "domestic" : isOther ? "other" : "intl";
  const useIntlCanadaBilling = Boolean(
    isOther
    && selectedCountry
    && isCanadaCountry(selectedCountry)
    && selectedMovie.billingIntl
    && !selectedMovie.billingOther,
  );
  const billingHeadRegion: "domestic" | "intl" | "intl-canada" | "other" = useIntlCanadaBilling ? "intl-canada" : billingRegion;
  const unitsByHeadId = getMovieBillingUnits(selectedMovie);

  function getHeadCost(head: { domesticCost: unknown; intlCost: unknown; intlCanadaCost?: unknown; otherCost?: unknown }) {
    if (billingHeadRegion === "domestic") return head.domesticCost;
    if (billingHeadRegion === "other") return head.otherCost ?? 0;
    if (billingHeadRegion === "intl-canada") return head.intlCanadaCost ?? head.intlCost;
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

    const units = unitsByHeadId.get(head.id) ?? (head.costType === "PER_UNIT_COST" ? 0 : 1);
    rows.push({
      label: head.name,
      cost: calculateBillingHeadCost(head.costType, getHeadCost(head), units),
      group: "Fixed - Compulsory",
      meta: isIntl ? undefined : head.costType === "PER_UNIT_COST" ? `Per-unit × ${units}` : "Whole cost",
    });
  }

  const optionalAssignmentWhere = isIntl
    ? {
        clientId,
        movieId: selectedMovie.id,
        isActive: true,
        countryId: { in: countryOptions.map((country) => country.id) },
        billingHead: { is: { isActive: true, intlActive: true, intlCompulsionType: "FIXED_OPTIONAL" as const } },
      }
    : {
        clientId,
        movieId: selectedMovie.id,
        isActive: true,
        ...(isDomestic
          ? { country: { is: { isoCode: "US" } } }
          : { countryId: selectedCountry?.id ?? "" }),
        billingHead: { is: {
          isActive: true,
          ...(billingHeadRegion === "domestic"
            ? { domesticActive: true, domesticCompulsionType: "FIXED_OPTIONAL" as const }
            : billingHeadRegion === "other"
              ? { otherActive: true, otherCompulsionType: "FIXED_OPTIONAL" as const }
              : { intlActive: true, intlCompulsionType: "FIXED_OPTIONAL" as const }),
        } },
      };

  const optionalAssignments = await db.movieBillingHeadAssignment.findMany({
    where: optionalAssignmentWhere,
    include: {
      billingHead: true,
      country: { select: { id: true, name: true, isoCode: true } },
    },
    orderBy: { billingHead: { name: "asc" } },
  });

  if (isIntl) {
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
        .filter((country): country is { id: string; name: string; isoCode: string | null } => Boolean(country))
        .map((country) => country.isoCode ? `${country.name} (${country.isoCode})` : country.name)
        .sort((a, b) => a.localeCompare(b));
      const totalCost = assignments.reduce((sum, assignment) => {
        const units = Number(assignment.units ?? 0);
        return sum + calculateBillingHeadCost(assignment.billingHead.costType, assignment.billingHead.intlCost, units);
      }, 0);
      rows.push({
        label: firstAssignment.billingHead.name,
        cost: totalCost,
        group: "Fixed - Optional",
        meta: countries.length ? `Countries: ${Array.from(new Set(countries)).join(", ")}` : undefined,
      });
    }
  } else {
    for (const assignment of optionalAssignments) {
      const units = Number(assignment.units ?? 0);
      rows.push({
        label: assignment.billingHead.name,
        cost: calculateBillingHeadCost(assignment.billingHead.costType, getHeadCost(assignment.billingHead), units),
        group: "Fixed - Optional",
        meta: assignment.billingHead.costType === "PER_UNIT_COST" ? `Per-unit × ${units}` : "Whole cost",
      });
    }
  }

  const fixedFullProjects = await db.project.findMany({
    where: {
      clientId,
      billingModel: "FIXED_FULL",
      timeEntries: {
        some: {
          movieId: selectedMovie.id,
          ...(isDomestic
            ? {}
            : isIntl
              ? { countryId: { in: countryOptions.map((country) => country.id) } }
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

  for (const project of fixedFullProjects) {
    const fixedHoursCost = Number(project.fixedContractHours ?? 0) * Number(client.hourlyCost ?? 0);
    const additionalCharges = Number(project.additionalCharges ?? 0);
    rows.push({
      label: `${project.name} (${project.status.replaceAll("_", " ")})`,
      cost: fixedHoursCost + additionalCharges,
      group: "Fixed Full Projects",
      meta: `${Number(project.fixedContractHours ?? 0)} hrs × ${formatUsd(Number(client.hourlyCost ?? 0))}${additionalCharges > 0 ? ` + ${formatUsd(additionalCharges)} additional` : ""}`,
    });
  }

  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);

  return {
    client,
    reportType,
    reportTitle,
    filters: { movieId: selectedMovie.id, countryId: selectedCountry?.id ?? "" },
    movieOptions: mappedMovieOptions,
    countryOptions,
    selectedMovie: { id: selectedMovie.id, title: `${selectedMovie.title} (${formatMovieStatus(selectedMovie.status)})` },
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
  return getWarnerDeliverableData({ clientId, filters, reportType: "domestic-deliverable" });
}

export async function getWarnerIntlDeliverableData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: WarnerDeliverableFilters;
}): Promise<WarnerDomesticDeliverableData | null> {
  return getWarnerDeliverableData({ clientId, filters, reportType: "intl-deliverable" });
}

export async function getWarnerOtherDeliverableData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: WarnerDeliverableFilters;
}): Promise<WarnerDomesticDeliverableData | null> {
  return getWarnerDeliverableData({ clientId, filters, reportType: "other-deliverable" });
}

export function sanitizeFileSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "report";
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
