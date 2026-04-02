import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { TimeEntryCreateForm } from "@/components/forms/time-entry-create-form";
import { isManager, isRoleScopedManager } from "@/lib/permissions";

export default async function NewTimeEntryPage() {
  const user = await requireUser();

  const [projects, countries, movies, languages, supervisorAssignments, roleScopedUsers, allActiveEmployees, allSubProjects] =
    await Promise.all([
      getVisibleProjects(user),
      db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      db.movie.findMany({ where: { isActive: true }, orderBy: { title: "asc" } }),
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
        : Promise.resolve([]),
      db.subProject.findMany({
        where: { isActive: true },
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
        : isManager(user)
          ? allActiveEmployees.map((employee) => ({
              id: employee.id,
              fullName: employee.fullName,
              userType: employee.userType,
            }))
          : [currentUserOption];

  const dedupedAssignableEmployees = Array.from(
    new Map(assignableEmployees.map((employee) => [employee.id, employee])).values(),
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
            showCountriesInTimeEntries: project.client.showCountriesInTimeEntries,
            showMoviesInEntries: project.client.showMoviesInEntries,
            showLanguagesInEntries: project.client.showLanguagesInEntries,
            assignedUserIds: project.assignedUsers.map((assignment) => assignment.userId),
          }))}
          subProjects={allSubProjects.map((subProject) => ({
            id: subProject.id,
            name: subProject.name,
            projectId: subProject.projectId,
            assignedUserIds: subProject.assignments.map((row) => row.userId),
          }))}
          countries={countries.map((country) => ({ id: country.id, name: country.name }))}
          movies={movies.map((movie) => ({ id: movie.id, title: movie.title, clientId: movie.clientId }))}
          languages={languages.map((language) => ({
            id: language.id,
            name: language.name,
            code: language.code,
          }))}
          assignableEmployees={dedupedAssignableEmployees}
          defaultEmployeeId={defaultEmployeeId}
          allowUnassignedSubProjects
        />
      </div>
    </div>
  );
}
