import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

export default async function ContactPersonsPage({ searchParams }: { searchParams?: Promise<{ q?: string; clientId?: string; projectId?: string; page?: string }>; }) {
  await requireUserTypes(["ADMIN"]);
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const clientId = params.clientId ?? "all";
  const projectId = params.projectId ?? "all";
  const page = parsePageParam(params.page);

  const [clients, projects, contactPersons] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { isActive: true }, include: { client: { select: { name: true } } }, orderBy: [{ client: { name: "asc" } }, { name: "asc" }] }),
    db.contactPerson.findMany({
      where: {
        ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { contactNumber: { contains: q } }] } : {}),
        ...(clientId !== "all" ? { clientId } : {}),
        ...(projectId !== "all" ? { projectId } : {}),
      },
      include: { client: true, project: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const projectOptions = projects
    .filter((project) => clientId === "all" || project.clientId === clientId)
    .map((project) => ({ value: project.id, label: project.name, keywords: project.client.name }));
  const { items: paginatedContactPersons, currentPage, totalPages, totalItems, pageSize } = paginateItems(contactPersons, page, DEFAULT_PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Contact Persons" description="Create and maintain project-specific contact persons." actions={<Link href="/contact-persons/new" className="btn-primary">Create Contact Person</Link>} />

      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto]" method="get">
          <input className="input" name="q" defaultValue={q} placeholder="Search by name, email, or contact number" />
          <SearchableCombobox id="clientId" name="clientId" defaultValue={clientId} options={[{ value: "all", label: "All clients" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} placeholder="All clients" searchPlaceholder="Search clients..." emptyLabel="No client found." />
          <SearchableCombobox id="projectId" name="projectId" defaultValue={projectId} options={[{ value: "all", label: "All projects" }, ...projectOptions]} placeholder="All projects" searchPlaceholder="Search projects..." emptyLabel="No project found." />
          <button className="btn-secondary" type="submit">Apply</button>
        </form>
      </div>

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head"><tr><th className="table-cell">Name</th><th className="table-cell">Email</th><th className="table-cell">Contact Number</th><th className="table-cell">Client</th><th className="table-cell">Project</th><th className="table-cell">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedContactPersons.map((person) => (
              <tr key={person.id}>
                <td className="table-cell"><div className="font-medium text-slate-900">{person.name}</div></td>
                <td className="table-cell">{person.email}</td>
                <td className="table-cell">{person.contactNumber || "—"}</td>
                <td className="table-cell">{person.client.name}</td>
                <td className="table-cell">{person.project.name}</td>
                <td className="table-cell"><Link href={`/contact-persons/${person.id}`} className="btn-secondary text-xs">Edit</Link></td>
              </tr>
            ))}
            {contactPersons.length === 0 ? (<tr><td colSpan={6} className="table-cell text-center text-sm text-slate-500">No contact persons found.</td></tr>) : null}
          </tbody>
        </table>
        <PaginationControls basePath="/contact-persons" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ q, clientId, projectId }} />
      </div>
    </div>
  );
}
