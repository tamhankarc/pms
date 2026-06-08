import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { MovieForm } from "@/components/forms/movie-form";
import { createMovieAction } from "@/lib/actions/movie-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageMovies, canViewCostData } from "@/lib/permissions";

export default async function NewTitlePage() {
  const currentUser = await requireUser();
  if (!canManageMovies(currentUser)) redirect("/dashboard");

  const [clients, countries, contactPersons] = await Promise.all([
    db.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        showCountriesInTimeEntries: true,
        showMoviesInEntries: true,
        showAssetTypesInEntries: true,
        showAssetNamesInEntries: true,
        showLanguagesInEntries: true,
        showNewslettersInEntries: true,
      },
    }),
    db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.contactPerson.findMany({ where: { client: { isActive: true } }, orderBy: [{ client: { name: "asc" } }, { name: "asc" }], select: { id: true, clientId: true, name: true, email: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Create Title" description="Add a new title and configure its billing region, status, and client-specific billing fields." actions={<Link className="btn-secondary" href="/movies">Back to Titles</Link>} />
      <MovieForm clients={clients} countries={countries} contactPersons={contactPersons} action={createMovieAction} title="Create title" submitLabel="Create title" canEditCosts={canViewCostData(currentUser)} />
    </div>
  );
}
