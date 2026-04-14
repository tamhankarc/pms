import type { FunctionalRoleCode } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { isRoleScopedManager } from "@/lib/permissions";

function normalizeDateInput(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function buildDateRange(fromDate: string, toDate: string) {
  return {
    fromBoundary: new Date(`${fromDate}T00:00:00`),
    toBoundary: new Date(`${toDate}T23:59:59.999`),
  };
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultMonthRange() {
  const now = new Date();
  return {
    fromDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function getTodayRange() {
  const today = toDateInputValue(new Date());
  return { fromDate: today, toDate: today };
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function formatRole(role?: FunctionalRoleCode | "UNASSIGNED" | null) {
  if (!role || role === "UNASSIGNED") return "-";
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeCsvValue(value: string) {
  const normalized = value.replace(/\r?\n|\r/g, " ");
  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")).join("\n");
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "client";
  const defaultMonthRange = getDefaultMonthRange();
  const defaultTodayRange = getTodayRange();
  const visibleProjects = await getVisibleProjects(user);
  const visibleProjectIds = visibleProjects.map((project) => project.id);
  const safeProjectIds = visibleProjectIds.length ? visibleProjectIds : ["__none__"];

  const supervisorAssignments =
    user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
      ? await db.employeeTeamLead.findMany({
          where: { teamLeadId: user.id },
          include: {
            employee: {
              select: {
                id: true,
                functionalRole: true,
                isActive: true,
              },
            },
          },
        })
      : [];

  const scopedEmployeeIds = supervisorAssignments
    .filter((row) => row.employee.isActive && row.employee.functionalRole === user.functionalRole)
    .map((row) => row.employeeId);

  const visibleEmployeeIds =
    user.userType === "EMPLOYEE"
      ? [user.id]
      : user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
        ? Array.from(new Set([user.id, ...scopedEmployeeIds]))
        : undefined;

  const employeeWhereClause = visibleEmployeeIds
    ? { employeeId: { in: visibleEmployeeIds.length ? visibleEmployeeIds : ["__none__"] } }
    : {};

  if (type === "project") {
    const fromDate = normalizeDateInput(searchParams.get("projectFromDate")) ?? defaultMonthRange.fromDate;
    const toDate = normalizeDateInput(searchParams.get("projectToDate")) ?? defaultMonthRange.toDate;
    const projectClientId = searchParams.get("projectClientId") ?? "all";
    const projectProjectId = searchParams.get("projectProjectId") ?? "all";
    const { fromBoundary, toBoundary } = buildDateRange(fromDate, toDate);

    const entries = await db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: fromBoundary, lte: toBoundary },
        ...(projectClientId !== "all" ? { project: { is: { clientId: projectClientId } } } : {}),
        ...(projectProjectId !== "all" ? { projectId: projectProjectId } : {}),
        ...employeeWhereClause,
      },
      include: {
        project: { include: { client: true } },
        subProject: true,
      },
    });

    const map = new Map<string, { clientName: string; projectName: string; subProjectName: string; totalMinutes: number }>();
    for (const entry of entries) {
      const key = `${entry.project.client.name}__${entry.project.name}__${entry.subProject?.name ?? "-"}`;
      const row = map.get(key) ?? {
        clientName: entry.project.client.name,
        projectName: entry.project.name,
        subProjectName: entry.subProject?.name ?? "-",
        totalMinutes: 0,
      };
      row.totalMinutes += entry.minutesSpent;
      map.set(key, row);
    }

    const rows = Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
    const csv = toCsv([
      ["Client", "Project Name", "Sub-Project Name", "Hours"],
      ...rows.map((row) => [row.clientName, row.projectName, row.subProjectName, formatHours(row.totalMinutes)]),
    ]);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="project-subproject-hours.csv"',
      },
    });
  }

  if (type === "task") {
    const fromDate = normalizeDateInput(searchParams.get("taskFromDate")) ?? defaultTodayRange.fromDate;
    const toDate = normalizeDateInput(searchParams.get("taskToDate")) ?? defaultTodayRange.toDate;
    const taskClientId = searchParams.get("taskClientId") ?? "all";
    const taskProjectId = searchParams.get("taskProjectId") ?? "all";
    const taskSubProjectId = searchParams.get("taskSubProjectId") ?? "all";
    const taskCountryId = searchParams.get("taskCountryId") ?? "all";
    const { fromBoundary, toBoundary } = buildDateRange(fromDate, toDate);

    const entries = await db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: fromBoundary, lte: toBoundary },
        ...(taskClientId !== "all" ? { project: { is: { clientId: taskClientId } } } : {}),
        ...(taskProjectId !== "all" ? { projectId: taskProjectId } : {}),
        ...(taskSubProjectId !== "all" ? { subProjectId: taskSubProjectId } : {}),
        ...(taskCountryId !== "all" ? { countryId: taskCountryId } : {}),
        ...employeeWhereClause,
      },
      include: {
        employee: { select: { functionalRole: true } },
        project: { include: { client: true } },
        subProject: true,
        country: true,
      },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    });

    const csv = toCsv([
      ["Client Name", "Project Name", "Sub-Project Name", "Task Name", "Task Description", "Country Code", "Employee Role", "Hours"],
      ...entries.map((entry) => [
        entry.project.client.name,
        entry.project.name,
        entry.subProject?.name ?? "-",
        entry.taskName,
        entry.notes?.trim() ? entry.notes : "-",
        entry.country?.isoCode ?? "-",
        formatRole(entry.employee.functionalRole),
        formatHours(entry.minutesSpent),
      ]),
    ]);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="task-wise-detailed-hours.csv"',
      },
    });
  }

  if (type === "movie") {
    const fromDate = normalizeDateInput(searchParams.get("movieFromDate")) ?? defaultMonthRange.fromDate;
    const toDate = normalizeDateInput(searchParams.get("movieToDate")) ?? defaultMonthRange.toDate;
    const movieMovieId = searchParams.get("movieMovieId") ?? "all";
    const movieClientId = searchParams.get("movieClientId") ?? "all";
    const movieProjectId = searchParams.get("movieProjectId") ?? "all";
    const movieSubProjectId = searchParams.get("movieSubProjectId") ?? "all";
    const movieCountryId = searchParams.get("movieCountryId") ?? "all";
    const { fromBoundary, toBoundary } = buildDateRange(fromDate, toDate);

    const entries = await db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: fromBoundary, lte: toBoundary },
        movieId: { not: null },
        ...(movieMovieId !== "all" ? { movieId: movieMovieId } : {}),
        ...(movieClientId !== "all" ? { project: { is: { clientId: movieClientId } } } : {}),
        ...(movieProjectId !== "all" ? { projectId: movieProjectId } : {}),
        ...(movieSubProjectId !== "all" ? { subProjectId: movieSubProjectId } : {}),
        ...(movieCountryId !== "all" ? { countryId: movieCountryId } : {}),
        ...employeeWhereClause,
      },
      include: {
        movie: true,
        project: { include: { client: true } },
        subProject: true,
        country: true,
      },
    });

    const map = new Map<string, { movieName: string; clientName: string; projectName: string; subProjectName: string; countryCode: string; totalMinutes: number }>();
    for (const entry of entries) {
      const movieName = entry.movie?.title ?? "-";
      const subProjectName = entry.subProject?.name ?? "-";
      const countryCode = entry.country?.isoCode ?? "-";
      const key = `${movieName}__${entry.project.client.name}__${entry.project.name}__${subProjectName}__${countryCode}`;
      const row = map.get(key) ?? {
        movieName,
        clientName: entry.project.client.name,
        projectName: entry.project.name,
        subProjectName,
        countryCode,
        totalMinutes: 0,
      };
      row.totalMinutes += entry.minutesSpent;
      map.set(key, row);
    }

    const rows = Array.from(map.values()).sort((a, b) => {
      if (a.movieName !== b.movieName) return a.movieName.localeCompare(b.movieName);
      if (a.clientName !== b.clientName) return a.clientName.localeCompare(b.clientName);
      if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
      if (a.subProjectName !== b.subProjectName) return a.subProjectName.localeCompare(b.subProjectName);
      return a.countryCode.localeCompare(b.countryCode);
    });

    const csv = toCsv([
      ["Movie Name", "Client Name", "Project Name", "Sub-Project Name", "Country", "Mins"],
      ...rows.map((row) => [row.movieName, row.clientName, row.projectName, row.subProjectName, row.countryCode, String(row.totalMinutes)]),
    ]);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="movie-wise-minutes.csv"',
      },
    });
  }

  const fromDate = normalizeDateInput(searchParams.get("clientFromDate")) ?? defaultMonthRange.fromDate;
  const toDate = normalizeDateInput(searchParams.get("clientToDate")) ?? defaultMonthRange.toDate;
  const clientClientId = searchParams.get("clientClientId") ?? "all";
  const { fromBoundary, toBoundary } = buildDateRange(fromDate, toDate);

  const entries = await db.timeEntry.findMany({
    where: {
      projectId: { in: safeProjectIds },
      workDate: { gte: fromBoundary, lte: toBoundary },
      ...(clientClientId !== "all" ? { project: { is: { clientId: clientClientId } } } : {}),
      ...employeeWhereClause,
    },
    include: {
      project: { include: { client: true } },
    },
  });

  const map = new Map<string, { clientName: string; totalMinutes: number }>();
  for (const entry of entries) {
    const row = map.get(entry.project.clientId) ?? {
      clientName: entry.project.client.name,
      totalMinutes: 0,
    };
    row.totalMinutes += entry.minutesSpent;
    map.set(entry.project.clientId, row);
  }

  const rows = Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  const csv = toCsv([
    ["Client", "Hours"],
    ...rows.map((row) => [row.clientName, formatHours(row.totalMinutes)]),
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="client-wise-hours.csv"',
    },
  });
}
