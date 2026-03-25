import "server-only";
import { db } from "@/lib/db";
import { canSeeAllProjects } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";

export async function getVisibleProjects(user: SessionUser) {
  const include = {
    client: true,
    movie: true,
    countries: { include: { country: true } },
    employeeGroups: { include: { employeeGroup: true } },
  } as const;

  if (canSeeAllProjects(user)) {
    return db.project.findMany({
      include,
      orderBy: { createdAt: "desc" },
    });
  }

  return db.project.findMany({
    where: {
      employeeGroups: {
        some: {
          employeeGroup: {
            users: {
              some: {
                userId: user.id,
              },
            },
          },
        },
      },
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
      employee: {
        include: {
          employeeGroups: { include: { employeeGroup: true } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });
}