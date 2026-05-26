import { db } from "@/lib/db";
import {
  formatUsd,
  getExportTimestamp,
  sanitizeFileSegment,
} from "@/lib/billing-reports/amazon";
import { getLensBillingAdjustments } from "@/lib/billing-reports/lens";

const SONY_TICKETING_PROJECT_ID = "cmnn1qrex000ll7043zm4uyti";
const SONY_NEWSLETTER_PROJECT_ID = "cmnijd30h0001l404y6i8tb2y";

export type SonyPicturesReportFilters = {
  movieId: string;
};

export type SonyPicturesReportProjectRow = {
  projectId: string;
  projectName: string;
  contactPerson: string;
  billingModel: string;
  countryList: string;
  lensDetails?: string[];
  cost: number;
};

export type SonyPicturesReportChargeRow = {
  label: string;
  cost: number;
};

export type SonyPicturesReportTitleBlock = {
  movie: { id: string; title: string; status: string };
  projectRows: SonyPicturesReportProjectRow[];
  chargeRows: SonyPicturesReportChargeRow[];
  totalCost: number;
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
  titleBlocks: SonyPicturesReportTitleBlock[];
};

export type SonyBillingSummaryHistoryFilters = { year: string };
export type SonyBillingSummaryHistoryRow = {
  movieId: string;
  title: string;
  status: string;
  billingRegions: string;
  billingDate: string;
};
export type SonyBillingSummaryHistoryData = {
  client: { id: string; name: string };
  filters: SonyBillingSummaryHistoryFilters;
  summaryRows: SonyBillingSummaryHistoryRow[];
  historyRows: SonyBillingSummaryHistoryRow[];
};

function getParamValue(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
) {
  if (searchParams instanceof URLSearchParams)
    return searchParams.get(key) ?? undefined;
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export function buildSonyPicturesReportFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  return {
    movieId: getParamValue(searchParams, "movieId") || "",
  } satisfies SonyPicturesReportFilters;
}

export function buildSonyBillingSummaryHistoryFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  const currentYear = String(new Date().getFullYear());
  const year = getParamValue(searchParams, "year") || currentYear;
  return {
    year: /^\d{4}$/.test(year) ? year : currentYear,
  } satisfies SonyBillingSummaryHistoryFilters;
}

function formatMovieStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace("COMPLETED BILLED", "COMPLETED & BILLED");
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

function formatDisplayDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function buildContactPersonLabel(
  contactPersons: { name: string; email: string }[],
) {
  if (!contactPersons.length) return "-";
  return contactPersons
    .map(
      (person) => `${person.name}${person.email ? ` (${person.email})` : ""}`,
    )
    .join(", ");
}

function normalizeCountryCode(
  country: { isoCode: string | null; name: string } | null,
) {
  return (country?.isoCode || country?.name || "").trim().toUpperCase();
}

function isUnitedStates(code: string) {
  return (
    code === "US" ||
    code === "USA" ||
    code === "UNITED STATES" ||
    code === "UNITED STATES OF AMERICA"
  );
}

function isCanada(code: string) {
  return code === "CA" || code === "CAN" || code === "CANADA";
}

function formatBillingRegions(movie: {
  billingDomestic: boolean;
  billingIntl: boolean;
  billingOther: boolean;
  billingSocial: boolean;
}) {
  const values: string[] = [];
  if (movie.billingDomestic) values.push("Domestic");
  if (movie.billingIntl) values.push("INTL");
  if (movie.billingOther) values.push("Other");
  if (movie.billingSocial) values.push("Social");
  return values.length ? values.join(", ") : "-";
}

