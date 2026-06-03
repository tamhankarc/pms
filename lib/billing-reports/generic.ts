import { db } from "@/lib/db";
import {
  formatUsd,
  getDefaultMonthRange,
  getExportTimestamp,
  normalizeDateInput,
  sanitizeFileSegment,
} from "@/lib/billing-reports/amazon";
import { getLensBillingAdjustments } from "@/lib/billing-reports/lens";

const FOCUS_FEATURES_CLIENT_ID = "cmpuqhyhc002in22ivx3w9vvk";

export type GenericBillingReportFilters = {
  fromDate: string;
  toDate: string;
  movieId: string;
};

export type GenericBillingReportOptions = {
  movieSpecific?: boolean;
  includeDeveloperCosts?: boolean;
  openDateRange?: boolean;
};

export type GenericBillingReportRow = {
  projectId: string;
  projectName: string;
  contactPerson: string;
  status: string;
  projectCost: number;
  cost: number;
  developerCost?: number;
  totalHours?: number;
  countryList?: string;
  lensDetails?: string[];
};

export type GenericBillingReportBlock = {
  key:
    | "hourly"
    | "fixedFull"
    | "fixedMonthly"
    | "fixedPerCountry"
    | "fixedCost";
  title: string;
  description: string;
  rows: GenericBillingReportRow[];
  showDeveloperCost: boolean;
};

export type GenericBillingReportTitleBlock = {
  movie: { id: string; title: string };
  blocks: GenericBillingReportBlock[];
  totalCost: number;
};

export type GenericBillingSummaryHistoryFilters = { year: string };

export type GenericBillingSummaryHistoryRow = {
  movieId: string;
  title: string;
  status: string;
  billingRegions: string;
  billingDate: string;
};

export type GenericBillingSummaryHistoryData = {
  client: { id: string; name: string };
  filters: GenericBillingSummaryHistoryFilters;
  summaryRows: GenericBillingSummaryHistoryRow[];
  historyRows: GenericBillingSummaryHistoryRow[];
};

export type GenericBillingReportData = {
  client: {
    id: string;
    name: string;
    hourlyCost: number;
    showCountriesInTimeEntries: boolean;
  };
  filters: GenericBillingReportFilters;
  movieSpecific: boolean;
  includeDeveloperCosts: boolean;
  movieOptions: { id: string; title: string }[];
  selectedMovie: { id: string; title: string } | null;
  blocks: GenericBillingReportBlock[];
  titleBlocks?: GenericBillingReportTitleBlock[];
  reportTitle: string;
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

export function buildGenericBillingReportFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  const defaults = getDefaultMonthRange();
  return {
    fromDate: normalizeDateInput(
      getParamValue(searchParams, "fromDate"),
      defaults.fromDate,
    ),
    toDate: normalizeDateInput(
      getParamValue(searchParams, "toDate"),
      defaults.toDate,
    ),
    movieId: getParamValue(searchParams, "movieId") || "",
  } satisfies GenericBillingReportFilters;
}

export function buildGenericBillingSummaryHistoryFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  const currentYear = String(new Date().getFullYear());
  const suppliedYear = getParamValue(searchParams, "year") || currentYear;
  return {
    year: /^\d{4}$/.test(suppliedYear) ? suppliedYear : currentYear,
  } satisfies GenericBillingSummaryHistoryFilters;
}

function formatMovieStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace("COMPLETED BILLED", "COMPLETED & BILLED");
}

function formatBillingRegions(movie: {
  billingDomestic: boolean;
  billingIntl: boolean;
  billingOther: boolean;
  billingSocial: boolean;
}) {
  const regions: string[] = [];
  if (movie.billingDomestic) regions.push("Domestic");
  if (movie.billingIntl) regions.push("INTL");
  if (movie.billingOther) regions.push("Other");
  if (movie.billingSocial) regions.push("Social");
  return regions.join(", ") || "-";
}

function formatBillingDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export async function getGenericBillingSummaryHistoryData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: GenericBillingSummaryHistoryFilters;
}): Promise<GenericBillingSummaryHistoryData | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });
  if (!client) return null;
  const year = Number(filters.year);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const select = {
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
      select,
      orderBy: { title: "asc" },
    }),
    db.movie.findMany({
      where: {
        clientId,
        isActive: true,
        status: "COMPLETED_BILLED",
        billingDate: { gte: yearStart, lt: yearEnd },
      },
      select,
      orderBy: [{ billingDate: "desc" }, { title: "asc" }],
    }),
  ]);
  const mapRow = (
    movie: (typeof summaryMovies)[number],
  ): GenericBillingSummaryHistoryRow => ({
    movieId: movie.id,
    title: movie.title,
    status: formatMovieStatus(movie.status),
    billingRegions: formatBillingRegions(movie),
    billingDate: formatBillingDate(movie.billingDate),
  });
  return {
    client,
    filters,
    summaryRows: summaryMovies.map(mapRow),
    historyRows: historyMovies.map(mapRow),
  };
}

function formatProjectStatus(status: string) {
  return status.replaceAll("_", " ");
}

function toStartOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function toEndOfDay(value: string) {
  return new Date(`${value}T23:59:59.999`);
}

function sortRows(rows: GenericBillingReportRow[]) {
  return [...rows].sort((a, b) => a.projectName.localeCompare(b.projectName));
}

function getDeveloperCost(
  project: { developerCount: number; perDeveloperCost: unknown },
  includeDeveloperCosts: boolean,
) {
  if (!includeDeveloperCosts || Number(project.developerCount || 0) <= 0)
    return undefined;
  return (
    Number(project.developerCount || 0) * Number(project.perDeveloperCost ?? 0)
  );
}

