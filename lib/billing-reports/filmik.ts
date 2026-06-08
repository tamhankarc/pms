import { db } from "@/lib/db";
import {
  getExportTimestamp,
  sanitizeFileSegment,
} from "@/lib/billing-reports/amazon";
import { FILMIK_CLIENT_ID } from "@/lib/billing-reports/config";
import { getLensBillingAdjustments } from "@/lib/billing-reports/lens";

export type FilmikBillingReportFilters = { month: string };

export type FilmikResourceReportRow = {
  resourceTypeId: string;
  resourceTypeName: string;
  count: number;
  perResourceClientCost: number;
  perResourceVendorCost: number;
  clientCost: number;
  vendorCost: number;
};

export type FilmikCombinedReportRow = {
  key: string;
  name: string;
  quantity: number;
  clientCost: number;
  vendorCost: number;
  contactPerson: string;
};

export type FilmikBillingReportData = {
  client: { id: string; name: string; hourlyCost: number };
  filters: FilmikBillingReportFilters;
  resourceRows: FilmikResourceReportRow[];
  resourceTotalCount: number;
  resourceTotalClientCost: number;
  resourceTotalVendorCost: number;
  projectRows: FilmikCombinedReportRow[];
  combinedRows: FilmikCombinedReportRow[];
  combinedTotalClientCost: number;
  combinedTotalVendorCost: number;
  reportTitle: string;
};

export function buildFilmikBillingReportFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  const value =
    searchParams instanceof URLSearchParams
      ? searchParams.get("month")
      : Array.isArray(searchParams.month)
        ? searchParams.month[0]
        : searchParams.month;
  const todayMonth = new Date().toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(value || "") ? String(value) : todayMonth;
  return { month } satisfies FilmikBillingReportFilters;
}

function getMonthBoundaries(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
  return { from, to };
}

