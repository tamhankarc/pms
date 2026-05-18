import { canManageMovies, canViewCostData } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { updateMovieAction } from "@/lib/actions/movie-actions";
import { MovieForm } from "@/components/forms/movie-form";

export default async function MovieEditPage({

  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireUser();
  if (!canManageMovies(currentUser)) redirect("/dashboard");

  const { id } = await params;

  const [clients, countries, movie] = await Promise.all([
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
    db.movie.findUnique({
      where: { id },
      include: {
        client: true,
      },
    }),
  ]);

  if (!movie) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit movie · ${movie.title}`}
        description="Update movie details and client association."
        actions={
          <Link href="/movies" className="btn-secondary">
            Back to movies
          </Link>
        }
      />

      <div className="max-w-3xl">
        <MovieForm
          clients={clients}
          countries={countries}
          action={updateMovieAction}
          title={`Edit movie: ${movie.title}`}
          submitLabel="Save changes"
          canEditCosts={canViewCostData(currentUser)}
          initialValues={{
            id: movie.id,
            clientId: movie.clientId,
            title: movie.title,
            description: movie.description,
            status: movie.status,
            isActive: movie.isActive,
            billingDomestic: movie.billingDomestic,
            billingIntl: movie.billingIntl,
            billingOther: movie.billingOther,
            otherCountryIds: movie.otherCountryIds ? JSON.parse(movie.otherCountryIds) : [],
            billingUnits: movie.billingUnitsJson ? JSON.parse(movie.billingUnitsJson) : {},
            sonyTicketingBannerCost: movie.sonyTicketingBannerCost == null ? null : Number(movie.sonyTicketingBannerCost),
            sonyEmailTicketingBannerCost: movie.sonyEmailTicketingBannerCost == null ? null : Number(movie.sonyEmailTicketingBannerCost),
          }}
        />
      </div>
    </div>
  );
}
