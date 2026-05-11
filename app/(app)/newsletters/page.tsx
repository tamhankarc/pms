import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageNewsletters } from "@/lib/permissions";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";
import { toggleNewsletterStatusAction } from "@/lib/actions/newsletter-actions";

function formatNewsletterType(value?: string | null) {
  if (!value) return "-";
  return value === "AFFIRM" ? "Affirm" : value;
}

export default async function NewslettersPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string; clientId?: string; page?: string }> }) {
  const user = await requireUser();
  if (!canManageNewsletters(user)) redirect("/dashboard");
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";
  const clientId = params.clientId ?? "all";
  const page = parsePageParam(params.page);
  const [clients, newsletters] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.newsletter.findMany({
      where: {
        ...(q ? { name: { contains: q } } : {}),
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
        ...(clientId !== "all" ? { clientId } : {}),
      },
      include: { client: true, project: { select: { name: true } } },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    }),
  ]);
  const { items, currentPage, totalPages, totalItems, pageSize } = paginateItems(newsletters, page, DEFAULT_PAGE_SIZE);
  return (
    <div>
      <PageHeader title="Newsletters" description="Create and manage client newsletters used in Time Entries, Estimates, and billing reports." actions={<Link href="/newsletters/new" className="btn-primary">Create Newsletter</Link>} />
      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]" method="get">
          <input className="input" name="q" defaultValue={q} placeholder="Search by newsletter name" />
          <SearchableCombobox id="status" name="status" defaultValue={status} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active only" }, { value: "inactive", label: "Inactive only" }]} placeholder="All statuses" searchPlaceholder="Search statuses..." emptyLabel="No status found." />
          <SearchableCombobox id="clientId" name="clientId" defaultValue={clientId} options={[{ value: "all", label: "All clients" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} placeholder="All clients" searchPlaceholder="Search clients..." emptyLabel="No client found." />
          <button className="btn-secondary" type="submit">Apply</button>
        </form>
      </div>
      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head"><tr><th className="table-cell">Newsletter</th><th className="table-cell">Client</th><th className="table-cell">Project</th><th className="table-cell">Type</th><th className="table-cell">Status</th><th className="table-cell">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((newsletter) => (<tr key={newsletter.id}><td className="table-cell font-medium text-slate-900">{newsletter.name}</td><td className="table-cell">{newsletter.client.name}</td><td className="table-cell">{newsletter.project?.name ?? "-"}</td><td className="table-cell">{formatNewsletterType(newsletter.newsletterType)}</td><td className="table-cell"><span className={newsletter.isActive ? "badge-emerald" : "badge-slate"}>{newsletter.isActive ? "Active" : "Inactive"}</span></td><td className="table-cell"><div className="flex gap-2"><Link href={`/newsletters/${newsletter.id}`} className="btn-secondary text-xs">Edit</Link><form action={toggleNewsletterStatusAction}><input type="hidden" name="newsletterId" value={newsletter.id} /><button className="btn-secondary text-xs">{newsletter.isActive ? "Deactivate" : "Activate"}</button></form></div></td></tr>))}
            {newsletters.length === 0 ? (<tr><td colSpan={6} className="table-cell text-center text-sm text-slate-500">No newsletters found.</td></tr>) : null}
          </tbody>
        </table>
        <PaginationControls basePath="/newsletters" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ q, status, clientId }} />
      </div>
    </div>
  );
}
