import { canManageContactPersons } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ContactPersonForm } from "@/components/forms/contact-person-form";
import { createContactPersonAction } from "@/lib/actions/contact-person-actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export default async function NewContactPersonPage() {
  const currentUser = await requireUser();
  if (!canManageContactPersons(currentUser)) redirect("/dashboard");

  const [clients, countries] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Contact Person"
        description="Create a client contact person."
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
          action={createContactPersonAction}
          title="Create Contact Person"
          submitLabel="Create Contact Person"
        />
      </div>
    </div>
  );
}
