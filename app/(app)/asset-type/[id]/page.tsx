import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { updateAssetTypeAction } from "@/lib/actions/asset-type-actions";
import { AssetTypeForm } from "@/components/forms/asset-type-form";

export default async function AssetTypeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clients, assetType] = await Promise.all([db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }), db.assetType.findUnique({ where: { id }, include: { client: true } })]);
  if (!assetType) notFound();
  return <div className="space-y-6"><PageHeader title={`Edit Asset Type · ${assetType.name}`} description="Update asset type details, cost, and client association." actions={<Link href="/asset-type" className="btn-secondary">Back to Asset Types</Link>} /><div className="max-w-3xl"><AssetTypeForm clients={clients} action={updateAssetTypeAction} title={`Edit Asset Type: ${assetType.name}`} submitLabel="Save changes" initialValues={{ id: assetType.id, clientId: assetType.clientId, name: assetType.name, description: assetType.description, cost: assetType.cost.toString(), isActive: assetType.isActive }} /></div></div>;
}
