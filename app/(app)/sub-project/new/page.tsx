import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { SubProjectForm } from "@/components/forms/sub-project-form";
import { createSubProjectAction } from "@/lib/actions/sub-project-actions";

export default async function NewSubProjectPage({
  searchParams,
}: {
  searchParams?: Promise<{ clientId?: string; projectId?: string }>;
}) {
  const params = (await searchParams) ?? {};

  const projects = await db.project.findMany({
    where: { isActive: true },
    include: { client: true },
    orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Sub Project"
        description="Select client, choose the project, and create the Sub Project record."
        actions={
          <Link href="/sub-project" className="btn-secondary">
            Back to Sub Projects
          </Link>
        }
      />

      <div className="max-w-3xl">
        <SubProjectForm
          mode="create"
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
            clientName: project.client.name,
          }))}
          action={createSubProjectAction}
          initialValues={{
            clientId: params.clientId,
            projectId: params.projectId,
          }}
        />
      </div>
    </div>
  );
}
