"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserTypesForAction } from "@/lib/auth";

export type ContactPersonFormState = { success?: boolean; error?: string };

const contactPersonSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  projectId: z.string().min(1, "Project is required."),
  name: z.string().trim().min(2, "Name is required."),
  email: z.string().trim().email("Valid email is required."),
  contactNumber: z.string().trim().optional(),
});

async function validateProjectBelongsToClient(clientId: string, projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, clientId }, select: { id: true } });
  if (!project) {
    throw new Error("Selected project does not belong to selected client.");
  }
}

export async function createContactPersonAction(_prevState: ContactPersonFormState, formData: FormData): Promise<ContactPersonFormState> {
  try {
    await requireUserTypesForAction(["ADMIN", "OPERATIONS"]);
    const parsed = contactPersonSchema.safeParse({
      clientId: String(formData.get("clientId") ?? ""),
      projectId: String(formData.get("projectId") ?? ""),
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      contactNumber: String(formData.get("contactNumber") ?? ""),
    });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid contact person payload." };
    await validateProjectBelongsToClient(parsed.data.clientId, parsed.data.projectId);
    await db.contactPerson.create({ data: { clientId: parsed.data.clientId, projectId: parsed.data.projectId, name: parsed.data.name, email: parsed.data.email.toLowerCase(), contactNumber: parsed.data.contactNumber || null } });
    revalidatePath("/contact-persons");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateContactPersonAction(_prevState: ContactPersonFormState, formData: FormData): Promise<ContactPersonFormState> {
  try {
    await requireUserTypesForAction(["ADMIN", "OPERATIONS"]);
    const parsed = contactPersonSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      clientId: String(formData.get("clientId") ?? ""),
      projectId: String(formData.get("projectId") ?? ""),
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      contactNumber: String(formData.get("contactNumber") ?? ""),
    });
    if (!parsed.success || !parsed.data.id) return { success: false, error: parsed.success ? "Contact Person is required." : parsed.error.issues[0]?.message };
    await validateProjectBelongsToClient(parsed.data.clientId, parsed.data.projectId);
    const existing = await db.contactPerson.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
    if (!existing) return { success: false, error: "Contact Person not found." };
    await db.contactPerson.update({ where: { id: parsed.data.id }, data: { clientId: parsed.data.clientId, projectId: parsed.data.projectId, name: parsed.data.name, email: parsed.data.email.toLowerCase(), contactNumber: parsed.data.contactNumber || null } });
    revalidatePath("/contact-persons");
    revalidatePath(`/contact-persons/${parsed.data.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
