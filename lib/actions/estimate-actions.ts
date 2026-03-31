"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canFullyModerateProject, isRoleScopedManager } from "@/lib/permissions";

export type EstimateFormState = {
  success?: boolean;
  error?: string;
};

const estimateSchema = z.object({
  projectId: z.string().min(1),
  countryId: z.string().optional(),
  workDate: z.string().min(1),
  estimatedMinutes: z.coerce.number().int().positive(),
  notes: z.string().optional(),
});

export async function createEstimateAction(
  _prevState: EstimateFormState,
  formData: FormData,
): Promise<EstimateFormState> {
  try {
    const user = await requireUser();

    if (!["EMPLOYEE", "TEAM_LEAD"].includes(user.userType) && !isRoleScopedManager(user)) {
      return { success: false, error: "You are not allowed to submit estimates." };
    }

    const parsed = estimateSchema.safeParse({
      projectId: formData.get("projectId"),
      countryId: formData.get("countryId") || undefined,
      workDate: formData.get("workDate"),
      estimatedMinutes: formData.get("estimatedMinutes"),
      notes: formData.get("notes") || "",
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid estimate payload" };
    }

    const project = await db.project.findFirst({
      where: {
        id: parsed.data.projectId,
        ...(isRoleScopedManager(user)
          ? {}
          : {
              OR: [
                {
                  employeeGroups: {
                    some: {
                      employeeGroup: {
                        users: {
                          some: { userId: user.id },
                        },
                      },
                    },
                  },
                },
                {
                  assignedUsers: {
                    some: {
                      userId: user.id,
                    },
                  },
                },
              ],
            }),
        isActive: true,
      },
      select: { id: true },
    });

    if (!project) {
      return { success: false, error: "You cannot submit estimates to this project." };
    }

    await db.estimate.create({
      data: {
        projectId: parsed.data.projectId,
        employeeId: user.id,
        countryId: parsed.data.countryId || null,
        workDate: new Date(parsed.data.workDate),
        estimatedMinutes: parsed.data.estimatedMinutes,
        notes: parsed.data.notes || null,
        status: "SUBMITTED",
      },
    });

    revalidatePath("/estimates");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

const reviewEstimateSchema = z.object({
  estimateId: z.string().min(1),
  action: z.enum(["APPROVED", "REJECTED", "REVISED"]),
  comment: z.string().optional(),
});

export async function reviewEstimateAction(formData: FormData) {
  const user = await requireUser();

  const parsed = reviewEstimateSchema.safeParse({
    estimateId: formData.get("estimateId"),
    action: formData.get("action"),
    comment: formData.get("comment") || "",
  });

  if (!parsed.success) throw new Error("Invalid estimate review payload");

  const estimate = await db.estimate.findUnique({
    where: { id: parsed.data.estimateId },
    include: {
      employee: {
        select: {
          id: true,
          functionalRole: true,
        },
      },
    },
  });

  if (!estimate) throw new Error("Estimate not found");

  let canReview = canFullyModerateProject(user);

  if (!canReview && (user.userType === "TEAM_LEAD" || isRoleScopedManager(user))) {
    const assignment = await db.employeeTeamLead.findFirst({
      where: {
        teamLeadId: user.id,
        employeeId: estimate.employeeId,
      },
      select: { id: true },
    });

    canReview = Boolean(
      assignment && estimate.employee.functionalRole === user.functionalRole,
    );
  }

  if (!canReview) {
    throw new Error("You do not have review access for this estimate.");
  }

  await db.$transaction([
    db.estimateReview.create({
      data: {
        estimateId: estimate.id,
        reviewerId: user.id,
        decisionStatus: parsed.data.action,
        remarks: parsed.data.comment || null,
      },
    }),
    db.estimate.update({
      where: { id: estimate.id },
      data: { status: parsed.data.action },
    }),
  ]);

  revalidatePath("/estimates");
}

const updateEstimateSchema = z.object({
  estimateId: z.string().min(1),
  countryId: z.string().optional(),
  workDate: z.string().min(1),
  estimatedMinutes: z.coerce.number().int().positive(),
  notes: z.string().optional(),
});

export async function updateEstimateAction(
  _prevState: EstimateFormState,
  formData: FormData,
): Promise<EstimateFormState> {
  try {
    const user = await requireUser();

    const parsed = updateEstimateSchema.safeParse({
      estimateId: formData.get("estimateId"),
      countryId: formData.get("countryId") || undefined,
      workDate: formData.get("workDate"),
      estimatedMinutes: formData.get("estimatedMinutes"),
      notes: formData.get("notes") || "",
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid estimate update payload" };
    }

    const estimate = await db.estimate.findUnique({
      where: { id: parsed.data.estimateId },
    });

    if (!estimate) return { success: false, error: "Estimate not found" };

    const isOwner = estimate.employeeId === user.id;
    const canOverride = canFullyModerateProject(user);

    if (!isOwner && !canOverride) {
      return { success: false, error: "You are not allowed to update this estimate." };
    }

    if (isOwner && estimate.status !== "REVISED") {
      return { success: false, error: "You can only edit estimates that are marked Revised." };
    }

    if (canOverride && !["DRAFT", "REVISED", "SUBMITTED"].includes(estimate.status)) {
      return { success: false, error: "This estimate cannot be updated in its current status." };
    }

    await db.estimate.update({
      where: { id: estimate.id },
      data: {
        countryId: parsed.data.countryId || null,
        workDate: new Date(parsed.data.workDate),
        estimatedMinutes: parsed.data.estimatedMinutes,
        notes: parsed.data.notes || null,
        status: isOwner ? "SUBMITTED" : estimate.status,
      },
    });

    revalidatePath("/estimates");
    revalidatePath(`/estimates/${estimate.id}/edit`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
