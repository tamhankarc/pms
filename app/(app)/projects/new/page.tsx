import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { NewProjectForm } from "@/components/forms/new-project-form";

export default async function NewProjectPage() {
  const [clients, movies, countries, employeeGroups] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create project"
        description="Movie selection is optional and only shown when the selected client has movies."
      />
      <NewProjectForm
        clients={clients}
        movies={movies}
        countries={countries}
        employeeGroups={employeeGroups}
      />
    </div>
  );
}
