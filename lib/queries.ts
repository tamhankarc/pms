import "server-only";
import { db } from "@/lib/db";
import { canSeeAllProjects, canSeeBillingDashboard } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";
import type { BillingModel, ProjectStatus } from "@prisma/client";

export async function getVisibleProjects(
  user: SessionUser,
  options?: { allowedStatuses?: ProjectStatus[] },
) {
  const include = {
    client: true,
    projectType: true,
    assignedUsers: { include: { user: true } },
    subProjects: {
      where: { isActive: true },
      include: {
        assignments: { include: { user: true } },
      },
      orderBy: { name: "asc" as const },
    },
  } as const;

  const baseWhere = {
    isActive: true,
    ...(options?.allowedStatuses?.length ? { status: { in: options.allowedStatuses } } : {}),
  };

  if (canSeeAllProjects(user)) {
    return db.project.findMany({
      where: baseWhere,
      include,
      orderBy: { createdAt: "desc" },
    });
  }

  return db.project.findMany({
    where: {
      ...baseWhere,
      OR: [
        {
          assignedUsers: {
            some: {
              userId: user.id,
            },
          },
        },
        {
          subProjects: {
            some: {
              isActive: true,
              assignments: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        },
      ],
    },
    include,
    orderBy: { createdAt: "desc" },
  });
}

export async function getDashboardStats(user: SessionUser) {
  const visibleProjects = await getVisibleProjects(user);
  const projectIds = visibleProjects.map((project) => project.id);
  const targetIds = projectIds.length ? projectIds : ["__none__"];

  const [approvedTime, approvedBillableTime, pendingEntries, pendingEstimates] =
    await Promise.all([
      db.timeEntry.aggregate({
        _sum: { minutesSpent: true },
        where: {
          projectId: { in: targetIds },
          status: "APPROVED",
        },
      }),
      db.timeEntry.aggregate({
        _sum: { minutesSpent: true },
        where: {
          projectId: { in: targetIds },
          status: "APPROVED",
          isBillable: true,
        },
      }),
      db.timeEntry.count({
        where: {
          projectId: { in: targetIds },
          status: "SUBMITTED",
        },
      }),
      db.estimate.count({
        where: {
          projectId: { in: targetIds },
          status: "SUBMITTED",
        },
      }),
    ]);

  return {
    projects: visibleProjects.length,
    approvedMinutes: approvedTime._sum.minutesSpent ?? 0,
    approvedBillableMinutes: approvedBillableTime._sum.minutesSpent ?? 0,
    pendingEntries,
    pendingEstimates,
  };
}

export async function getManagedEmployees(teamLeadId: string) {
  return db.employeeTeamLead.findMany({
    where: { teamLeadId },
    include: {
      employee: true,
    },
    orderBy: { assignedAt: "desc" },
  });
}

function getDateRange(startDate: string, endDate: string) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0));
  const endExclusive = new Date(Date.UTC(endYear, endMonth - 1, endDay + 1, 0, 0, 0));
  return { start, endExclusive };
}

export async function getBillingDashboardData(
  user: SessionUser,
  startDate: string,
  endDate: string,
  selectedProjectId?: string,
  selectedBillingModel?: BillingModel | "",
) {
  if (!canSeeBillingDashboard(user)) {
    return {
      rows: [] as Array<{
        projectId: string;
        projectName: string;
        billingModel: BillingModel;
        workedMinutes: number;
        workedHours: string;
      }>,
      projectOptions: [] as Array<{ id: string; name: string; billingModel: BillingModel }>,
    };
  }

  const { start, endExclusive } = getDateRange(startDate, endDate);

  const allProjects = await db.project.findMany({
    select: {
      id: true,
      name: true,
      billingModel: true,
    },
    orderBy: { name: "asc" },
  });

  const filteredProjects = allProjects.filter((project) => {
    const projectMatch = selectedProjectId ? project.id === selectedProjectId : true;
    const billingMatch = selectedBillingModel ? project.billingModel === selectedBillingModel : true;
    return projectMatch && billingMatch;
  });

  const filteredProjectIds = filteredProjects.map((project) => project.id);
  const targetIds = filteredProjectIds.length ? filteredProjectIds : ["__none__"];

  const grouped = await db.timeEntry.groupBy({
    by: ["projectId"],
    _sum: {
      minutesSpent: true,
    },
    where: {
      projectId: { in: targetIds },
      workDate: {
        gte: start,
        lt: endExclusive,
      },
    },
  });

  const totals = new Map(grouped.map((row) => [row.projectId, row._sum.minutesSpent ?? 0]));

  const rows = filteredProjects.map((project) => {
    const workedMinutes = totals.get(project.id) ?? 0;
    return {
      projectId: project.id,
      projectName: project.name,
      billingModel: project.billingModel,
      workedMinutes,
      workedHours: (workedMinutes / 60).toFixed(2),
    };
  });

  return {
    rows,
    projectOptions: allProjects,
  };
}
