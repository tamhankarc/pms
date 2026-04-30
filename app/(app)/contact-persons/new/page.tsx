import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ContactPersonForm } from "@/components/forms/contact-person-form";
import { createContactPersonAction } from "@/lib/actions/contact-person-actions";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";

export default async function NewContactPersonPage() {
  await requireUserTypes(["ADMIN"]);
  const [clients, projects] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { isActive: true }, include: { client: { select: { name: true } } }, orderBy: [{ client: { name: "asc" } }, { name: "asc" }] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Create Contact Person" description="Create a project-specific contact person." actions={<Link href="/contact-persons" className="btn-secondary">Back to Contact Persons</Link>} />
      <div className="max-w-3xl"><ContactPersonForm clients={clients} projects={projects.map((project) => ({ id: project.id, name: project.name, clientId: project.clientId, clientName: project.client.name }))} action={createContactPersonAction} title="Create Contact Person" submitLabel="Create Contact Person" /></div>
    </div>
  );
}
