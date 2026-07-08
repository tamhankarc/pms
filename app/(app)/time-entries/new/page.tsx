import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { TimeEntryCreateForm } from "@/components/forms/time-entry-create-form";
import {
  canAccessMenuItem,
  canFullyModerateProject,
  canLogOwnTimeWithoutProjectAssignment,
  isManager,
  isRoleScopedManager,
} from "@/lib/permissions";

export default async function NewTimeEntryPage() {
  const user = await requireUser();
  if (!canAccessMenuItem(user, "time-entries")) redirect("/dashboard");

  const [
    projects,
    countries,
    movies,
    assetTypes,
    lensTypes,
    assetNames,
    newsletters,
    languages,
    supervisorAssignments,
    roleScopedUsers,
    allActiveEmployees,
    allSubProjects,
  ] = await Promise.all([
    getVisibleProjects(user, { allowedStatuses: ["ACTIVE"] }),
    db.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.movie.findMany({ where: { isActive: true }, orderBy: { title: "asc" } }),
    db.assetType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.lensType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.assetName.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.newsletter.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.language.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    user.userType === "TEAM_LEAD"
      ? db.employeeTeamLead.findMany({
          where: { teamLeadId: user.id },
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                userType: true,
                isActive: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    isRoleScopedManager(user)
      ? db.user.findMany({
          where: {
            isActive: true,
            functionalRole:
              user.functionalRole && user.functionalRole !== "UNASSIGNED"
                ? user.functionalRole
                : undefined,
            userType: { in: ["EMPLOYEE", "TEAM_LEAD"] },
          },
          select: { id: true, fullName: true, userType: true },
          orderBy: [{ userType: "asc" }, { fullName: "asc" }],
        })
      : Promise.resolve([]),
    isManager(user) && !isRoleScopedManager(user)
      ? db.user.findMany({
          where: {
            isActive: true,
            OR: [
              { userType: { in: ["EMPLOYEE", "TEAM_LEAD"] } },
              {
                userType: "MANAGER",
                OR: [
                  { functionalRole: { not: "PROJECT_MANAGER" } },
                  { functionalRole: null },
                ],
              },
            ],
          },
          select: { id: true, fullName: true, userType: true },
          orderBy: [{ userType: "asc" }, { fullName: "asc" }],
        })
      : canFullyModerateProject(user)
        ? db.user.findMany({
            where: {
              isActive: true,
              userType: { in: ["MANAGER", "TEAM_LEAD", "EMPLOYEE"] },
            },
            select: { id: true, fullName: true, userType: true },
            orderBy: { fullName: "asc" },
          })
        : Promise.resolve([]),
    db.subProject.findMany({
      where: { isActive: true, project: { isActive: true, status: "ACTIVE" } },
      include: { assignments: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const currentUserOption = {
    id: user.id,
    fullName: user.fullName,
    userType: user.userType,
  };

  const assignableEmployees =
    user.userType === "TEAM_LEAD"
      ? [
          currentUserOption,
          ...supervisorAssignments
            .filter((row) => row.employee.isActive)
            .map((row) => ({
              id: row.employee.id,
              fullName: row.employee.fullName,
              userType: row.employee.userType,
            })),
        ]
      : isRoleScopedManager(user)
        ? [
            currentUserOption,
            ...roleScopedUsers.map((row) => ({
              id: row.id,
              fullName: row.fullName,
              userType: row.userType,
            })),
          ]
        : isManager(user) || canFullyModerateProject(user)
          ? [
              currentUserOption,
              ...allActiveEmployees.map((employee) => ({
                id: employee.id,
                fullName: employee.fullName,
                userType: employee.userType,
              })),
            ]
          : [currentUserOption];

  const dedupedAssignableEmployees = Array.from(
    new Map(
      assignableEmployees.map((employee) => [employee.id, employee]),
    ).values(),
  );
  const defaultEmployeeId = dedupedAssignableEmployees[0]?.id ?? user.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Time Entry"
        description="Select the employee, project details, and submit the time entry."
        actions={
          <Link href="/time-entries" className="btn-secondary">
            Back to Time Entries
          </Link>
        }
      />

      <div className="max-w-3xl">
        <TimeEntryCreateForm
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
            clientName: project.client.name,
            showCountriesInTimeEntries:
              project.client.showCountriesInTimeEntries,
            hideCountriesInEntries: project.hideCountriesInEntries,
            showMoviesInEntries: project.client.showMoviesInEntries,
            hideMoviesInEntries: project.hideMoviesInEntries,
            showAssetTypesInEntries: project.client.showAssetTypesInEntries,
            hideAssetTypesInEntries: project.hideAssetTypesInEntries,
            showLensTypesInEntries: project.client.showLensTypesInEntries,
            hideLensTypesInEntries: project.hideLensTypesInEntries,
            showAssetNamesInEntries: project.client.showAssetNamesInEntries,
            hideAssetNamesInEntries: project.hideAssetNamesInEntries,
            showNewslettersInEntries: project.client.showNewslettersInEntries,
            hideNewslettersInEntries: project.hideNewslettersInEntries,
            requireCountriesInTimeEntries: project.requireCountriesInTimeEntries,
            requireMoviesInTimeEntries: project.requireMoviesInTimeEntries,
            requireAssetTypesInTimeEntries: project.requireAssetTypesInTimeEntries,
            requireLensTypesInTimeEntries: project.requireLensTypesInTimeEntries,
            requireAssetNamesInTimeEntries: project.requireAssetNamesInTimeEntries,
            requireNewslettersInTimeEntries: project.requireNewslettersInTimeEntries,
            allowedCountryIdsJson: project.allowedCountryIdsJson,
            allowedMovieIdsJson: project.allowedMovieIdsJson,
            allowedAssetTypeIdsJson: project.allowedAssetTypeIdsJson,
            allowedLensTypeIdsJson: project.allowedLensTypeIdsJson,
            allowedAssetNameIdsJson: project.allowedAssetNameIdsJson,
            allowedNewsletterIdsJson: project.allowedNewsletterIdsJson,
            showLanguagesInEntries: project.client.showLanguagesInEntries,
            assignedUserIds: project.assignedUsers.map(
              (assignment) => assignment.userId,
            ),
          }))}
          subProjects={allSubProjects.map((subProject) => ({
            id: subProject.id,
            name: subProject.name,
            projectId: subProject.projectId,
            assignedUserIds: subProject.assignments.map((row) => row.userId),
            hideCountriesInEntries: subProject.hideCountriesInEntries,
            hideMoviesInEntries: subProject.hideMoviesInEntries,
            hideAssetTypesInEntries: subProject.hideAssetTypesInEntries,
            hideLensTypesInEntries: subProject.hideLensTypesInEntries,
            hideAssetNamesInEntries: subProject.hideAssetNamesInEntries,
            hideNewslettersInEntries: subProject.hideNewslettersInEntries,
          }))}
          countries={countries.map((country) => ({
            id: country.id,
            name: country.name,
          }))}
          movies={movies.map((movie) => ({
            id: movie.id,
            title: movie.title,
            clientId: movie.clientId,
          }))}
          assetTypes={assetTypes.map((assetType) => ({
            id: assetType.id,
            name: assetType.name,
            clientId: assetType.clientId,
          }))}
          lensTypes={lensTypes.map((lensType) => ({
            id: lensType.id,
            name: lensType.name,
          }))}
          assetNames={assetNames.map((assetName) => ({
            id: assetName.id,
            name: assetName.name,
            clientId: assetName.clientId,
            movieId: assetName.movieId,
          }))}
          newsletters={newsletters.map((newsletter) => ({
            id: newsletter.id,
            name: newsletter.name,
            clientId: newsletter.clientId,
          }))}
          languages={languages.map((language) => ({
            id: language.id,
            name: language.name,
            code: language.code,
          }))}
          assignableEmployees={dedupedAssignableEmployees}
          defaultEmployeeId={defaultEmployeeId}
          currentUserId={user.id}
          canCurrentUserBypassProjectAssignment={canLogOwnTimeWithoutProjectAssignment(
            user,
          )}
          allowUnassignedSubProjects
        />
      </div>
    </div>
  );
}
