import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectEditForm } from "@/components/forms/project-edit-form";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      projectType: true,
    },
  });

  if (!project) notFound();

  const projectTypes = project.client.enableProjectTypes
    ? await db.projectType.findMany({
        where: {
          clientId: project.clientId,
          isActive: true,
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          clientId: true,
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Edit project"
        description="Client remains locked after creation."
        actions={
          <Link href={`/projects/${project.id}`} className="btn-secondary">
            Back to project
          </Link>
        }
      />

      <ProjectEditForm
        projectId={project.id}
        lockedClientName={project.client.name}
        projectTypes={projectTypes}
        clientUsesProjectTypes={project.client.enableProjectTypes}
        clientShowsCountriesInEntries={project.client.showCountriesInTimeEntries}
        clientShowsMoviesInEntries={project.client.showMoviesInEntries}
        initialValues={{
          projectTypeId: project.projectTypeId,
          name: project.name,
          billingModel: project.billingModel,
          fixedContractHours:
            project.fixedContractHours == null ? null : Number(project.fixedContractHours),
          fixedMonthlyHours:
            project.fixedMonthlyHours == null ? null : Number(project.fixedMonthlyHours),
          status: project.status,
          description: project.description,
          hideCountriesInEntries: project.hideCountriesInEntries,
          hideMoviesInEntries: project.hideMoviesInEntries,
        }}
      />
    </div>
  );
}