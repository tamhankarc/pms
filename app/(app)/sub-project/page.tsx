import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { db } from "@/lib/db";
import { toggleSubProjectStatusAction } from "@/lib/actions/sub-project-actions";

export default async function SubProjectPage({
  searchParams,
}: {
  searchParams?: Promise<{ clientId?: string; projectId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const selectedClientId = params.clientId ?? "";
  const selectedProjectId = params.projectId ?? "";

  const [projects, subProjects] = await Promise.all([
    db.project.findMany({
      where: {
        isActive: true,
        ...(selectedClientId ? { clientId: selectedClientId } : {}),
      },
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
        <form method="get" className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <select className="input" name="clientId" defaultValue={selectedClientId}>
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>

          <SearchableCombobox
            id="projectId"
            name="projectId"
            defaultValue={selectedProjectId}
            options={[
              { value: "", label: "All projects" },
              ...projects.map((project) => ({
                value: project.id,
                label: `${project.name} · ${project.client.name}`,
                keywords: `${project.name} ${project.client.name}`,
              })),
            ]}
            placeholder="All projects"
            searchPlaceholder="Search projects..."
            emptyLabel="No projects found."
          />

          <button className="btn-secondary" type="submit">
            Apply
          </button>
          <Link href="/sub-project" className="btn-secondary">
            Reset
          </Link>
        </form>
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
            {subProjects.map((subProject) => (
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
      </div>
    </div>
  );
}
