import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { requireUser } from "@/lib/auth";
import { getVisibleProjects } from "@/lib/queries";
import { canCreateProjects } from "@/lib/permissions";
import { toggleProjectStatusAction } from "@/lib/actions/project-actions";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; billingModel?: string; clientId?: string }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const q = params.q?.trim().toLowerCase() ?? "";
  const status = params.status ?? "all";
  const billingModel = params.billingModel ?? "all";
  const clientId = params.clientId ?? "all";

  const allProjects = await getVisibleProjects(user);
  const clientOptions = Array.from(
    new Map(allProjects.map((project) => [project.client.id, { id: project.client.id, name: project.client.name }])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const projects = allProjects.filter((project) => {
    const assignedPeople = Array.from(
      new Map<string, string>([
        ...project.assignedUsers.map((row) => [row.user.id, row.user.fullName] as const),
        ...project.subProjects.flatMap((subProject) =>
          subProject.assignments.map((row) => [row.user.id, row.user.fullName] as const),
        ),
      ]).values(),
    );

    const matchesQ =
      !q ||
      project.name.toLowerCase().includes(q) ||
      (project.code ?? "").toLowerCase().includes(q) ||
      project.client.name.toLowerCase().includes(q) ||
      assignedPeople.some((name) => name.toLowerCase().includes(q));

    const matchesStatus = status === "all" ? true : project.status === status;
    const matchesBilling = billingModel === "all" ? true : project.billingModel === billingModel;
    const matchesClient = clientId === "all" ? true : project.clientId === clientId;

    return matchesQ && matchesStatus && matchesBilling && matchesClient;
  });

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Project records hold billing model, client, commercial tracking, and assigned people across project and sub-project levels."
        actions={
          canCreateProjects(user) ? (
            <Link className="btn-primary" href="/projects/new">
              Create project
            </Link>
          ) : null
        }
      />

      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_220px_auto]" method="get">
          <input
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Search by project, client, or assigned person"
          />
          <SearchableCombobox id="status" name="status" defaultValue={status} options={[{ value: "all", label: "All statuses" },{ value: "DRAFT", label: "Draft" },{ value: "ACTIVE", label: "Active" },{ value: "ON_HOLD", label: "On Hold" },{ value: "COMPLETED", label: "Completed" },{ value: "ARCHIVED", label: "Archived" }]} placeholder="All statuses" searchPlaceholder="Search statuses..." emptyLabel="No statuses found." />
          <SearchableCombobox id="billingModel" name="billingModel" defaultValue={billingModel} options={[{ value: "all", label: "All billing models" },{ value: "HOURLY", label: "Hourly" },{ value: "FIXED_FULL", label: "Fixed - Full Project" },{ value: "FIXED_MONTHLY", label: "Fixed - Monthly" }]} placeholder="All billing models" searchPlaceholder="Search billing models..." emptyLabel="No billing models found." />
          <SearchableCombobox id="clientId" name="clientId" defaultValue={clientId} options={[{ value: "all", label: "All clients" }, ...clientOptions.map((client) => ({ value: client.id, label: client.name }))]} placeholder="All clients" searchPlaceholder="Search clients..." emptyLabel="No clients found." />
          <button className="btn-secondary" type="submit">
            Apply
          </button>
        </form>
      </div>

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Project</th>
              <th className="table-cell">Client</th>
              <th className="table-cell">Assigned People</th>
              <th className="table-cell">Billing</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => {
              const assignedPeople = Array.from(
                new Map<string, string>([
                  ...project.assignedUsers.map((row) => [row.user.id, row.user.fullName] as const),
                  ...project.subProjects.flatMap((subProject) =>
                    subProject.assignments.map((row) => [row.user.id, row.user.fullName] as const),
                  ),
                ]).values(),
              );

              return (
                <tr key={project.id}>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">{project.name}</div>
                  </td>
                  <td className="table-cell">{project.client.name}</td>
                  <td className="table-cell">
                    {assignedPeople.length > 0 ? (
                      <div className="text-sm text-slate-700">{assignedPeople.join(", ")}</div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="table-cell">{project.billingModel.replaceAll("_", " ")}</td>
                  <td className="table-cell">
                    <span className="badge-blue">{project.status.replaceAll("_", " ")}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <Link className="btn-secondary text-xs" href={`/projects/${project.id}`}>
                        View
                      </Link>
                      {canCreateProjects(user) ? (
                        <>
                          <Link className="btn-secondary text-xs" href={`/projects/${project.id}/edit`}>
                            Edit
                          </Link>
                          <form action={toggleProjectStatusAction}>
                            <input type="hidden" name="projectId" value={project.id} />
                            <button className="btn-secondary text-xs">
                              {project.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}

            {projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-cell text-center text-sm text-slate-500">
                  No projects found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
