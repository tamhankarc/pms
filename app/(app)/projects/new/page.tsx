import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { NewProjectForm } from "@/components/forms/new-project-form";

export default async function NewProjectPage() {
  const [clients, movies, countries, employeeGroups, assignableUsers] = await Promise.all([
    db.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.movie.findMany({
      where: { isActive: true },
      select: { id: true, title: true, clientId: true },
      orderBy: { title: "asc" },
    }),
    db.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.employeeGroup.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: {
        isActive: true,
        userType: { in: ["EMPLOYEE", "TEAM_LEAD", "MANAGER"] },
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, userType: true, functionalRole: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create project"
        description="Movie selection is optional. Projects can be assigned either to employee groups or directly to individual operational users."
      />
      <NewProjectForm
        clients={clients}
        movies={movies}
        countries={countries}
        employeeGroups={employeeGroups}
        assignableUsers={assignableUsers}
      />
    </div>
  );
}
