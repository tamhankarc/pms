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
  const [clients, movies, purchaseOrders, contactPerson] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.movie.findMany({ where: { isActive: true }, include: { client: { select: { name: true } } }, orderBy: [{ client: { name: "asc" } }, { title: "asc" }] }),
    db.purchaseOrder.findMany({ where: { status: "ACTIVE" }, include: { client: { select: { name: true } } }, orderBy: [{ client: { name: "asc" } }, { poNumber: "asc" }] }),
    db.contactPerson.findUnique({ where: { id }, include: { client: true, movie: true, purchaseOrder: true } }),
  ]);

  if (!contactPerson) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit Contact Person · ${contactPerson.name}`} description="Update Title-specific or PO-specific contact person details." actions={<Link href="/contact-persons" className="btn-secondary">Back to Contact Persons</Link>} />
      <div className="max-w-3xl"><ContactPersonForm clients={clients} movies={movies.map((movie) => ({ id: movie.id, title: movie.title, clientId: movie.clientId, clientName: movie.client.name }))} purchaseOrders={purchaseOrders.map((po) => ({ id: po.id, poNumber: po.poNumber, clientId: po.clientId, clientName: po.client.name }))} action={updateContactPersonAction} title={`Edit Contact Person: ${contactPerson.name}`} submitLabel="Save changes" initialValues={{ id: contactPerson.id, clientId: contactPerson.clientId, movieId: contactPerson.movieId, purchaseOrderId: contactPerson.purchaseOrderId, name: contactPerson.name, email: contactPerson.email, contactNumber: contactPerson.contactNumber }} /></div>
    </div>
  );
}
