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
        projects: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (!movie) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit movie · ${movie.title}`}
        description="Update movie details and client association."
        actions={<Link href="/movies" className="btn-secondary">Back to movies</Link>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="card p-6">
          <h2 className="section-title">Linked projects</h2>
          <div className="mt-4 space-y-2">
            {movie.projects.length > 0 ? movie.projects.map((project) => (
              <div key={project.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {project.name}
              </div>
            )) : <div className="text-sm text-slate-500">No linked projects.</div>}
          </div>
        </div>

        <MovieForm
          clients={clients}
          action={updateMovieAction}
          title={`Edit movie: ${movie.title}`}
          submitLabel="Save changes"
          initialValues={{
            clientId: movie.clientId,
            title: movie.title,
            code: movie.code,
            description: movie.description,
            isActive: movie.isActive,
          }}
        />
      </div>
    </div>
  );
}
