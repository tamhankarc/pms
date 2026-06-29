import { db } from "@/lib/db";
import {
  formatUsd,
  getDefaultMonthRange,
  getExportTimestamp,
  normalizeDateInput,
  sanitizeFileSegment,
} from "@/lib/billing-reports/amazon";
import { getLensBillingAdjustments } from "@/lib/billing-reports/lens";
import type { MovieStatus } from "@prisma/client";

import { SONY_PICTURES_CLASSICS_CLIENT_ID } from "@/lib/billing-reports/config";

const FOCUS_FEATURES_CLIENT_ID = "cmpuqhyhc002in22ivx3w9vvk";

export type GenericBillingReportContactPerson = {
  id?: string;
  name: string;
  email: string | null;
  countryCode?: string | null;
  country?: { isoCode: string | null } | null;
};

export type GenericBillingReportFilters = {
  fromDate: string;
  toDate: string;
  movieId: string;
};

export type GenericBillingReportOptions = {
  movieSpecific?: boolean;
  includeDeveloperCosts?: boolean;
  openDateRange?: boolean;
  includeCompletedBilled?: boolean;
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
    "hourly" | "fixedFull" | "fixedMonthly" | "fixedPerCountry" | "fixedCost";
  title: string;
  description: string;
  rows: GenericBillingReportRow[];
  showDeveloperCost: boolean;
};

export type GenericBillingReportTitleBlock = {
  movie: { id: string; title: string };
  contactPerson: string;
  contactPersons: GenericBillingReportContactPerson[];
  blocks: GenericBillingReportBlock[];
  totalCost: number;
};

export type GenericBillingSummaryHistoryFilters = {
  year: string;
  projectMonth: string;
};

export type GenericBillingSummaryHistoryRow = {
  itemId: string;
  itemType: "TITLE" | "PROJECT" | "TITLE_PROJECT";
  movieId?: string;
  projectId?: string;
  title: string;
  projectName?: string;
  status: string;
  titleStatus?: string;
  projectStatus?: string;
  billingModel?: string;
  billingMonth?: string;
  billingRegions: string;
  billingDate: string;
  poNumber: string;
  cost?: number;
};

export type GenericBillingSummaryHistoryData = {
  client: { id: string; name: string; poAssignmentMode: string };
  filters: GenericBillingSummaryHistoryFilters;
  summaryRows: GenericBillingSummaryHistoryRow[];
  nonTitleProjectRows: GenericBillingSummaryHistoryRow[];
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
  contactPersons: GenericBillingReportContactPerson[];
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
  const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const suppliedYear = getParamValue(searchParams, "year") || currentYear;
  const suppliedProjectMonth =
    getParamValue(searchParams, "projectMonth") || currentMonth;
  return {
    year: /^\d{4}$/.test(suppliedYear) ? suppliedYear : currentYear,
    projectMonth: /^\d{4}-\d{2}$/.test(suppliedProjectMonth)
      ? suppliedProjectMonth
      : currentMonth,
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
  billingPortal?: boolean;
}) {
  const regions: string[] = [];
  if (movie.billingDomestic) regions.push("Domestic");
  if (movie.billingIntl) regions.push("INTL");
  if (movie.billingOther) regions.push("Other");
  if (movie.billingSocial) regions.push("Social");
  if (movie.billingPortal) regions.push("Portal");
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
    fromDate: `${safeValue}-01`,
    toDate: new Date(year, month, 0).toISOString().slice(0, 10),
  };
}

function getGenericReportTotal(data: GenericBillingReportData | null) {
  if (!data) return 0;
  if (data.titleBlocks?.length) {
    return data.titleBlocks.reduce((sum, block) => sum + block.totalCost, 0);
  }
  return data.blocks.reduce(
    (sum, block) =>
      sum + block.rows.reduce((blockSum, row) => blockSum + row.cost, 0),
    0,
  );
}

function getProjectCostFromGenericReport(
  data: GenericBillingReportData | null,
  projectId: string,
) {
  if (!data) return 0;
  const blocks = data.titleBlocks?.length
    ? data.titleBlocks.flatMap((block) => block.blocks)
    : data.blocks;
  return blocks.reduce(
    (sum, block) =>
      sum +
      block.rows
        .filter((row) => row.projectId === projectId)
        .reduce((blockSum, row) => blockSum + row.cost, 0),
    0,
  );
}

