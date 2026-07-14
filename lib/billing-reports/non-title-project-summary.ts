import { db } from "@/lib/db";
import { shouldExcludeWorldwideCountryFromBilling } from "@/lib/billing-reports/config";

export type NonTitleProjectBillingSummaryFilters = {
  projectMonth: string;
};

export type NonTitleProjectBillingSummaryRow = {
  itemId: string;
  itemType: "PROJECT";
  itemName: string;
  title?: string;
  projectName: string;
  projectId: string;
  billingRegion: string;
  billingRegions?: string;
  billingDate: string;
  poNumber: string;
  status: string;
  projectStatus: string;
  billingModel: string;
  billingMonth?: string;
  cost: number;
  timeEntryCount: number;
  movieBillingHeadCount: number;
};

function formatDisplayDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatProjectStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatProjectBillingModel(value: string) {
  return (
    {
      HOURLY: "Hourly",
      FIXED_FULL: "Fixed Full",
      FIXED_MONTHLY: "Fixed Monthly",
      FIXED_PER_COUNTRY: "Fixed Per Country",
      FIXED_COST: "Fixed Cost",
    }[value] ?? value.replaceAll("_", " ")
  );
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
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 1)),
  };
}

function fixedProjectCost(
  project: {
    billingModel: string;
    projectCost?: unknown;
    perCountryCharges?: unknown;
    fixedContractHours?: unknown;
    fixedMonthlyHours?: unknown;
    additionalCharges?: unknown;
    partialBillingCost?: unknown;
  },
  clientHourlyCost: unknown,
) {
  const hourlyCost = Number(clientHourlyCost ?? 0);
  if (project.billingModel === "FIXED_COST") {
    return Number(project.projectCost ?? 0);
  }
  if (project.billingModel === "FIXED_PER_COUNTRY") {
    return Number(project.perCountryCharges ?? 0);
  }
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
}

async function getHourlyProjectCost({
  projectId,
  clientHourlyCost,
  monthRange,
  isMonthly,
}: {
  projectId: string;
  clientHourlyCost: unknown;
  monthRange: ReturnType<typeof parseYearMonth>;
  isMonthly: boolean;
}) {
  const minutes = await db.timeEntry.aggregate({
    where: {
      projectId,
      movieId: null,
      ...(isMonthly
        ? { workDate: { gte: monthRange.from, lt: monthRange.to } }
        : {}),
    },
    _sum: { minutesSpent: true },
  });
  return ((minutes._sum.minutesSpent ?? 0) / 60) * Number(clientHourlyCost ?? 0);
}

export async function getProjectsConsideredByTitleRows({
  clientId,
  movieIds,
}: {
  clientId: string;
  movieIds: string[];
}) {
  if (!movieIds.length) return [];
  const entries = await db.timeEntry.findMany({
    where: {
      movieId: { in: movieIds },
      project: {
        clientId,
        isActive: true,
        addToBilling: true,
      },
    },
    select: { projectId: true },
    distinct: ["projectId"],
  });
  return entries
    .map((entry) => entry.projectId)
    .filter((projectId): projectId is string => Boolean(projectId));
}

