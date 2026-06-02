import { canManageAssetTypes, canViewCostData } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { updateFilmikResourceAction } from "@/lib/actions/filmik-resource-actions";
import { FilmikResourceForm } from "@/components/forms/filmik-resource-form";
import { FILMIK_CLIENT_ID } from "@/lib/billing-reports/config";

export default async function FilmikResourceEditPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireUser();
  if (!canManageAssetTypes(currentUser)) redirect("/dashboard");

  const { id } = await params;
  const resource = await db.filmikResourceType.findFirst({ where: { id, clientId: FILMIK_CLIENT_ID } });
  if (!resource) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit Filmik Resource · ${resource.name}`} description="Update Filmik resource type and per-resource client/vendor monthly costs." actions={<Link href="/filmik-resource" className="btn-secondary">Back to Filmik Resources</Link>} />
      <div className="max-w-3xl">
        <FilmikResourceForm action={updateFilmikResourceAction} title={`Edit Filmik Resource: ${resource.name}`} submitLabel="Save changes" initialValues={{ id: resource.id, name: resource.name, cost: resource.cost.toString(), perResourceVendorCost: resource.perResourceVendorCost.toString(), isActive: resource.isActive }} canEditCosts={canViewCostData(currentUser)} />
      </div>
    </div>
  );
}
