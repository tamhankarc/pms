import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SubProjectListFilters } from "@/components/forms/sub-project-list-filters";
import { db } from "@/lib/db";
import { toggleSubProjectStatusAction } from "@/lib/actions/sub-project-actions";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

export default async function SubProjectPage({
  searchParams,
}: {
  searchParams?: Promise<{ clientId?: string; projectId?: string; page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const selectedClientId = params.clientId ?? "";
  const selectedProjectId = params.projectId ?? "";
  const page = parsePageParam(params.page);

  const [projects, subProjects] = await Promise.all([
    db.project.findMany({
      where: { isActive: true },
      include: { client: true },
      orderBy: [{ name: "asc" }],
    }),
    db.subProject.findMany({
      where: {
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        ...(selectedClientId ? { project: { clientId: selectedClientId } } : {}),
      },
      include: {
        project: { include: { client: true } },
        assignments: { include: { user: true } },
      },
      orderBy: [{ project: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  const clients = await db.client.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const { items: paginatedSubProjects, currentPage, totalPages, totalItems, pageSize } = paginateItems(subProjects, page, DEFAULT_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sub Projects"
        description="Create and maintain Sub Projects under a project. User assignment is managed separately."
        actions={
          <Link className="btn-primary" href="/sub-project/new">
            Create Sub Project
          </Link>
        }
      />

      <div className="card p-4">
        <SubProjectListFilters
          selectedClientId={selectedClientId}
          selectedProjectId={selectedProjectId}
          clients={clients}
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
            clientName: project.client.name,
          }))}
        />
      </div>

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Sub Project</th>
              <th className="table-cell">Client</th>
              <th className="table-cell">Project</th>
              <th className="table-cell">Assigned People</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedSubProjects.map((subProject) => (
              <tr key={subProject.id}>
                <td className="table-cell">
                  <div className="font-medium text-slate-900">{subProject.name}</div>
                </td>
                <td className="table-cell">{subProject.project.client.name}</td>
                <td className="table-cell">{subProject.project.name}</td>
                <td className="table-cell">
                  {subProject.assignments.map((row) => row.user.fullName).join(", ") || "—"}
                </td>
                <td className="table-cell">
                  <span className={subProject.isActive ? "badge-emerald" : "badge-slate"}>
                    {subProject.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="table-cell">
                  <div className="flex gap-2">
                    <Link className="btn-secondary text-xs" href={`/sub-project/${subProject.id}`}>
                      Edit
                    </Link>
                    <form action={toggleSubProjectStatusAction}>
                      <input type="hidden" name="subProjectId" value={subProject.id} />
                      <button className="btn-secondary text-xs">
                        {subProject.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {subProjects.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-cell text-center text-sm text-slate-500">
                  No Sub Projects found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <PaginationControls basePath="/sub-project" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ clientId: selectedClientId || undefined, projectId: selectedProjectId || undefined }} />
      </div>
    </div>
  );
}
