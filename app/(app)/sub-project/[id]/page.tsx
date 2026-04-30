import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { SubProjectForm } from "@/components/forms/sub-project-form";
import { updateSubProjectAction } from "@/lib/actions/sub-project-actions";

export default async function SubProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [subProject, projects] = await Promise.all([
    db.subProject.findUnique({
      where: { id },
      include: { project: { include: { client: true } } },
    }),
    db.project.findMany({
      where: { isActive: true },
      include: { client: true },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  if (!subProject) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit Sub Project · ${subProject.name}`}
        description="Update sub project details. User assignment is managed separately."
        actions={
          <Link href="/sub-project" className="btn-secondary">
            Back to Sub Projects
          </Link>
        }
      />

      <SubProjectForm
        mode="edit"
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          clientId: project.clientId,
          clientName: project.client.name,
          clientShowsCountriesInEntries: project.client.showCountriesInTimeEntries,
          clientShowsMoviesInEntries: project.client.showMoviesInEntries,
          clientShowsAssetTypesInEntries: project.client.showAssetTypesInEntries,
          hideCountriesInEntries: project.hideCountriesInEntries,
          hideMoviesInEntries: project.hideMoviesInEntries,
          hideAssetTypesInEntries: project.hideAssetTypesInEntries,
        }))}
        action={updateSubProjectAction}
        initialValues={{
          id: subProject.id,
          clientId: subProject.project.clientId,
          projectId: subProject.projectId,
          name: subProject.name,
          description: subProject.description,
          isActive: subProject.isActive,
          hideCountriesInEntries: subProject.hideCountriesInEntries,
          hideMoviesInEntries: subProject.hideMoviesInEntries,
          hideAssetTypesInEntries: subProject.hideAssetTypesInEntries,
        }}
      />
    </div>
  );
}
