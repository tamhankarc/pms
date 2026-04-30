import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";
import { MovieBillingHeadForm } from "@/components/forms/movie-billing-head-form";
import { updateMovieBillingHeadAction } from "@/lib/actions/movie-billing-head-actions";

export default async function EditMovieBillingHeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUserTypes(["ADMIN"]);
  const { id } = await params;
  const [head, clients] = await Promise.all([
    db.movieBillingHead.findUnique({ where: { id } }),
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!head) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Edit Billing Head · ${head.name}`} description="Update client-specific movie billing head details." actions={<Link href="/movie-billing-heads" className="btn-secondary">Back to Billing Heads</Link>} />
      <MovieBillingHeadForm
        clients={clients}
        action={updateMovieBillingHeadAction}
        title="Edit billing head"
        submitLabel="Save changes"
        initialValues={{
          id: head.id,
          clientId: head.clientId,
          name: head.name,
          compulsionType: head.compulsionType,
          domesticCompulsionType: head.domesticCompulsionType ?? head.compulsionType,
          intlCompulsionType: head.intlCompulsionType ?? head.compulsionType,
          domesticActive: head.domesticActive,
          intlActive: head.intlActive,
          costType: head.costType,
          domesticCost: Number(head.domesticCost).toFixed(2),
          intlCost: Number(head.intlCost).toFixed(2),
          isActive: head.isActive,
        }}
      />
    </div>
  );
}