function calculateProjectCost(
  project: {
    billingModel: string;
    fixedContractHours: unknown;
    fixedMonthlyHours: unknown;
    additionalCharges: unknown;
    partialBillingCost: unknown;
    perCountryCharges: unknown;
    projectCost: unknown;
    projectCostOtherMovieBillingRegion: unknown;
  },
  minutes: number,
  countryCount: number,
  hourlyCost: number,
  otherVariant: boolean,
) {
  if (project.billingModel === "HOURLY") return (minutes / 60) * hourlyCost;
  if (project.billingModel === "FIXED_PER_COUNTRY")
    return countryCount * Number(project.perCountryCharges ?? 0);
  if (project.billingModel === "FIXED_MONTHLY")
    return Number(project.fixedMonthlyHours ?? 0) * hourlyCost;
  if (project.billingModel === "FIXED_FULL") {
    return (
      Number(project.fixedContractHours ?? 0) * hourlyCost +
      Number(project.additionalCharges ?? 0) -
      Number(project.partialBillingCost ?? 0)
    );
  }
  if (project.billingModel === "FIXED_COST") {
    return otherVariant
      ? Number(project.projectCostOtherMovieBillingRegion ?? 0)
      : Number(project.projectCost ?? 0);
  }
  return 0;
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
    select: {
      id: true,
      name: true,
      hourlyCost: true,
      sonyCoppaSiteCost: true,
      sonyUsEpkSiteCost: true,
      sonyGlobalEpkSiteCost: true,
    },
  });
  if (!client) return null;

  const [rawMovieOptions, otherProjectEntryMovieIds] = await Promise.all([
    db.movie.findMany({
      where: {
        clientId,
        isActive: true,
        status: { in: ["WORKING", "COMPLETED"] },
        timeEntries: { some: { projectId: SONY_TICKETING_PROJECT_ID } },
      },
      select: {
        id: true,
        title: true,
        status: true,
        billingDomestic: true,
        billingIntl: true,
        billingOther: true,
        billingSocial: true,
        sonyCoppaSite: true,
        sonyGlobalEpkSite: true,
        sonyTicketingBannerCost: true,
        sonyEmailTicketingBannerCost: true,
        timeEntries: {
          where: {
            projectId: SONY_TICKETING_PROJECT_ID,
            countryId: { not: null },
          },
          select: { country: { select: { name: true, isoCode: true } } },
        },
      },
      orderBy: { title: "asc" },
    }),
    db.timeEntry.findMany({
      where: {
        movie: {
          clientId,
          isActive: true,
          status: { in: ["WORKING", "COMPLETED"] },
        },
        projectId: {
          notIn: [SONY_TICKETING_PROJECT_ID, SONY_NEWSLETTER_PROJECT_ID],
        },
      },
      select: { movieId: true },
    }),
  ]);
  const moviesWithOtherProjectRows = new Set(
    otherProjectEntryMovieIds.map((entry) => entry.movieId).filter(Boolean),
  );
  const movieOptions = rawMovieOptions.filter((movie) => {
    if (variant === "canada-other")
      return (
        movie.billingDomestic ||
        movie.billingIntl ||
        movie.billingOther ||
        movie.billingSocial
      );
    if (!movie.billingDomestic && !movie.billingIntl) return false;
    const countryCodes = movie.timeEntries.map((entry) =>
      normalizeCountryCode(entry.country),
    );
    return (
      (movie.billingDomestic && countryCodes.some(isUnitedStates)) ||
      movie.sonyCoppaSite ||
      (movie.billingIntl &&
        countryCodes.some(
          (code) => !isUnitedStates(code) && !isCanada(code),
        )) ||
      movie.sonyGlobalEpkSite ||
      Number(movie.sonyTicketingBannerCost ?? 0) > 0 ||
      Number(movie.sonyEmailTicketingBannerCost ?? 0) > 0 ||
      moviesWithOtherProjectRows.has(movie.id)
    );
  });
  const requestedMovieId = filters.movieId;
  const selectedMovieId =
    movieOptions.length > 1
      ? requestedMovieId === "all" ||
        movieOptions.some((movie) => movie.id === requestedMovieId)
        ? requestedMovieId || "all"
        : "all"
      : movieOptions[0]?.id || "";
  const mappedMovieOptions = movieOptions.map((movie) => ({
    id: movie.id,
    title: `${movie.title} (${formatMovieStatus(movie.status)})`,
    status: movie.status,
  }));
  const reportTitle =
    variant === "canada-other"
      ? "SPE US Ticketing, Canada & Other"
      : "SPE Billing";

  if (movieOptions.length > 1 && selectedMovieId === "all") {
    const titleReports = await Promise.all(
      movieOptions.map((movie) =>
        getSonyPicturesReportData({
          clientId,
          filters: { movieId: movie.id },
          variant,
        }),
      ),
    );
    const titleBlocks = titleReports
      .filter((result): result is SonyPicturesReportData =>
        Boolean(result?.selectedMovie && result.projectRows.length),
      )
      .map((result) => ({
        movie: result.selectedMovie!,
        projectRows: result.projectRows,
        chargeRows: result.chargeRows,
        totalCost: result.totalCost,
      }));
    return {
      reportTitle,
      showCountryList: true,
      client: {
        id: client.id,
        name: client.name,
        hourlyCost: Number(client.hourlyCost ?? 0),
      },
      filters: { movieId: "all" },
      movieOptions: mappedMovieOptions,
      selectedMovie: null,
      projectRows: [],
      chargeRows: [],
      totalCost: titleBlocks.reduce((sum, block) => sum + block.totalCost, 0),
      titleBlocks,
    };
  }

  const selectedMovieAllowed = movieOptions.some(
    (movie) => movie.id === selectedMovieId,
  );
  const selectedMovie = selectedMovieAllowed
    ? await db.movie.findFirst({
        where: {
          id: selectedMovieId,
          clientId,
          isActive: true,
          status: { in: ["WORKING", "COMPLETED"] },
        },
        select: {
          id: true,
          title: true,
          status: true,
          billingDomestic: true,
          billingIntl: true,
          billingOther: true,
          billingSocial: true,
          sonyCoppaSite: true,
          sonyGlobalEpkSite: true,
          sonyTicketingBannerCost: true,
          sonyEmailTicketingBannerCost: true,
        },
      })
    : null;

  if (!selectedMovie) {
    return {
      reportTitle,
      showCountryList: variant === "canada-other",
      client: {
        id: client.id,
        name: client.name,
        hourlyCost: Number(client.hourlyCost ?? 0),
      },
      filters: { movieId: selectedMovieId },
      movieOptions: mappedMovieOptions,
      selectedMovie: null,
      projectRows: [],
      chargeRows: [],
      totalCost: 0,
      titleBlocks: [],
    };
  }

  const [
    ticketingProject,
    ticketingEntries,
    otherProjects,
    movieContactPersons,
  ] = await Promise.all([
    db.project.findFirst({
      where: { id: SONY_TICKETING_PROJECT_ID, clientId },
      select: {
        id: true,
        name: true,
        perCountryCharges: true,
        projectCostOtherMovieBillingRegion: true,
        contactPersons: {
          orderBy: { name: "asc" },
          select: { name: true, email: true },
        },
      },
    }),
    db.timeEntry.findMany({
      where: {
        movieId: selectedMovie.id,
        projectId: SONY_TICKETING_PROJECT_ID,
        countryId: { not: null },
      },
      select: { country: { select: { id: true, name: true, isoCode: true } } },
    }),
    db.project.findMany({
      where: {
        clientId,
        isActive: true,
        id: { notIn: [SONY_TICKETING_PROJECT_ID, SONY_NEWSLETTER_PROJECT_ID] },
        timeEntries: { some: { movieId: selectedMovie.id } },
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
        projectCostOtherMovieBillingRegion: true,
        contactPersons: {
          orderBy: { name: "asc" },
          select: { name: true, email: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.contactPerson.findMany({
      where: { clientId, movieId: selectedMovie.id },
      orderBy: { name: "asc" },
      select: { name: true, email: true },
    }),
  ]);

  const ticketingContact = buildContactPersonLabel(
    movieContactPersons.length
      ? movieContactPersons
      : (ticketingProject?.contactPersons ?? []),
  );
  const ticketCountries = new Map<string, { label: string; code: string }>();
  for (const entry of ticketingEntries) {
    if (!entry.country) continue;
    const code = normalizeCountryCode(entry.country);
    ticketCountries.set(entry.country.id, {
      label: entry.country.isoCode
        ? `${entry.country.name} (${entry.country.isoCode})`
        : entry.country.name,
      code,
    });
  }
  const countryValues = Array.from(ticketCountries.values());
  const hasUs = countryValues.some((country) => isUnitedStates(country.code));
  const hasCanada = countryValues.some((country) => isCanada(country.code));
  const internationalCountries = countryValues
    .filter(
      (country) => !isUnitedStates(country.code) && !isCanada(country.code),
    )
    .map((country) => country.label)
    .sort();
  const allTicketingCountries = countryValues
    .map((country) => country.label)
    .sort();
  const projectRows: SonyPicturesReportProjectRow[] = [];
  const pushLine = (
    projectId: string,
    projectName: string,
    billingModel: string,
    cost: number,
    countryList = "",
    contactPerson = ticketingContact,
    lensDetails?: string[],
  ) => {
    projectRows.push({
      projectId,
      projectName,
      contactPerson,
      billingModel,
      countryList,
      lensDetails,
      cost,
    });
  };

  if (variant === "main") {
    if (selectedMovie.billingDomestic && hasUs)
      pushLine(
        "sony-us-epk",
        "US EPK",
        "Client Fixed Cost",
        Number(client.sonyUsEpkSiteCost ?? 0),
        "United States",
      );
    if (selectedMovie.sonyCoppaSite)
      pushLine(
        "sony-coppa",
        "COPPA",
        "Client Fixed Cost",
        Number(client.sonyCoppaSiteCost ?? 0),
      );
    if (
      selectedMovie.billingIntl &&
      internationalCountries.length &&
      ticketingProject
    ) {
      pushLine(
        "sony-international-ticketing",
        "International Ticketing",
        "Per Country",
        internationalCountries.length *
          Number(ticketingProject.perCountryCharges ?? 0),
        internationalCountries.join(", "),
      );
    }
    if (selectedMovie.sonyGlobalEpkSite)
      pushLine(
        "sony-global-epk",
        "Global EPK Site",
        "Client Fixed Cost",
        Number(client.sonyGlobalEpkSiteCost ?? 0),
      );
    if (Number(selectedMovie.sonyTicketingBannerCost ?? 0) > 0)
      pushLine(
        "sony-ticketing-banner",
        "Ticketing Banners",
        "Title Charge",
        Number(selectedMovie.sonyTicketingBannerCost),
      );
    if (Number(selectedMovie.sonyEmailTicketingBannerCost ?? 0) > 0)
      pushLine(
        "sony-email-ticketing-banner",
        "Email Ticketing Banners",
        "Title Charge",
        Number(selectedMovie.sonyEmailTicketingBannerCost),
      );
  } else {
    if (selectedMovie.billingDomestic && hasUs && ticketingProject)
      pushLine(
        "sony-us-ticketing",
        "US Ticketing",
        "Per Country",
        Number(ticketingProject.perCountryCharges ?? 0),
        "United States",
      );
    if (selectedMovie.billingIntl && hasCanada && ticketingProject)
      pushLine(
        "sony-canada-site",
        "Canada Site",
        "Per Country",
        Number(ticketingProject.perCountryCharges ?? 0),
        "Canada",
      );
    if (
      selectedMovie.billingOther &&
      allTicketingCountries.length &&
      ticketingProject
    ) {
      pushLine(
        "sony-ticketing-site",
        "Ticketing Site",
        "Other Region Per Country",
        allTicketingCountries.length *
          Number(ticketingProject.projectCostOtherMovieBillingRegion ?? 0),
        allTicketingCountries.join(", "),
      );
    }
  }

  const permittedOtherProjects =
    variant === "main"
      ? otherProjects
      : selectedMovie.billingOther
        ? otherProjects
        : [];
  const projectIds = permittedOtherProjects.map((project) => project.id);
  const [minuteGroups, otherCountryEntries] = projectIds.length
    ? await Promise.all([
        db.timeEntry.groupBy({
          by: ["projectId"],
          where: { projectId: { in: projectIds }, movieId: selectedMovie.id },
          _sum: { minutesSpent: true },
        }),
        db.timeEntry.findMany({
          where: {
            projectId: { in: projectIds },
            movieId: selectedMovie.id,
            countryId: { not: null },
          },
          select: {
            projectId: true,
            country: { select: { id: true, name: true, isoCode: true } },
          },
        }),
      ])
    : [[], []];
  const minutesByProject = new Map(
    minuteGroups.map((group) => [
      group.projectId,
      group._sum.minutesSpent ?? 0,
    ]),
  );
  const countriesByProject = new Map<string, Map<string, string>>();
  for (const entry of otherCountryEntries) {
    if (!entry.country) continue;
    const current =
      countriesByProject.get(entry.projectId) ?? new Map<string, string>();
    current.set(
      entry.country.id,
      entry.country.isoCode
        ? `${entry.country.name} (${entry.country.isoCode})`
        : entry.country.name,
    );
    countriesByProject.set(entry.projectId, current);
  }
  const movieContactPersonLabel = buildContactPersonLabel(movieContactPersons);
  const hourlyCost = Number(client.hourlyCost ?? 0);
  const lensAdjustments = await getLensBillingAdjustments({
    projectIds,
    movieId: selectedMovie.id,
  });
  for (const project of permittedOtherProjects) {
    const countries = Array.from(
      countriesByProject.get(project.id)?.values() ?? [],
    ).sort((a, b) => a.localeCompare(b));
    const calculatedCost = calculateProjectCost(
      project,
      minutesByProject.get(project.id) ?? 0,
      countries.length,
      hourlyCost,
      variant === "canada-other",
    );
    const lens = lensAdjustments.get(project.id);
    const projectName = `${project.name}${project.status ? ` (${formatProjectStatus(project.status)})` : ""}${lens && project.billingModel !== "FIXED_PER_COUNTRY" ? ` (${lens.lensNames.join(", ")})` : ""}`;
    const countryList =
      lens && project.billingModel === "FIXED_PER_COUNTRY"
        ? lens.detailLines.join(" | ")
        : variant === "canada-other"
          ? countries.join(", ")
          : "";
    pushLine(
      project.id,
      projectName,
      formatBillingModel(project.billingModel),
      lens ? lens.cost : calculatedCost,
      countryList,
      movieContactPersons.length
        ? movieContactPersonLabel
        : buildContactPersonLabel(project.contactPersons),
      lens && project.billingModel === "FIXED_PER_COUNTRY"
        ? lens.detailLines
        : undefined,
    );
  }

  return {
    reportTitle,
    showCountryList: variant === "canada-other" || variant === "main",
    client: { id: client.id, name: client.name, hourlyCost },
    filters: { movieId: selectedMovie.id },
    movieOptions: mappedMovieOptions,
    selectedMovie: {
      id: selectedMovie.id,
      title: `${selectedMovie.title} (${formatMovieStatus(selectedMovie.status)})`,
      status: selectedMovie.status,
    },
    projectRows,
    chargeRows: [],
    totalCost: projectRows.reduce((sum, row) => sum + row.cost, 0),
    titleBlocks: [],
  };
}

export async function getSonyBillingSummaryHistoryData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: SonyBillingSummaryHistoryFilters;
}): Promise<SonyBillingSummaryHistoryData | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });
  if (!client) return null;
  const year = Number(filters.year);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const baseSelect = {
    id: true,
    title: true,
    status: true,
    billingDate: true,
    billingDomestic: true,
    billingIntl: true,
    billingOther: true,
    billingSocial: true,
  } as const;
  const [summaryMovies, historyMovies] = await Promise.all([
    db.movie.findMany({
      where: {
        clientId,
        isActive: true,
        status: { in: ["WORKING", "COMPLETED"] },
      },
      select: baseSelect,
      orderBy: { title: "asc" },
    }),
    db.movie.findMany({
      where: {
        clientId,
        isActive: true,
        status: "COMPLETED_BILLED",
        billingDate: { gte: yearStart, lt: yearEnd },
      },
      select: baseSelect,
      orderBy: [{ billingDate: "desc" }, { title: "asc" }],
    }),
  ]);
  const mapRow = (
    movie: (typeof summaryMovies)[number],
  ): SonyBillingSummaryHistoryRow => ({
    movieId: movie.id,
    title: movie.title,
    status: formatMovieStatus(movie.status),
    billingRegions: formatBillingRegions(movie),
    billingDate: formatDisplayDate(movie.billingDate),
  });
  return {
    client,
    filters,
    summaryRows: summaryMovies.map(mapRow),
    historyRows: historyMovies.map(mapRow),
  };
}

