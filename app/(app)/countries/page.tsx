import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { CountryForm } from "@/components/forms/country-form";
import { createCountryAction, toggleCountryStatusAction } from "@/lib/actions/country-actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageCountries } from "@/lib/permissions";

export default async function CountriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireUser();
  if (!canManageCountries(user)) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";

  const countries = await db.country.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { isoCode: { contains: q.toUpperCase() } },
            ],
          }
        : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Countries"
        description="Create and maintain country masters used in time entries and filtering. Only Admins and Project Managers can access this area."
      />

      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]" method="get">
          <input
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Search by country name or ISO code"
          />
          <select className="input" name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <button className="btn-secondary" type="submit">
            Apply
          </button>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="table-wrap">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Country</th>
                <th className="table-cell">ISO code</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {countries.map((country) => (
                <tr key={country.id}>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">{country.name}</div>
                  </td>
                  <td className="table-cell">{country.isoCode || "—"}</td>
                  <td className="table-cell">
                    <span className={country.isActive ? "badge-emerald" : "badge-slate"}>
                      {country.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <Link className="btn-secondary text-xs" href={`/countries/${country.id}`}>
                        Edit
                      </Link>
                      <form action={toggleCountryStatusAction}>
                        <input type="hidden" name="countryId" value={country.id} />
                        <button className="btn-secondary text-xs">
                          {country.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {countries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-cell text-center text-sm text-slate-500">
                    No countries found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <CountryForm mode="create" action={createCountryAction} />
      </div>
    </div>
  );
}