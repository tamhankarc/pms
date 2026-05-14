import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { AssetNameForm } from "@/components/forms/asset-name-form";
import { createAssetNameAction } from "@/lib/actions/asset-name-actions";
import { requireUser } from "@/lib/auth";
import { canManageAssetNames } from "@/lib/permissions";
import { db } from "@/lib/db";

const UNIVERSAL_PICTURES_CLIENT_ID = "cmnh2xr1s0004l204ia5u5zj3";

export default async function NewAssetNamePage() {
  const user = await requireUser();
  if (!canManageAssetNames(user)) redirect("/dashboard");
  const movies = await db.movie.findMany({
    where: { clientId: UNIVERSAL_PICTURES_CLIENT_ID, isActive: true },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
  return <div className="space-y-6"><PageHeader title="Create Asset Name" description="Create a Universal Pictures International asset name and connect it to one movie." actions={<Link href="/asset-names" className="btn-secondary">Back to Asset Names</Link>} /><div className="max-w-3xl"><AssetNameForm action={createAssetNameAction} title="Create Asset Name" submitLabel="Create Asset Name" movies={movies} /></div></div>;
}
