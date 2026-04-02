import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CountryForm } from "@/components/forms/country-form";
import { PageHeader } from "@/components/ui/page-header";
import { updateCountryAction } from "@/lib/actions/country-actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageCountries } from "@/lib/permissions";

export default async function CountryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canManageCountries(user)) redirect("/dashboard");

  const { id } = await params;
  const country = await db.country.findUnique({
    where: { id },
  });

  if (!country) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit country · ${country.name}`}
        description="Update country details and active status."
        actions={
          <Link href="/countries" className="btn-secondary">
            Back to countries
          </Link>
        }
      />

      <div className="max-w-3xl">
        <CountryForm
          mode="edit"
          action={updateCountryAction}
          initialValues={{
            id: country.id,
            name: country.name,
            isoCode: country.isoCode,
            isActive: country.isActive,
          }}
        />
      </div>
    </div>
  );
}