export function getSonyPicturesReportFileName(
  data: SonyPicturesReportData,
  extension: "xls" | "pdf",
) {
  const moviePart = data.selectedMovie
    ? `_${sanitizeFileSegment(data.selectedMovie.title)}`
    : "";
  return `${sanitizeFileSegment(data.client.name)}${moviePart}_Billing_Report_${getExportTimestamp()}.${extension}`;
}

export { formatUsd };

export type SonyNewsletterBillingFilters = { month: string };
export type SonyNewsletterBillingRow = {
  newsletterType: string;
  count: number;
  cost: number;
};
export type SonyNewsletterBillingData = {
  client: { id: string; name: string };
  filters: SonyNewsletterBillingFilters;
  project: { id: string; name: string; projectCost: number } | null;
  rows: SonyNewsletterBillingRow[];
  totalCount: number;
  totalCost: number;
};

function defaultMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function buildSonyNewsletterBillingFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  const month = getParamValue(searchParams, "month") || defaultMonthValue();
  return {
    month: /^\d{4}-\d{2}$/.test(month) ? month : defaultMonthValue(),
  } satisfies SonyNewsletterBillingFilters;
}

function monthRange(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, monthNum - 1, 1)),
    end: new Date(Date.UTC(year, monthNum, 1)),
  };
}

