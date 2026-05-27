import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { LensTypeForm } from "@/components/forms/lens-type-form";
import { updateLensTypeAction } from "@/lib/actions/lens-type-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageLensTypes } from "@/lib/permissions";

export default async function EditLensTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireUser();
  if (!canManageLensTypes(currentUser)) redirect("/dashboard");
  const { id } = await params;
  const lensType = await db.lensType.findUnique({ where: { id } });
  if (!lensType) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit Lens Type · ${lensType.name}`}
        description="Update Lens Type name and availability."
        actions={
          <Link href="/lens-type" className="btn-secondary">
            Back to Lens Types
          </Link>
        }
      />
      <div className="max-w-3xl">
        <LensTypeForm
          action={updateLensTypeAction}
          title={`Edit Lens Type: ${lensType.name}`}
          submitLabel="Save changes"
          initialValues={{
            id: lensType.id,
            name: lensType.name,
            isActive: lensType.isActive,
          }}
        />
      </div>
    </div>
  );
}
