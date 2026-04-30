import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";
import { MovieBillingHeadAssignmentForm } from "@/components/forms/movie-billing-head-assignment-form";
import { createMovieBillingHeadAssignmentAction } from "@/lib/actions/movie-billing-head-assignment-actions";

export default async function NewMovieBillingHeadPage() {
  await requireUserTypes(["ADMIN"]);
  const [clients, countries, movies, billingHeads] = await Promise.all([
    db.client.findMany({ where: { isActive: true, movieBillingHeads: { some: { isActive: true, OR: [{ domesticActive: true, domesticCompulsionType: "FIXED_OPTIONAL" }, { intlActive: true, intlCompulsionType: "FIXED_OPTIONAL" }] } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, isoCode: true } }),
    db.movie.findMany({ where: { isActive: true, status: "WORKING" }, orderBy: { title: "asc" }, select: { id: true, clientId: true, title: true } }),
    db.movieBillingHead.findMany({
      where: { isActive: true, OR: [{ domesticActive: true, domesticCompulsionType: "FIXED_OPTIONAL" }, { intlActive: true, intlCompulsionType: "FIXED_OPTIONAL" }] },
      orderBy: { name: "asc" },
      select: { id: true, clientId: true, name: true, costType: true, domesticActive: true, intlActive: true, domesticCompulsionType: true, intlCompulsionType: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Create Movie Billing Head" description="Assign a Fixed - Optional billing head to a Working movie for the selected country." actions={<Link href="/movie-billing-heads" className="btn-secondary">Back to Movie Billing Heads</Link>} />
      <MovieBillingHeadAssignmentForm clients={clients} countries={countries} movies={movies} billingHeads={billingHeads} action={createMovieBillingHeadAssignmentAction} title="Create movie billing head" submitLabel="Create movie billing head" />
    </div>
  );
}
