import { db } from "@/lib/db";

export type AmazonReportType = "social-assets" | "localization";

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
  movieOptions: { id: string; title: string }[];
  assetTypeOptions: { id: string; name: string }[];
  rows: AmazonBillingReportRow[];
  summaryRows: AmazonBillingReportSummaryRow[];
  contactPersons: string;
  projectFound: boolean;
};

export const AMAZON_CLIENT_NAME = "Amazon Studios";
export const UNIVERSAL_CLIENT_NAME = "Universal Pictures International";

export type BillingReportDefinition = {
  title: string;
  projectName: string;
  includeLanguage: boolean;
};

export const AMAZON_REPORTS: Record<AmazonReportType, BillingReportDefinition> = {
  "social-assets": {
    title: "Amazon Social Assets",
    projectName: "AMZ Social QC",
    includeLanguage: false,
  },
  localization: {
    title: "Amazon Localization",
    projectName: "AMZ Social Localization",
    includeLanguage: true,
  },
};

export const UNIVERSAL_REPORTS: Record<AmazonReportType, BillingReportDefinition> = {
  "social-assets": {
    title: "UNI Social Status",
    projectName: "UNI Social QC",
    includeLanguage: false,
  },
  localization: {
    title: "UNI Localization Status",
    projectName: "UNI Social Localization",
    includeLanguage: true,
  },
};

export function getBillingReportCatalogForClient(clientName: string) {
  const normalizedClientName = clientName.trim().toLowerCase();
  if (normalizedClientName === AMAZON_CLIENT_NAME.toLowerCase()) return AMAZON_REPORTS;
  if (normalizedClientName === UNIVERSAL_CLIENT_NAME.toLowerCase()) return UNIVERSAL_REPORTS;
  return null;
}

export function isConfiguredBillingReportClient(clientName: string) {
  return Boolean(getBillingReportCatalogForClient(clientName));
}

export function normalizeAmazonReportType(value: string | null | undefined): AmazonReportType {
  return value === "localization" ? "localization" : "social-assets";
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

  const reportCatalog = getBillingReportCatalogForClient(client.name);
  if (!reportCatalog) return null;

  const reportConfig = reportCatalog[reportType];
  const project = await db.project.findFirst({
    where: {
      clientId,
      name: reportConfig.projectName,
    },
    select: {
      id: true,
      name: true,
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
    },
    orderBy: [{ workDate: "asc" }, { movie: { title: "asc" } }, { taskName: "asc" }],
  });

  const contactPersons = buildContactPersonLabel(project.contactPersons);

  const rows: AmazonBillingReportRow[] = entries.map((entry) => ({
    date: formatDisplayDate(entry.workDate),
    titleName: entry.movie?.title ?? "-",
    assetName: entry.taskName || "-",
    territoryVariant: reportConfig.includeLanguage ? entry.language?.name ?? "-" : undefined,
    assetType: entry.assetType?.name ?? "-",
    cost: Number(entry.assetType?.cost ?? 0),
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
