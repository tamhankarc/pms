"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManagePurchaseOrders } from "@/lib/permissions";

export type PurchaseOrderFormState = { success?: boolean; error?: string };

const purchaseOrderSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  poNumber: z.string().trim().min(1, "PO number is required."),
  amount: z.coerce.number().min(0, "PO amount cannot be negative.").optional(),
  currency: z.string().trim().min(1).default("USD"),
  poDate: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  status: z.enum(["ACTIVE", "PROCESSED", "EXHAUSTED", "EXPIRED", "CANCELLED"]),
  documentUrl: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  assignmentMode: z.enum(["TITLE", "TITLE_BILLING_REPORT", "TITLE_PROJECT", "PROJECT", "BILLING_REPORT"]),
  movieIds: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  billingReportType: z.string().optional(),
});

function parseDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function requireCanManagePurchaseOrders() {
  const user = await requireUserForAction();
  if (!canManagePurchaseOrders(user)) throw new Error("You are not allowed to manage Purchase Orders.");
  return user;
}

function getFormValues(formData: FormData) {
  const movieIds = formData.getAll("movieIds").map(String).filter(Boolean);
  return {
    id: String(formData.get("id") ?? "") || undefined,
    clientId: String(formData.get("clientId") ?? ""),
    poNumber: String(formData.get("poNumber") ?? ""),
    amount: formData.get("amount") ? String(formData.get("amount")) : "0",
    currency: String(formData.get("currency") ?? "USD"),
    poDate: String(formData.get("poDate") ?? ""),
    validFrom: String(formData.get("validFrom") ?? ""),
    validTo: String(formData.get("validTo") ?? ""),
    status: String(formData.get("status") ?? "ACTIVE"),
    documentUrl: String(formData.get("documentUrl") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    assignmentMode: String(formData.get("assignmentMode") ?? "TITLE"),
    movieIds,
    projectId: String(formData.get("projectId") ?? ""),
    billingReportType: String(formData.get("billingReportType") ?? ""),
  };
}

async function validateAssignmentPayload(data: z.infer<typeof purchaseOrderSchema>) {
  const client = await db.client.findUnique({ where: { id: data.clientId }, select: { id: true, poAssignmentMode: true } });
  if (!client) throw new Error("Selected client was not found.");

  if (data.assignmentMode === "TITLE" || data.assignmentMode === "TITLE_BILLING_REPORT" || data.assignmentMode === "TITLE_PROJECT") {
    if (!data.movieIds?.length) throw new Error("At least one Title is required for this PO assignment mode.");
    const movies = await db.movie.findMany({ where: { id: { in: data.movieIds }, clientId: data.clientId }, select: { id: true } });
    if (movies.length !== data.movieIds.length) throw new Error("One or more selected Titles do not belong to selected client.");
  }

  if ((data.assignmentMode === "TITLE_BILLING_REPORT" || data.assignmentMode === "BILLING_REPORT") && !data.billingReportType) throw new Error("Billing report type is required.");

  if (data.assignmentMode === "TITLE_PROJECT" || data.assignmentMode === "PROJECT") {
    if (!data.projectId) throw new Error("Project is required.");
    const project = await db.project.findFirst({ where: { id: data.projectId, clientId: data.clientId }, select: { id: true } });
    if (!project) throw new Error("Selected project does not belong to selected client.");
  }
}

async function savePurchaseOrder(formData: FormData, mode: "create" | "update") {
  await requireCanManagePurchaseOrders();
  const parsed = purchaseOrderSchema.safeParse(getFormValues(formData));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid Purchase Order payload." };
  await validateAssignmentPayload(parsed.data);

  const poData = {
    clientId: parsed.data.clientId,
    poNumber: parsed.data.poNumber.trim(),
    amount: parsed.data.amount ?? 0,
    currency: parsed.data.currency.trim().toUpperCase() || "USD",
    poDate: parseDate(parsed.data.poDate),
    validFrom: parseDate(parsed.data.validFrom),
    validTo: parseDate(parsed.data.validTo),
    status: parsed.data.status,
    documentUrl: parsed.data.documentUrl || null,
    notes: parsed.data.notes || null,
  };

  const purchaseOrder = mode === "create"
    ? await db.purchaseOrder.create({ data: poData, select: { id: true } })
    : await db.purchaseOrder.update({ where: { id: parsed.data.id }, data: poData, select: { id: true } });

  await db.purchaseOrderAssignment.deleteMany({ where: { purchaseOrderId: purchaseOrder.id } });
  const movieIds = parsed.data.assignmentMode === "PROJECT" || parsed.data.assignmentMode === "BILLING_REPORT" ? [null] : (parsed.data.movieIds ?? []);
  await db.purchaseOrderAssignment.createMany({
    data: movieIds.map((movieId) => ({
      clientId: parsed.data.clientId,
      purchaseOrderId: purchaseOrder.id,
      assignmentMode: parsed.data.assignmentMode,
      movieId,
      projectId: parsed.data.assignmentMode === "TITLE" || parsed.data.assignmentMode === "TITLE_BILLING_REPORT" || parsed.data.assignmentMode === "BILLING_REPORT" ? null : (parsed.data.projectId || null),
      billingReportType: parsed.data.assignmentMode === "TITLE_BILLING_REPORT" || parsed.data.assignmentMode === "BILLING_REPORT" ? parsed.data.billingReportType || null : null,
    })),
  });

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${purchaseOrder.id}`);
  return { success: true };
}

export async function createPurchaseOrderAction(_prevState: PurchaseOrderFormState, formData: FormData): Promise<PurchaseOrderFormState> {
  try { return await savePurchaseOrder(formData, "create"); }
  catch (error) { return { success: false, error: error instanceof Error ? error.message : "Something went wrong." }; }
}

export async function updatePurchaseOrderAction(_prevState: PurchaseOrderFormState, formData: FormData): Promise<PurchaseOrderFormState> {
  try { return await savePurchaseOrder(formData, "update"); }
  catch (error) { return { success: false, error: error instanceof Error ? error.message : "Something went wrong." }; }
}


export async function deletePurchaseOrderAction(formData: FormData) {
  let redirectTo = "/purchase-orders";

  try {
    await requireCanManagePurchaseOrders();
    const id = String(formData.get("id") ?? "");

    if (!id) {
      throw new Error("Purchase Order is required.");
    }

    await db.purchaseOrder.delete({
      where: {
        id,
      },
    });

    revalidatePath("/purchase-orders");
    redirectTo = "/purchase-orders?deleteSuccess=Purchase%20Order%20deleted.";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete Purchase Order.";
    redirectTo = `/purchase-orders?deleteError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}
