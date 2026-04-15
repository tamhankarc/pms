import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { UserAssignmentListFilters } from "@/components/forms/user-assignment-list-filters";
import { UserAssignmentForm } from "@/components/forms/user-assignment-form";
import { db } from "@/lib/db";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

export default async function UserAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    clientId?: string;
    projectId?: string;
    subProjectId?: string;
    create?: string;
    scope?: string;
    id?: string;
    page?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);

  const [clients, projects, subProjects, users, projectAssignments, subProjectAssignments] = await Promise.all([
    db.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: {},
      select: {
        id: true,
        name: true,
        clientId: true,
        client: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.subProject.findMany({
      where: {},
      select: {
        id: true,
        name: true,
        projectId: true,
        project: {
          select: {
            name: true,
            clientId: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { isActive: true, userType: { in: ["EMPLOYEE", "TEAM_LEAD", "MANAGER"] } },
      select: { id: true, fullName: true, userType: true, functionalRole: true },
      orderBy: { fullName: "asc" },
    }),
    db.projectUserAssignment.findMany({
      include: { project: { include: { client: true } }, user: true },
      orderBy: { assignedAt: "desc" },
    }),
    db.subProjectAssignment.findMany({
      include: {
        subProject: {
          include: {
            project: {
              include: { client: true },
            },
          },
        },
        user: true,
      },
      orderBy: { assignedAt: "desc" },
    }),
  ]);

  let initialValues:
    | {
        clientId?: string;
        projectId?: string;
        subProjectId?: string;
        userIds?: string[];
      }
    | undefined;

  if (params.scope === "project" && params.id) {
    const rows = projectAssignments.filter((row) => row.projectId === params.id);
    if (rows[0]) {
      initialValues = {
        clientId: rows[0].project.clientId,
        projectId: rows[0].projectId,
        userIds: rows.map((row) => row.userId),
      };
    }
  }

  if (params.scope === "subproject" && params.id) {
    const rows = subProjectAssignments.filter((row) => row.subProjectId === params.id);
    if (rows[0]) {
      initialValues = {
        clientId: rows[0].subProject.project.clientId,
        projectId: rows[0].subProject.projectId,
        subProjectId: rows[0].subProjectId,
        userIds: rows.map((row) => row.userId),
      };
    }
  }

  const visibleProjectRows = [...new Map(
    projectAssignments
      .filter((row) => !params.clientId || row.project.clientId === params.clientId)
      .filter((row) => !params.projectId || row.projectId === params.projectId)
      .map((row) => [row.projectId, row]),
  ).values()];

  const visibleSubProjectRows = [...new Map(
    subProjectAssignments
      .filter((row) => !params.clientId || row.subProject.project.clientId === params.clientId)
      .filter((row) => !params.projectId || row.subProject.projectId === params.projectId)
      .filter((row) => !params.subProjectId || row.subProjectId === params.subProjectId)
      .map((row) => [row.subProjectId, row]),
  ).values()];


  const combinedRows = [
    ...visibleProjectRows.map((row) => ({
      key: `project-${row.projectId}`,
      scope: "Project" as const,
      clientName: row.project.client.name,
      projectName: row.project.name,
      subProjectName: "—",
      users: projectAssignments.filter((assignment) => assignment.projectId === row.projectId).map((assignment) => assignment.user.fullName).join(", "),
      href: `/user-assignments?scope=project&id=${row.projectId}`,
    })),
    ...visibleSubProjectRows.map((row) => ({
      key: `subproject-${row.subProjectId}`,
      scope: "Sub Project" as const,
      clientName: row.subProject.project.client.name,
      projectName: row.subProject.project.name,
      subProjectName: row.subProject.name,
      users: subProjectAssignments.filter((assignment) => assignment.subProjectId === row.subProjectId).map((assignment) => assignment.user.fullName).join(", "),
      href: `/user-assignments?scope=subproject&id=${row.subProjectId}`,
    })),
  ];

  const { items: paginatedRows, currentPage, totalPages, totalItems, pageSize } = paginateItems(combinedRows, page, DEFAULT_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Assignments"
        description="Manage project-level and sub-project-level visibility assignments."
        actions={
          <Link className="btn-primary" href="/user-assignments?create=1">
            Assign user
          </Link>
        }
      />

      <div className="card p-4">
        <UserAssignmentListFilters
          selectedClientId={params.clientId ?? ""}
          selectedProjectId={params.projectId ?? ""}
          selectedSubProjectId={params.subProjectId ?? ""}
          clients={clients}
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
            clientName: project.client.name,
          }))}
          subProjects={subProjects.map((subProject) => ({
            id: subProject.id,
            name: subProject.name,
            projectId: subProject.projectId,
            projectName: subProject.project.name,
            clientId: subProject.project.clientId,
            clientName: subProject.project.client.name,
          }))}
        />
      </div>

      {params.create === "1" || params.scope ? (
        <UserAssignmentForm
          clients={clients}
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
          }))}
          subProjects={subProjects.map((subProject) => ({
            id: subProject.id,
            name: subProject.name,
            projectId: subProject.projectId,
          }))}
          users={users}
          initialValues={initialValues}
        />
      ) : null}

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Scope</th>
              <th className="table-cell">Client</th>
              <th className="table-cell">Project</th>
              <th className="table-cell">Sub Project</th>
              <th className="table-cell">Users</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRows.map((row) => (
              <tr key={row.key}>
                <td className="table-cell">{row.scope}</td>
                <td className="table-cell">{row.clientName}</td>
                <td className="table-cell">{row.projectName}</td>
                <td className="table-cell">{row.subProjectName}</td>
                <td className="table-cell">{row.users}</td>
                <td className="table-cell">
                  <Link className="btn-secondary text-xs" href={row.href}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}

            {combinedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-cell text-center text-sm text-slate-500">
                  No assignments found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <PaginationControls basePath="/user-assignments" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ clientId: params.clientId, projectId: params.projectId, subProjectId: params.subProjectId, create: params.create, scope: params.scope, id: params.id }} />
      </div>
    </div>
  );
}