function formatNewsletterType(value: string | null) {
  if (!value) return "Unspecified";
  return value === "AFFIRM" ? "Affirm" : value;
}

export async function getSonyNewsletterBillingData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: SonyNewsletterBillingFilters;
}): Promise<SonyNewsletterBillingData | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });
  if (!client) return null;
  const project = await db.project.findFirst({
    where: { id: SONY_NEWSLETTER_PROJECT_ID, clientId },
    select: { id: true, name: true, projectCost: true },
  });
  if (!project)
    return {
      client,
      filters,
      project: null,
      rows: [],
      totalCount: 0,
      totalCost: 0,
    };
  const range = monthRange(filters.month);
  const entries = await db.timeEntry.findMany({
    where: {
      projectId: project.id,
      workDate: { gte: range.start, lt: range.end },
      newsletterId: { not: null },
    },
    select: { newsletter: { select: { id: true, newsletterType: true } } },
  });
  const byNewsletter = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.newsletter) continue;
    byNewsletter.set(
      entry.newsletter.id,
      formatNewsletterType(entry.newsletter.newsletterType),
    );
  }
  const counts = new Map<string, number>();
  for (const type of byNewsletter.values())
    counts.set(type, (counts.get(type) ?? 0) + 1);
  const unitCost = Number(project.projectCost ?? 0);
  const rows = Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([newsletterType, count]) => ({
      newsletterType,
      count,
      cost: count * unitCost,
    }));
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  return {
    client,
    filters,
    project: { id: project.id, name: project.name, projectCost: unitCost },
    rows,
    totalCount,
    totalCost,
  };
}

export function getSonyNewsletterBillingFileName(
  data: SonyNewsletterBillingData,
  extension: "xls" | "pdf",
) {
  return `${sanitizeFileSegment(data.client.name)}_Newsletters_${data.filters.month}_Billing_Report_${getExportTimestamp()}.${extension}`;
}
