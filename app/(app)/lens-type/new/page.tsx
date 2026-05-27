import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { LensTypeForm } from "@/components/forms/lens-type-form";
import { createLensTypeAction } from "@/lib/actions/lens-type-actions";
import { requireUser } from "@/lib/auth";
import { canManageLensTypes } from "@/lib/permissions";

export default async function NewLensTypePage() {
  const currentUser = await requireUser();
  if (!canManageLensTypes(currentUser)) redirect("/dashboard");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Lens Type"
        description="Create a Lens Type for selection in Time Entries and Estimates."
        actions={
          <Link href="/lens-type" className="btn-secondary">
            Back to Lens Types
          </Link>
        }
      />
      <div className="max-w-3xl">
        <LensTypeForm
          action={createLensTypeAction}
          title="Create Lens Type"
          submitLabel="Create Lens Type"
        />
      </div>
    </div>
  );
}
