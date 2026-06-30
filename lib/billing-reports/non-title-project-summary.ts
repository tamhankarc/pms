import { db } from "@/lib/db";

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
}: {
  clientId: string;
  clientHourlyCost: unknown;
  filters: NonTitleProjectBillingSummaryFilters;
  excludedProjectIds?: string[];
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
