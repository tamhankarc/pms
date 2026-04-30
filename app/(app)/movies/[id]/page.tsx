import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { updateMovieAction } from "@/lib/actions/movie-actions";
import { MovieForm } from "@/components/forms/movie-form";

export default async function MovieEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [clients, countries, billingHeads, movie] = await Promise.all([
    db.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.movieBillingHead.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, clientId: true, costType: true } }),
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
          billingHeads={billingHeads}
          action={updateMovieAction}
          title={`Edit movie: ${movie.title}`}
          submitLabel="Save changes"
          initialValues={{
            id: movie.id,
            clientId: movie.clientId,
            title: movie.title,
            description: movie.description,
            isActive: movie.isActive,
            billingDomestic: movie.billingDomestic,
            billingIntl: movie.billingIntl,
            billingOther: movie.billingOther,
            otherCountryIds: movie.otherCountryIds ? JSON.parse(movie.otherCountryIds) : [],
            billingUnits: movie.billingUnitsJson ? JSON.parse(movie.billingUnitsJson) : {},
          }}
        />
      </div>
    </div>
  );
}
