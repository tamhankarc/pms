import { db } from "@/lib/db";
import { formatUsd, getExportTimestamp, sanitizeFileSegment } from "@/lib/billing-reports/amazon";

export type SonyPicturesReportFilters = {
  movieId: string;
};

export type SonyPicturesReportProjectRow = {
  projectId: string;
  projectName: string;
  contactPerson: string;
  billingModel: string;
  countryList: string;
  cost: number;
};

export type SonyPicturesReportChargeRow = {
  label: string;
  cost: number;
};

export type SonyPicturesReportData = {
  reportTitle: string;
  showCountryList: boolean;
  client: {
    id: string;
    name: string;
    hourlyCost: number;
  };
  filters: SonyPicturesReportFilters;
  movieOptions: { id: string; title: string; status: string }[];
  selectedMovie: { id: string; title: string; status: string } | null;
  projectRows: SonyPicturesReportProjectRow[];
  chargeRows: SonyPicturesReportChargeRow[];
  totalCost: number;
};

function getParamValue(searchParams: URLSearchParams | Record<string, string | string[] | undefined>, key: string) {
  if (searchParams instanceof URLSearchParams) return searchParams.get(key) ?? undefined;
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export function buildSonyPicturesReportFilters(searchParams: URLSearchParams | Record<string, string | string[] | undefined>) {
  return {
    movieId: getParamValue(searchParams, "movieId") || "",
  } satisfies SonyPicturesReportFilters;
}

function formatMovieStatus(status: string) {
  return status.replaceAll("_", " ").replace("COMPLETED BILLED", "COMPLETED & BILLED");
}

function formatProjectStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatBillingModel(model: string) {
  const labels: Record<string, string> = {
    HOURLY: "Hourly",
    FIXED_PER_COUNTRY: "Fixed Per Country",
    FIXED_MONTHLY: "Fixed Monthly",
    FIXED_FULL: "Fixed Full",
    FIXED_COST: "Fixed Cost",
  };
  return labels[model] ?? model.replaceAll("_", " ");
}

function buildContactPersonLabel(contactPersons: { name: string; email: string }[]) {
  if (!contactPersons.length) return "-";
  return contactPersons.map((person) => `${person.name}${person.email ? ` (${person.email})` : ""}`).join(", ");
}

function sortRows(rows: SonyPicturesReportProjectRow[]) {
  return [...rows].sort((a, b) => a.projectName.localeCompare(b.projectName));
}

export async function getSonyPicturesReportData({
  clientId,
  filters,
  variant = "main",
}: {
  clientId: string;
  filters: SonyPicturesReportFilters;
  variant?: "main" | "canada-other";
}): Promise<SonyPicturesReportData | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, hourlyCost: true },
  });

  if (!client) return null;

  const rawMovieOptions = await db.movie.findMany({
    where: {
      clientId,
      isActive: true,
      status: { in: ["WORKING", "COMPLETED"] },
      timeEntries: { some: { project: { clientId } } },
    },
    select: {
      id: true,
      title: true,
      status: true,
      billingDomestic: true,
      billingIntl: true,
      billingOther: true,
      timeEntries: {
        where: { project: { clientId } },
        select: { country: { select: { isoCode: true, name: true } } },
      },
    },
    orderBy: { title: "asc" },
  });

  const movieOptions = rawMovieOptions.filter((movie) => {
    const countryCodes = new Set(movie.timeEntries.map((entry) => (entry.country?.isoCode || entry.country?.name || "").toUpperCase()).filter(Boolean));
    const hasCanada = countryCodes.has("CA") || countryCodes.has("CANADA");
    const hasNonCanada = Array.from(countryCodes).some((code) => code !== "CA" && code !== "CANADA");
    if (variant === "canada-other") {
      return movie.billingOther || (movie.billingIntl && hasCanada);
    }

    if (!movie.billingDomestic && !movie.billingIntl) {
      return false;
    }

    const canadaOnlyIntl = movie.billingIntl && !movie.billingDomestic && !movie.billingOther && hasCanada && !hasNonCanada;
    return !canadaOnlyIntl;
  });

  const selectedMovieId = filters.movieId || movieOptions[0]?.id || "";
  const selectedMovieAllowed = movieOptions.some((movie) => movie.id === selectedMovieId);
  const selectedMovie = selectedMovieId && selectedMovieAllowed
    ? await db.movie.findFirst({
        where: {
          id: selectedMovieId,
          clientId,
          isActive: true,
          status: { in: ["WORKING", "COMPLETED"] },
          timeEntries: { some: { project: { clientId } } },
        },
        select: {
          id: true,
          title: true,
          status: true,
          sonyTicketingBannerCost: true,
          sonyEmailTicketingBannerCost: true,
        },
      })
    : null;

  const mappedMovieOptions = movieOptions.map((movie) => ({
    id: movie.id,
    title: `${movie.title} (${formatMovieStatus(movie.status)})`,
    status: movie.status,
  }));

  if (!selectedMovie) {
    return {
      reportTitle: variant === "canada-other" ? "SPE Canada & Other" : "SPE Billing",
      showCountryList: variant === "canada-other",
      client: { id: client.id, name: client.name, hourlyCost: Number(client.hourlyCost ?? 0) },
      filters: { movieId: selectedMovieId },
      movieOptions: mappedMovieOptions,
      selectedMovie: null,
      projectRows: [],
      chargeRows: [],
      totalCost: 0,
    };
  }

  const projects = await db.project.findMany({
    where: {
      clientId,
      isActive: true,
      timeEntries: { some: { movieId: selectedMovie.id } },
      id: { not: SONY_NEWSLETTER_PROJECT_ID },
    },
    select: {
      id: true,
      name: true,
      billingModel: true,
      status: true,
      fixedContractHours: true,
      fixedMonthlyHours: true,
      additionalCharges: true,
      partialBillingCost: true,
      perCountryCharges: true,
      projectCost: true,
      contactPersons: {
        orderBy: { name: "asc" },
        select: { name: true, email: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const projectIds = projects.map((project) => project.id);
  const movieContactPersons = await db.contactPerson.findMany({
    where: { clientId, movieId: selectedMovie.id },
    orderBy: { name: "asc" },
    select: { name: true, email: true },
  });
  const movieContactPersonLabel = buildContactPersonLabel(movieContactPersons);

  const minutesByProject = new Map<string, number>();
  if (projectIds.length) {
    const minuteGroups = await db.timeEntry.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, movieId: selectedMovie.id },
      _sum: { minutesSpent: true },
    });
    minuteGroups.forEach((group) => minutesByProject.set(group.projectId, group._sum.minutesSpent ?? 0));
  }

  const countryEntries = projectIds.length
    ? await db.timeEntry.findMany({
        where: { projectId: { in: projectIds }, movieId: selectedMovie.id, countryId: { not: null } },
        select: {
          projectId: true,
          country: { select: { id: true, name: true, isoCode: true } },
        },
      })
    : [];

  const countriesByProject = new Map<string, Map<string, string>>();
  for (const entry of countryEntries) {
    if (!entry.country) continue;
    const current = countriesByProject.get(entry.projectId) ?? new Map<string, string>();
    current.set(entry.country.id, entry.country.isoCode ? `${entry.country.name} (${entry.country.isoCode})` : entry.country.name);
    countriesByProject.set(entry.projectId, current);
  }

  const hourlyCost = Number(client.hourlyCost ?? 0);
  const projectRows = sortRows(projects.map((project) => {
    const countries = Array.from(countriesByProject.get(project.id)?.values() ?? []).sort((a, b) => a.localeCompare(b));
    let cost = 0;

    if (project.billingModel === "HOURLY") {
      cost = ((minutesByProject.get(project.id) ?? 0) / 60) * hourlyCost;
    } else if (project.billingModel === "FIXED_PER_COUNTRY") {
      cost = countries.length * Number(project.perCountryCharges ?? 0);
    } else if (project.billingModel === "FIXED_MONTHLY") {
      cost = Number(project.fixedMonthlyHours ?? 0) * hourlyCost;
    } else if (project.billingModel === "FIXED_FULL") {
      cost = (Number(project.fixedContractHours ?? 0) * hourlyCost) + Number(project.additionalCharges ?? 0) - Number(project.partialBillingCost ?? 0);
    } else if (project.billingModel === "FIXED_COST") {
      cost = Number(project.projectCost ?? 0);
    }

    const contactPerson = movieContactPersons.length ? movieContactPersonLabel : buildContactPersonLabel(project.contactPersons);

    return {
      projectId: project.id,
      projectName: `${project.name}${project.status ? ` (${formatProjectStatus(project.status)})` : ""}`,
      contactPerson,
      billingModel: formatBillingModel(project.billingModel),
      countryList: variant === "canada-other" ? countries.join(", ") : "",
      cost,
    } satisfies SonyPicturesReportProjectRow;
  }));

  const chargeRows: SonyPicturesReportChargeRow[] = [
    { label: "Ticketing Banner", cost: Number(selectedMovie.sonyTicketingBannerCost ?? 0) },
    { label: "Email Ticketing Banner", cost: Number(selectedMovie.sonyEmailTicketingBannerCost ?? 0) },
  ].filter((row) => row.cost > 0);

  const totalCost = projectRows.reduce((sum, row) => sum + row.cost, 0) + chargeRows.reduce((sum, row) => sum + row.cost, 0);

  return {
    reportTitle: variant === "canada-other" ? "SPE Canada & Other" : "SPE Billing",
    showCountryList: variant === "canada-other",
    client: { id: client.id, name: client.name, hourlyCost },
    filters: { movieId: selectedMovie.id },
    movieOptions: mappedMovieOptions,
    selectedMovie: { id: selectedMovie.id, title: `${selectedMovie.title} (${formatMovieStatus(selectedMovie.status)})`, status: selectedMovie.status },
    projectRows,
    chargeRows,
    totalCost,
  };
}

export function getSonyPicturesReportFileName(data: SonyPicturesReportData, extension: "xls" | "pdf") {
  const moviePart = data.selectedMovie ? `_${sanitizeFileSegment(data.selectedMovie.title)}` : "";
  return `${sanitizeFileSegment(data.client.name)}${moviePart}_Billing_Report_${getExportTimestamp()}.${extension}`;
}

export { formatUsd };

export type SonyNewsletterBillingFilters = { month: string };
export type SonyNewsletterBillingRow = { newsletterType: string; count: number; cost: number };
export type SonyNewsletterBillingData = {
  client: { id: string; name: string };
  filters: SonyNewsletterBillingFilters;
  project: { id: string; name: string; projectCost: number } | null;
  rows: SonyNewsletterBillingRow[];
  totalCount: number;
  totalCost: number;
};

const SONY_NEWSLETTER_PROJECT_ID = "cmnijd30h0001l404y6i8tb2y";

function defaultMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function buildSonyNewsletterBillingFilters(searchParams: URLSearchParams | Record<string, string | string[] | undefined>) {
  const month = getParamValue(searchParams, "month") || defaultMonthValue();
  return { month: /^\d{4}-\d{2}$/.test(month) ? month : defaultMonthValue() } satisfies SonyNewsletterBillingFilters;
}

function monthRange(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, monthNum - 1, 1)), end: new Date(Date.UTC(year, monthNum, 1)) };
}

