import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjects } from "@/lib/queries";
import { canCreateProjects } from "@/lib/permissions";
import { toggleProjectStatusAction } from "@/lib/actions/project-actions";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

type ProjectListKind = "standard" | "fixedFull";

function assignedPeopleForProject(project: Awaited<ReturnType<typeof getVisibleProjects>>[number]) {
  return Array.from(new Map<string, string>([
    ...project.assignedUsers.map((row) => [row.user.id, row.user.fullName] as const),
    ...project.subProjects.flatMap((subProject) => subProject.assignments.map((row) => [row.user.id, row.user.fullName] as const)),
  ]).values());
}

function filterProjects(projects: Awaited<ReturnType<typeof getVisibleProjects>>, filters: { q: string; status: string; billingModel: string; clientId: string }, kind: ProjectListKind) {
  const q = filters.q.trim().toLowerCase();
  return projects.filter((project) => {
    if (kind === "fixedFull" && project.billingModel !== "FIXED_FULL") return false;
    if (kind === "standard" && project.billingModel === "FIXED_FULL") return false;
    const assignedPeople = assignedPeopleForProject(project);
    const matchesQ = !q || project.name.toLowerCase().includes(q) || (project.code ?? "").toLowerCase().includes(q) || project.client.name.toLowerCase().includes(q) || assignedPeople.some((name) => name.toLowerCase().includes(q));
    const matchesStatus = filters.status === "all" ? true : project.status === filters.status;
    const matchesBilling = filters.billingModel === "all" ? true : project.billingModel === filters.billingModel;
    const matchesClient = filters.clientId === "all" ? true : project.clientId === filters.clientId;
    return matchesQ && matchesStatus && matchesBilling && matchesClient;
  });
}

function projectTableRows(projects: Awaited<ReturnType<typeof getVisibleProjects>>, user: Awaited<ReturnType<typeof requireUser>>, estimateCounts: Map<string, number>, showEstimateCount: boolean) {
  return projects.map((project) => {
    const assignedPeople = assignedPeopleForProject(project);
    return (
      <tr key={project.id}>
        <td className="table-cell"><div className="font-medium text-slate-900">{project.name}</div></td>
        <td className="table-cell">{project.client.name}</td>
        <td className="table-cell">{assignedPeople.length > 0 ? <div className="text-sm text-slate-700">{assignedPeople.join(", ")}</div> : <span className="text-sm text-slate-400">—</span>}</td>
        <td className="table-cell">{project.billingModel.replaceAll("_", " ")}</td>
        {showEstimateCount ? <td className="table-cell">{estimateCounts.get(project.id) ?? "-"}</td> : null}
        <td className="table-cell"><span className="badge-blue">{project.status.replaceAll("_", " ")}</span></td>
        <td className="table-cell"><div className="flex gap-2"><Link className="btn-secondary text-xs" href={`/projects/${project.id}`}>View</Link>{canCreateProjects(user) ? <><Link className="btn-secondary text-xs" href={`/projects/${project.id}/edit`}>Edit</Link><form action={toggleProjectStatusAction}><input type="hidden" name="projectId" value={project.id} /><button className="btn-secondary text-xs">{project.isActive ? "Deactivate" : "Activate"}</button></form></> : null}</div></td>
      </tr>
    );
  });
}