export async function getNonTitleProjectBillingSummaryRows({
  clientId,
  clientHourlyCost,
  filters,
  excludedProjectIds = [],
  billingCycle,
  warnerProjectType,
}: {
  clientId: string;
  clientHourlyCost: unknown;
  filters: NonTitleProjectBillingSummaryFilters;
  excludedProjectIds?: string[];
  billingCycle?: "MONTHLY" | "ONE_TIME";
  warnerProjectType?: "OTHER" | "PORTAL" | "DVD" | "TICKETING" | "SOCIAL";
}): Promise<NonTitleProjectBillingSummaryRow[]> {
  const projectMonthRange = parseYearMonth(filters.projectMonth);
  const excludedProjectIdSet = new Set(
    excludedProjectIds.filter((projectId): projectId is string =>
      Boolean(projectId),
    ),
  );

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
    _count: { select: { timeEntries: true } },
  } as const;

  const candidateProjects = await db.project.findMany({
    where: {
      clientId,
      isActive: true,
      addToBilling: true,
      ...(billingCycle ? { billingCycle } : {}),
      ...(warnerProjectType ? { warnerProjectType } : {}),
      ...(excludedProjectIds.length ? { id: { notIn: excludedProjectIds } } : {}),
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
    monthlyBillingRecords
      .map((record) => record.projectId)
      .filter((projectId): projectId is string => Boolean(projectId)),
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
      ...(billingCycle === "MONTHLY"
        ? {
            OR: [
              {
                billingMonth: projectMonthRange.month,
                billingYear: projectMonthRange.year,
              },
              { billingMonth: null, billingYear: null },
            ],
          }
        : {}),
    },
    select: {
      projectId: true,
      billingMonth: true,
      billingYear: true,
      purchaseOrder: { select: { poNumber: true, amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const poByProject = new Map<string, string>();
  for (const assignment of poAssignments) {
    if (!assignment.projectId) continue;
    const isMonthSpecific =
      assignment.billingMonth === projectMonthRange.month &&
      assignment.billingYear === projectMonthRange.year;
    const isOpenAssignment =
      assignment.billingMonth == null && assignment.billingYear == null;
    if (
      (billingCycle === "MONTHLY" && isMonthSpecific) ||
      (billingCycle !== "MONTHLY" && isOpenAssignment) ||
      !poByProject.has(assignment.projectId)
    ) {
      poByProject.set(assignment.projectId, assignment.purchaseOrder.poNumber);
    }
  }

  return Promise.all(
    pendingProjects.map(async (project) => {
      const cost =
        project.billingModel === "HOURLY"
          ? await getHourlyProjectCost({
              projectId: project.id,
              clientHourlyCost,
              monthRange: projectMonthRange,
              isMonthly: project.billingCycle === "MONTHLY",
            })
          : fixedProjectCost(project, clientHourlyCost);

      return {
        itemId: `non-title-project:${project.id}`,
        itemType: "PROJECT" as const,
        itemName: project.name,
        title: project.name,
        projectName: project.name,
        projectId: project.id,
        billingRegion: "Project",
        billingRegions: "Project",
        billingDate: formatDisplayDate(project.billingDate),
        billingMonth:
          project.billingCycle === "MONTHLY" ? projectMonthRange.value : undefined,
        poNumber: poByProject.get(project.id) ?? "-",
        status: formatProjectStatus(project.status),
        projectStatus: formatProjectStatus(project.status),
        billingModel: formatProjectBillingModel(project.billingModel),
        cost,
        timeEntryCount: project._count.timeEntries,
        movieBillingHeadCount: 0,
      };
    }),
  );
}


export async function getNonTitleProjectBillingHistoryRows({
  clientId,
  year,
  excludedProjectIds = [],
  billingCycle,
  warnerProjectType,
}: {
  clientId: string;
  year: number;
  excludedProjectIds?: string[];
  billingCycle?: "MONTHLY" | "ONE_TIME";
  warnerProjectType?: "OTHER" | "PORTAL" | "DVD" | "TICKETING" | "SOCIAL";
}): Promise<NonTitleProjectBillingSummaryRow[]> {
  const excludedProjectIdSet = new Set(
    excludedProjectIds.filter((projectId): projectId is string =>
      Boolean(projectId),
    ),
  );

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
    _count: { select: { timeEntries: true } },
  } as const;

  const records = await db.billingRecord.findMany({
    where: {
      clientId,
      projectId: { not: null },
      billingYear: year,
      project: {
        clientId,
        isActive: true,
        addToBilling: true,
        ...(billingCycle ? { billingCycle } : {}),
        ...(warnerProjectType ? { warnerProjectType } : {}),
        ...(excludedProjectIds.length
          ? { id: { notIn: excludedProjectIds } }
          : {}),
        OR: [
          { hideMoviesInEntries: true },
          { timeEntries: { some: { movieId: null } } },
        ],
      },
    },
    include: {
      project: { select: projectSelect },
      purchaseOrder: { select: { poNumber: true, amount: true } },
    },
    orderBy: [
      { billingYear: "desc" },
      { billingMonth: "desc" },
      { billingDate: "desc" },
    ],
  });

  const filteredRecords = records.filter(
    (record) => record.project && !excludedProjectIdSet.has(record.project.id),
  );
  const projectIds = Array.from(
    new Set(
      filteredRecords
        .map((record) => record.projectId)
        .filter((projectId): projectId is string => Boolean(projectId)),
    ),
  );

  const poAssignments = projectIds.length
    ? await db.purchaseOrderAssignment.findMany({
        where: {
          clientId,
          assignmentMode: "PROJECT",
          projectId: { in: projectIds },
          purchaseOrder: { status: { not: "CANCELLED" } },
        },
        select: {
          projectId: true,
          billingMonth: true,
          billingYear: true,
          purchaseOrder: { select: { poNumber: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const poByProject = new Map<string, string>();
  const poByProjectMonth = new Map<string, string>();
  for (const assignment of poAssignments) {
    if (!assignment.projectId) continue;
    if (assignment.billingMonth && assignment.billingYear) {
      const key = `${assignment.projectId}:${assignment.billingYear}:${assignment.billingMonth}`;
      if (!poByProjectMonth.has(key)) {
        poByProjectMonth.set(key, assignment.purchaseOrder.poNumber);
      }
    }
    if (!poByProject.has(assignment.projectId)) {
      poByProject.set(assignment.projectId, assignment.purchaseOrder.poNumber);
    }
    if (assignment.billingMonth == null && assignment.billingYear == null) {
      poByProject.set(assignment.projectId, assignment.purchaseOrder.poNumber);
    }
  }

  return filteredRecords
    .filter((record) => record.project)
    .map((record) => {
      const project = record.project!;
      const billingMonth =
        record.billingYear && record.billingMonth
          ? `${record.billingYear}-${String(record.billingMonth).padStart(2, "0")}`
          : undefined;
      const projectMonthKey =
        record.projectId && record.billingYear && record.billingMonth
          ? `${record.projectId}:${record.billingYear}:${record.billingMonth}`
          : null;
      return {
        itemId: `non-title-project-history:${record.projectId}:${record.billingYear}:${record.billingMonth ?? "one-time"}:${record.id}`,
        itemType: "PROJECT" as const,
        itemName: project.name,
        title: project.name,
        projectName: project.name,
        projectId: project.id,
        billingRegion: "Project",
        billingRegions: "Project",
        billingDate: formatDisplayDate(record.billingDate),
        billingMonth,
        poNumber:
          record.purchaseOrder?.poNumber ??
          (projectMonthKey ? poByProjectMonth.get(projectMonthKey) : undefined) ??
          poByProject.get(project.id) ??
          "-",
        status: formatProjectStatus(project.status),
        projectStatus: formatProjectStatus(project.status),
        billingModel: formatProjectBillingModel(project.billingModel),
        cost: Number(record.amount ?? 0),
        timeEntryCount: project._count.timeEntries,
        movieBillingHeadCount: 0,
      };
    });
}

export type TitleCountryPoGroup = {
  movieId: string;
  assignmentId: string;
  poNumber: string;
  amount: number;
  countryNames: string[];
  countryLabel: string;
  countries: { name: string; isoCode: string | null }[];
};

export async function getTitleCountryPoGroups({
  clientId,
  movieIds,
}: {
  clientId: string;
  movieIds: string[];
}): Promise<TitleCountryPoGroup[]> {
  if (!movieIds.length) return [];
  const assignments = await db.purchaseOrderAssignment.findMany({
    where: {
      clientId,
      assignmentMode: "TITLE_COUNTRY",
      movieId: { in: movieIds },
      purchaseOrder: { status: { not: "CANCELLED" } },
    },
    include: {
      purchaseOrder: { select: { poNumber: true, amount: true } },
      countries: {
        include: {
          country: { select: { name: true, isoCode: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return assignments
    .filter((assignment) => Boolean(assignment.movieId))
    .map((assignment) => {
      const includedCountries = assignment.countries.filter(
        (item) =>
          !shouldExcludeWorldwideCountryFromBilling(clientId, item.country),
      );
      const countryNames = includedCountries
        .map((item) =>
          item.country.isoCode
            ? `${item.country.name} (${item.country.isoCode})`
            : item.country.name,
        )
        .sort((a, b) => a.localeCompare(b));
      return {
        movieId: assignment.movieId!,
        assignmentId: assignment.id,
        poNumber: assignment.purchaseOrder.poNumber,
        amount: Number(assignment.purchaseOrder.amount ?? 0),
        countryNames,
        countryLabel: countryNames.length ? countryNames.join(", ") : "-",
        countries: includedCountries.map((item) => ({
          name: item.country.name,
          isoCode: item.country.isoCode,
        })),
      };
    });
}
