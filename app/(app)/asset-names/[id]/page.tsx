import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { AssetNameForm } from "@/components/forms/asset-name-form";
import { updateAssetNameAction } from "@/lib/actions/asset-name-actions";
import { requireUser } from "@/lib/auth";
import { canManageAssetNames } from "@/lib/permissions";
import { db } from "@/lib/db";

const UNIVERSAL_PICTURES_CLIENT_ID = "cmnh2xr1s0004l204ia5u5zj3";

export default async function EditAssetNamePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManageAssetNames(user)) redirect("/dashboard");
  const { id } = await params;
  const assetName = await db.assetName.findFirst({ where: { id, clientId: UNIVERSAL_PICTURES_CLIENT_ID } });
  if (!assetName) notFound();
  return <div className="space-y-6"><PageHeader title={`Edit Asset Name · ${assetName.name}`} description="Update Universal Pictures International asset name details." actions={<Link href="/asset-names" className="btn-secondary">Back to Asset Names</Link>} /><div className="max-w-3xl"><AssetNameForm action={updateAssetNameAction} title={`Edit Asset Name: ${assetName.name}`} submitLabel="Save changes" initialValues={{ id: assetName.id, name: assetName.name, isActive: assetName.isActive }} /></div></div>;
}
