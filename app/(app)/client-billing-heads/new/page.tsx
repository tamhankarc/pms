import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";
import { MovieBillingHeadForm } from "@/components/forms/movie-billing-head-form";
import { createMovieBillingHeadAction } from "@/lib/actions/movie-billing-head-actions";

export default async function NewMovieBillingHeadPage() {
  await requireUserTypes(["ADMIN"]);
  const clients = await db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <div className="mx-auto max-w-3xl space-y-6"><PageHeader title="Create Billing Head" description="Create a client-specific billing head." actions={<Link href="/client-billing-heads" className="btn-secondary">Back to Billing Heads</Link>} /><MovieBillingHeadForm clients={clients} action={createMovieBillingHeadAction} title="Create billing head" submitLabel="Create billing head" /></div>;
}
