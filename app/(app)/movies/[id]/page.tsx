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

  const [clients, movie] = await Promise.all([
    db.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
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
          action={updateMovieAction}
          title={`Edit movie: ${movie.title}`}
          submitLabel="Save changes"
          initialValues={{
            id: movie.id,
            clientId: movie.clientId,
            title: movie.title,
            description: movie.description,
            isActive: movie.isActive,
          }}
        />
      </div>
    </div>
  );
}
