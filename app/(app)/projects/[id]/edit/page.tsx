import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectEditForm } from "@/components/forms/project-edit-form";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project, countries, employeeGroups, assignableUsers] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        client: true,
        movie: true,
        countries: true,
        employeeGroups: true,
        assignedUsers: true,
      },
    }),
    db.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.employeeGroup.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: {
        isActive: true,
        userType: { in: ["EMPLOYEE", "TEAM_LEAD"] },
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, userType: true, functionalRole: true },
    }),
  ]);

  if (!project) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Edit project"
        description="Client and Movie are locked after project creation."
        actions={<Link href={`/projects/${project.id}`} className="btn-secondary">Back to project</Link>}
      />

      <ProjectEditForm
        projectId={project.id}
        lockedClientName={project.client.name}
        lockedMovieTitle={project.movie?.title ?? null}
        countries={countries}
        employeeGroups={employeeGroups}
        assignableUsers={assignableUsers}
        initialValues={{
          name: project.name,
          billingModel: project.billingModel,
          fixedContractHours: project.fixedContractHours == null ? null : Number(project.fixedContractHours),
          fixedMonthlyHours: project.fixedMonthlyHours == null ? null : Number(project.fixedMonthlyHours),
          status: project.status,
          description: project.description,
          countryIds: project.countries.map((item) => item.countryId),
          assignmentType: project.assignedUsers.length > 0 ? "USER" : "GROUP",
          employeeGroupIds: project.employeeGroups.map((item) => item.employeeGroupId),
          directUserIds: project.assignedUsers.map((item) => item.userId),
        }}
      />
    </div>
  );
}
