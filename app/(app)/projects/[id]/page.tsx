import { canSeeAllProjects } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectEditForm } from "@/components/forms/project-edit-form";
import { db } from "@/lib/db";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireUser();
  if (!canSeeAllProjects(currentUser)) redirect("/dashboard");

  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, include: { client: true } });
  if (!project) notFound();

  const projectTypes = await db.projectType.findMany({ where: { clientId: project.clientId, isActive: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${project.name}`} description="Update project profile, billing model, entry dropdown behavior, and billing report cost fields." actions={<Link className="btn-secondary" href="/projects">Back to Projects</Link>} />
      <ProjectEditForm
        projectId={project.id}
        lockedClientName={project.client.name}
        clientId={project.clientId}
        projectTypes={projectTypes}
        clientUsesProjectTypes={project.client.enableProjectTypes}
        clientShowsCountriesInEntries={project.client.showCountriesInTimeEntries}
        clientShowsMoviesInEntries={project.client.showMoviesInEntries}
        clientShowsAssetTypesInEntries={project.client.showAssetTypesInEntries}
        initialValues={{
          projectTypeId: project.projectTypeId,
          name: project.name,
          billingModel: project.billingModel,
          fixedContractHours: project.fixedContractHours == null ? null : Number(project.fixedContractHours),
          fixedMonthlyHours: project.fixedMonthlyHours == null ? null : Number(project.fixedMonthlyHours),
          status: project.status,
          description: project.description,
          hideCountriesInEntries: project.hideCountriesInEntries,
          hideMoviesInEntries: project.hideMoviesInEntries,
          hideAssetTypesInEntries: project.hideAssetTypesInEntries,
          addToBilling: project.addToBilling,
          additionalCharges: Number(project.additionalCharges ?? 0),
          partialBillingCost: Number(project.partialBillingCost ?? 0),
          perCountryCharges: Number(project.perCountryCharges ?? 0),
          developerCount: Number(project.developerCount ?? 0),
          perDeveloperCost: Number(project.perDeveloperCost ?? 0),
        }}
      />
    </div>
  );
}
