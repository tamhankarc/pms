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
    include: {
      projects: {
        include: {
          project: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (!country) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit country · ${country.name}`}
        description="Update country details and active status."
        actions={<Link href="/countries" className="btn-secondary">Back to countries</Link>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="card p-6">
          <h2 className="section-title">Linked projects</h2>
          <div className="mt-5 space-y-2">
            {country.projects.length > 0 ? country.projects.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {row.project.name}{row.project.code ? ` · ${row.project.code}` : ""}
              </div>
            )) : <div className="text-sm text-slate-500">No linked projects.</div>}
          </div>
        </div>

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
