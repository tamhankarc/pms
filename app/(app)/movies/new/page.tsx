import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { MovieForm } from "@/components/forms/movie-form";
import { createMovieAction } from "@/lib/actions/movie-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageMovies } from "@/lib/permissions";

export default async function NewMoviePage() {
  const currentUser = await requireUser();
  if (!canManageMovies(currentUser)) redirect("/dashboard");

  const [clients, countries, billingHeads] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.movieBillingHead.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, clientId: true, costType: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Create Movie" description="Add a new movie and configure its billing region, status, and client-specific billing fields." actions={<Link className="btn-secondary" href="/movies">Back to Movies</Link>} />
      <MovieForm clients={clients} countries={countries} billingHeads={billingHeads} action={createMovieAction} title="Create movie" submitLabel="Create movie" />
    </div>
  );
}
