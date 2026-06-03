import { canManageMovieBillingHeads, canViewCostData } from "@/lib/permissions";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MovieBillingHeadAssignmentForm } from "@/components/forms/movie-billing-head-assignment-form";
import { updateMovieBillingHeadAssignmentAction } from "@/lib/actions/movie-billing-head-assignment-actions";

export default async function EditMovieBillingHeadPage({
 params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireUser();
  if (!canManageMovieBillingHeads(currentUser)) redirect("/dashboard");

  const { id } = await params;
  const [row, clients, countries, movies, billingHeads] = await Promise.all([
    db.movieBillingHeadAssignment.findUnique({ where: { id }, include: { movie: true, billingHead: true } }),
    db.client.findMany({ where: { isActive: true, movieBillingHeads: { some: { isActive: true, OR: [{ domesticActive: true, domesticCompulsionType: "FIXED_OPTIONAL" }, { intlActive: true, intlCompulsionType: "FIXED_OPTIONAL" }, { otherActive: true, otherCompulsionType: "FIXED_OPTIONAL" }] } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, isoCode: true } }),
    db.movie.findMany({ where: { isActive: true, status: "WORKING" }, orderBy: { title: "asc" }, select: { id: true, clientId: true, title: true, billingDomestic: true, billingIntl: true, billingOther: true } }),
    db.movieBillingHead.findMany({
      where: { isActive: true, OR: [{ domesticActive: true, domesticCompulsionType: "FIXED_OPTIONAL" }, { intlActive: true, intlCompulsionType: "FIXED_OPTIONAL" }, { otherActive: true, otherCompulsionType: "FIXED_OPTIONAL" }] },
      orderBy: { name: "asc" },
      select: { id: true, clientId: true, name: true, costType: true, domesticActive: true, intlActive: true, otherActive: true, domesticCompulsionType: true, intlCompulsionType: true, otherCompulsionType: true },
    }),
  ]);
  if (!row) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Edit Title Billing Head · ${row.billingHead.name}`} description="Update the Fixed - Optional billing head selected for this client movie." actions={<Link href="/movie-billing-heads" className="btn-secondary">Back to Title Billing Heads</Link>} />
      {row.movie.status === "COMPLETED_BILLED" ? (
        <div className="card p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            This movie billing head belongs to the billed title <strong>{row.movie.title}</strong>. It is viewable but cannot be edited.
          </div>
          <dl className="mt-5 grid gap-4 md:grid-cols-2">
            <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Title</dt><dd className="mt-1 text-sm text-slate-900">{row.movie.title}</dd></div>
            <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Billing Head</dt><dd className="mt-1 text-sm text-slate-900">{row.billingHead.name}</dd></div>
            <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Units</dt><dd className="mt-1 text-sm text-slate-900">{row.units ? Number(row.units).toString() : "-"}</dd></div>
            <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt><dd className="mt-1 text-sm text-slate-900">{row.isActive ? "Active" : "Inactive"}</dd></div>
          </dl>
        </div>
      ) : (
      <MovieBillingHeadAssignmentForm
        clients={clients}
        countries={countries}
        movies={movies}
        billingHeads={billingHeads}
        action={updateMovieBillingHeadAssignmentAction}
        title="Edit movie billing head"
        submitLabel="Save changes"
        canEditCosts={canViewCostData(currentUser)}
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
      )}
    </div>
  );
}
