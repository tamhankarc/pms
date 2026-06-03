"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageContactPersons } from "@/lib/permissions";

export type BillingContactFormState = { success?: boolean; error?: string };

const schema = z.object({
  clientId: z.string().min(1, "Client is required."),
  contactPersonId: z.string().min(1, "Billing contact is required."),
  assignmentLevel: z.enum(["CLIENT", "CLIENT_PROJECT", "CLIENT_BILLING_REPORT"]),
  projectId: z.string().optional(),
  billingReportType: z.string().optional(),
});

async function requireCanManageBillingContacts() {
  const user = await requireUserForAction();
  if (!canManageContactPersons(user)) throw new Error("You are not allowed to manage billing contacts.");
}

export async function saveBillingContactAction(_prevState: BillingContactFormState, formData: FormData): Promise<BillingContactFormState> {
  try {
    await requireCanManageBillingContacts();
    const parsed = schema.safeParse({
      clientId: String(formData.get("clientId") ?? ""),
      contactPersonId: String(formData.get("contactPersonId") ?? ""),
      assignmentLevel: String(formData.get("assignmentLevel") ?? "CLIENT"),
      projectId: String(formData.get("projectId") ?? ""),
      billingReportType: String(formData.get("billingReportType") ?? ""),
    });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid billing contact payload." };
    const data = parsed.data;
    const contact = await db.contactPerson.findFirst({ where: { id: data.contactPersonId, clientId: data.clientId }, select: { id: true } });
    if (!contact) return { success: false, error: "Selected contact person does not belong to selected client." };
    if (data.assignmentLevel === "CLIENT_PROJECT") {
      if (!data.projectId) return { success: false, error: "Project is required." };
      const project = await db.project.findFirst({ where: { id: data.projectId, clientId: data.clientId }, select: { id: true } });
      if (!project) return { success: false, error: "Selected project does not belong to selected client." };
    }
    if (data.assignmentLevel === "CLIENT_BILLING_REPORT" && !data.billingReportType) return { success: false, error: "Billing report is required." };

    await db.billingContactAssignment.deleteMany({
      where: {
        clientId: data.clientId,
        assignmentLevel: data.assignmentLevel,
        projectId: data.assignmentLevel === "CLIENT_PROJECT" ? data.projectId : null,
        billingReportType: data.assignmentLevel === "CLIENT_BILLING_REPORT" ? data.billingReportType : null,
      },
    });
    await db.billingContactAssignment.create({
      data: {
        clientId: data.clientId,
        contactPersonId: data.contactPersonId,
        assignmentLevel: data.assignmentLevel,
        projectId: data.assignmentLevel === "CLIENT_PROJECT" ? data.projectId || null : null,
        billingReportType: data.assignmentLevel === "CLIENT_BILLING_REPORT" ? data.billingReportType || null : null,
      },
    });
    revalidatePath("/billing-contacts");
    revalidatePath(`/billing-reports/${data.clientId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function deleteBillingContactAction(formData: FormData) {
  let redirectTo = "/billing-contacts";

  try {
    await requireCanManageBillingContacts();
    const id = String(formData.get("id") ?? "");

    if (!id) {
      throw new Error("Billing contact is required.");
    }

    const assignment = await db.billingContactAssignment.findUnique({
      where: {
        id,
      },
      select: {
        clientId: true,
      },
    });

    if (!assignment) {
      throw new Error("Billing contact assignment was not found.");
    }

    await db.billingContactAssignment.delete({
      where: {
        id,
      },
    });

    revalidatePath("/billing-contacts");
    revalidatePath(`/billing-reports/${assignment.clientId}`);
    redirectTo = "/billing-contacts?deleteSuccess=Billing%20contact%20deleted.";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete billing contact.";
    redirectTo = `/billing-contacts?deleteError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}
