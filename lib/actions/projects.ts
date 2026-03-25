'use server';

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canCreateOrEditProject } from "@/lib/permissions";
import {
  assertProjectHasAtLeastOneCountry,
  assertUniqueIds,
} from "@/lib/domain/rules";

type UpsertProjectInput = {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  clientId: string;
  movieId?: string | null;
  status: "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
  billingModel: "HOURLY" | "FIXED_FULL" | "FIXED_MONTHLY";
  countryIds: string[];
  employeeGroupIds?: string[];
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

  assertProjectHasAtLeastOneCountry(input.countryIds);
  assertUniqueIds(input.countryIds, "country");
  assertUniqueIds(input.employeeGroupIds ?? [], "employee group");

  return db.$transaction(async (tx) => {
    const project = input.id
      ? await tx.project.update({
          where: { id: input.id },
          data: {
            name: input.name,
            code: input.code || null,
            description: input.description || null,
            clientId: input.clientId,
            movieId: input.movieId || null,
            status: input.status,
            billingModel: input.billingModel,
            fixedContractHours: input.fixedContractHours ?? null,
            fixedMonthlyHours: input.fixedMonthlyHours ?? null,
            startDate: input.startDate ? new Date(input.startDate) : null,
            endDate: input.endDate ? new Date(input.endDate) : null,
            updatedById: currentUser.id,
          },
        })
      : await tx.project.create({
          data: {
            name: input.name,
            code: input.code || null,
            description: input.description || null,
            clientId: input.clientId,
            movieId: input.movieId || null,
            status: input.status,
            billingModel: input.billingModel,
            fixedContractHours: input.fixedContractHours ?? null,
            fixedMonthlyHours: input.fixedMonthlyHours ?? null,
            startDate: input.startDate ? new Date(input.startDate) : null,
            endDate: input.endDate ? new Date(input.endDate) : null,
            createdById: currentUser.id,
            updatedById: currentUser.id,
          },
        });

    await tx.projectCountry.deleteMany({
      where: { projectId: project.id },
    });

    await tx.projectCountry.createMany({
      data: input.countryIds.map((countryId) => ({
        projectId: project.id,
        countryId,
      })),
      skipDuplicates: true,
    });

    await tx.projectEmployeeGroup.deleteMany({
      where: { projectId: project.id },
    });

    if ((input.employeeGroupIds ?? []).length > 0) {
      await tx.projectEmployeeGroup.createMany({
        data: (input.employeeGroupIds ?? []).map((employeeGroupId) => ({
          projectId: project.id,
          employeeGroupId,
        })),
        skipDuplicates: true,
      });
    }

    return project;
  });
}