import { canManageContactPersons } from "@/lib/permissions";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ContactPersonForm } from "@/components/forms/contact-person-form";
import { updateContactPersonAction } from "@/lib/actions/contact-person-actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export default async function ContactPersonEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireUser();
  if (!canManageContactPersons(currentUser)) redirect("/dashboard");

  const { id } = await params;
  const [clients, countries, contactPerson] = await Promise.all([
    db.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.country.findMany({
      where: { isActive: true },
      select: { id: true, name: true, isoCode: true },
      orderBy: { name: "asc" },
    }),
    db.contactPerson.findUnique({ where: { id }, include: { client: true } }),
  ]);

  if (!contactPerson) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit Contact Person · ${contactPerson.name}`}
        description="Update client contact person details."
        actions={
          <Link href="/contact-persons" className="btn-secondary">
            Back to Contact Persons
          </Link>
        }
      />
      <div className="max-w-3xl">
        <ContactPersonForm
          clients={clients}
          countries={countries}
          action={updateContactPersonAction}
          title={`Edit Contact Person: ${contactPerson.name}`}
          submitLabel="Save changes"
          initialValues={{
            id: contactPerson.id,
            clientId: contactPerson.clientId,
            name: contactPerson.name,
            email: contactPerson.email,
            contactNumber: contactPerson.contactNumber,
            countryId: contactPerson.countryId,
          }}
        />
      </div>
    </div>
  );
}
