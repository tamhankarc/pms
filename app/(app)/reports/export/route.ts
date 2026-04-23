import type { FunctionalRoleCode } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { isRoleScopedManager } from "@/lib/permissions";
import { formatMinutes } from "@/lib/utils";

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

function sanitizeFileSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "report";
}

function getTimestamp() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

function buildFileName(baseName: string, selectedClientName?: string) {
  const prefix = selectedClientName ? `${sanitizeFileSegment(selectedClientName)}_` : "";
  return `${prefix}${baseName.replace(/-/g, "_")}_${getTimestamp()}.csv`;
}

function formatReportDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function csvResponse(rows: string[][], baseName: string, selectedClientName?: string) {
  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildFileName(baseName, selectedClientName)}"`,
    },
  });
}


type SortDirection = "asc" | "desc";

function normalizeSortDirection(value: string | null): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

function compareText(a: string, b: string, direction: SortDirection) {
  const result = a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  return direction === "asc" ? result : -result;
}

function compareNumber(a: number, b: number, direction: SortDirection) {
  return direction === "asc" ? a - b : b - a;
}

function sortRows<T>(rows: T[], selector: (row: T) => string | number, direction: SortDirection) {
  return [...rows].sort((a, b) => {
    const av = selector(a);
    const bv = selector(b);
    if (typeof av === "number" && typeof bv === "number") {
      return compareNumber(av, bv, direction);
    }
    return compareText(String(av), String(bv), direction);
  });
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
  const clientNameById = new Map(
    Array.from(new Map(visibleProjects.map((project) => [project.clientId, project.client.name])).entries()),
  );
  const movieEligibleProjects = visibleProjects.filter(
    (project) => project.client.showMoviesInEntries && !project.hideMoviesInEntries,
  );
  const movieEligibleProjectIds = movieEligibleProjects.length ? movieEligibleProjects.map((project) => project.id) : ["__none__"];
  const countryEligibleProjects = visibleProjects.filter(
    (project) => project.client.showCountriesInTimeEntries && !project.hideCountriesInEntries,
  );
  const countryEligibleProjectIds = countryEligibleProjects.length ? countryEligibleProjects.map((project) => project.id) : ["__none__"];

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

    const projectSortBy = searchParams.get("projectSortBy") ?? "clientName";
    const projectSortDir = normalizeSortDirection(searchParams.get("projectSortDir"));
    const rows = sortRows(Array.from(map.values()), (row) => {
      switch (projectSortBy) {
        case "projectName":
          return row.projectName;
        case "subProjectName":
          return row.subProjectName;
        case "totalMinutes":
          return row.totalMinutes;
        case "clientName":
        default:
          return row.clientName;
      }
    }, projectSortDir);
    const totalMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);

    return csvResponse(
      [
        ["Client", "Project Name", "Sub-Project Name", "Mins"],
        ...rows.map((row) => [row.clientName, row.projectName, row.subProjectName, String(row.totalMinutes)]),
        ["", "", "Total Time", formatMinutes(totalMinutes)],
      ],
      "project-subproject-minutes",
      projectClientId !== "all" ? clientNameById.get(projectClientId) : undefined,
    );
  }

  if (type === "task") {
    const fromDate = normalizeDateInput(searchParams.get("taskFromDate")) ?? defaultTodayRange.fromDate;
    const toDate = normalizeDateInput(searchParams.get("taskToDate")) ?? defaultTodayRange.toDate;
    const taskClientId = searchParams.get("taskClientId") ?? "all";
    const taskProjectId = searchParams.get("taskProjectId") ?? "all";
    const taskSubProjectId = searchParams.get("taskSubProjectId") ?? "all";
    const taskCountryId = searchParams.get("taskCountryId") ?? "all";
    const taskMovieId = searchParams.get("taskMovieId") ?? "all";
    const { fromBoundary, toBoundary } = buildDateRange(fromDate, toDate);

    const entries = await db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: fromBoundary, lte: toBoundary },
        ...(taskClientId !== "all" ? { project: { is: { clientId: taskClientId } } } : {}),
        ...(taskProjectId !== "all" ? { projectId: taskProjectId } : {}),
        ...(taskSubProjectId !== "all" ? { subProjectId: taskSubProjectId } : {}),
        ...(taskCountryId !== "all" ? { countryId: taskCountryId } : {}),
        ...(taskMovieId !== "all" ? { movieId: taskMovieId } : {}),
        ...employeeWhereClause,
      },
      include: {
        employee: { select: { functionalRole: true } },
        project: { include: { client: true } },
        subProject: true,
        country: true,
        movie: true,
      },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    });

    const taskSortBy = searchParams.get("taskSortBy") ?? "clientName";
    const taskSortDir = normalizeSortDirection(searchParams.get("taskSortDir"));
    const rows = sortRows(entries, (entry) => {
      switch (taskSortBy) {
        case "projectName":
          return entry.project.name;
        case "subProjectName":
          return entry.subProject?.name ?? "-";
        case "taskName":
          return entry.taskName;
        case "countryCode":
          return entry.country?.isoCode ?? "-";
        case "employeeRole":
          return formatRole(entry.employee.functionalRole);
        case "totalMinutes":
          return entry.minutesSpent;
        case "clientName":
        default:
          return entry.project.client.name;
      }
    }, taskSortDir);
    const totalMinutes = rows.reduce((sum, entry) => sum + entry.minutesSpent, 0);

    return csvResponse(
      [
        ["Client Name", "Project Name", "Sub-Project Name", "Task Name", "Task Description", "Movie", "Country Code", "Employee Role", "Mins"],
        ...rows.map((entry) => [
          entry.project.client.name,
          entry.project.name,
          entry.subProject?.name ?? "-",
          entry.taskName,
          entry.notes?.trim() ? entry.notes : "-",
          entry.movie?.title ?? "-",
          entry.country?.isoCode ?? "-",
          formatRole(entry.employee.functionalRole),
          String(entry.minutesSpent),
        ]),
        ["", "", "", "", "", "", "", "Total Time", formatMinutes(totalMinutes)],
      ],
      "task-wise-detailed-minutes",
      taskClientId !== "all" ? clientNameById.get(taskClientId) : undefined,
    );
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
        projectId: { in: movieEligibleProjectIds },
        workDate: { gte: fromBoundary, lte: toBoundary },
        movieId: { not: null },
        project: {
          is: {
            client: { is: { showMoviesInEntries: true } },
            hideMoviesInEntries: false,
            ...(movieClientId !== "all" ? { clientId: movieClientId } : {}),
          },
        },
        OR: [{ subProjectId: null }, { subProject: { is: { hideMoviesInEntries: false } } }],
        ...(movieMovieId !== "all" ? { movieId: movieMovieId } : {}),
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

    const movieSortBy = searchParams.get("movieSortBy") ?? "movieName";
    const movieSortDir = normalizeSortDirection(searchParams.get("movieSortDir"));
    const rows = sortRows(Array.from(map.values()), (row) => {
      switch (movieSortBy) {
        case "clientName":
          return row.clientName;
        case "projectName":
          return row.projectName;
        case "subProjectName":
          return row.subProjectName;
        case "countryCode":
          return row.countryCode;
        case "totalMinutes":
          return row.totalMinutes;
        case "movieName":
        default:
          return row.movieName;
      }
    }, movieSortDir);
    const totalMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);

    return csvResponse(
      [
        ["Movie Name", "Client Name", "Project Name", "Sub-Project Name", "Country", "Mins"],
        ...rows.map((row) => [row.movieName, row.clientName, row.projectName, row.subProjectName, row.countryCode, String(row.totalMinutes)]),
        ["", "", "", "", "", "Total Time", formatMinutes(totalMinutes)],
      ],
      "movie-wise-minutes",
      movieClientId !== "all" ? clientNameById.get(movieClientId) : undefined,
    );
  }

  if (type === "day") {
    const fromDate = normalizeDateInput(searchParams.get("dayFromDate")) ?? defaultMonthRange.fromDate;
    const toDate = normalizeDateInput(searchParams.get("dayToDate")) ?? defaultMonthRange.toDate;
    const dayClientId = searchParams.get("dayClientId") ?? "all";
    const dayProjectId = searchParams.get("dayProjectId") ?? "all";
    const daySubProjectId = searchParams.get("daySubProjectId") ?? "all";
    const dayCountryId = searchParams.get("dayCountryId") ?? "all";
    const dayMovieId = searchParams.get("dayMovieId") ?? "all";
    const { fromBoundary, toBoundary } = buildDateRange(fromDate, toDate);

    const entries = await db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: fromBoundary, lte: toBoundary },
        ...(dayClientId !== "all" ? { project: { is: { clientId: dayClientId } } } : {}),
        ...(dayProjectId !== "all" ? { projectId: dayProjectId } : {}),
        ...(daySubProjectId !== "all" ? { subProjectId: daySubProjectId } : {}),
        ...(dayCountryId !== "all" ? { countryId: dayCountryId } : {}),
        ...(dayMovieId !== "all" ? { movieId: dayMovieId } : {}),
        ...employeeWhereClause,
      },
      include: {
        project: { include: { client: true } },
        subProject: true,
        country: true,
        movie: true,
      },
      orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
    });

    const map = new Map<string, { dateKey: string; clientName: string; projectName: string; subProjectName: string; countryName: string; countryCode: string; movieName: string; totalMinutes: number }>();
    for (const entry of entries) {
      const dateKey = entry.workDate.toISOString().slice(0, 10);
      const clientName = entry.project.client.name;
      const projectName = entry.project.name;
      const subProjectName = entry.subProject?.name ?? "-";
      const countryName = entry.country?.name ?? "Unspecified";
      const countryCode = entry.country?.isoCode ?? "-";
      const movieName = entry.movie?.title ?? "-";
      const key = `${dateKey}__${clientName}__${projectName}__${subProjectName}__${countryCode}__${countryName}__${movieName}`;
      const row = map.get(key) ?? { dateKey, clientName, projectName, subProjectName, countryName, countryCode, movieName, totalMinutes: 0 };
      row.totalMinutes += entry.minutesSpent;
      map.set(key, row);
    }

    const daySortBy = searchParams.get("daySortBy") ?? "dateKey";
    const daySortDir = normalizeSortDirection(searchParams.get("daySortDir"));
    const rows = sortRows(Array.from(map.values()), (row) => {
      switch (daySortBy) {
        case "clientName":
          return row.clientName;
        case "projectName":
          return row.projectName;
        case "subProjectName":
          return row.subProjectName;
        case "countryCode":
          return row.countryCode;
        case "movieName":
          return row.movieName;
        case "totalMinutes":
          return row.totalMinutes;
        case "dateKey":
        default:
          return row.dateKey;
      }
    }, daySortDir);
    const totalMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);

    return csvResponse(
      [
        ["Date", "Client", "Project", "Sub-Project", "Movie", "Country", "Mins"],
        ...rows.map((row) => [formatReportDate(new Date(`${row.dateKey}T12:00:00`)), row.clientName, row.projectName, row.subProjectName, row.movieName, row.countryCode === "-" ? row.countryName : `${row.countryCode} - ${row.countryName}`, String(row.totalMinutes)]),
        ["", "", "", "", "", "Total Time", formatMinutes(totalMinutes)],
      ],
      "day-wise-minutes",
      dayClientId !== "all" ? clientNameById.get(dayClientId) : undefined,
    );
  }

  if (type === "country") {
    const fromDate = normalizeDateInput(searchParams.get("countryFromDate")) ?? defaultMonthRange.fromDate;
    const toDate = normalizeDateInput(searchParams.get("countryToDate")) ?? defaultMonthRange.toDate;
    const countryClientId = searchParams.get("countryClientId") ?? "all";
    const countryProjectId = searchParams.get("countryProjectId") ?? "all";
    const countrySubProjectId = searchParams.get("countrySubProjectId") ?? "all";
    const countryCountryId = searchParams.get("countryCountryId") ?? "all";
    const countryMovieId = searchParams.get("countryMovieId") ?? "all";
    const { fromBoundary, toBoundary } = buildDateRange(fromDate, toDate);

    const entries = await db.timeEntry.findMany({
      where: {
        projectId: { in: countryEligibleProjectIds.length ? countryEligibleProjectIds : ["__none__"] },
        workDate: { gte: fromBoundary, lte: toBoundary },
        ...(countryClientId !== "all" ? { project: { is: { clientId: countryClientId } } } : {}),
        ...(countryProjectId !== "all" ? { projectId: countryProjectId } : {}),
        ...(countrySubProjectId !== "all" ? { subProjectId: countrySubProjectId } : {}),
        ...(countryCountryId !== "all" ? { countryId: countryCountryId } : {}),
        ...(countryMovieId !== "all" ? { movieId: countryMovieId } : {}),
        OR: [{ subProjectId: null }, { subProject: { is: { hideCountriesInEntries: false } } }],
        ...employeeWhereClause,
      },
      include: {
        project: { include: { client: true } },
        subProject: true,
        country: true,
        movie: true,
      },
    });

    const map = new Map<string, { clientName: string; projectName: string; subProjectName: string; countryName: string; countryCode: string; movieName: string; totalMinutes: number }>();
    for (const entry of entries) {
      const clientName = entry.project.client.name;
      const projectName = entry.project.name;
      const subProjectName = entry.subProject?.name ?? "-";
      const countryCode = entry.country?.isoCode ?? "-";
      const countryName = entry.country?.name ?? "Unspecified";
      const movieName = entry.movie?.title ?? "-";
      const key = `${clientName}__${projectName}__${subProjectName}__${countryCode}__${countryName}__${movieName}`;
      const row = map.get(key) ?? { clientName, projectName, subProjectName, countryName, countryCode, movieName, totalMinutes: 0 };
      row.totalMinutes += entry.minutesSpent;
      map.set(key, row);
    }

    const countrySortBy = searchParams.get("countrySortBy") ?? "countryCode";
    const countrySortDir = normalizeSortDirection(searchParams.get("countrySortDir"));
    const rows = sortRows(Array.from(map.values()), (row) => {
      switch (countrySortBy) {
        case "clientName":
          return row.clientName;
        case "projectName":
          return row.projectName;
        case "subProjectName":
          return row.subProjectName;
        case "totalMinutes":
          return row.totalMinutes;
        case "countryName":
          return row.countryName;
        case "movieName":
          return row.movieName;
        case "countryCode":
        default:
          return row.countryCode;
      }
    }, countrySortDir);
    const totalMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);

    return csvResponse(
      [
        ["Country", "Movie", "Client", "Project", "Sub-Project", "Mins"],
        ...rows.map((row) => [row.countryCode === "-" ? row.countryName : `${row.countryCode} - ${row.countryName}`, row.movieName, row.clientName, row.projectName, row.subProjectName, String(row.totalMinutes)]),
        ["", "", "", "", "Total Time", formatMinutes(totalMinutes)],
      ],
      "country-wise-minutes",
      countryClientId !== "all" ? clientNameById.get(countryClientId) : undefined,
    );
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

  const clientSortBy = searchParams.get("clientSortBy") ?? "clientName";
  const clientSortDir = normalizeSortDirection(searchParams.get("clientSortDir"));
  const rows = sortRows(Array.from(map.values()), (row) => {
    switch (clientSortBy) {
      case "totalMinutes":
        return row.totalMinutes;
      case "clientName":
      default:
        return row.clientName;
    }
  }, clientSortDir);
  const totalMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);

  return csvResponse(
    [
      ["Client", "Mins"],
      ...rows.map((row) => [row.clientName, String(row.totalMinutes)]),
      ["Total Time", formatMinutes(totalMinutes)],
    ],
    "client-wise-minutes",
    clientClientId !== "all" ? clientNameById.get(clientClientId) : undefined,
  );
}
