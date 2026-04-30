import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EstimateCreateForm } from "@/components/forms/estimate-create-form";
import { getVisibleProjects } from "@/lib/queries";
import { canFullyModerateProject, isManager, isRoleScopedManager } from "@/lib/permissions";

export default async function NewEstimatePage() {
  const user = await requireUser();

  const [projects, countries, movies, assetTypes, languages, supervisorAssignments, roleScopedUsers, allActiveEmployees, allSubProjects] =
    await Promise.all([
      getVisibleProjects(user, { allowedStatuses: ["ACTIVE", "ON_HOLD"] }).then((projects) => projects.filter((project) => project.billingModel === "FIXED_FULL")),
      db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      db.movie.findMany({ where: { isActive: true }, orderBy: { title: "asc" } }),
      db.assetType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      db.language.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      user.userType === "TEAM_LEAD"
        ? db.employeeTeamLead.findMany({
            where: { teamLeadId: user.id },
            include: {
              employee: {
                select: { id: true, fullName: true, userType: true, isActive: true },
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
            where: { isActive: true, userType: "EMPLOYEE" },
            select: { id: true, fullName: true, userType: true },
            orderBy: { fullName: "asc" },
          })
        : canFullyModerateProject(user)
          ? db.user.findMany({
              where: { isActive: true, userType: "EMPLOYEE" },
              select: { id: true, fullName: true, userType: true },
              orderBy: { fullName: "asc" },
            })
          : Promise.resolve([]),
      db.subProject.findMany({
        where: { isActive: true, project: { isActive: true, status: { in: ["ACTIVE", "ON_HOLD"] }, billingModel: "FIXED_FULL" } },
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
    new Map(assignableEmployees.map((employee) => [employee.id, employee])).values(),
  );
  const defaultEmployeeId = dedupedAssignableEmployees[0]?.id ?? user.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Estimate"
        description="Select the employee, project details, and submit the estimate."
        actions={
          <Link href="/estimates" className="btn-secondary">
            Back to Estimates
          </Link>
        }
      />

      <div className="max-w-3xl">
        <EstimateCreateForm
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
            clientName: project.client.name,
            showCountriesInTimeEntries: project.client.showCountriesInTimeEntries,
            hideCountriesInEntries: project.hideCountriesInEntries,
            showMoviesInEntries: project.client.showMoviesInEntries,
            hideMoviesInEntries: project.hideMoviesInEntries,
            showAssetTypesInEntries: project.client.showAssetTypesInEntries,
            hideAssetTypesInEntries: project.hideAssetTypesInEntries,
            showLanguagesInEntries: project.client.showLanguagesInEntries,
            assignedUserIds: project.assignedUsers.map((assignment) => assignment.userId),
          }))}
          subProjects={allSubProjects.map((subProject) => ({
            id: subProject.id,
            name: subProject.name,
            projectId: subProject.projectId,
            assignedUserIds: subProject.assignments.map((row) => row.userId),
            hideCountriesInEntries: subProject.hideCountriesInEntries,
            hideMoviesInEntries: subProject.hideMoviesInEntries,
            hideAssetTypesInEntries: subProject.hideAssetTypesInEntries,
          }))}
          countries={countries.map((country) => ({ id: country.id, name: country.name }))}
          movies={movies.map((movie) => ({ id: movie.id, title: movie.title, clientId: movie.clientId }))}
          assetTypes={assetTypes.map((assetType) => ({ id: assetType.id, name: assetType.name, clientId: assetType.clientId }))}
          languages={languages.map((language) => ({
            id: language.id,
            name: language.name,
            code: language.code,
          }))}
          currentUserId={user.id}
          currentUserType={user.userType}
          assignableEmployees={dedupedAssignableEmployees}
          defaultEmployeeId={defaultEmployeeId}
          allowUnassignedSubProjects
        />
      </div>
    </div>
  );
}
