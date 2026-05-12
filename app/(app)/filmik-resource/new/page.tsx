import { canManageAssetTypes, canViewCostData } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { createFilmikResourceAction } from "@/lib/actions/filmik-resource-actions";
import { FilmikResourceForm } from "@/components/forms/filmik-resource-form";

export default async function NewFilmikResourcePage() {
  const currentUser = await requireUser();
  if (!canManageAssetTypes(currentUser)) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PageHeader title="Create Filmik Resource" description="Create a Filmik resource type with per-resource monthly cost." actions={<Link href="/filmik-resource" className="btn-secondary">Back to Filmik Resources</Link>} />
      <div className="max-w-3xl"><FilmikResourceForm action={createFilmikResourceAction} title="Create Filmik Resource" submitLabel="Create Resource Type" canEditCosts={canViewCostData(currentUser)} /></div>
    </div>
  );
}
