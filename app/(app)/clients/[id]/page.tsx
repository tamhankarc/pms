import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/forms/client-form";
import { PageHeader } from "@/components/ui/page-header";
import { updateClientAction } from "@/lib/actions/client-actions";
import { db } from "@/lib/db";

export default async function ClientEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    include: {
      projects: { select: { id: true, name: true } },
      movies: { select: { id: true, title: true } },
    },
  });
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit client · ${client.name}`}
        description="Update client details and active status."
        actions={<Link href="/clients" className="btn-secondary">Back to clients</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="card p-6">
          <h2 className="section-title">Linked records</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Projects</div>
              <div className="mt-2 space-y-2">
                {client.projects.length > 0 ? client.projects.map((project) => (
                  <div key={project.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {project.name}
                  </div>
                )) : <div className="text-sm text-slate-500">No linked projects.</div>}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Movies</div>
              <div className="mt-2 space-y-2">
                {client.movies.length > 0 ? client.movies.map((movie) => (
                  <div key={movie.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {movie.title}
                  </div>
                )) : <div className="text-sm text-slate-500">No linked movies.</div>}
              </div>
            </div>
          </div>
        </div>
        <ClientForm
          mode="edit"
          action={updateClientAction}
          initialValues={{
            id: client.id,
            name: client.name,
            code: client.code,
            isActive: client.isActive,
          }}
        />
      </div>
    </div>
  );
}
