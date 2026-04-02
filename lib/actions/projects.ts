'use server';

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canCreateOrEditProject } from "@/lib/permissions";

type UpsertProjectInput = {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  clientId: string;
  movieId?: string | null;
  status: "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
  billingModel: "HOURLY" | "FIXED_FULL" | "FIXED_MONTHLY";
  basisType?: "MOVIE_BASED" | "NON_MOVIE_BASED";
  fixedContractHours?: number | null;
  fixedMonthlyHours?: number | null;
  startDate?: string | null;
  endDate?: string | null;
};

export async function upsertProject(input: UpsertProjectInput) {
  const currentUser = await requireUser();

  if (!canCreateOrEditProject(currentUser)) {
    throw new Error("Only Admin/Manager can create or edit projects.");
  }

  return db.$transaction(async (tx) => {
    const projectData = {
      name: input.name,
      code: input.code || null,
      description: input.description || null,
      clientId: input.clientId,
      movieId: input.movieId || null,
      status: input.status,
      billingModel: input.billingModel,
      basisType: input.basisType ?? (input.movieId ? "MOVIE_BASED" : "NON_MOVIE_BASED"),
      fixedContractHours:
        input.billingModel === "FIXED_FULL" ? (input.fixedContractHours ?? null) : null,
      fixedMonthlyHours:
        input.billingModel === "FIXED_MONTHLY" ? (input.fixedMonthlyHours ?? null) : null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      updatedById: currentUser.id,
    } as const;

    const project = input.id
      ? await tx.project.update({
          where: { id: input.id },
          data: projectData,
        })
      : await tx.project.create({
          data: {
            ...projectData,
            createdById: currentUser.id,
          },
        });

    return project;
  });
}