"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageContactPersons } from "@/lib/permissions";

export type ContactPersonFormState = { success?: boolean; error?: string };

const contactPersonSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  name: z.string().trim().min(2, "Name is required."),
  email: z.string().trim().email("Valid email is required."),
  contactNumber: z.string().trim().optional(),
});

async function requireCanManageContactPersons() {
  const user = await requireUserForAction();
  if (!canManageContactPersons(user)) throw new Error("You are not allowed to manage contact persons.");
  return user;
}

function parsePayload(formData: FormData) {
  return contactPersonSchema.safeParse({
    id: String(formData.get("id") ?? "") || undefined,
    clientId: String(formData.get("clientId") ?? ""),
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    contactNumber: String(formData.get("contactNumber") ?? ""),
  });
}

async function validateClient(clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new Error("Selected client was not found.");
}

export async function createContactPersonAction(_prevState: ContactPersonFormState, formData: FormData): Promise<ContactPersonFormState> {
  try {
    await requireCanManageContactPersons();
    const parsed = parsePayload(formData);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid contact person payload." };
    await validateClient(parsed.data.clientId);
    await db.contactPerson.create({
      data: {
        clientId: parsed.data.clientId,
        projectId: null,
        movieId: null,
        purchaseOrderId: null,
        countryId: null,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        contactNumber: parsed.data.contactNumber || null,
      },
    });
    revalidatePath("/contact-persons");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateContactPersonAction(_prevState: ContactPersonFormState, formData: FormData): Promise<ContactPersonFormState> {
  try {
    await requireCanManageContactPersons();
    const parsed = parsePayload(formData);
    if (!parsed.success || !parsed.data.id) return { success: false, error: parsed.success ? "Contact Person is required." : parsed.error.issues[0]?.message };
    await validateClient(parsed.data.clientId);
    const existing = await db.contactPerson.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
    if (!existing) return { success: false, error: "Contact Person not found." };
    await db.contactPerson.update({
      where: { id: parsed.data.id },
      data: {
        clientId: parsed.data.clientId,
        projectId: null,
        movieId: null,
        purchaseOrderId: null,
        countryId: null,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        contactNumber: parsed.data.contactNumber || null,
      },
    });
    revalidatePath("/contact-persons");
    revalidatePath(`/contact-persons/${parsed.data.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}


export async function deleteContactPersonAction(formData: FormData) {
  let redirectTo = "/contact-persons";

  try {
    await requireCanManageContactPersons();
    const id = String(formData.get("id") ?? "");

    if (!id) {
      throw new Error("Contact Person is required.");
    }

    const billingContactCount = await db.billingContactAssignment.count({
      where: {
        contactPersonId: id,
      },
    });

    if (billingContactCount > 0) {
      throw new Error(
        "This contact person is assigned as a billing contact. Remove the billing contact assignment first.",
      );
    }

    await db.contactPerson.delete({
      where: {
        id,
      },
    });

    revalidatePath("/contact-persons");
    revalidatePath("/billing-contacts");
    redirectTo = "/contact-persons?deleteSuccess=Contact%20person%20deleted.";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete contact person.";
    redirectTo = `/contact-persons?deleteError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}
