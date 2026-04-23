import Link from "next/link";
import { redirect } from "next/navigation";
import type { FunctionalRoleCode } from "@prisma/client";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  MovieMinutesFilterForm,
  ProjectHoursFilterForm,
  ScopedMinutesFilterForm,
  TaskDetailFilterForm,
} from "@/components/reports/report-filter-forms";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { isRoleScopedManager } from "@/lib/permissions";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";
import { formatMinutes } from "@/lib/utils";

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

function normalizeDateInput(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function buildDateRange(fromDate: string, toDate: string) {
  return {
    fromBoundary: new Date(`${fromDate}T00:00:00`),
    toBoundary: new Date(`${toDate}T23:59:59.999`),
  };
}

function formatMins(minutes: number) {
  return minutes;
}

function formatRole(role?: FunctionalRoleCode | "UNASSIGNED" | null) {
  if (!role || role === "UNASSIGNED") return "-";
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildExportHref(type: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams({ type });
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return `/reports/export?${search.toString()}`;
}

type ClientHoursRow = {
  clientId: string;
  clientName: string;
  totalMinutes: number;
};

type ProjectHoursRow = {
  clientName: string;
  projectName: string;
  subProjectName: string;
  totalMinutes: number;
};

type TaskDetailRow = {
  id: string;
  clientName: string;
  projectName: string;
  subProjectName: string;
  taskName: string;
  taskDescription: string;
  countryName: string;
  countryCode: string;
  movieName: string;
  employeeRole: string;
  totalMinutes: number;
};

type MovieMinutesRow = {
  movieName: string;
  clientName: string;
  projectName: string;
  subProjectName: string;
  countryCode: string;
  totalMinutes: number;
};

type DayMinutesRow = {
  dateKey: string;
  clientName: string;
  projectName: string;
  subProjectName: string;
  countryName: string;
  countryCode: string;
  movieName: string;
  totalMinutes: number;
};

type CountryMinutesRow = {
  clientName: string;
  projectName: string;
  subProjectName: string;
  countryName: string;
  countryCode: string;
  movieName: string;
  totalMinutes: number;
};

function formatReportDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

type SortDirection = "asc" | "desc";

function normalizeSortDirection(value?: string): SortDirection {
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

function buildSortHref({
  basePath,
  baseSearchParams,
  sortByParam,
  sortDirParam,
  pageParam,
  sortBy,
  currentSortBy,
  currentSortDir,
  anchor,
}: {
  basePath: string;
  baseSearchParams: Record<string, string | undefined>;
  sortByParam: string;
  sortDirParam: string;
  pageParam: string;
  sortBy: string;
  currentSortBy: string;
  currentSortDir: SortDirection;
  anchor: string;
}) {
  const search = new URLSearchParams();
  Object.entries(baseSearchParams).forEach(([key, value]) => {
    if (value && key !== pageParam) search.set(key, value);
  });
  search.set(sortByParam, sortBy);
  search.set(sortDirParam, currentSortBy === sortBy && currentSortDir === "asc" ? "desc" : "asc");
  const query = search.toString();
  return query ? `${basePath}?${query}${anchor}` : `${basePath}${anchor}`;
}

function SortableHeader({
  label,
  sortBy,
  currentSortBy,
  currentSortDir,
  href,
  className = "table-cell",
}: {
  label: string;
  sortBy: string;
  currentSortBy: string;
  currentSortDir: SortDirection;
  href: string;
  className?: string;
}) {
  const isActive = currentSortBy === sortBy;
  return (
    <th className={className}>
      <Link className="inline-flex items-center gap-1 hover:text-slate-900" href={href} scroll={false}>
        <span>{label}</span>
        {isActive ? (
          currentSortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-700" strokeWidth={2.5} />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-700" strokeWidth={2.5} />
          )
        ) : null}
      </Link>
    </th>
  );
}

const REPORT_TABS = [
  { slug: "client-wise-minutes", label: "Client-wise minutes", anchor: "#client-wise-hours" },
  { slug: "project-wise-minutes", label: "Project / Sub-Project-wise minutes", anchor: "#project-wise-hours" },
  { slug: "task-wise-minutes", label: "Task-wise detailed minutes", anchor: "#task-wise-hours" },
  { slug: "movie-wise-minutes", label: "Movie-wise minutes", anchor: "#movie-wise-minutes" },
  { slug: "day-wise-minutes", label: "Day-wise minutes", anchor: "#day-wise-minutes" },
  { slug: "country-wise-minutes", label: "Country-wise minutes", anchor: "#country-wise-minutes" },
] as const;

type ReportSlug = (typeof REPORT_TABS)[number]["slug"];

function normalizeReportSlug(value?: string): ReportSlug {
  return REPORT_TABS.find((item) => item.slug === value)?.slug ?? "client-wise-minutes";
}

export default async function ReportsPage({
  searchParams,
  activeReportName,
}: {
  searchParams?: Promise<{
    clientFromDate?: string;
    clientToDate?: string;
    clientClientId?: string;
    clientPage?: string;
    clientSortBy?: string;
    clientSortDir?: string;
    projectFromDate?: string;
    projectToDate?: string;
    projectClientId?: string;
    projectProjectId?: string;
    projectPage?: string;
    projectSortBy?: string;
    projectSortDir?: string;
    taskFromDate?: string;
    taskToDate?: string;
    taskClientId?: string;
    taskProjectId?: string;
    taskSubProjectId?: string;
    taskCountryId?: string;
    taskMovieId?: string;
    taskPage?: string;
    taskSortBy?: string;
    taskSortDir?: string;
    movieFromDate?: string;
    movieToDate?: string;
    movieMovieId?: string;
    movieClientId?: string;
    movieProjectId?: string;
    movieSubProjectId?: string;
    movieCountryId?: string;
    moviePage?: string;
    movieSortBy?: string;
    movieSortDir?: string;
    dayFromDate?: string;
    dayToDate?: string;
    dayClientId?: string;
    dayProjectId?: string;
    daySubProjectId?: string;
    dayCountryId?: string;
    dayMovieId?: string;
    dayPage?: string;
    daySortBy?: string;
    daySortDir?: string;
    countryFromDate?: string;
    countryToDate?: string;
    countryClientId?: string;
    countryProjectId?: string;
    countrySubProjectId?: string;
    countryCountryId?: string;
    countryMovieId?: string;
    countryPage?: string;
    countrySortBy?: string;
    countrySortDir?: string;
  }>;
  activeReportName?: string;
}) {
  if (!activeReportName) {
    redirect("/reports/client-wise-minutes");
  }
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const activeReportSlug = normalizeReportSlug(activeReportName);
  const reportsBasePath = `/reports/${activeReportSlug}`;
  const defaultMonthRange = getDefaultMonthRange();
  const defaultTodayRange = getTodayRange();

  const clientFromDate = normalizeDateInput(params.clientFromDate) ?? defaultMonthRange.fromDate;
  const clientToDate = normalizeDateInput(params.clientToDate) ?? defaultMonthRange.toDate;
  const clientClientId = params.clientClientId ?? "all";
  const clientPage = parsePageParam(params.clientPage);
  const clientSortBy = params.clientSortBy ?? "clientName";
  const clientSortDir = normalizeSortDirection(params.clientSortDir);

  const projectFromDate = normalizeDateInput(params.projectFromDate) ?? defaultMonthRange.fromDate;
  const projectToDate = normalizeDateInput(params.projectToDate) ?? defaultMonthRange.toDate;
  const projectClientId = params.projectClientId ?? "all";
  const projectProjectId = params.projectProjectId ?? "all";
  const projectPage = parsePageParam(params.projectPage);
  const projectSortBy = params.projectSortBy ?? "clientName";
  const projectSortDir = normalizeSortDirection(params.projectSortDir);

  const taskFromDate = normalizeDateInput(params.taskFromDate) ?? defaultTodayRange.fromDate;
  const taskToDate = normalizeDateInput(params.taskToDate) ?? defaultTodayRange.toDate;
  const taskClientId = params.taskClientId ?? "all";
  const taskProjectId = params.taskProjectId ?? "all";
  const taskSubProjectId = params.taskSubProjectId ?? "all";
  const taskCountryId = params.taskCountryId ?? "all";
  const taskMovieId = params.taskMovieId ?? "all";
  const taskPage = parsePageParam(params.taskPage);
  const taskSortBy = params.taskSortBy ?? "clientName";
  const taskSortDir = normalizeSortDirection(params.taskSortDir);

  const movieFromDate = normalizeDateInput(params.movieFromDate) ?? defaultMonthRange.fromDate;
  const movieToDate = normalizeDateInput(params.movieToDate) ?? defaultMonthRange.toDate;
  const movieMovieId = params.movieMovieId ?? "all";
  const movieClientId = params.movieClientId ?? "all";
  const movieProjectId = params.movieProjectId ?? "all";
  const movieSubProjectId = params.movieSubProjectId ?? "all";
  const movieCountryId = params.movieCountryId ?? "all";
  const moviePage = parsePageParam(params.moviePage);
  const movieSortBy = params.movieSortBy ?? "movieName";
  const movieSortDir = normalizeSortDirection(params.movieSortDir);

  const dayFromDate = normalizeDateInput(params.dayFromDate) ?? defaultMonthRange.fromDate;
  const dayToDate = normalizeDateInput(params.dayToDate) ?? defaultMonthRange.toDate;
  const dayClientId = params.dayClientId ?? "all";
  const dayProjectId = params.dayProjectId ?? "all";
  const daySubProjectId = params.daySubProjectId ?? "all";
  const dayCountryId = params.dayCountryId ?? "all";
  const dayMovieId = params.dayMovieId ?? "all";
  const dayPage = parsePageParam(params.dayPage);
  const daySortBy = params.daySortBy ?? "dateKey";
  const daySortDir = normalizeSortDirection(params.daySortDir);

  const countryFromDate = normalizeDateInput(params.countryFromDate) ?? defaultMonthRange.fromDate;
  const countryToDate = normalizeDateInput(params.countryToDate) ?? defaultMonthRange.toDate;
  const countryClientId = params.countryClientId ?? "all";
  const countryProjectId = params.countryProjectId ?? "all";
  const countrySubProjectId = params.countrySubProjectId ?? "all";
  const countryCountryId = params.countryCountryId ?? "all";
  const countryMovieId = params.countryMovieId ?? "all";
  const countryPage = parsePageParam(params.countryPage);
  const countrySortBy = params.countrySortBy ?? "countryCode";
  const countrySortDir = normalizeSortDirection(params.countrySortDir);

  const visibleProjects = await getVisibleProjects(user);
  const visibleProjectIds = visibleProjects.map((project) => project.id);
  const safeProjectIds = visibleProjectIds.length ? visibleProjectIds : ["__none__"];

  const clientOptions = Array.from(
    new Map(
      visibleProjects.map((project) => [project.client.id, { id: project.client.id, name: project.client.name }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const projectOptions = visibleProjects
    .map((project) => ({ id: project.id, name: project.name, clientId: project.clientId }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const movieEligibleProjects = visibleProjects.filter(
    (project) => project.client.showMoviesInEntries && !project.hideMoviesInEntries,
  );
  const movieEligibleProjectIds = movieEligibleProjects.map((project) => project.id);
  const movieEligibleClientMap = new Map(
    movieEligibleProjects.map((project) => [project.client.id, { id: project.client.id, name: project.client.name }]),
  );
  const movieClientOptions = Array.from(movieEligibleClientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const movieProjectOptions = movieEligibleProjects
    .map((project) => ({ id: project.id, name: project.name, clientId: project.clientId }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const countryEligibleProjects = visibleProjects.filter(
    (project) => project.client.showCountriesInTimeEntries && !project.hideCountriesInEntries,
  );
  const countryEligibleProjectIds = countryEligibleProjects.map((project) => project.id);
  const countryEligibleClientMap = new Map(
    countryEligibleProjects.map((project) => [project.client.id, { id: project.client.id, name: project.client.name }]),
  );
  const countryEligibleClientOptions = Array.from(countryEligibleClientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const countryEligibleProjectOptions = countryEligibleProjects
    .map((project) => ({ id: project.id, name: project.name, clientId: project.clientId, hideCountriesInEntries: project.hideCountriesInEntries }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const [subProjectOptions, countryOptions, movieOptions] = await Promise.all([
    db.subProject.findMany({
      where: {
        isActive: true,
        projectId: { in: safeProjectIds },
      },
      select: {
        id: true,
        name: true,
        projectId: true,
        hideMoviesInEntries: true,
        hideCountriesInEntries: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    db.country.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        isoCode: true,
      },
      orderBy: [{ isoCode: "asc" }, { name: "asc" }],
    }),
    db.movie.findMany({
      where: {
        isActive: true,
        clientId: { in: Array.from(new Set(movieEligibleProjects.map((project) => project.clientId))).length ? Array.from(new Set(movieEligibleProjects.map((project) => project.clientId))) : ["__none__"] },
      },
      select: {
        id: true,
        title: true,
        clientId: true,
        client: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ title: "asc" }],
    }),
  ]);

  const normalizedSubProjectOptions = subProjectOptions
    .map((subProject) => ({ id: subProject.id, name: subProject.name, projectId: subProject.projectId, hideMoviesInEntries: subProject.hideMoviesInEntries, hideCountriesInEntries: subProject.hideCountriesInEntries }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const countryEligibleSubProjectOptions = normalizedSubProjectOptions
    .filter((subProject) => countryEligibleProjectIds.includes(subProject.projectId) && !subProject.hideCountriesInEntries)
    .map(({ id, name, projectId, hideCountriesInEntries }) => ({ id, name, projectId, hideCountriesInEntries }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const movieSubProjectOptions = normalizedSubProjectOptions
    .filter((subProject) => movieEligibleProjectIds.includes(subProject.projectId) && !subProject.hideMoviesInEntries)
    .map(({ id, name, projectId }) => ({ id, name, projectId }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const normalizedCountryOptions = countryOptions
    .map((country) => ({ id: country.id, name: country.name, isoCode: country.isoCode ?? "-" }))
    .sort((a, b) => {
      if (a.isoCode !== b.isoCode) return a.isoCode.localeCompare(b.isoCode);
      return a.name.localeCompare(b.name);
    });

  const normalizedMovieOptions = movieOptions
    .map((movie) => ({ id: movie.id, title: movie.title, clientId: movie.clientId, clientName: movie.client.name }))
    .sort((a, b) => a.title.localeCompare(b.title));

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

  const [
    { fromBoundary: clientFromBoundary, toBoundary: clientToBoundary },
    { fromBoundary: projectFromBoundary, toBoundary: projectToBoundary },
    { fromBoundary: taskFromBoundary, toBoundary: taskToBoundary },
    { fromBoundary: movieFromBoundary, toBoundary: movieToBoundary },
    { fromBoundary: dayFromBoundary, toBoundary: dayToBoundary },
    { fromBoundary: countryFromBoundary, toBoundary: countryToBoundary },
  ] = [
    buildDateRange(clientFromDate, clientToDate),
    buildDateRange(projectFromDate, projectToDate),
    buildDateRange(taskFromDate, taskToDate),
    buildDateRange(movieFromDate, movieToDate),
    buildDateRange(dayFromDate, dayToDate),
    buildDateRange(countryFromDate, countryToDate),
  ];

  const [clientEntries, projectEntries, taskEntries, movieEntries, dayEntries, countryEntries] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: clientFromBoundary, lte: clientToBoundary },
        ...(clientClientId !== "all" ? { project: { is: { clientId: clientClientId } } } : {}),
        ...employeeWhereClause,
      },
      include: { project: { include: { client: true } } },
      orderBy: [{ workDate: "desc" }],
    }),
    db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: projectFromBoundary, lte: projectToBoundary },
        ...(projectClientId !== "all" ? { project: { is: { clientId: projectClientId } } } : {}),
        ...(projectProjectId !== "all" ? { projectId: projectProjectId } : {}),
        ...employeeWhereClause,
      },
      include: { project: { include: { client: true } }, subProject: true },
      orderBy: [{ workDate: "desc" }],
    }),
    db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: taskFromBoundary, lte: taskToBoundary },
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
    }),
    db.timeEntry.findMany({
      where: {
        projectId: { in: movieEligibleProjectIds.length ? movieEligibleProjectIds : ["__none__"] },
        workDate: { gte: movieFromBoundary, lte: movieToBoundary },
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
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    }),
    db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        workDate: { gte: dayFromBoundary, lte: dayToBoundary },
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
    }),
    db.timeEntry.findMany({
      where: {
        projectId: { in: countryEligibleProjectIds.length ? countryEligibleProjectIds : ["__none__"] },
        workDate: { gte: countryFromBoundary, lte: countryToBoundary },
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
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const clientMap = new Map<string, ClientHoursRow>();
  const projectMap = new Map<string, ProjectHoursRow>();
  const movieMap = new Map<string, MovieMinutesRow>();
  const dayMap = new Map<string, DayMinutesRow>();
  const countryMap = new Map<string, CountryMinutesRow>();

  for (const entry of clientEntries) {
    const clientKey = entry.project.clientId;
    const clientRow = clientMap.get(clientKey) ?? {
      clientId: entry.project.clientId,
      clientName: entry.project.client.name,
      totalMinutes: 0,
    };
    clientRow.totalMinutes += entry.minutesSpent;
    clientMap.set(clientKey, clientRow);
  }

  for (const entry of projectEntries) {
    const projectKey = `${entry.project.client.name}__${entry.project.name}__${entry.subProject?.name ?? "-"}`;
    const projectRow = projectMap.get(projectKey) ?? {
      clientName: entry.project.client.name,
      projectName: entry.project.name,
      subProjectName: entry.subProject?.name ?? "-",
      totalMinutes: 0,
    };
    projectRow.totalMinutes += entry.minutesSpent;
    projectMap.set(projectKey, projectRow);
  }

  for (const entry of movieEntries) {
    const movieName = entry.movie?.title ?? "-";
    const countryCode = entry.country?.isoCode ?? "-";
    const subProjectName = entry.subProject?.name ?? "-";
    const movieKey = `${movieName}__${entry.project.client.name}__${entry.project.name}__${subProjectName}__${countryCode}`;
    const movieRow = movieMap.get(movieKey) ?? {
      movieName,
      clientName: entry.project.client.name,
      projectName: entry.project.name,
      subProjectName,
      countryCode,
      totalMinutes: 0,
    };
    movieRow.totalMinutes += entry.minutesSpent;
    movieMap.set(movieKey, movieRow);
  }

  for (const entry of dayEntries) {
    const dateKey = entry.workDate.toISOString().slice(0, 10);
    const clientName = entry.project.client.name;
    const projectName = entry.project.name;
    const subProjectName = entry.subProject?.name ?? "-";
    const countryName = entry.country?.name ?? "Unspecified";
    const countryCode = entry.country?.isoCode ?? "-";
    const movieName = entry.movie?.title ?? "-";
    const key = `${dateKey}__${clientName}__${projectName}__${subProjectName}__${countryCode}__${countryName}__${movieName}`;
    const dayRow = dayMap.get(key) ?? {
      dateKey,
      clientName,
      projectName,
      subProjectName,
      countryName,
      countryCode,
      movieName,
      totalMinutes: 0,
    };
    dayRow.totalMinutes += entry.minutesSpent;
    dayMap.set(key, dayRow);
  }

  for (const entry of countryEntries) {
    const clientName = entry.project.client.name;
    const projectName = entry.project.name;
    const subProjectName = entry.subProject?.name ?? "-";
    const countryCode = entry.country?.isoCode ?? "-";
    const countryName = entry.country?.name ?? "Unspecified";
    const movieName = entry.movie?.title ?? "-";
    const key = `${clientName}__${projectName}__${subProjectName}__${countryCode}__${countryName}__${movieName}`;
    const countryRow = countryMap.get(key) ?? {
      clientName,
      projectName,
      subProjectName,
      countryCode,
      countryName,
      movieName,
      totalMinutes: 0,
    };
    countryRow.totalMinutes += entry.minutesSpent;
    countryMap.set(key, countryRow);
  }

  const clientBaseRows = Array.from(clientMap.values());
  const projectBaseRows = Array.from(projectMap.values());
  const taskBaseRows: TaskDetailRow[] = taskEntries.map((entry) => ({
    id: entry.id,
    clientName: entry.project.client.name,
    projectName: entry.project.name,
    subProjectName: entry.subProject?.name ?? "-",
    taskName: entry.taskName,
    taskDescription: entry.notes?.trim() ? entry.notes : "-",
    countryName: entry.country?.name ?? "-",
    countryCode: entry.country?.isoCode ?? "-",
    movieName: entry.movie?.title ?? "-",
    employeeRole: formatRole(entry.employee.functionalRole),
    totalMinutes: entry.minutesSpent,
  }));
  const movieBaseRows = Array.from(movieMap.values());
  const dayBaseRows = Array.from(dayMap.values());
  const countryBaseRows = Array.from(countryMap.values());

  const clientRows = sortRows(clientBaseRows, (row) => {
    switch (clientSortBy) {
      case "totalMinutes":
        return row.totalMinutes;
      case "clientName":
      default:
        return row.clientName;
    }
  }, clientSortDir);

  const projectRows = sortRows(projectBaseRows, (row) => {
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

  const taskRows = sortRows(taskBaseRows, (row) => {
    switch (taskSortBy) {
      case "projectName":
        return row.projectName;
      case "subProjectName":
        return row.subProjectName;
      case "taskName":
        return row.taskName;
      case "countryCode":
        return row.countryCode;
      case "employeeRole":
        return row.employeeRole;
      case "totalMinutes":
        return row.totalMinutes;
      case "clientName":
      default:
        return row.clientName;
    }
  }, taskSortDir);

  const movieRows = sortRows(movieBaseRows, (row) => {
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

  const dayRows = sortRows(dayBaseRows, (row) => {
    switch (daySortBy) {
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
      case "dateKey":
      default:
        return row.dateKey;
    }
  }, daySortDir);

  const countryRows = sortRows(countryBaseRows, (row) => {
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
      case "countryCode":
      default:
        return row.countryCode;
    }
  }, countrySortDir);

  const paginatedClientRows = paginateItems(clientRows, clientPage, DEFAULT_PAGE_SIZE);
  const paginatedProjectRows = paginateItems(projectRows, projectPage, DEFAULT_PAGE_SIZE);
  const paginatedTaskRows = paginateItems(taskRows, taskPage, DEFAULT_PAGE_SIZE);
  const paginatedMovieRows = paginateItems(movieRows, moviePage, DEFAULT_PAGE_SIZE);
  const paginatedDayRows = paginateItems(dayRows, dayPage, DEFAULT_PAGE_SIZE);
  const paginatedCountryRows = paginateItems(countryRows, countryPage, DEFAULT_PAGE_SIZE);

  const clientTotalMinutes = clientRows.reduce((sum, row) => sum + row.totalMinutes, 0);
  const projectTotalMinutes = projectRows.reduce((sum, row) => sum + row.totalMinutes, 0);
  const taskTotalMinutes = taskRows.reduce((sum, row) => sum + row.totalMinutes, 0);
  const movieTotalMinutes = movieRows.reduce((sum, row) => sum + row.totalMinutes, 0);
  const dayTotalMinutes = dayRows.reduce((sum, row) => sum + row.totalMinutes, 0);
  const countryTotalMinutes = countryRows.reduce((sum, row) => sum + row.totalMinutes, 0);

  const clientSearch = {
    clientSortBy: clientSortBy || undefined,
    clientSortDir,
    clientFromDate,
    clientToDate,
    clientClientId: clientClientId === "all" ? undefined : clientClientId,
  };

  const projectSearch = {
    projectSortBy: projectSortBy || undefined,
    projectSortDir,
    projectFromDate,
    projectToDate,
    projectClientId: projectClientId === "all" ? undefined : projectClientId,
    projectProjectId: projectProjectId === "all" ? undefined : projectProjectId,
  };

  const taskSearch = {
    taskSortBy: taskSortBy || undefined,
    taskSortDir,
    taskFromDate,
    taskToDate,
    taskClientId: taskClientId === "all" ? undefined : taskClientId,
    taskProjectId: taskProjectId === "all" ? undefined : taskProjectId,
    taskSubProjectId: taskSubProjectId === "all" ? undefined : taskSubProjectId,
    taskCountryId: taskCountryId === "all" ? undefined : taskCountryId,
    taskMovieId: taskMovieId === "all" ? undefined : taskMovieId,
  };

  const movieSearch = {
    movieSortBy: movieSortBy || undefined,
    movieSortDir,
    movieFromDate,
    movieToDate,
    movieMovieId: movieMovieId === "all" ? undefined : movieMovieId,
    movieClientId: movieClientId === "all" ? undefined : movieClientId,
    movieProjectId: movieProjectId === "all" ? undefined : movieProjectId,
    movieSubProjectId: movieSubProjectId === "all" ? undefined : movieSubProjectId,
    movieCountryId: movieCountryId === "all" ? undefined : movieCountryId,
  };

  const daySearch = {
    daySortBy: daySortBy || undefined,
    daySortDir,
    dayFromDate,
    dayToDate,
    dayClientId: dayClientId === "all" ? undefined : dayClientId,
    dayProjectId: dayProjectId === "all" ? undefined : dayProjectId,
    daySubProjectId: daySubProjectId === "all" ? undefined : daySubProjectId,
    dayCountryId: dayCountryId === "all" ? undefined : dayCountryId,
    dayMovieId: dayMovieId === "all" ? undefined : dayMovieId,
  };

  const countrySearch = {
    countrySortBy: countrySortBy || undefined,
    countrySortDir,
    countryFromDate,
    countryToDate,
    countryClientId: countryClientId === "all" ? undefined : countryClientId,
    countryProjectId: countryProjectId === "all" ? undefined : countryProjectId,
    countrySubProjectId: countrySubProjectId === "all" ? undefined : countrySubProjectId,
    countryCountryId: countryCountryId === "all" ? undefined : countryCountryId,
    countryMovieId: countryMovieId === "all" ? undefined : countryMovieId,
  };

  const allReportSearch = {
    ...clientSearch,
    ...(clientPage > 1 ? { clientPage: String(clientPage) } : {}),
    ...projectSearch,
    ...(projectPage > 1 ? { projectPage: String(projectPage) } : {}),
    ...taskSearch,
    ...(taskPage > 1 ? { taskPage: String(taskPage) } : {}),
    ...movieSearch,
    ...(moviePage > 1 ? { moviePage: String(moviePage) } : {}),
    ...daySearch,
    ...(dayPage > 1 ? { dayPage: String(dayPage) } : {}),
    ...countrySearch,
    ...(countryPage > 1 ? { countryPage: String(countryPage) } : {}),
  };

  const clientPreservedParams = {
    ...projectSearch,
    ...(projectPage > 1 ? { projectPage: String(projectPage) } : {}),
    ...taskSearch,
    ...(taskPage > 1 ? { taskPage: String(taskPage) } : {}),
    ...movieSearch,
    ...(moviePage > 1 ? { moviePage: String(moviePage) } : {}),
    ...daySearch,
    ...(dayPage > 1 ? { dayPage: String(dayPage) } : {}),
    ...countrySearch,
    ...(countryPage > 1 ? { countryPage: String(countryPage) } : {}),
  };

  const projectPreservedParams = {
    ...clientSearch,
    ...(clientPage > 1 ? { clientPage: String(clientPage) } : {}),
    ...taskSearch,
    ...(taskPage > 1 ? { taskPage: String(taskPage) } : {}),
    ...movieSearch,
    ...(moviePage > 1 ? { moviePage: String(moviePage) } : {}),
    ...daySearch,
    ...(dayPage > 1 ? { dayPage: String(dayPage) } : {}),
    ...countrySearch,
    ...(countryPage > 1 ? { countryPage: String(countryPage) } : {}),
  };

  const taskPreservedParams = {
    ...clientSearch,
    ...(clientPage > 1 ? { clientPage: String(clientPage) } : {}),
    ...projectSearch,
    ...(projectPage > 1 ? { projectPage: String(projectPage) } : {}),
    ...movieSearch,
    ...(moviePage > 1 ? { moviePage: String(moviePage) } : {}),
    ...daySearch,
    ...(dayPage > 1 ? { dayPage: String(dayPage) } : {}),
    ...countrySearch,
    ...(countryPage > 1 ? { countryPage: String(countryPage) } : {}),
  };

  const moviePreservedParams = {
    ...clientSearch,
    ...(clientPage > 1 ? { clientPage: String(clientPage) } : {}),
    ...projectSearch,
    ...(projectPage > 1 ? { projectPage: String(projectPage) } : {}),
    ...taskSearch,
    ...(taskPage > 1 ? { taskPage: String(taskPage) } : {}),
    ...daySearch,
    ...(dayPage > 1 ? { dayPage: String(dayPage) } : {}),
    ...countrySearch,
    ...(countryPage > 1 ? { countryPage: String(countryPage) } : {}),
  };

  const dayPreservedParams = {
    ...clientSearch,
    ...(clientPage > 1 ? { clientPage: String(clientPage) } : {}),
    ...projectSearch,
    ...(projectPage > 1 ? { projectPage: String(projectPage) } : {}),
    ...taskSearch,
    ...(taskPage > 1 ? { taskPage: String(taskPage) } : {}),
    ...movieSearch,
    ...(moviePage > 1 ? { moviePage: String(moviePage) } : {}),
    ...countrySearch,
    ...(countryPage > 1 ? { countryPage: String(countryPage) } : {}),
  };

  const countryPreservedParams = {
    ...clientSearch,
    ...(clientPage > 1 ? { clientPage: String(clientPage) } : {}),
    ...projectSearch,
    ...(projectPage > 1 ? { projectPage: String(projectPage) } : {}),
    ...taskSearch,
    ...(taskPage > 1 ? { taskPage: String(taskPage) } : {}),
    ...movieSearch,
    ...(moviePage > 1 ? { moviePage: String(moviePage) } : {}),
    ...daySearch,
    ...(dayPage > 1 ? { dayPage: String(dayPage) } : {}),
  };


  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Time-entry reporting with report-specific filters and grouped minute summaries."
      />

      <nav className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {REPORT_TABS.map((tab) => {
            const isActive = tab.slug === activeReportSlug;
            return (
              <Link
                key={tab.slug}
                href={`/reports/${tab.slug}`}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${isActive ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {activeReportSlug === "client-wise-minutes" ? (
      <section id="client-wise-hours" className="table-wrap">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="section-title">Client-wise minutes</h2>
            <p className="section-subtitle">Grouped by client for the selected date range.</p>
          </div>
          <Link className="btn-secondary whitespace-nowrap" href={buildExportHref("client", clientSearch)}>
            Export CSV
          </Link>
        </div>
        <div className="relative z-20 border-b border-slate-100 px-4 py-4">
          <form className="flex flex-wrap items-end gap-3" method="get" action={`${reportsBasePath}#client-wise-hours`}>
            <div className="w-full sm:w-[180px]">
              <input className="input w-full" type="date" name="clientFromDate" defaultValue={clientFromDate} />
            </div>
            <div className="w-full sm:w-[180px]">
              <input className="input w-full" type="date" name="clientToDate" defaultValue={clientToDate} />
            </div>
            <div className="w-full sm:w-[240px] md:w-[260px] lg:w-[280px]">
              <SearchableCombobox
                id="clientClientId"
                name="clientClientId"
                defaultValue={clientClientId}
                options={[
                  { value: "all", label: "All clients" },
                  ...clientOptions.map((client) => ({ value: client.id, label: client.name })),
                ]}
                placeholder="All clients"
                searchPlaceholder="Search clients..."
                emptyLabel="No clients found."
              />
            </div>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              {Object.entries(clientPreservedParams).map(([key, value]) =>
                value ? <input key={key} type="hidden" name={key} value={value} /> : null,
              )}
              <button className="btn-secondary" type="submit">Apply</button>
              <a
                className="btn-secondary"
                href={(() => {
                  const search = new URLSearchParams();
                  Object.entries(clientPreservedParams).forEach(([key, value]) => { if (value) search.set(key, value); });
                  const query = search.toString();
                  return query ? `${reportsBasePath}?${query}#client-wise-hours` : `${reportsBasePath}#client-wise-hours`;
                })()}
              >
                Reset
              </a>
            </div>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <SortableHeader
                  label="Client"
                  sortBy="clientName"
                  currentSortBy={clientSortBy}
                  currentSortDir={clientSortDir}
                  href={buildSortHref({ basePath: reportsBasePath,
                    baseSearchParams: allReportSearch,
                    sortByParam: "clientSortBy",
                    sortDirParam: "clientSortDir",
                    pageParam: "clientPage",
                    sortBy: "clientName",
                    currentSortBy: clientSortBy,
                    currentSortDir: clientSortDir,
                    anchor: "#client-wise-hours",
                  })}
                />
                <SortableHeader
                  label="Mins"
                  sortBy="totalMinutes"
                  currentSortBy={clientSortBy}
                  currentSortDir={clientSortDir}
                  href={buildSortHref({ basePath: reportsBasePath,
                    baseSearchParams: allReportSearch,
                    sortByParam: "clientSortBy",
                    sortDirParam: "clientSortDir",
                    pageParam: "clientPage",
                    sortBy: "totalMinutes",
                    currentSortBy: clientSortBy,
                    currentSortDir: clientSortDir,
                    anchor: "#client-wise-hours",
                  })}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedClientRows.items.map((row) => (
                <tr key={row.clientId}>
                  <td className="table-cell">{row.clientName}</td>
                  <td className="table-cell">{formatMins(row.totalMinutes)}</td>
                </tr>
              ))}
              {clientRows.length === 0 ? <tr><td colSpan={2} className="table-cell text-center text-sm text-slate-500">No records found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-700">
          Total Time: <span className="text-slate-900">{formatMinutes(clientTotalMinutes)}</span>
        </div>
        <PaginationControls basePath={reportsBasePath} currentPage={paginatedClientRows.currentPage} totalPages={paginatedClientRows.totalPages} totalItems={paginatedClientRows.totalItems} pageSize={paginatedClientRows.pageSize} searchParams={allReportSearch} pageParam="clientPage" anchor="#client-wise-hours" />
      </section>
      ) : null}

      {activeReportSlug === "project-wise-minutes" ? (
      <section id="project-wise-hours" className="table-wrap">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="section-title">Project / Sub-Project-wise minutes</h2>
            <p className="section-subtitle">Grouped by client, project, and sub-project for the selected date range.</p>
          </div>
          <Link className="btn-secondary whitespace-nowrap" href={buildExportHref("project", projectSearch)}>
            Export CSV
          </Link>
        </div>
        <div className="relative z-20 border-b border-slate-100 px-4 py-4">
          <ProjectHoursFilterForm action={reportsBasePath} anchor="#project-wise-hours" fromDate={projectFromDate} toDate={projectToDate} clientId={projectClientId} projectId={projectProjectId} clientOptions={clientOptions} projectOptions={projectOptions} preservedParams={projectPreservedParams} />
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head"><tr>
              <SortableHeader label="Client" sortBy="clientName" currentSortBy={projectSortBy} currentSortDir={projectSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "projectSortBy", sortDirParam: "projectSortDir", pageParam: "projectPage", sortBy: "clientName", currentSortBy: projectSortBy, currentSortDir: projectSortDir, anchor: "#project-wise-hours" })} />
              <SortableHeader label="Project Name" sortBy="projectName" currentSortBy={projectSortBy} currentSortDir={projectSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "projectSortBy", sortDirParam: "projectSortDir", pageParam: "projectPage", sortBy: "projectName", currentSortBy: projectSortBy, currentSortDir: projectSortDir, anchor: "#project-wise-hours" })} />
              <SortableHeader label="Sub-Project Name" sortBy="subProjectName" currentSortBy={projectSortBy} currentSortDir={projectSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "projectSortBy", sortDirParam: "projectSortDir", pageParam: "projectPage", sortBy: "subProjectName", currentSortBy: projectSortBy, currentSortDir: projectSortDir, anchor: "#project-wise-hours" })} />
              <SortableHeader label="Mins" sortBy="totalMinutes" currentSortBy={projectSortBy} currentSortDir={projectSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "projectSortBy", sortDirParam: "projectSortDir", pageParam: "projectPage", sortBy: "totalMinutes", currentSortBy: projectSortBy, currentSortDir: projectSortDir, anchor: "#project-wise-hours" })} />
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProjectRows.items.map((row) => (
                <tr key={`${row.clientName}-${row.projectName}-${row.subProjectName}`}>
                  <td className="table-cell">{row.clientName}</td><td className="table-cell">{row.projectName}</td><td className="table-cell">{row.subProjectName}</td><td className="table-cell">{formatMins(row.totalMinutes)}</td>
                </tr>
              ))}
              {projectRows.length === 0 ? <tr><td colSpan={4} className="table-cell text-center text-sm text-slate-500">No records found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-700">Total Time: <span className="text-slate-900">{formatMinutes(projectTotalMinutes)}</span></div>
        <PaginationControls basePath={reportsBasePath} currentPage={paginatedProjectRows.currentPage} totalPages={paginatedProjectRows.totalPages} totalItems={paginatedProjectRows.totalItems} pageSize={paginatedProjectRows.pageSize} searchParams={allReportSearch} pageParam="projectPage" anchor="#project-wise-hours" />
      </section>
      ) : null}

      {activeReportSlug === "task-wise-minutes" ? (
      <section id="task-wise-hours" className="table-wrap">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="section-title">Task-wise detailed minutes</h2>
            <p className="section-subtitle">Detailed task entries for the selected date range, project, and sub-project.</p>
          </div>
          <Link className="btn-secondary whitespace-nowrap" href={buildExportHref("task", taskSearch)}>
            Export CSV
          </Link>
        </div>
        <div className="relative z-20 border-b border-slate-100 px-4 py-4">
          <TaskDetailFilterForm action={reportsBasePath} anchor="#task-wise-hours" fromDate={taskFromDate} toDate={taskToDate} clientId={taskClientId} projectId={taskProjectId} subProjectId={taskSubProjectId} countryId={taskCountryId} clientOptions={clientOptions} projectOptions={projectOptions} subProjectOptions={normalizedSubProjectOptions.map(({id,name,projectId,hideCountriesInEntries}) => ({id,name,projectId,hideCountriesInEntries}))} countryOptions={normalizedCountryOptions} countryEligibleClientOptions={countryEligibleClientOptions} countryEligibleProjectOptions={countryEligibleProjectOptions} countryEligibleSubProjectOptions={countryEligibleSubProjectOptions} movieId={taskMovieId} movieOptions={normalizedMovieOptions} movieEligibleClientOptions={movieClientOptions} movieEligibleProjectOptions={movieProjectOptions} movieEligibleSubProjectOptions={movieSubProjectOptions} preservedParams={taskPreservedParams} />
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head"><tr>
              <SortableHeader className="table-cell max-w-48 break-normal" label="Client Name" sortBy="clientName" currentSortBy={taskSortBy} currentSortDir={taskSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "taskSortBy", sortDirParam: "taskSortDir", pageParam: "taskPage", sortBy: "clientName", currentSortBy: taskSortBy, currentSortDir: taskSortDir, anchor: "#task-wise-hours" })} />
              <SortableHeader label="Project Name" sortBy="projectName" currentSortBy={taskSortBy} currentSortDir={taskSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "taskSortBy", sortDirParam: "taskSortDir", pageParam: "taskPage", sortBy: "projectName", currentSortBy: taskSortBy, currentSortDir: taskSortDir, anchor: "#task-wise-hours" })} />
              <SortableHeader label="Sub-Project Name" sortBy="subProjectName" currentSortBy={taskSortBy} currentSortDir={taskSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "taskSortBy", sortDirParam: "taskSortDir", pageParam: "taskPage", sortBy: "subProjectName", currentSortBy: taskSortBy, currentSortDir: taskSortDir, anchor: "#task-wise-hours" })} />
              <SortableHeader className="table-cell max-w-48 break-normal" label="Task Name" sortBy="taskName" currentSortBy={taskSortBy} currentSortDir={taskSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "taskSortBy", sortDirParam: "taskSortDir", pageParam: "taskPage", sortBy: "taskName", currentSortBy: taskSortBy, currentSortDir: taskSortDir, anchor: "#task-wise-hours" })} />
              <th className="table-cell max-w-48 break-all">Task Details</th>
              <SortableHeader label="Movie" sortBy="movieName" currentSortBy={taskSortBy} currentSortDir={taskSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "taskSortBy", sortDirParam: "taskSortDir", pageParam: "taskPage", sortBy: "movieName", currentSortBy: taskSortBy, currentSortDir: taskSortDir, anchor: "#task-wise-hours" })} />
              <SortableHeader label="Country" sortBy="countryCode" currentSortBy={taskSortBy} currentSortDir={taskSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "taskSortBy", sortDirParam: "taskSortDir", pageParam: "taskPage", sortBy: "countryCode", currentSortBy: taskSortBy, currentSortDir: taskSortDir, anchor: "#task-wise-hours" })} />
              <SortableHeader label="Employee Role" sortBy="employeeRole" currentSortBy={taskSortBy} currentSortDir={taskSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "taskSortBy", sortDirParam: "taskSortDir", pageParam: "taskPage", sortBy: "employeeRole", currentSortBy: taskSortBy, currentSortDir: taskSortDir, anchor: "#task-wise-hours" })} />
              <SortableHeader label="Mins" sortBy="totalMinutes" currentSortBy={taskSortBy} currentSortDir={taskSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "taskSortBy", sortDirParam: "taskSortDir", pageParam: "taskPage", sortBy: "totalMinutes", currentSortBy: taskSortBy, currentSortDir: taskSortDir, anchor: "#task-wise-hours" })} />
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTaskRows.items.map((row) => (
                <tr key={row.id}><td className="table-cell max-w-48 break-normal">{row.clientName}</td><td className="table-cell">{row.projectName}</td><td className="table-cell">{row.subProjectName}</td><td className="table-cell max-w-48 break-normal">{row.taskName}</td><td className="table-cell max-w-48 break-all">{row.taskDescription}</td><td className="table-cell">{row.movieName}</td>
                  <td className="table-cell">{row.countryCode}</td><td className="table-cell">{row.employeeRole}</td><td className="table-cell">{formatMins(row.totalMinutes)}</td></tr>
              ))}
              {taskRows.length === 0 ? <tr><td colSpan={9} className="table-cell text-center text-sm text-slate-500">No records found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-700">Total Time: <span className="text-slate-900">{formatMinutes(taskTotalMinutes)}</span></div>
        <PaginationControls basePath={reportsBasePath} currentPage={paginatedTaskRows.currentPage} totalPages={paginatedTaskRows.totalPages} totalItems={paginatedTaskRows.totalItems} pageSize={paginatedTaskRows.pageSize} searchParams={allReportSearch} pageParam="taskPage" anchor="#task-wise-hours" />
      </section>
      ) : null}

      {activeReportSlug === "movie-wise-minutes" ? (
      <section id="movie-wise-minutes" className="table-wrap">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="section-title">Movie-wise minutes</h2>
            <p className="section-subtitle">Grouped by movie, client, project, sub-project, and country for movie-enabled time-entry combinations only.</p>
          </div>
          <Link className="btn-secondary whitespace-nowrap" href={buildExportHref("movie", movieSearch)}>
            Export CSV
          </Link>
        </div>
        <div className="relative z-20 border-b border-slate-100 px-4 py-4">
          <MovieMinutesFilterForm action={reportsBasePath} anchor="#movie-wise-minutes" fromDate={movieFromDate} toDate={movieToDate} movieId={movieMovieId} clientId={movieClientId} projectId={movieProjectId} subProjectId={movieSubProjectId} countryId={movieCountryId} movieOptions={normalizedMovieOptions} clientOptions={movieClientOptions} projectOptions={movieProjectOptions} subProjectOptions={movieSubProjectOptions} countryOptions={normalizedCountryOptions} preservedParams={moviePreservedParams} />
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head"><tr>
              <SortableHeader label="Movie Name" sortBy="movieName" currentSortBy={movieSortBy} currentSortDir={movieSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "movieSortBy", sortDirParam: "movieSortDir", pageParam: "moviePage", sortBy: "movieName", currentSortBy: movieSortBy, currentSortDir: movieSortDir, anchor: "#movie-wise-minutes" })} />
              <SortableHeader label="Client Name" sortBy="clientName" currentSortBy={movieSortBy} currentSortDir={movieSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "movieSortBy", sortDirParam: "movieSortDir", pageParam: "moviePage", sortBy: "clientName", currentSortBy: movieSortBy, currentSortDir: movieSortDir, anchor: "#movie-wise-minutes" })} />
              <SortableHeader label="Project Name" sortBy="projectName" currentSortBy={movieSortBy} currentSortDir={movieSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "movieSortBy", sortDirParam: "movieSortDir", pageParam: "moviePage", sortBy: "projectName", currentSortBy: movieSortBy, currentSortDir: movieSortDir, anchor: "#movie-wise-minutes" })} />
              <SortableHeader label="Sub-Project Name" sortBy="subProjectName" currentSortBy={movieSortBy} currentSortDir={movieSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "movieSortBy", sortDirParam: "movieSortDir", pageParam: "moviePage", sortBy: "subProjectName", currentSortBy: movieSortBy, currentSortDir: movieSortDir, anchor: "#movie-wise-minutes" })} />
              <SortableHeader label="Country" sortBy="countryCode" currentSortBy={movieSortBy} currentSortDir={movieSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "movieSortBy", sortDirParam: "movieSortDir", pageParam: "moviePage", sortBy: "countryCode", currentSortBy: movieSortBy, currentSortDir: movieSortDir, anchor: "#movie-wise-minutes" })} />
              <SortableHeader label="Mins" sortBy="totalMinutes" currentSortBy={movieSortBy} currentSortDir={movieSortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "movieSortBy", sortDirParam: "movieSortDir", pageParam: "moviePage", sortBy: "totalMinutes", currentSortBy: movieSortBy, currentSortDir: movieSortDir, anchor: "#movie-wise-minutes" })} />
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedMovieRows.items.map((row) => (
                <tr key={`${row.movieName}-${row.clientName}-${row.projectName}-${row.subProjectName}-${row.countryCode}`}>
                  <td className="table-cell">{row.movieName}</td>
                  <td className="table-cell">{row.clientName}</td>
                  <td className="table-cell">{row.projectName}</td>
                  <td className="table-cell">{row.subProjectName}</td>
                  <td className="table-cell">{row.countryCode}</td>
                  <td className="table-cell">{formatMins(row.totalMinutes)}</td>
                </tr>
              ))}
              {movieRows.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-sm text-slate-500">No records found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-700">Total Time: <span className="text-slate-900">{formatMinutes(movieTotalMinutes)}</span></div>
        <PaginationControls basePath={reportsBasePath} currentPage={paginatedMovieRows.currentPage} totalPages={paginatedMovieRows.totalPages} totalItems={paginatedMovieRows.totalItems} pageSize={paginatedMovieRows.pageSize} searchParams={allReportSearch} pageParam="moviePage" anchor="#movie-wise-minutes" />
      </section>
      ) : null}

      {activeReportSlug === "day-wise-minutes" ? (
      <section id="day-wise-minutes" className="table-wrap">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="section-title">Day-wise minutes</h2>
            <p className="section-subtitle">Grouped by work date for the selected filters.</p>
          </div>
          <Link className="btn-secondary whitespace-nowrap" href={buildExportHref("day", daySearch)}>
            Export CSV
          </Link>
        </div>
        <div className="relative z-20 border-b border-slate-100 px-4 py-4">
          <ScopedMinutesFilterForm action={reportsBasePath} anchor="#day-wise-minutes" prefix="day" fromDate={dayFromDate} toDate={dayToDate} clientId={dayClientId} projectId={dayProjectId} subProjectId={daySubProjectId} countryId={dayCountryId} clientOptions={clientOptions} projectOptions={projectOptions} subProjectOptions={normalizedSubProjectOptions.map(({id,name,projectId,hideCountriesInEntries}) => ({id,name,projectId,hideCountriesInEntries}))} countryOptions={normalizedCountryOptions} countryEligibleClientOptions={countryEligibleClientOptions} countryEligibleProjectOptions={countryEligibleProjectOptions} countryEligibleSubProjectOptions={countryEligibleSubProjectOptions} movieId={dayMovieId} movieOptions={normalizedMovieOptions} movieEligibleClientOptions={movieClientOptions} movieEligibleProjectOptions={movieProjectOptions} movieEligibleSubProjectOptions={movieSubProjectOptions} preservedParams={dayPreservedParams} />
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head"><tr>
              <SortableHeader label="Date" sortBy="dateKey" currentSortBy={daySortBy} currentSortDir={daySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "daySortBy", sortDirParam: "daySortDir", pageParam: "dayPage", sortBy: "dateKey", currentSortBy: daySortBy, currentSortDir: daySortDir, anchor: "#day-wise-minutes" })} />
              <SortableHeader label="Client" sortBy="clientName" currentSortBy={daySortBy} currentSortDir={daySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "daySortBy", sortDirParam: "daySortDir", pageParam: "dayPage", sortBy: "clientName", currentSortBy: daySortBy, currentSortDir: daySortDir, anchor: "#day-wise-minutes" })} />
              <SortableHeader label="Project" sortBy="projectName" currentSortBy={daySortBy} currentSortDir={daySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "daySortBy", sortDirParam: "daySortDir", pageParam: "dayPage", sortBy: "projectName", currentSortBy: daySortBy, currentSortDir: daySortDir, anchor: "#day-wise-minutes" })} />
              <SortableHeader label="Sub-Project" sortBy="subProjectName" currentSortBy={daySortBy} currentSortDir={daySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "daySortBy", sortDirParam: "daySortDir", pageParam: "dayPage", sortBy: "subProjectName", currentSortBy: daySortBy, currentSortDir: daySortDir, anchor: "#day-wise-minutes" })} />
              <SortableHeader label="Movie" sortBy="movieName" currentSortBy={daySortBy} currentSortDir={daySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "daySortBy", sortDirParam: "daySortDir", pageParam: "dayPage", sortBy: "movieName", currentSortBy: daySortBy, currentSortDir: daySortDir, anchor: "#day-wise-minutes" })} />
              <SortableHeader label="Country" sortBy="countryCode" currentSortBy={daySortBy} currentSortDir={daySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "daySortBy", sortDirParam: "daySortDir", pageParam: "dayPage", sortBy: "countryCode", currentSortBy: daySortBy, currentSortDir: daySortDir, anchor: "#day-wise-minutes" })} />
              <SortableHeader label="Mins" sortBy="totalMinutes" currentSortBy={daySortBy} currentSortDir={daySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "daySortBy", sortDirParam: "daySortDir", pageParam: "dayPage", sortBy: "totalMinutes", currentSortBy: daySortBy, currentSortDir: daySortDir, anchor: "#day-wise-minutes" })} />
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedDayRows.items.map((row) => (
                <tr key={`${row.dateKey}-${row.clientName}-${row.projectName}-${row.subProjectName}-${row.countryCode}-${row.countryName}-${row.movieName}`}>
                  <td className="table-cell">{formatReportDate(new Date(`${row.dateKey}T12:00:00`))}</td>
                  <td className="table-cell">{row.clientName}</td>
                  <td className="table-cell">{row.projectName}</td>
                  <td className="table-cell">{row.subProjectName}</td>
                  <td className="table-cell">{row.movieName}</td>
                  <td className="table-cell">{row.countryCode === "-" ? row.countryName : `${row.countryCode} - ${row.countryName}`}</td>
                  <td className="table-cell">{formatMins(row.totalMinutes)}</td>
                </tr>
              ))}
              {dayRows.length === 0 ? <tr><td colSpan={7} className="table-cell text-center text-sm text-slate-500">No records found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-700">Total Time: <span className="text-slate-900">{formatMinutes(dayTotalMinutes)}</span></div>
        <PaginationControls basePath={reportsBasePath} currentPage={paginatedDayRows.currentPage} totalPages={paginatedDayRows.totalPages} totalItems={paginatedDayRows.totalItems} pageSize={paginatedDayRows.pageSize} searchParams={allReportSearch} pageParam="dayPage" anchor="#day-wise-minutes" />
      </section>
      ) : null}

      {activeReportSlug === "country-wise-minutes" ? (
      <section id="country-wise-minutes" className="table-wrap">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="section-title">Country-wise minutes</h2>
            <p className="section-subtitle">Grouped by country for the selected filters, limited to time-entry combinations where the country dropdown is enabled.</p>
          </div>
          <Link className="btn-secondary whitespace-nowrap" href={buildExportHref("country", countrySearch)}>
            Export CSV
          </Link>
        </div>
        <div className="relative z-20 border-b border-slate-100 px-4 py-4">
          <ScopedMinutesFilterForm action={reportsBasePath} anchor="#country-wise-minutes" prefix="country" fromDate={countryFromDate} toDate={countryToDate} clientId={countryClientId} projectId={countryProjectId} subProjectId={countrySubProjectId} countryId={countryCountryId} clientOptions={countryEligibleClientOptions} projectOptions={countryEligibleProjectOptions} subProjectOptions={countryEligibleSubProjectOptions} countryOptions={normalizedCountryOptions} countryEligibleClientOptions={countryEligibleClientOptions} countryEligibleProjectOptions={countryEligibleProjectOptions} countryEligibleSubProjectOptions={countryEligibleSubProjectOptions} movieId={countryMovieId} movieOptions={normalizedMovieOptions} movieEligibleClientOptions={movieClientOptions} movieEligibleProjectOptions={movieProjectOptions} movieEligibleSubProjectOptions={movieSubProjectOptions} preservedParams={countryPreservedParams} />
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-head"><tr>
              <SortableHeader label="Country" sortBy="countryCode" currentSortBy={countrySortBy} currentSortDir={countrySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "countrySortBy", sortDirParam: "countrySortDir", pageParam: "countryPage", sortBy: "countryCode", currentSortBy: countrySortBy, currentSortDir: countrySortDir, anchor: "#country-wise-minutes" })} />
              <SortableHeader label="Movie" sortBy="movieName" currentSortBy={countrySortBy} currentSortDir={countrySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "countrySortBy", sortDirParam: "countrySortDir", pageParam: "countryPage", sortBy: "movieName", currentSortBy: countrySortBy, currentSortDir: countrySortDir, anchor: "#country-wise-minutes" })} />
              <SortableHeader label="Client" sortBy="clientName" currentSortBy={countrySortBy} currentSortDir={countrySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "countrySortBy", sortDirParam: "countrySortDir", pageParam: "countryPage", sortBy: "clientName", currentSortBy: countrySortBy, currentSortDir: countrySortDir, anchor: "#country-wise-minutes" })} />
              <SortableHeader label="Project" sortBy="projectName" currentSortBy={countrySortBy} currentSortDir={countrySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "countrySortBy", sortDirParam: "countrySortDir", pageParam: "countryPage", sortBy: "projectName", currentSortBy: countrySortBy, currentSortDir: countrySortDir, anchor: "#country-wise-minutes" })} />
              <SortableHeader label="Sub-Project" sortBy="subProjectName" currentSortBy={countrySortBy} currentSortDir={countrySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "countrySortBy", sortDirParam: "countrySortDir", pageParam: "countryPage", sortBy: "subProjectName", currentSortBy: countrySortBy, currentSortDir: countrySortDir, anchor: "#country-wise-minutes" })} />
              <SortableHeader label="Mins" sortBy="totalMinutes" currentSortBy={countrySortBy} currentSortDir={countrySortDir} href={buildSortHref({ basePath: reportsBasePath, baseSearchParams: allReportSearch, sortByParam: "countrySortBy", sortDirParam: "countrySortDir", pageParam: "countryPage", sortBy: "totalMinutes", currentSortBy: countrySortBy, currentSortDir: countrySortDir, anchor: "#country-wise-minutes" })} />
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedCountryRows.items.map((row) => (
                <tr key={`${row.countryCode}-${row.countryName}-${row.clientName}-${row.projectName}-${row.subProjectName}-${row.movieName}`}>
                  <td className="table-cell">{row.countryCode === "-" ? row.countryName : `${row.countryCode} - ${row.countryName}`}</td>
                  <td className="table-cell">{row.movieName}</td>
                  <td className="table-cell">{row.clientName}</td>
                  <td className="table-cell">{row.projectName}</td>
                  <td className="table-cell">{row.subProjectName}</td>
                  <td className="table-cell">{formatMins(row.totalMinutes)}</td>
                </tr>
              ))}
              {countryRows.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-sm text-slate-500">No records found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-700">Total Time: <span className="text-slate-900">{formatMinutes(countryTotalMinutes)}</span></div>
        <PaginationControls basePath={reportsBasePath} currentPage={paginatedCountryRows.currentPage} totalPages={paginatedCountryRows.totalPages} totalItems={paginatedCountryRows.totalItems} pageSize={paginatedCountryRows.pageSize} searchParams={allReportSearch} pageParam="countryPage" anchor="#country-wise-minutes" />
      </section>
      ) : null}
    </div>
  );
}
