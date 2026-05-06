import { db } from "@/lib/db";
import { formatUsd, getDefaultMonthRange, getExportTimestamp, normalizeDateInput, sanitizeFileSegment } from "@/lib/billing-reports/amazon";

export type GenericBillingReportFilters = {
  fromDate: string;
  toDate: string;
  movieId: string;
};

export type GenericBillingReportOptions = {
  movieSpecific?: boolean;
  includeDeveloperCosts?: boolean;
};

export type GenericBillingReportRow = {
  projectId: string;
  projectName: string;
  contactPerson: string;
  status: string;
  projectCost: number;
  cost: number;
  developerCost?: number;
  countryList?: string;
};

export type GenericBillingReportBlock = {
  key: "hourly" | "fixedFull" | "fixedMonthly" | "fixedPerCountry";
  title: string;
  description: string;
  rows: GenericBillingReportRow[];
  showDeveloperCost: boolean;
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
};

function getParamValue(searchParams: URLSearchParams | Record<string, string | string[] | undefined>, key: string) {
  if (searchParams instanceof URLSearchParams) return searchParams.get(key) ?? undefined;
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export function buildGenericBillingReportFilters(searchParams: URLSearchParams | Record<string, string | string[] | undefined>) {
  const defaults = getDefaultMonthRange();
  return {
    fromDate: normalizeDateInput(getParamValue(searchParams, "fromDate"), defaults.fromDate),
    toDate: normalizeDateInput(getParamValue(searchParams, "toDate"), defaults.toDate),
    movieId: getParamValue(searchParams, "movieId") || "",
  } satisfies GenericBillingReportFilters;
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

function getDeveloperCost(project: { developerCount: number; perDeveloperCost: unknown }, includeDeveloperCosts: boolean) {
  if (!includeDeveloperCosts || Number(project.developerCount || 0) <= 0) return undefined;
  return Number(project.developerCount || 0) * Number(project.perDeveloperCost ?? 0);
}

function addDeveloperCost(baseCost: number, project: { developerCount: number; perDeveloperCost: unknown }, includeDeveloperCosts: boolean) {
  const developerCost = getDeveloperCost(project, includeDeveloperCosts);
  return { projectCost: baseCost, cost: baseCost + Number(developerCost ?? 0), developerCost };
}

function buildContactPersonLabel(contactPersons: { name: string; email: string }[]) {
  if (!contactPersons.length) return "-";
  return contactPersons.map((person) => `${person.name}${person.email ? ` (${person.email})` : ""}`).join(", ");
}

function buildBlock(block: Omit<GenericBillingReportBlock, "showDeveloperCost">): GenericBillingReportBlock {
  return {
    ...block,
    showDeveloperCost: block.rows.some((row) => row.developerCost !== undefined),
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
        where: { clientId, isActive: true, timeEntries: { some: { project: { clientId } } } },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      })
    : [];

  const selectedMovieId = movieSpecific ? (filters.movieId || movieOptions[0]?.id || "") : "";
  const selectedMovie = selectedMovieId ? movieOptions.find((movie) => movie.id === selectedMovieId) ?? null : null;

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
    };
  }

  const movieContactPersons = movieSpecific && selectedMovieId
    ? await db.contactPerson.findMany({
        where: { clientId, movieId: selectedMovieId },
        orderBy: { name: "asc" },
        select: { name: true, email: true },
      })
    : [];
  const movieContactPersonLabel = buildContactPersonLabel(movieContactPersons);

  const projectIdsWithSelectedMovie = new Set<string>();
  if (movieSpecific && selectedMovieId) {
    const movieEntries = await db.timeEntry.findMany({
      where: { movieId: selectedMovieId, project: { clientId } },
      select: { projectId: true },
      distinct: ["projectId"],
    });
    movieEntries.forEach((entry) => projectIdsWithSelectedMovie.add(entry.projectId));
  }

  const eligibleProjects = movieSpecific
    ? client.projects.filter((project) => projectIdsWithSelectedMovie.has(project.id))
    : client.projects;

  const hourlyCost = Number(client.hourlyCost ?? 0);
  const getProjectContactPerson = (project: { contactPersons: { name: string; email: string }[] }) => {
    if (movieSpecific && movieContactPersons.length) return movieContactPersonLabel;
    return buildContactPersonLabel(project.contactPersons);
  };
  const hourlyProjectIds = eligibleProjects.filter((project) => project.billingModel === "HOURLY").map((project) => project.id);
  const fromBoundary = toStartOfDay(filters.fromDate);
  const toBoundary = toEndOfDay(filters.toDate);

  const hourlyMinutesByProject = new Map<string, number>();
  if (hourlyProjectIds.length) {
    const hourlyGroups = await db.timeEntry.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: hourlyProjectIds },
        workDate: { gte: fromBoundary, lte: toBoundary },
        ...(movieSpecific && selectedMovieId ? { movieId: selectedMovieId } : {}),
      },
      _sum: { minutesSpent: true },
    });

    for (const group of hourlyGroups) {
      hourlyMinutesByProject.set(group.projectId, group._sum.minutesSpent ?? 0);
    }
  }

  const hourlyRows = sortRows(eligibleProjects
    .filter((project) => project.billingModel === "HOURLY")
    .map((project) => {
      const minutes = hourlyMinutesByProject.get(project.id) ?? 0;
      const developer = addDeveloperCost((minutes / 60) * hourlyCost, project, includeDeveloperCosts);
      return {
        projectId: project.id,
        projectName: project.name,
        contactPerson: getProjectContactPerson(project),
        status: formatProjectStatus(project.status),
        ...developer,
      } satisfies GenericBillingReportRow;
    }));

  const fixedFullRows = sortRows(eligibleProjects
    .filter((project) => project.billingModel === "FIXED_FULL" && project.status === "COMPLETED")
    .map((project) => {
      const developer = addDeveloperCost((Number(project.fixedContractHours ?? 0) * hourlyCost) + Number(project.additionalCharges ?? 0) - Number(project.partialBillingCost ?? 0), project, includeDeveloperCosts);
      return {
        projectId: project.id,
        projectName: project.name,
        contactPerson: getProjectContactPerson(project),
        status: formatProjectStatus(project.status),
        ...developer,
      } satisfies GenericBillingReportRow;
    }));

  const fixedMonthlyRows = sortRows(eligibleProjects
    .filter((project) => project.billingModel === "FIXED_MONTHLY")
    .map((project) => {
      const developer = addDeveloperCost(Number(project.fixedMonthlyHours ?? 0) * hourlyCost, project, includeDeveloperCosts);
      return {
        projectId: project.id,
        projectName: project.name,
        contactPerson: getProjectContactPerson(project),
        status: formatProjectStatus(project.status),
        ...developer,
      } satisfies GenericBillingReportRow;
    }));

  let fixedPerCountryRows: GenericBillingReportRow[] = [];
  if (client.showCountriesInTimeEntries) {
    const fixedPerCountryProjectIds = eligibleProjects.filter((project) => project.billingModel === "FIXED_PER_COUNTRY").map((project) => project.id);
    const countryEntries = fixedPerCountryProjectIds.length
      ? await db.timeEntry.findMany({
          where: {
            projectId: { in: fixedPerCountryProjectIds },
            countryId: { not: null },
            ...(movieSpecific && selectedMovieId ? { movieId: selectedMovieId } : {}),
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
      const projectCountries = countriesByProject.get(entry.projectId) ?? new Map<string, string>();
      projectCountries.set(entry.country.id, entry.country.isoCode ? `${entry.country.name} (${entry.country.isoCode})` : entry.country.name);
      countriesByProject.set(entry.projectId, projectCountries);
    }

    fixedPerCountryRows = sortRows(eligibleProjects
      .filter((project) => project.billingModel === "FIXED_PER_COUNTRY")
      .map((project) => {
        const countries = Array.from(countriesByProject.get(project.id)?.values() ?? []).sort((a, b) => a.localeCompare(b));
        const developer = addDeveloperCost(countries.length * Number(project.perCountryCharges ?? 0), project, includeDeveloperCosts);
        return {
          projectId: project.id,
          projectName: project.name,
          contactPerson: getProjectContactPerson(project),
          status: formatProjectStatus(project.status),
          countryList: countries.join(", "),
          ...developer,
        } satisfies GenericBillingReportRow;
      })
      .filter((row) => Boolean(row.countryList)));
  }

  const possibleBlocks: GenericBillingReportBlock[] = [
    buildBlock({
      key: "hourly",
      title: "Hourly",
      description: `Costs are calculated from time entries between ${filters.fromDate} and ${filters.toDate}.`,
      rows: hourlyRows,
    }),
    buildBlock({
      key: "fixedFull",
      title: "Fixed - Full Project",
      description: "Only completed Fixed - Full Project records are shown here.",
      rows: fixedFullRows,
    }),
    buildBlock({
      key: "fixedMonthly",
      title: "Fixed - Monthly",
      description: "Costs are calculated from fixed monthly hours and the client hourly cost.",
      rows: fixedMonthlyRows,
    }),
    ...(client.showCountriesInTimeEntries ? [buildBlock({
      key: "fixedPerCountry" as const,
      title: "Fixed Per Country",
      description: "Costs are calculated from distinct countries used in time entries.",
      rows: fixedPerCountryRows,
    })] : []),
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
  };
}

export function getGenericBillingReportFileName(data: GenericBillingReportData, extension: "xls" | "pdf") {
  const moviePart = data.selectedMovie ? `_${sanitizeFileSegment(data.selectedMovie.title)}` : "";
  return `${sanitizeFileSegment(data.client.name)}${moviePart}_Billing_Report_${getExportTimestamp()}.${extension}`;
}

export { formatUsd };