function formatNewsletterType(value: string | null) {
  if (!value) return "Unspecified";
  return value === "AFFIRM" ? "Affirm" : value;
}

export async function getSonyNewsletterBillingData({ clientId, filters }: { clientId: string; filters: SonyNewsletterBillingFilters }): Promise<SonyNewsletterBillingData | null> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) return null;
  const project = await db.project.findFirst({ where: { id: SONY_NEWSLETTER_PROJECT_ID, clientId }, select: { id: true, name: true, projectCost: true } });
  if (!project) return { client, filters, project: null, rows: [], totalCount: 0, totalCost: 0 };
  const range = monthRange(filters.month);
  const entries = await db.timeEntry.findMany({
    where: { projectId: project.id, workDate: { gte: range.start, lt: range.end }, newsletterId: { not: null } },
    select: { newsletter: { select: { id: true, newsletterType: true } } },
  });
  const byNewsletter = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.newsletter) continue;
    byNewsletter.set(entry.newsletter.id, formatNewsletterType(entry.newsletter.newsletterType));
  }
  const counts = new Map<string, number>();
  for (const type of byNewsletter.values()) counts.set(type, (counts.get(type) ?? 0) + 1);
  const unitCost = Number(project.projectCost ?? 0);
  const rows = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([newsletterType, count]) => ({ newsletterType, count, cost: count * unitCost }));
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  return { client, filters, project: { id: project.id, name: project.name, projectCost: unitCost }, rows, totalCount, totalCost };
}

export function getSonyNewsletterBillingFileName(data: SonyNewsletterBillingData, extension: "xls" | "pdf") {
  return `${sanitizeFileSegment(data.client.name)}_Newsletters_${data.filters.month}_Billing_Report_${getExportTimestamp()}.${extension}`;
}
