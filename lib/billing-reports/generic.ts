import { db } from "@/lib/db";
import { formatUsd, getDefaultMonthRange, getExportTimestamp, normalizeDateInput, sanitizeFileSegment } from "@/lib/billing-reports/amazon";

export type GenericBillingReportFilters = {
  fromDate: string;
  toDate: string;
};

export type GenericBillingReportRow = {
  projectId: string;
  projectName: string;
  status: string;
  cost: number;
  countryList?: string;
};

export type GenericBillingReportBlock = {
  key: "hourly" | "fixedFull" | "fixedMonthly" | "fixedPerCountry";
  title: string;
  description: string;
  rows: GenericBillingReportRow[];
};

export type GenericBillingReportData = {
  client: {
    id: string;
    name: string;
    hourlyCost: number;
    showCountriesInTimeEntries: boolean;
  };
  filters: GenericBillingReportFilters;
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

export async function getGenericBillingReportData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: GenericBillingReportFilters;
}): Promise<GenericBillingReportData | null> {
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
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!client) return null;

  const hourlyCost = Number(client.hourlyCost ?? 0);
  const hourlyProjectIds = client.projects.filter((project) => project.billingModel === "HOURLY").map((project) => project.id);
  const fromBoundary = toStartOfDay(filters.fromDate);
  const toBoundary = toEndOfDay(filters.toDate);

  const hourlyMinutesByProject = new Map<string, number>();
  if (hourlyProjectIds.length) {
    const hourlyGroups = await db.timeEntry.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: hourlyProjectIds },
        workDate: { gte: fromBoundary, lte: toBoundary },
      },
      _sum: { minutesSpent: true },
    });

    for (const group of hourlyGroups) {
      hourlyMinutesByProject.set(group.projectId, group._sum.minutesSpent ?? 0);
    }
  }

  const hourlyRows = sortRows(client.projects
    .filter((project) => project.billingModel === "HOURLY")
    .map((project) => {
      const minutes = hourlyMinutesByProject.get(project.id) ?? 0;
      return {
        projectId: project.id,
        projectName: project.name,
        status: formatProjectStatus(project.status),
        cost: (minutes / 60) * hourlyCost,
      } satisfies GenericBillingReportRow;
    }));

  const fixedFullRows = sortRows(client.projects
    .filter((project) => project.billingModel === "FIXED_FULL" && project.status === "COMPLETED")
    .map((project) => ({
      projectId: project.id,
      projectName: project.name,
      status: formatProjectStatus(project.status),
      cost: (Number(project.fixedContractHours ?? 0) * hourlyCost) + Number(project.additionalCharges ?? 0) - Number(project.partialBillingCost ?? 0),
    })));

  const fixedMonthlyRows = sortRows(client.projects
    .filter((project) => project.billingModel === "FIXED_MONTHLY")
    .map((project) => ({
      projectId: project.id,
      projectName: project.name,
      status: formatProjectStatus(project.status),
      cost: Number(project.fixedMonthlyHours ?? 0) * hourlyCost,
    })));

  let fixedPerCountryRows: GenericBillingReportRow[] = [];
  if (client.showCountriesInTimeEntries) {
    const fixedPerCountryProjectIds = client.projects.filter((project) => project.billingModel === "FIXED_PER_COUNTRY").map((project) => project.id);
    const countryEntries = fixedPerCountryProjectIds.length
      ? await db.timeEntry.findMany({
          where: {
            projectId: { in: fixedPerCountryProjectIds },
            countryId: { not: null },
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

    fixedPerCountryRows = sortRows(client.projects
      .filter((project) => project.billingModel === "FIXED_PER_COUNTRY")
      .map((project) => {
        const countries = Array.from(countriesByProject.get(project.id)?.values() ?? []).sort((a, b) => a.localeCompare(b));
        return {
          projectId: project.id,
          projectName: project.name,
          status: formatProjectStatus(project.status),
          countryList: countries.join(", "),
          cost: countries.length * Number(project.perCountryCharges ?? 0),
        } satisfies GenericBillingReportRow;
      })
      .filter((row) => Boolean(row.countryList)));
  }

  const possibleBlocks: GenericBillingReportBlock[] = [
    {
      key: "hourly",
      title: "Hourly",
      description: `Costs are calculated from time entries between ${filters.fromDate} and ${filters.toDate}.`,
      rows: hourlyRows,
    },
    {
      key: "fixedFull",
      title: "Fixed - Full Project",
      description: "Only completed Fixed - Full Project records are shown here.",
      rows: fixedFullRows,
    },
    {
      key: "fixedMonthly",
      title: "Fixed - Monthly",
      description: "Costs are calculated from fixed monthly hours and the client hourly cost.",
      rows: fixedMonthlyRows,
    },
    ...(client.showCountriesInTimeEntries ? [{
      key: "fixedPerCountry" as const,
      title: "Fixed Per Country",
      description: "Costs are calculated from distinct countries used in time entries.",
      rows: fixedPerCountryRows,
    }] : []),
  ];

  return {
    client: {
      id: client.id,
      name: client.name,
      hourlyCost,
      showCountriesInTimeEntries: client.showCountriesInTimeEntries,
    },
    filters,
    blocks: possibleBlocks.filter((block) => block.rows.length > 0),
  };
}

export function getGenericBillingReportFileName(data: GenericBillingReportData, extension: "xls" | "pdf") {
  return `${sanitizeFileSegment(data.client.name)}_Billing_Report_${getExportTimestamp()}.${extension}`;
}

export { formatUsd };
