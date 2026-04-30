import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";
import { MovieBillingHeadAssignmentForm } from "@/components/forms/movie-billing-head-assignment-form";
import { updateMovieBillingHeadAssignmentAction } from "@/lib/actions/movie-billing-head-assignment-actions";

export default async function EditMovieBillingHeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUserTypes(["ADMIN"]);
  const { id } = await params;
  const [row, clients, countries, movies, billingHeads] = await Promise.all([
    db.movieBillingHeadAssignment.findUnique({ where: { id }, include: { movie: true, billingHead: true } }),
    db.client.findMany({ where: { isActive: true, movieBillingHeads: { some: { isActive: true, OR: [{ domesticActive: true, domesticCompulsionType: "FIXED_OPTIONAL" }, { intlActive: true, intlCompulsionType: "FIXED_OPTIONAL" }] } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, isoCode: true } }),
    db.movie.findMany({ where: { isActive: true, status: "WORKING" }, orderBy: { title: "asc" }, select: { id: true, clientId: true, title: true } }),
    db.movieBillingHead.findMany({
      where: { isActive: true, OR: [{ domesticActive: true, domesticCompulsionType: "FIXED_OPTIONAL" }, { intlActive: true, intlCompulsionType: "FIXED_OPTIONAL" }] },
      orderBy: { name: "asc" },
      select: { id: true, clientId: true, name: true, costType: true, domesticActive: true, intlActive: true, domesticCompulsionType: true, intlCompulsionType: true },
    }),
  ]);
  if (!row) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Edit Movie Billing Head · ${row.billingHead.name}`} description="Update the Fixed - Optional billing head selected for this client movie." actions={<Link href="/movie-billing-heads" className="btn-secondary">Back to Movie Billing Heads</Link>} />
      <MovieBillingHeadAssignmentForm
        clients={clients}
        countries={countries}
        movies={movies}
        billingHeads={billingHeads}
        action={updateMovieBillingHeadAssignmentAction}
        title="Edit movie billing head"
        submitLabel="Save changes"
        initialValues={{
          id: row.id,
          clientId: row.clientId,
          countryId: row.countryId,
          movieId: row.movieId,
          billingHeadId: row.billingHeadId,
          units: row.units ? Number(row.units).toString() : "",
          isActive: row.isActive,
        }}
      />
    </div>
  );
}
