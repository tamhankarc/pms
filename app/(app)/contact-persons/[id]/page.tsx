import { canManageContactPersons } from "@/lib/permissions";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ContactPersonForm } from "@/components/forms/contact-person-form";
import { updateContactPersonAction } from "@/lib/actions/contact-person-actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export default async function ContactPersonEditPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireUser();
  if (!canManageContactPersons(currentUser)) redirect("/dashboard");

  const { id } = await params;
  const [clients, projects, movies, contactPerson] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, select: { id: true, name: true, showMoviesInEntries: true }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { isActive: true }, include: { client: { select: { name: true } } }, orderBy: [{ client: { name: "asc" } }, { name: "asc" }] }),
    db.movie.findMany({ where: { isActive: true }, include: { client: { select: { name: true } } }, orderBy: [{ client: { name: "asc" } }, { title: "asc" }] }),
    db.contactPerson.findUnique({ where: { id }, include: { client: true, project: true, movie: true } }),
  ]);

  if (!contactPerson) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit Contact Person · ${contactPerson.name}`} description="Update project-specific or movie-specific contact person details." actions={<Link href="/contact-persons" className="btn-secondary">Back to Contact Persons</Link>} />
      <div className="max-w-3xl"><ContactPersonForm clients={clients} projects={projects.map((project) => ({ id: project.id, name: project.name, clientId: project.clientId, clientName: project.client.name }))} movies={movies.map((movie) => ({ id: movie.id, title: movie.title, clientId: movie.clientId, clientName: movie.client.name }))} action={updateContactPersonAction} title={`Edit Contact Person: ${contactPerson.name}`} submitLabel="Save changes" initialValues={{ id: contactPerson.id, clientId: contactPerson.clientId, projectId: contactPerson.projectId, movieId: contactPerson.movieId, name: contactPerson.name, email: contactPerson.email, contactNumber: contactPerson.contactNumber }} /></div>
    </div>
  );
}
