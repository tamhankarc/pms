import { db } from "@/lib/db";
import { assertReviewableProjectState } from "@/lib/domain/rules";

export async function getProjectOrThrow(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      status: true,
      isActive: true,
      clientId: true,
    },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  return project;
}

export async function assertProjectAllowsNewEntries(projectId: string) {
  const project = await getProjectOrThrow(projectId);
  assertReviewableProjectState(project.status, project.isActive);
  return project;
}

export async function assertProjectHasCountriesInDb(projectId: string) {
  const count = await db.projectCountry.count({
    where: { projectId },
  });

  if (count < 1) {
    throw new Error("A project must have at least one country.");
  }
}