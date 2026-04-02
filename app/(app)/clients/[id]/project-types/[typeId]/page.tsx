import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectTypeForm } from "@/components/forms/project-type-form";
import { updateProjectTypeAction } from "@/lib/actions/project-type-actions";

export default async function EditClientProjectTypePage({
  params,
}: {
  params: Promise<{ id: string; typeId: string }>;
}) {
  const { id, typeId } = await params;

  const row = await db.projectType.findFirst({
    where: { id: typeId, clientId: id },
  });

  if (!row) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit Project Type · ${row.name}`}
        description="Update this client project type."
        actions={
          <Link href={`/clients/${id}/project-types`} className="btn-secondary">
            Back to project types
          </Link>
        }
      />

      <div className="max-w-3xl">
        <ProjectTypeForm
          mode="edit"
          action={updateProjectTypeAction}
          clientId={id}
          initialValues={{
            id: row.id,
            name: row.name,
            code: row.code ?? undefined,
            isActive: row.isActive,
          }}
        />
      </div>
    </div>
  );
}