function formatMonthLabel(month: string) {
  const { from } = getMonthBoundaries(month);
  return from.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
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

function latestCountsForMonth<
  TRow extends {
    projectId: string;
    resourceTypeId: string;
    effectiveMonth: Date;
    count: number;
  },
>(rows: TRow[], monthStart: Date) {
  const latest = new Map<string, TRow>();
  for (const row of rows) {
    if (row.effectiveMonth > monthStart) continue;
    const key = `${row.projectId}::${row.resourceTypeId}`;
    const existing = latest.get(key);
    if (
      !existing ||
      row.effectiveMonth > existing.effectiveMonth ||
      row.effectiveMonth.getTime() === existing.effectiveMonth.getTime()
    )
      latest.set(key, row);
  }
  return latest;
}

export async function getFilmikBillingReportData(
  filters: FilmikBillingReportFilters,
): Promise<FilmikBillingReportData | null> {
  const { from, to } = getMonthBoundaries(filters.month);
  const client = await db.client.findUnique({
    where: { id: FILMIK_CLIENT_ID },
    select: {
      id: true,
      name: true,
      hourlyCost: true,
      projects: {
        where: { isActive: true, addToBilling: true },
        select: {
          id: true,
          name: true,
          contactPersons: {
            orderBy: { name: "asc" },
            select: {
              name: true,
              email: true,
              country: { select: { isoCode: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!client) return null;

  const [resourceTypes, countHistory, projectTimeGroups] = await Promise.all([
    db.filmikResourceType.findMany({
      where: { clientId: FILMIK_CLIENT_ID, isActive: true },
      select: { id: true, name: true, cost: true, perResourceVendorCost: true },
      orderBy: { name: "asc" },
    }),
    db.projectFilmikResourceCount.findMany({
      where: {
        project: { clientId: FILMIK_CLIENT_ID },
        effectiveMonth: { lte: from },
      },
      select: {
        projectId: true,
        resourceTypeId: true,
        effectiveMonth: true,
        count: true,
      },
      orderBy: [
        { resourceTypeId: "asc" },
        { projectId: "asc" },
        { effectiveMonth: "asc" },
      ],
    }),
    db.timeEntry.groupBy({
      by: ["projectId"],
      where: {
        project: { clientId: FILMIK_CLIENT_ID },
        workDate: { gte: from, lte: to },
      },
      _sum: { minutesSpent: true },
    }),
  ]);

  const latest = latestCountsForMonth(countHistory, from);
  const countByResource = new Map<string, number>();
  for (const row of latest.values()) {
    if (row.count <= 0) continue;
    countByResource.set(
      row.resourceTypeId,
      (countByResource.get(row.resourceTypeId) ?? 0) + row.count,
    );
  }

  const resourceRows = resourceTypes
    .map((resource) => {
      const count = countByResource.get(resource.id) ?? 0;
      const perResourceClientCost = Number(resource.cost ?? 0);
      const perResourceVendorCost = Number(resource.perResourceVendorCost ?? 0);
      return {
        resourceTypeId: resource.id,
        resourceTypeName: resource.name,
        count,
        perResourceClientCost,
        perResourceVendorCost,
        clientCost: count * perResourceClientCost,
        vendorCost: count * perResourceVendorCost,
      } satisfies FilmikResourceReportRow;
    })
    .filter((row) => row.count > 0);

  const resourceTotalCount = resourceRows.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const resourceTotalClientCost = resourceRows.reduce(
    (sum, row) => sum + row.clientCost,
    0,
  );
  const resourceTotalVendorCost = resourceRows.reduce(
    (sum, row) => sum + row.vendorCost,
    0,
  );
  const minutesByProject = new Map(
    projectTimeGroups.map((group) => [
      group.projectId,
      group._sum.minutesSpent ?? 0,
    ]),
  );
  const hourlyCost = Number(client.hourlyCost ?? 0);
  const lensAdjustments = await getLensBillingAdjustments({
    projectIds: client.projects.map((project) => project.id),
    workDate: { gte: from, lte: to },
  });

  const projectRows = client.projects
    .map((project) => {
      const minutes = minutesByProject.get(project.id) ?? 0;
      const hours = minutes / 60;
      const lens = lensAdjustments.get(project.id);
      return {
        key: project.id,
        name: lens
          ? `${project.name} (${lens.lensNames.join(", ")})`
          : project.name,
        quantity: hours,
        clientCost: lens ? lens.cost : hours * hourlyCost,
        vendorCost: 0,
        contactPerson: buildContactPersonLabel(project.contactPersons),
      } satisfies FilmikCombinedReportRow;
    })
    .filter((row) => row.quantity > 0);

  const combinedRows: FilmikCombinedReportRow[] = [
    {
      key: "resource-cost",
      name: "Resource Cost",
      quantity: resourceTotalCount,
      clientCost: resourceTotalClientCost,
      vendorCost: resourceTotalVendorCost,
      contactPerson: "-",
    },
    ...projectRows,
  ];
  const combinedTotalClientCost = combinedRows.reduce(
    (sum, row) => sum + row.clientCost,
    0,
  );
  const combinedTotalVendorCost = combinedRows.reduce(
    (sum, row) => sum + row.vendorCost,
    0,
  );

  return {
    client: { id: client.id, name: client.name, hourlyCost },
    filters,
    resourceRows,
    resourceTotalCount,
    resourceTotalClientCost,
    resourceTotalVendorCost,
    projectRows,
    combinedRows,
    combinedTotalClientCost,
    combinedTotalVendorCost,
    reportTitle: "Filmik Billing",
  };
}

export function getFilmikBillingReportFileName(
  data: FilmikBillingReportData,
  extension: "xls" | "pdf",
) {
  return `${sanitizeFileSegment(data.client.name)}_${sanitizeFileSegment(formatMonthLabel(data.filters.month))}_Billing_Report_${getExportTimestamp()}.${extension}`;
}

export function getFilmikBillingReportMonthLabel(
  data: FilmikBillingReportData,
) {
  return formatMonthLabel(data.filters.month);
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(value) ? value : 0);
}