function addDeveloperCost(
  baseCost: number,
  project: { developerCount: number; perDeveloperCost: unknown },
  includeDeveloperCosts: boolean,
) {
  const developerCost = getDeveloperCost(project, includeDeveloperCosts);
  return {
    projectCost: baseCost,
    cost: baseCost + Number(developerCost ?? 0),
    developerCost,
  };
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

function buildBlock(
  block: Omit<GenericBillingReportBlock, "showDeveloperCost">,
): GenericBillingReportBlock {
  return {
    ...block,
    showDeveloperCost: block.rows.some(
      (row) => row.developerCost !== undefined,
    ),
  };
}

export async function getGenericBillingReportData({
  clientId,
  filters,
  options = {},
}: {
  clientId: string;
  filters: GenericBillingReportFilters;
  options?: GenericBillingReportOptions;
}): Promise<GenericBillingReportData | null> {
  const movieSpecific = Boolean(options.movieSpecific);
  const includeDeveloperCosts = Boolean(options.includeDeveloperCosts);
  const openDateRange = Boolean(options.openDateRange);

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      hourlyCost: true,
      showCountriesInTimeEntries: true,
      projects: {
        where: { isActive: true },
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
          developerCount: true,
          perDeveloperCost: true,
          contactPersons: {
            orderBy: { name: "asc" },
            select: { name: true, email: true },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!client) return null;

  const movieOptions = movieSpecific
    ? await db.movie.findMany({
        where: {
          clientId,
          isActive: true,
          status: { in: ["WORKING", "COMPLETED"] },
          timeEntries: { some: { project: { clientId } } },
        },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      })
    : [];

  const requestedMovieId = filters.movieId;
  const selectedMovieId = movieSpecific
    ? movieOptions.length > 1
      ? requestedMovieId === "all" ||
        movieOptions.some((movie) => movie.id === requestedMovieId)
        ? requestedMovieId || "all"
        : "all"
      : (movieOptions[0]?.id ?? "")
    : "";
  const selectedMovie =
    selectedMovieId && selectedMovieId !== "all"
      ? (movieOptions.find((movie) => movie.id === selectedMovieId) ?? null)
      : null;

  if (movieSpecific && movieOptions.length > 1 && selectedMovieId === "all") {
    const titleBlocks: GenericBillingReportTitleBlock[] = [];
    for (const movie of movieOptions) {
      const titleData = await getGenericBillingReportData({
        clientId,
        filters: { ...filters, movieId: movie.id },
        options: { ...options, openDateRange },
      });
      if (!titleData || !titleData.blocks.length) continue;
      titleBlocks.push({
        movie,
        blocks: titleData.blocks,
        totalCost: titleData.blocks.reduce(
          (sum, block) =>
            sum + block.rows.reduce((blockSum, row) => blockSum + row.cost, 0),
          0,
        ),
      });
    }

    return {
      client: {
        id: client.id,
        name: client.name,
        hourlyCost: Number(client.hourlyCost ?? 0),
        showCountriesInTimeEntries: client.showCountriesInTimeEntries,
      },
      filters: {
        ...filters,
        movieId: "all",
        fromDate: openDateRange ? filters.fromDate : filters.fromDate,
        toDate: openDateRange ? filters.toDate : filters.toDate,
      },
      movieSpecific,
      includeDeveloperCosts,
      movieOptions,
      selectedMovie: null,
      blocks: [],
      titleBlocks,
      reportTitle: client.name + " Billing",
    };
  }

  if (movieSpecific && !selectedMovie) {
    return {
      client: {
        id: client.id,
        name: client.name,
        hourlyCost: Number(client.hourlyCost ?? 0),
        showCountriesInTimeEntries: client.showCountriesInTimeEntries,
      },
      filters: { ...filters, movieId: selectedMovieId },
      movieSpecific,
      includeDeveloperCosts,
      movieOptions,
      selectedMovie: null,
      blocks: [],
      titleBlocks: [],
      reportTitle: client.name + " Billing",
    };
  }

  const movieContactPersons =
    movieSpecific && selectedMovieId && selectedMovieId !== "all"
      ? await db.contactPerson.findMany({
          where: { clientId, movieId: selectedMovieId },
          orderBy: { name: "asc" },
          select: { name: true, email: true },
        })
      : [];
  const movieContactPersonLabel = buildContactPersonLabel(movieContactPersons);

  const projectIdsWithSelectedMovie = new Set<string>();
  if (movieSpecific && selectedMovieId && selectedMovieId !== "all") {
    const movieEntries = await db.timeEntry.findMany({
      where: { movieId: selectedMovieId, project: { clientId } },
      select: { projectId: true },
      distinct: ["projectId"],
    });
    movieEntries.forEach((entry) =>
      projectIdsWithSelectedMovie.add(entry.projectId),
    );
  }

  const eligibleProjects = movieSpecific
    ? client.projects.filter((project) =>
        projectIdsWithSelectedMovie.has(project.id),
      )
    : client.projects;

  const eligibleProjectIds = eligibleProjects.map((project) => project.id);
  const lensAdjustments = await getLensBillingAdjustments({
    projectIds: eligibleProjectIds,
    ...(movieSpecific && selectedMovieId && selectedMovieId !== "all"
      ? { movieId: selectedMovieId }
      : {}),
  });
  const hourlyCost = Number(client.hourlyCost ?? 0);
  const applyLensAdjustment = (
    row: GenericBillingReportRow,
    project: { id: string; name: string; billingModel: string },
  ) => {
    const lens = lensAdjustments.get(project.id);
    if (!lens) return row;
    const developerCost = Number(row.developerCost ?? 0);
    return {
      ...row,
      projectName:
        project.billingModel === "FIXED_PER_COUNTRY"
          ? project.name
          : `${project.name} (${lens.lensNames.join(", ")})`,
      projectCost: lens.cost,
      cost: lens.cost + developerCost,
      lensDetails:
        project.billingModel === "FIXED_PER_COUNTRY"
          ? lens.detailLines
          : undefined,
    };
  };
  const getProjectContactPerson = (project: {
    contactPersons: { name: string; email: string }[];
  }) => {
    if (movieSpecific && movieContactPersons.length)
      return movieContactPersonLabel;
    return buildContactPersonLabel(project.contactPersons);
  };
  const hourlyProjectIds = eligibleProjects
    .filter((project) => project.billingModel === "HOURLY")
    .map((project) => project.id);
  const fromBoundary = filters.fromDate ? toStartOfDay(filters.fromDate) : null;
  const toBoundary = filters.toDate ? toEndOfDay(filters.toDate) : null;

  const totalMinutesByProject = new Map<string, number>();
  if (eligibleProjectIds.length) {
    const totalGroups = await db.timeEntry.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: eligibleProjectIds },
        ...(fromBoundary || toBoundary
          ? { workDate: { ...(fromBoundary ? { gte: fromBoundary } : {}), ...(toBoundary ? { lte: toBoundary } : {}) } }
          : {}),
        ...(movieSpecific && selectedMovieId && selectedMovieId !== "all" ? { movieId: selectedMovieId } : {}),
      },
      _sum: { minutesSpent: true },
    });
    for (const group of totalGroups) totalMinutesByProject.set(group.projectId, group._sum.minutesSpent ?? 0);
  }

  const hourlyMinutesByProject = new Map<string, number>();
  if (hourlyProjectIds.length) {
    const hourlyGroups = await db.timeEntry.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: hourlyProjectIds },
        ...(fromBoundary || toBoundary
          ? {
              workDate: {
                ...(fromBoundary ? { gte: fromBoundary } : {}),
                ...(toBoundary ? { lte: toBoundary } : {}),
              },
            }
          : {}),
        ...(movieSpecific && selectedMovieId && selectedMovieId !== "all"
          ? { movieId: selectedMovieId }
          : {}),
      },
      _sum: { minutesSpent: true },
    });

    for (const group of hourlyGroups) {
      hourlyMinutesByProject.set(group.projectId, group._sum.minutesSpent ?? 0);
    }
  }

  const hourlyRows = sortRows(
    eligibleProjects
      .filter((project) => project.billingModel === "HOURLY")
      .map((project) => {
        const minutes = hourlyMinutesByProject.get(project.id) ?? 0;
        const developer = addDeveloperCost(
          (minutes / 60) * hourlyCost,
          project,
          includeDeveloperCosts,
        );
        return applyLensAdjustment(
          {
            projectId: project.id,
            projectName: project.name,
            contactPerson: getProjectContactPerson(project),
            status: formatProjectStatus(project.status),
            totalHours: (totalMinutesByProject.get(project.id) ?? 0) / 60,
            ...developer,
          } satisfies GenericBillingReportRow,
          project,
        );
      }),
  );

  const fixedFullRows = sortRows(
    eligibleProjects
      .filter(
        (project) =>
          project.billingModel === "FIXED_FULL" &&
          (project.status === "COMPLETED" || client.id === FOCUS_FEATURES_CLIENT_ID),
      )
      .map((project) => {
        const developer = addDeveloperCost(
          Number(project.fixedContractHours ?? 0) * hourlyCost +
            Number(project.additionalCharges ?? 0) -
            Number(project.partialBillingCost ?? 0),
          project,
          includeDeveloperCosts,
        );
        return applyLensAdjustment(
          {
            projectId: project.id,
            projectName: project.name,
            contactPerson: getProjectContactPerson(project),
            status: formatProjectStatus(project.status),
            totalHours: (totalMinutesByProject.get(project.id) ?? 0) / 60,
            ...developer,
          } satisfies GenericBillingReportRow,
          project,
        );
      }),
  );

  const fixedMonthlyRows = sortRows(
    eligibleProjects
      .filter((project) => project.billingModel === "FIXED_MONTHLY")
      .map((project) => {
        const developer = addDeveloperCost(
          Number(project.fixedMonthlyHours ?? 0) * hourlyCost,
          project,
          includeDeveloperCosts,
        );
        return applyLensAdjustment(
          {
            projectId: project.id,
            projectName: project.name,
            contactPerson: getProjectContactPerson(project),
            status: formatProjectStatus(project.status),
            totalHours: (totalMinutesByProject.get(project.id) ?? 0) / 60,
            ...developer,
          } satisfies GenericBillingReportRow,
          project,
        );
      }),
  );

  const fixedCostRows = sortRows(
    eligibleProjects
      .filter((project) => project.billingModel === "FIXED_COST")
      .map((project) => {
        const developer = addDeveloperCost(
          Number(project.projectCost ?? 0),
          project,
          includeDeveloperCosts,
        );
        return applyLensAdjustment(
          {
            projectId: project.id,
            projectName: project.name,
            contactPerson: getProjectContactPerson(project),
            status: formatProjectStatus(project.status),
            totalHours: (totalMinutesByProject.get(project.id) ?? 0) / 60,
            ...developer,
          } satisfies GenericBillingReportRow,
          project,
        );
      }),
  );

  let fixedPerCountryRows: GenericBillingReportRow[] = [];
  if (client.showCountriesInTimeEntries) {
    const fixedPerCountryProjectIds = eligibleProjects
      .filter((project) => project.billingModel === "FIXED_PER_COUNTRY")
      .map((project) => project.id);
    const countryEntries = fixedPerCountryProjectIds.length
      ? await db.timeEntry.findMany({
          where: {
            projectId: { in: fixedPerCountryProjectIds },
            countryId: { not: null },
            ...(movieSpecific && selectedMovieId && selectedMovieId !== "all"
              ? { movieId: selectedMovieId }
              : {}),
          },
          select: {
            projectId: true,
            country: { select: { id: true, name: true, isoCode: true } },
          },
        })
      : [];

    const countriesByProject = new Map<string, Map<string, string>>();
    for (const entry of countryEntries) {
      if (!entry.country) continue;
      const projectCountries =
        countriesByProject.get(entry.projectId) ?? new Map<string, string>();
      projectCountries.set(
        entry.country.id,
        entry.country.isoCode
          ? `${entry.country.name} (${entry.country.isoCode})`
          : entry.country.name,
      );
      countriesByProject.set(entry.projectId, projectCountries);
    }

    fixedPerCountryRows = sortRows(
      eligibleProjects
        .filter((project) => project.billingModel === "FIXED_PER_COUNTRY")
        .map((project) => {
          const countries = Array.from(
            countriesByProject.get(project.id)?.values() ?? [],
          ).sort((a, b) => a.localeCompare(b));
          const developer = addDeveloperCost(
            countries.length * Number(project.perCountryCharges ?? 0),
            project,
            includeDeveloperCosts,
          );
          return applyLensAdjustment(
            {
              projectId: project.id,
              projectName: project.name,
              contactPerson: getProjectContactPerson(project),
              status: formatProjectStatus(project.status),
              totalHours: (totalMinutesByProject.get(project.id) ?? 0) / 60,
              countryList: countries.join(", "),
              ...developer,
            } satisfies GenericBillingReportRow,
            project,
          );
        })
        .filter((row) => Boolean(row.countryList)),
    );
  }

  const possibleBlocks: GenericBillingReportBlock[] = [
    buildBlock({
      key: "hourly",
      title: "Hourly",
      description:
        filters.fromDate || filters.toDate
          ? `Costs are calculated from time entries between ${filters.fromDate || "Start"} and ${filters.toDate || "End"}.`
          : "Costs are calculated from all available time entries.",
      rows: hourlyRows,
    }),
    buildBlock({
      key: "fixedFull",
      title: "Fixed - Full Project",
      description:
        "Only completed Fixed - Full Project records are shown here.",
      rows: fixedFullRows,
    }),
    buildBlock({
      key: "fixedMonthly",
      title: "Fixed - Monthly",
      description:
        "Costs are calculated from fixed monthly hours and the client hourly cost.",
      rows: fixedMonthlyRows,
    }),
    buildBlock({
      key: "fixedCost",
      title: "Fixed Cost",
      description: "Costs are calculated from the fixed project cost.",
      rows: fixedCostRows,
    }),
    ...(client.showCountriesInTimeEntries
      ? [
          buildBlock({
            key: "fixedPerCountry" as const,
            title: "Fixed Per Country",
            description:
              "Costs are calculated from distinct countries used in time entries.",
            rows: fixedPerCountryRows,
          }),
        ]
      : []),
  ];

  return {
    client: {
      id: client.id,
      name: client.name,
      hourlyCost,
      showCountriesInTimeEntries: client.showCountriesInTimeEntries,
    },
    filters: { ...filters, movieId: selectedMovieId },
    movieSpecific,
    includeDeveloperCosts,
    movieOptions,
    selectedMovie,
    blocks: possibleBlocks.filter((block) => block.rows.length > 0),
    titleBlocks: [],
    reportTitle: client.name + " Billing",
  };
}

export function getGenericBillingReportFileName(
  data: GenericBillingReportData,
  extension: "xls" | "pdf",
) {
  const moviePart = data.selectedMovie
    ? `_${sanitizeFileSegment(data.selectedMovie.title)}`
    : "";
  return `${sanitizeFileSegment(data.client.name)}${moviePart}_Billing_Report_${getExportTimestamp()}.${extension}`;
}

export { formatUsd };