export default async function ProjectsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const standardFilters = { q: params.q ?? "", status: params.status ?? "all", billingModel: params.billingModel ?? "all", clientId: params.clientId ?? "all" };
  const fixedFilters = { q: params.ff_q ?? "", status: params.ff_status ?? "all", billingModel: "FIXED_FULL", clientId: params.ff_clientId ?? "all" };
  const standardPage = parsePageParam(params.page);
  const fixedPage = parsePageParam(params.ff_page);
  const allProjects = await getVisibleProjects(user);
  const clientOptions = Array.from(new Map(allProjects.map((project) => [project.client.id, { id: project.client.id, name: project.client.name }])).values()).sort((a, b) => a.name.localeCompare(b.name));
  const estimateCountRows = await Promise.all(
    allProjects
      .filter((project) => project.billingModel === "FIXED_FULL")
      .map(async (project) => ({
        projectId: project.id,
        count: await db.estimate.count({
          where: { projectId: project.id },
        }),
      }))
  );
  const estimateCounts = new Map(estimateCountRows.map((row) => [row.projectId, row.count]));
  const standardProjects = filterProjects(allProjects, standardFilters, "standard");
  const fixedFullProjects = filterProjects(allProjects, fixedFilters, "fixedFull");
  const standardPaged = paginateItems(standardProjects, standardPage, DEFAULT_PAGE_SIZE);
  const fixedPaged = paginateItems(fixedFullProjects, fixedPage, DEFAULT_PAGE_SIZE);
  const statusOptions = [{ value: "all", label: "All statuses" }, { value: "DRAFT", label: "Draft" }, { value: "ACTIVE", label: "Active" }, { value: "ON_HOLD", label: "On Hold" }, { value: "COMPLETED", label: "Completed" }, { value: "ARCHIVED", label: "Archived" }];
  const billingOptions = [{ value: "all", label: "All billing models" }, { value: "HOURLY", label: "Hourly" }, { value: "FIXED_MONTHLY", label: "Fixed - Monthly" }];
  const clientComboOptions = [{ value: "all", label: "All clients" }, ...clientOptions.map((client) => ({ value: client.id, label: client.name }))];
  return (
    <div>
      <PageHeader title="Projects" description="Project records hold billing model, client, commercial tracking, and assigned people across project and sub-project levels." actions={canCreateProjects(user) ? <Link className="btn-primary" href="/projects/new">Create project</Link> : null} />
      <div id="standard-projects" className="space-y-4 scroll-mt-6">
        <h2 className="section-title">Hourly and Fixed Monthly Projects</h2>
        <div className="card p-4"><form className="grid gap-3 md:grid-cols-[1fr_180px_220px_220px_auto]" method="get" action="/projects#standard-projects"><input type="hidden" name="ff_q" value={fixedFilters.q} /><input type="hidden" name="ff_status" value={fixedFilters.status} /><input type="hidden" name="ff_clientId" value={fixedFilters.clientId} /><input className="input" name="q" defaultValue={standardFilters.q} placeholder="Search by project, client, or assigned person" /><SearchableCombobox id="status" name="status" defaultValue={standardFilters.status} options={statusOptions} placeholder="All statuses" searchPlaceholder="Search statuses..." emptyLabel="No statuses found." /><SearchableCombobox id="billingModel" name="billingModel" defaultValue={standardFilters.billingModel} options={billingOptions} placeholder="All billing models" searchPlaceholder="Search billing models..." emptyLabel="No billing models found." /><SearchableCombobox id="clientId" name="clientId" defaultValue={standardFilters.clientId} options={clientComboOptions} placeholder="All clients" searchPlaceholder="Search clients..." emptyLabel="No clients found." /><button className="btn-secondary" type="submit">Apply</button></form></div>
        <div className="table-wrap"><table className="table-base"><thead className="table-head"><tr><th className="table-cell">Project</th><th className="table-cell">Client</th><th className="table-cell">Assigned People</th><th className="table-cell">Billing</th><th className="table-cell">Status</th><th className="table-cell">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{projectTableRows(standardPaged.items, user, estimateCounts, false)}{standardProjects.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-sm text-slate-500">No projects found.</td></tr> : null}</tbody></table><PaginationControls basePath="/projects" anchor="#standard-projects" currentPage={standardPaged.currentPage} totalPages={standardPaged.totalPages} totalItems={standardPaged.totalItems} pageSize={standardPaged.pageSize} searchParams={{ ...standardFilters, ff_q: fixedFilters.q, ff_status: fixedFilters.status, ff_clientId: fixedFilters.clientId }} /></div>
      </div>
      <div id="fixed-full-projects" className="mt-8 space-y-4 scroll-mt-6">
        <h2 className="section-title">Fixed Full Projects</h2>
        <div className="card p-4"><form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]" method="get" action="/projects#fixed-full-projects"><input type="hidden" name="q" value={standardFilters.q} /><input type="hidden" name="status" value={standardFilters.status} /><input type="hidden" name="billingModel" value={standardFilters.billingModel} /><input type="hidden" name="clientId" value={standardFilters.clientId} /><input className="input" name="ff_q" defaultValue={fixedFilters.q} placeholder="Search by project, client, or assigned person" /><SearchableCombobox id="ff_status" name="ff_status" defaultValue={fixedFilters.status} options={statusOptions} placeholder="All statuses" searchPlaceholder="Search statuses..." emptyLabel="No statuses found." /><SearchableCombobox id="ff_clientId" name="ff_clientId" defaultValue={fixedFilters.clientId} options={clientComboOptions} placeholder="All clients" searchPlaceholder="Search clients..." emptyLabel="No clients found." /><button className="btn-secondary" type="submit">Apply</button></form></div>
        <div className="table-wrap"><table className="table-base"><thead className="table-head"><tr><th className="table-cell">Project</th><th className="table-cell">Client</th><th className="table-cell">Assigned People</th><th className="table-cell">Billing</th><th className="table-cell">Estimates</th><th className="table-cell">Status</th><th className="table-cell">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{projectTableRows(fixedPaged.items, user, estimateCounts, true)}{fixedFullProjects.length === 0 ? <tr><td colSpan={7} className="table-cell text-center text-sm text-slate-500">No Fixed Full projects found.</td></tr> : null}</tbody></table><PaginationControls basePath="/projects" pageParam="ff_page" anchor="#fixed-full-projects" currentPage={fixedPaged.currentPage} totalPages={fixedPaged.totalPages} totalItems={fixedPaged.totalItems} pageSize={fixedPaged.pageSize} searchParams={{ q: standardFilters.q, status: standardFilters.status, billingModel: standardFilters.billingModel, clientId: standardFilters.clientId, ff_q: fixedFilters.q, ff_status: fixedFilters.status, ff_clientId: fixedFilters.clientId }} /></div>
      </div>
    </div>
  );
}