async function getGenericBillingCostForSummary({
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
  const monthRange = billingMonth ? parseYearMonth(billingMonth) : null;
  const defaults = getDefaultMonthRange();
  const openDateRange =
    clientId === SONY_PICTURES_CLASSICS_CLIENT_ID && !monthRange;
  const data = await getGenericBillingReportData({
    clientId,
    filters: {
      fromDate: openDateRange
        ? ""
        : (monthRange?.fromDate ?? defaults.fromDate),
      toDate: openDateRange ? "" : (monthRange?.toDate ?? defaults.toDate),
      movieId: movieId ?? "all",
    },
    options: {
      movieSpecific: Boolean(movieId),
      openDateRange,
      includeCompletedBilled,
    },
  });

  if (projectId) return getProjectCostFromGenericReport(data, projectId);
  return getGenericReportTotal(data);
}

async function getNonTitleProjectBillingSummaryRows({
  clientId,
  clientHourlyCost,
  filters,
  excludedProjectIds = [],
}: {
  clientId: string;
  clientHourlyCost: unknown;
  filters: GenericBillingSummaryHistoryFilters;
  excludedProjectIds?: string[];
}): Promise<GenericBillingSummaryHistoryRow[]> {
  const projectMonthRange = parseYearMonth(filters.projectMonth);
  const excludedProjectIdSet = new Set(excludedProjectIds.filter(Boolean));

  const formatProjectBillingModel = (value: string) =>
    ({
      HOURLY: "Hourly",
      FIXED_FULL: "Fixed Full",
      FIXED_MONTHLY: "Fixed Monthly",
      FIXED_PER_COUNTRY: "Fixed Per Country",
      FIXED_COST: "Fixed Cost",
    })[value] ?? value.replaceAll("_", " ");

  const projectCostValue = (project: {
    billingModel: string;
    projectCost?: unknown;
    perCountryCharges?: unknown;
    fixedContractHours?: unknown;
    additionalCharges?: unknown;
    partialBillingCost?: unknown;
  }) => {
    const hourlyCost = Number(clientHourlyCost ?? 0);
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
    return Number(project.projectCost ?? 0);
  };

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
    additionalCharges: true,
    partialBillingCost: true,
  } as const;

  const candidateProjects = await db.project.findMany({
    where: {
      clientId,
      isActive: true,
      addToBilling: true,
      ...(excludedProjectIds.length
        ? { id: { notIn: excludedProjectIds } }
        : {}),
      OR: [
        { hideMoviesInEntries: true },
        { timeEntries: { some: { movieId: null } } },
      ],
      AND: [
        {
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
      ],
    },
    select: projectSelect,
    orderBy: { name: "asc" },
  });

  const projects = candidateProjects.filter(
    (project) => !excludedProjectIdSet.has(project.id),
  );
  if (!projects.length) return [];

  const monthlyBillingRecords = await db.billingRecord.findMany({
    where: {
      clientId,
      projectId: { in: projects.map((project) => project.id) },
      billingMonth: projectMonthRange.month,
      billingYear: projectMonthRange.year,
    },
    select: { projectId: true },
  });
  const billedMonthlyProjectIds = new Set(
    monthlyBillingRecords.map((record) => record.projectId).filter(Boolean),
  );

  const pendingProjects = projects.filter(
    (project) =>
      project.billingCycle !== "MONTHLY" ||
      !billedMonthlyProjectIds.has(project.id),
  );
  if (!pendingProjects.length) return [];

  const poAssignments = await db.purchaseOrderAssignment.findMany({
    where: {
      clientId,
      assignmentMode: "PROJECT",
      projectId: { in: pendingProjects.map((project) => project.id) },
      purchaseOrder: { status: { not: "CANCELLED" } },
      OR: [
        {
          billingMonth: projectMonthRange.month,
          billingYear: projectMonthRange.year,
        },
        { billingMonth: null, billingYear: null },
      ],
    },
    select: {
      projectId: true,
      billingMonth: true,
      billingYear: true,
      purchaseOrder: { select: { poNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const poByProject = new Map<string, string>();
  for (const assignment of poAssignments) {
    if (!assignment.projectId) continue;
    const isMonthSpecific =
      assignment.billingMonth === projectMonthRange.month &&
      assignment.billingYear === projectMonthRange.year;
    if (isMonthSpecific || !poByProject.has(assignment.projectId)) {
      poByProject.set(assignment.projectId, assignment.purchaseOrder.poNumber);
    }
  }

  return Promise.all(
    pendingProjects.map(
      async (project): Promise<GenericBillingSummaryHistoryRow> => {
        const calculatedCost = await getGenericBillingCostForSummary({
          clientId,
          projectId: project.id,
          billingMonth:
            project.billingCycle === "MONTHLY"
              ? projectMonthRange.value
              : undefined,
        });
        return {
          itemId: `non-title-project:${project.id}`,
          itemType: "PROJECT",
          projectId: project.id,
          title: project.name,
          status: formatProjectStatus(project.status),
          projectStatus: formatProjectStatus(project.status),
          billingModel: formatProjectBillingModel(project.billingModel),
          billingRegions: "Project",
          billingDate: formatBillingDate(project.billingDate),
          billingMonth:
            project.billingCycle === "MONTHLY"
              ? projectMonthRange.value
              : undefined,
          poNumber: poByProject.get(project.id) ?? "-",
          cost: calculatedCost || projectCostValue(project),
        };
      },
    ),
  );
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
    select: { id: true, name: true, poAssignmentMode: true, hourlyCost: true },
  });
  if (!client) return null;
  const year = Number(filters.year);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const formatProjectBillingModel = (value: string) =>
    ({
      HOURLY: "Hourly",
      FIXED_FULL: "Fixed Full",
      FIXED_MONTHLY: "Fixed Monthly",
      FIXED_PER_COUNTRY: "Fixed Per Country",
      FIXED_COST: "Fixed Cost",
    })[value] ?? value.replaceAll("_", " ");
  const projectCostValue = (project: {
    billingModel: string;
    projectCost?: unknown;
    perCountryCharges?: unknown;
    fixedContractHours?: unknown;
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
    return Number(project.projectCost ?? 0);
  };

  const select = {
    id: true,
    title: true,
    status: true,
    billingDate: true,
    billingDomestic: true,
    billingIntl: true,
    billingOther: true,
    billingSocial: true,
    billingPortal: true,
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
    additionalCharges: true,
    partialBillingCost: true,
  } as const;

  const clientPoAssignmentMode: string = client.poAssignmentMode;
  const shouldIncludeNonTitleProjectRows =
    clientPoAssignmentMode === "TITLE" ||
    clientPoAssignmentMode === "TITLE_PROJECT";

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
            billingDate: { gte: yearStart, lt: yearEnd },
          },
          select: projectSelect,
          orderBy: [{ billingDate: "desc" }, { name: "asc" }],
        }),
        db.billingRecord.findMany({
          where: { clientId, projectId: { not: null }, billingYear: year },
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
    const projectIds = [...summaryProjects, ...historyProjects].map(
      (project) => project.id,
    );
    const poAssignments = projectIds.length
      ? await db.purchaseOrderAssignment.findMany({
          where: {
            projectId: { in: projectIds },
            OR: [
              {
                billingMonth: currentBillingMonth,
                billingYear: currentBillingYear,
              },
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
        })
      : [];
    const poByProject = new Map<string, string>();
    for (const assignment of poAssignments) {
      if (!assignment.projectId) continue;
      const isMonthSpecific =
        assignment.billingMonth === currentBillingMonth &&
        assignment.billingYear === currentBillingYear;
      if (isMonthSpecific || !poByProject.has(assignment.projectId)) {
        poByProject.set(
          assignment.projectId,
          assignment.purchaseOrder.poNumber,
        );
      }
    }
    const mapProject = async (
      project: (typeof summaryProjects)[number],
      includeCompletedBilled = false,
      monthly?: {
        month: number;
        year: number;
        amount?: unknown;
        poNumber?: string | null;
        billingDate?: Date | null;
      },
    ): Promise<GenericBillingSummaryHistoryRow> => {
      const calculatedCost = await getGenericBillingCostForSummary({
        clientId,
        projectId: project.id,
        includeCompletedBilled,
        billingMonth:
          project.billingCycle === "MONTHLY"
            ? projectMonthRange.value
            : undefined,
      });
      return {
        itemId: monthly
          ? `${project.id}:${monthly.year}:${monthly.month}`
          : project.id,
        itemType: "PROJECT",
        projectId: project.id,
        title: project.name,
        status: formatProjectStatus(project.status),
        projectStatus: formatProjectStatus(project.status),
        billingModel: formatProjectBillingModel(project.billingModel),
        billingRegions: "Project",
        billingDate: monthly?.billingDate
          ? formatBillingDate(monthly.billingDate)
          : formatBillingDate(project.billingDate),
        billingMonth: monthly
          ? `${monthly.year}-${String(monthly.month).padStart(2, "0")}`
          : project.billingCycle === "MONTHLY"
            ? `${currentBillingYear}-${String(currentBillingMonth).padStart(2, "0")}`
            : undefined,
        poNumber: monthly?.poNumber ?? poByProject.get(project.id) ?? "-",
        cost: monthly
          ? Number(monthly.amount ?? 0)
          : calculatedCost || projectCostValue(project),
      };
    };
    return {
      client,
      filters,
      summaryRows: await Promise.all(
        pendingSummaryProjects.map((project) => mapProject(project)),
      ),
      nonTitleProjectRows: [],
      historyRows: await Promise.all(
        historyProjects
          .map((project) => mapProject(project, true))
          .concat(
            monthlyBillingRecords
              .filter((record) => record.project)
              .map((record) =>
                mapProject(record.project!, true, {
                  month: record.billingMonth ?? 0,
                  year: record.billingYear ?? year,
                  amount: record.amount,
                  poNumber: record.purchaseOrder?.poNumber ?? null,
                  billingDate: record.billingDate,
                }),
              ),
          ),
      ),
    };
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
        select: { movie: { select }, project: { select: projectSelect } },
      }),
      db.timeEntry.findMany({
        where: {
          project: {
            clientId,
            isActive: true,
            addToBilling: true,
            billingModel: { not: "FIXED_MONTHLY" },
            status: "COMPLETED_BILLED",
            billingDate: { gte: yearStart, lt: yearEnd },
          },
          movie: { clientId, isActive: true },
        },
        select: { movie: { select }, project: { select: projectSelect } },
      }),
    ]);
    const hasMovieAndProject = (
      entry: (typeof summaryEntries)[number],
    ): entry is (typeof summaryEntries)[number] & {
      movie: NonNullable<(typeof summaryEntries)[number]["movie"]>;
      project: NonNullable<(typeof summaryEntries)[number]["project"]>;
    } => Boolean(entry.movie && entry.project);

    const allTitleProjectEntries = [
      ...summaryEntries,
      ...historyEntries,
    ].filter(hasMovieAndProject);

    const pairs = allTitleProjectEntries.map(
      (entry) => `${entry.movie.id}:${entry.project.id}`,
    );
    const poAssignments = pairs.length
      ? await db.purchaseOrderAssignment.findMany({
          where: { clientId, purchaseOrder: { status: { not: "CANCELLED" } } },
          select: {
            movieId: true,
            projectId: true,
            purchaseOrder: { select: { poNumber: true } },
          },
        })
      : [];
    const poByPair = new Map<string, string>();
    for (const assignment of poAssignments) {
      if (assignment.movieId && assignment.projectId) {
        const key = `${assignment.movieId}:${assignment.projectId}`;
        if (!poByPair.has(key))
          poByPair.set(key, assignment.purchaseOrder.poNumber);
      }
    }
    const mapEntries = async (
      entries: typeof summaryEntries,
      includeCompletedBilled = false,
    ) => {
      const byPair = new Map<string, (typeof allTitleProjectEntries)[number]>();

      for (const entry of entries) {
        if (!hasMovieAndProject(entry)) continue;

        byPair.set(`${entry.movie.id}:${entry.project.id}`, entry);
      }

      return Promise.all(
        Array.from(byPair.values()).map(
          async (entry): Promise<GenericBillingSummaryHistoryRow> => {
            const movie = entry.movie;
            const project = entry.project;
            const key = `${movie.id}:${project.id}`;

            return {
              itemId: key,
              itemType: "TITLE_PROJECT",
              movieId: movie.id,
              projectId: project.id,
              title: `${project.name} - ${movie.title}`,
              projectName: project.name,
              status: formatProjectStatus(project.status),
              titleStatus: formatMovieStatus(movie.status),
              projectStatus: formatProjectStatus(project.status),
              billingModel: formatProjectBillingModel(project.billingModel),
              billingRegions: formatBillingRegions(movie),
              billingDate: formatBillingDate(project.billingDate),
              poNumber: poByPair.get(key) ?? "-",
              cost:
                (await getGenericBillingCostForSummary({
                  clientId,
                  movieId: movie.id,
                  projectId: project.id,
                  includeCompletedBilled,
                })) || projectCostValue(project),
            };
          },
        ),
      );
    };
    const summaryRows = await mapEntries(summaryEntries);
    const historyRows = await mapEntries(historyEntries, true);
    const consideredProjectIds = Array.from(
      new Set(
        [...summaryRows, ...historyRows]
          .map((row) => row.projectId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    return {
      client,
      filters,
      summaryRows,
      nonTitleProjectRows: await getNonTitleProjectBillingSummaryRows({
        clientId,
        clientHourlyCost: client.hourlyCost,
        filters,
        excludedProjectIds: consideredProjectIds,
      }),
      historyRows,
    };
  }

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
  const allMovieIds = [...summaryMovies, ...historyMovies].map(
    (movie) => movie.id,
  );
  const poAssignments = allMovieIds.length
    ? await db.purchaseOrderAssignment.findMany({
        where: {
          movieId: { in: allMovieIds },
          purchaseOrder: { status: { not: "CANCELLED" } },
        },
        select: {
          movieId: true,
          purchaseOrder: { select: { poNumber: true } },
        },
      })
    : [];
  const poByMovie = new Map<string, string>();
  for (const assignment of poAssignments) {
    if (assignment.movieId && !poByMovie.has(assignment.movieId))
      poByMovie.set(assignment.movieId, assignment.purchaseOrder.poNumber);
  }

  const consideredTitleProjectIds: string[] =
    shouldIncludeNonTitleProjectRows && allMovieIds.length
      ? Array.from(
          new Set(
            (
              (await db.timeEntry.findMany({
                where: {
                  movieId: { in: allMovieIds },
                  project: {
                    clientId,
                    isActive: true,
                    addToBilling: true,
                  },
                },
                select: { projectId: true },
                distinct: ["projectId"],
              })) as Array<{ projectId: string | null }>
            )
              .map((entry) => entry.projectId)
              .filter((projectId): projectId is string =>
                typeof projectId === "string" && projectId.length > 0,
              ),
          ),
        )
      : [];

  const mapRow = async (
    movie: (typeof summaryMovies)[number],
    includeCompletedBilled = false,
  ): Promise<GenericBillingSummaryHistoryRow> => ({
    itemId: movie.id,
    itemType: "TITLE",
    movieId: movie.id,
    title: movie.title,
    status: formatMovieStatus(movie.status),
    billingRegions: formatBillingRegions(movie),
    billingDate: formatBillingDate(movie.billingDate),
    poNumber: poByMovie.get(movie.id) ?? "-",
    cost: await getGenericBillingCostForSummary({
      clientId,
      movieId: movie.id,
      includeCompletedBilled,
    }),
  });
  return {
    client,
    filters,
    summaryRows: await Promise.all(summaryMovies.map((movie) => mapRow(movie))),
    nonTitleProjectRows: shouldIncludeNonTitleProjectRows
      ? await getNonTitleProjectBillingSummaryRows({
          clientId,
          clientHourlyCost: client.hourlyCost,
          filters,
          excludedProjectIds: consideredTitleProjectIds,
        })
      : [],
    historyRows: await Promise.all(
      historyMovies.map((movie) => mapRow(movie, true)),
    ),
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
  const includeCompletedBilled = Boolean(options.includeCompletedBilled);
  const allowedMovieStatuses: MovieStatus[] = includeCompletedBilled
    ? ["WORKING", "COMPLETED", "COMPLETED_BILLED"]
    : ["WORKING", "COMPLETED"];

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      hourlyCost: true,
      showCountriesInTimeEntries: true,
      projects: {
        where: { isActive: true, addToBilling: true },
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
            select: {
              id: true,
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

  const movieOptions = movieSpecific
    ? await db.movie.findMany({
        where: {
          clientId,
          isActive: true,
          status: { in: allowedMovieStatuses },
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
        options: { ...options, openDateRange, includeCompletedBilled },
      });
      if (!titleData || !titleData.blocks.length) continue;
      titleBlocks.push({
        movie,
        contactPerson: titleData.selectedMovie
          ? (titleData.blocks[0]?.rows[0]?.contactPerson ?? "-")
          : "-",
        contactPersons: titleData.contactPersons,
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
      contactPersons: [],
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
      contactPersons: [],
      blocks: [],
      titleBlocks: [],
      reportTitle: client.name + " Billing",
    };
  }

  const movieContactPersonsResult =
    movieSpecific && selectedMovieId && selectedMovieId !== "all"
      ? await db.movie.findFirst({
          where: { id: selectedMovieId, clientId },
          select: {
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
  const movieContactPersons = movieContactPersonsResult?.contactPersons ?? [];
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
    contactPersons: {
      name: string;
      email: string | null;
      countryCode?: string | null;
      country?: { isoCode: string | null } | null;
    }[];
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
    for (const group of totalGroups)
      totalMinutesByProject.set(group.projectId, group._sum.minutesSpent ?? 0);
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
          (project.status === "COMPLETED" ||
            client.id === FOCUS_FEATURES_CLIENT_ID),
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
    contactPersons: movieContactPersons,
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
