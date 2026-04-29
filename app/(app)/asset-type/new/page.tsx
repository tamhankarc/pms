import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { createAssetTypeAction } from "@/lib/actions/asset-type-actions";
import { AssetTypeForm } from "@/components/forms/asset-type-form";

export default async function NewAssetTypePage() {
  const clients = await db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return <div className="space-y-6"><PageHeader title="Create Asset Type" description="Create a client-specific asset type for Time Entries and Estimates." actions={<Link href="/asset-type" className="btn-secondary">Back to Asset Types</Link>} /><div className="max-w-3xl"><AssetTypeForm clients={clients} action={createAssetTypeAction} title="Create Asset Type" submitLabel="Create Asset Type" /></div></div>;
}
