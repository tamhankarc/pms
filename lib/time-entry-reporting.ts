import "server-only";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { getVisibleProjects } from "@/lib/queries";
import { isRoleScopedManager } from "@/lib/permissions";
import { formatMinutes } from "@/lib/utils";

export type TimeEntryListSearchParams = {
  clientId?: string;
  projectId?: string;
  subProjectId?: string;
  fromDate?: string;
  toDate?: string;
  userId?: string;
  search?: string;
};

export type TimeEntryFilterOption = {
  id: string;
  name: string;
};

export type TimeEntryProjectOption = TimeEntryFilterOption & {
  clientId: string;
};

export type TimeEntrySubProjectOption = TimeEntryFilterOption & {
  projectId: string;
  clientId: string;
};

export function normalizeDateInput(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function buildFromBoundary(value: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function buildToBoundary(value: string) {
  return value ? new Date(`${value}T23:59:59.999`) : undefined;
}

export function normalizeTimeEntryFilters(
  params: TimeEntryListSearchParams,
  user: SessionUser,
) {
  return {
    selectedClientId: params.clientId ?? "all",
    selectedProjectId: params.projectId ?? "all",
    selectedSubProjectId: params.subProjectId ?? "all",
    selectedFromDate: normalizeDateInput(params.fromDate),
    selectedToDate: normalizeDateInput(params.toDate),
    selectedUserId: user.userType === "ADMIN" ? params.userId ?? "all" : "all",
    selectedTextSearch:
      user.userType === "ADMIN" ? (params.search ?? "").trim().slice(0, 200) : "",
  };
}

export type TimeEntryRow = Prisma.TimeEntryGetPayload<{
  include: {
    employee: true;
    project: { include: { client: true } };
    subProject: true;
    country: true;
    movie: true;
    language: true;
    assetType: true;
    lensType: true;
    assetName: true;
    newsletter: true;
  };
}>;

export type TimeEntryFilterData = Awaited<ReturnType<typeof getTimeEntryFilterData>>;

export async function getTimeEntryFilterData(user: SessionUser) {
  const [projects, supervisorAssignments, adminUserOptions] = await Promise.all([
    getVisibleProjects(user, { allowedStatuses: ["ACTIVE"] }),
    user.userType === "TEAM_LEAD" || isRoleScopedManager(user)
      ? db.employeeTeamLead.findMany({
          where: { teamLeadId: user.id },
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                functionalRole: true,
                userType: true,
                isActive: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    user.userType === "ADMIN"
      ? db.user.findMany({
          where: {
            isActive: true,
            userType: { in: ["MANAGER", "TEAM_LEAD", "EMPLOYEE"] },
          },
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            userType: true,
            functionalRole: true,
          },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const clientOptions = Array.from(
    new Map(
      projects.map((project) => [
        project.client.id,
        { id: project.client.id, name: project.client.name },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const projectOptions = projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      clientId: project.clientId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const subProjectOptions = projects
    .flatMap((project) =>
      project.subProjects.map((subProject) => ({
        id: subProject.id,
        name: subProject.name,
        projectId: project.id,
        clientId: project.clientId,
      })),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    projects,
    supervisorAssignments,
    adminUserOptions,
    clientOptions,
    projectOptions,
    subProjectOptions,
  };
}

function buildProjectScope({
  projects,
  selectedClientId,
  selectedProjectId,
  selectedSubProjectId,
}: {
  projects: TimeEntryFilterData["projects"];
  selectedClientId: string;
  selectedProjectId: string;
  selectedSubProjectId: string;
}) {
  const filteredProjects = projects.filter((project) => {
    const matchesClient =
      selectedClientId === "all" ? true : project.clientId === selectedClientId;
    const matchesProject =
      selectedProjectId === "all" ? true : project.id === selectedProjectId;
    const hasSelectedSubProject =
      selectedSubProjectId === "all"
        ? true
        : project.subProjects.some((subProject) => subProject.id === selectedSubProjectId);
    return matchesClient && matchesProject && hasSelectedSubProject;
  });

  const visibleProjectIds = filteredProjects.map((project) => project.id);
  const validSubProjectIds = new Set(
    filteredProjects.flatMap((project) => project.subProjects.map((subProject) => subProject.id)),
  );
  const effectiveSubProjectId =
    selectedSubProjectId !== "all" && validSubProjectIds.has(selectedSubProjectId)
      ? selectedSubProjectId
      : "all";

  return {
    safeProjectIds: visibleProjectIds.length ? visibleProjectIds : ["__none__"],
    effectiveSubProjectId,
  };
}

function buildCommonWhere({
  safeProjectIds,
  effectiveSubProjectId,
  selectedFromDate,
  selectedToDate,
}: {
  safeProjectIds: string[];
  effectiveSubProjectId: string;
  selectedFromDate: string;
  selectedToDate: string;
}): Prisma.TimeEntryWhereInput {
  const fromBoundary = buildFromBoundary(selectedFromDate);
  const toBoundary = buildToBoundary(selectedToDate);
  const workDateFilter = {
    ...(fromBoundary ? { gte: fromBoundary } : {}),
    ...(toBoundary ? { lte: toBoundary } : {}),
  };
  const hasWorkDateFilter = Object.keys(workDateFilter).length > 0;

  return {
    projectId: { in: safeProjectIds },
    project: { is: { isActive: true, status: "ACTIVE" } },
    ...(effectiveSubProjectId !== "all"
      ? { subProjectId: effectiveSubProjectId }
      : { OR: [{ subProjectId: null }, { subProject: { is: { isActive: true } } }] }),
    ...(hasWorkDateFilter ? { workDate: workDateFilter } : {}),
  };
}

function appendSearchWhere(
  baseWhere: Prisma.TimeEntryWhereInput,
  selectedTextSearch: string,
) {
  if (!selectedTextSearch) return baseWhere;
  return {
    ...baseWhere,
    AND: [
      ...(Array.isArray(baseWhere.AND) ? baseWhere.AND : baseWhere.AND ? [baseWhere.AND] : []),
      {
        OR: [
          { taskName: { contains: selectedTextSearch } },
          { notes: { contains: selectedTextSearch } },
        ],
      },
    ],
  } satisfies Prisma.TimeEntryWhereInput;
}

export function getManagedEmployeeIds(
  user: SessionUser,
  supervisorAssignments: TimeEntryFilterData["supervisorAssignments"],
) {
  return supervisorAssignments
    .filter((row) => row.employee.functionalRole === user.functionalRole)
    .map((row) => row.employeeId);
}

export async function getTimeEntryRows({
  user,
  params,
  filterData,
}: {
  user: SessionUser;
  params: TimeEntryListSearchParams;
  filterData: TimeEntryFilterData;
}) {
  const filters = normalizeTimeEntryFilters(params, user);
  const validAdminUserIds = new Set(filterData.adminUserOptions.map((option) => option.id));
  const effectiveUserId =
    filters.selectedUserId !== "all" && validAdminUserIds.has(filters.selectedUserId)
      ? filters.selectedUserId
      : "all";
  const { safeProjectIds, effectiveSubProjectId } = buildProjectScope({
    projects: filterData.projects,
    selectedClientId: filters.selectedClientId,
    selectedProjectId: filters.selectedProjectId,
    selectedSubProjectId: filters.selectedSubProjectId,
  });
  const commonWhere = buildCommonWhere({
    safeProjectIds,
    effectiveSubProjectId,
    selectedFromDate: filters.selectedFromDate,
    selectedToDate: filters.selectedToDate,
  });
  const scopedEmployeeIds = getManagedEmployeeIds(user, filterData.supervisorAssignments);

  let where: Prisma.TimeEntryWhereInput;
  if (user.userType === "EMPLOYEE") {
    where = {
      ...commonWhere,
      employeeId: user.id,
    };
  } else if (user.userType === "TEAM_LEAD" || isRoleScopedManager(user)) {
    where = {
      OR: [
        { ...commonWhere, employeeId: user.id },
        {
          ...commonWhere,
          employeeId: {
            in: scopedEmployeeIds.length ? scopedEmployeeIds : ["__none__"],
          },
        },
      ],
    };
  } else {
    where = {
      ...commonWhere,
      ...(user.userType === "ADMIN" && effectiveUserId !== "all"
        ? { employeeId: effectiveUserId }
        : {}),
    };
    where = appendSearchWhere(where, filters.selectedTextSearch);
  }

  const entries = await db.timeEntry.findMany({
    where,
    include: {
      employee: true,
      project: { include: { client: true } },
      subProject: true,
      country: true,
      movie: true,
      language: true,
      assetType: true,
      lensType: true,
      assetName: true,
      newsletter: true,
    },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
  });

  return {
    entries,
    filters: { ...filters, effectiveUserId, effectiveSubProjectId },
    scopedEmployeeIds,
  };
}

function parseAllowedIds(value?: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [] as string[];
  }
}

function isRestrictedInvalid(value: string | null, allowedIds: string[]) {
  return Boolean(value && allowedIds.length > 0 && !allowedIds.includes(value));
}

export function getInvalidTimeEntryReasons(entry: TimeEntryRow) {
  const reasons: string[] = [];
  const project = entry.project;
  const client = project.client;
  const subProject = entry.subProject;

  const countryEnabled =
    client.showCountriesInTimeEntries &&
    !project.hideCountriesInEntries &&
    !subProject?.hideCountriesInEntries;
  const movieEnabled =
    client.showMoviesInEntries &&
    !project.hideMoviesInEntries &&
    !subProject?.hideMoviesInEntries;
  const assetTypeEnabled =
    client.showAssetTypesInEntries &&
    !project.hideAssetTypesInEntries &&
    !subProject?.hideAssetTypesInEntries;
  const lensTypeEnabled =
    client.showLensTypesInEntries &&
    !project.hideLensTypesInEntries &&
    !subProject?.hideLensTypesInEntries;
  const assetNameEnabled =
    client.showAssetNamesInEntries &&
    !project.hideAssetNamesInEntries &&
    !subProject?.hideAssetNamesInEntries;
  const newsletterEnabled =
    client.showNewslettersInEntries &&
    !project.hideNewslettersInEntries &&
    !subProject?.hideNewslettersInEntries;

  const assetNameRequired = assetNameEnabled && project.requireAssetNamesInTimeEntries;
  const movieRequired =
    movieEnabled && (project.requireMoviesInTimeEntries || assetNameRequired);

  if (countryEnabled && project.requireCountriesInTimeEntries && !entry.countryId) {
    reasons.push("Country is required");
  }
  if (movieRequired && !entry.movieId) {
    reasons.push(assetNameRequired ? "Title is required for required Asset Name" : "Title is required");
  }
  if (assetTypeEnabled && project.requireAssetTypesInTimeEntries && !entry.assetTypeId) {
    reasons.push("Asset Type is required");
  }
  if (lensTypeEnabled && project.requireLensTypesInTimeEntries && !entry.lensTypeId) {
    reasons.push("Lens Type is required");
  }
  if (assetNameRequired && !entry.assetNameId) {
    reasons.push("Asset Name is required");
  }
  if (newsletterEnabled && project.requireNewslettersInTimeEntries && !entry.newsletterId) {
    reasons.push("Newsletter is required");
  }
  if (client.showLanguagesInEntries && !entry.languageId) {
    reasons.push("Language is required");
  }

  const allowedCountryIds = parseAllowedIds(project.allowedCountryIdsJson);
  const allowedMovieIds = parseAllowedIds(project.allowedMovieIdsJson);
  const allowedAssetTypeIds = parseAllowedIds(project.allowedAssetTypeIdsJson);
  const allowedLensTypeIds = parseAllowedIds(project.allowedLensTypeIdsJson);
  const allowedAssetNameIds = parseAllowedIds(project.allowedAssetNameIdsJson);
  const allowedNewsletterIds = parseAllowedIds(project.allowedNewsletterIdsJson);

  if (countryEnabled && allowedCountryIds.length === 1 && !entry.countryId) reasons.push("Country is required because the project allows only one country");
  if (movieEnabled && allowedMovieIds.length === 1 && !entry.movieId) reasons.push("Title is required because the project allows only one title");
  if (assetTypeEnabled && allowedAssetTypeIds.length === 1 && !entry.assetTypeId) reasons.push("Asset Type is required because the project allows only one asset type");
  if (lensTypeEnabled && allowedLensTypeIds.length === 1 && !entry.lensTypeId) reasons.push("Lens Type is required because the project allows only one Lens Type");
  if (assetNameEnabled && allowedAssetNameIds.length === 1 && !entry.assetNameId) reasons.push("Asset Name is required because the project allows only one asset name");
  if (newsletterEnabled && allowedNewsletterIds.length === 1 && !entry.newsletterId) reasons.push("Newsletter is required because the project allows only one newsletter");

  if (countryEnabled && isRestrictedInvalid(entry.countryId, allowedCountryIds)) {
    reasons.push("Selected country is not allowed for this project");
  }
  if (movieEnabled && isRestrictedInvalid(entry.movieId, allowedMovieIds)) {
    reasons.push("Selected title is not allowed for this project");
  }
  if (assetTypeEnabled && isRestrictedInvalid(entry.assetTypeId, allowedAssetTypeIds)) {
    reasons.push("Selected asset type is not allowed for this project");
  }
  if (lensTypeEnabled && isRestrictedInvalid(entry.lensTypeId, allowedLensTypeIds)) {
    reasons.push("Selected Lens Type is not allowed for this project");
  }
  if (assetNameEnabled && isRestrictedInvalid(entry.assetNameId, allowedAssetNameIds)) {
    reasons.push("Selected asset name is not allowed for this project");
  }
  if (newsletterEnabled && isRestrictedInvalid(entry.newsletterId, allowedNewsletterIds)) {
    reasons.push("Selected newsletter is not allowed for this project");
  }

  return reasons;
}

export function filterInvalidTimeEntries(entries: TimeEntryRow[]) {
  return entries
    .map((entry) => ({ entry, reasons: getInvalidTimeEntryReasons(entry) }))
    .filter((row) => row.reasons.length > 0);
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function buildTimeEntriesWorkbook({
  entries,
  invalidOnly = false,
}: {
  entries: TimeEntryRow[];
  invalidOnly?: boolean;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS";
  const sheet = workbook.addWorksheet(invalidOnly ? "Invalid Time Entries" : "Time Entries");
  const invalidMap = new Map(
    filterInvalidTimeEntries(entries).map((row) => [row.entry.id, row.reasons.join("; ")]),
  );

  const headers = [
    "Employee",
    "Client",
    "Project",
    "Sub-Project",
    "Work Date",
    "Task Name",
    "Minutes",
    "Time",
    "Country",
    "Title",
    "Asset Type",
    "Lens Type",
    "Asset Name",
    "Newsletter Type",
    "Newsletter",
    "Language",
    "Billable",
    "Status",
    "Notes",
    ...(invalidOnly ? ["Invalid Reason(s)"] : []),
  ];
  sheet.addRow(headers);

  for (const entry of entries) {
    sheet.addRow([
      entry.employee.fullName,
      entry.project.client.name,
      entry.project.name,
      entry.subProject?.name ?? "",
      formatDate(entry.workDate),
      entry.taskName,
      entry.minutesSpent,
      formatMinutes(entry.minutesSpent),
      entry.country?.name ?? "",
      entry.movie?.title ?? "",
      entry.assetType?.name ?? "",
      entry.lensType?.name ?? "",
      entry.assetName?.name ?? "",
      entry.newsletter?.newsletterType ?? "",
      entry.newsletter?.name ?? "",
      entry.language ? `${entry.language.name} (${entry.language.code})` : "",
      entry.isBillable ? "Yes" : "No",
      entry.status,
      entry.notes ?? "",
      ...(invalidOnly ? [invalidMap.get(entry.id) ?? ""] : []),
    ]);
  }

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((column) => {
    column.width = Math.min(Math.max(column.width ?? 12, 14), 36);
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
