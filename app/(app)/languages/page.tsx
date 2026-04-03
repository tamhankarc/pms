import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { LanguageForm } from "@/components/forms/language-form";
import { createLanguageAction, toggleLanguageStatusAction } from "@/lib/actions/language-actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageLanguages } from "@/lib/permissions";

export default async function LanguagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireUser();
  if (!canManageLanguages(user)) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";

  const languages = await db.language.findMany({
    where: {
      ...(q
        ? {
            OR: [{ name: { contains: q } }, { code: { contains: q.toUpperCase() } }],
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
        title="Languages"
        description="Create and maintain language masters used in time entries and estimates."
      />

      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]" method="get">
          <input className="input" name="q" defaultValue={q} placeholder="Search by language name or code" />
          <SearchableCombobox
            id="status"
            name="status"
            defaultValue={status}
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active only" },
              { value: "inactive", label: "Inactive only" },
            ]}
            placeholder="All statuses"
            searchPlaceholder="Search statuses..."
            emptyLabel="No status found."
          />
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
                <th className="table-cell">Language</th>
                <th className="table-cell">Code</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {languages.map((language) => (
                <tr key={language.id}>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">{language.name}</div>
                  </td>
                  <td className="table-cell">{language.code}</td>
                  <td className="table-cell">
                    <span className={language.isActive ? "badge-emerald" : "badge-slate"}>
                      {language.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <Link className="btn-secondary text-xs" href={`/languages/${language.id}`}>
                        Edit
                      </Link>
                      <form action={toggleLanguageStatusAction}>
                        <input type="hidden" name="languageId" value={language.id} />
                        <button className="btn-secondary text-xs">
                          {language.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {languages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-cell text-center text-sm text-slate-500">
                    No languages found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <LanguageForm mode="create" action={createLanguageAction} />
      </div>
    </div>
  );
}
