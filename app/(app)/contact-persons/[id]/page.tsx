import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ContactPersonForm } from "@/components/forms/contact-person-form";
import { updateContactPersonAction } from "@/lib/actions/contact-person-actions";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";

export default async function ContactPersonEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUserTypes(["ADMIN"]);
  const { id } = await params;
  const [clients, projects, contactPerson] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { isActive: true }, include: { client: { select: { name: true } } }, orderBy: [{ client: { name: "asc" } }, { name: "asc" }] }),
    db.contactPerson.findUnique({ where: { id }, include: { client: true, project: true } }),
  ]);

  if (!contactPerson) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit Contact Person · ${contactPerson.name}`} description="Update project-specific contact person details." actions={<Link href="/contact-persons" className="btn-secondary">Back to Contact Persons</Link>} />
      <div className="max-w-3xl"><ContactPersonForm clients={clients} projects={projects.map((project) => ({ id: project.id, name: project.name, clientId: project.clientId, clientName: project.client.name }))} action={updateContactPersonAction} title={`Edit Contact Person: ${contactPerson.name}`} submitLabel="Save changes" initialValues={{ id: contactPerson.id, clientId: contactPerson.clientId, projectId: contactPerson.projectId, name: contactPerson.name, email: contactPerson.email, contactNumber: contactPerson.contactNumber }} /></div>
    </div>
  );
}
