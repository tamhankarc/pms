"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";

export type ClientFormState = {
  success?: boolean;
  error?: string;
};

const clientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Client name is required."),
  code: z.string().trim().max(20).optional().or(z.literal("")),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  try {
    await requireUserTypes(["ADMIN", "MANAGER"]);

    const parsed = clientSchema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      isActive: formData.get("isActive") ?? "on",
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid client payload." };
    }

    await db.client.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code?.trim() || null,
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/clients");
    revalidatePath("/projects/new");
    revalidatePath("/movies");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  try {
    await requireUserTypes(["ADMIN", "MANAGER"]);
    const parsed = clientSchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      code: formData.get("code"),
      isActive: formData.get("isActive") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return { success: false, error: parsed.success ? "Client is required." : parsed.error.issues[0]?.message };
    }

    await db.client.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code?.trim() || null,
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/clients");
    revalidatePath(`/clients/${parsed.data.id}`);
    revalidatePath("/projects/new");
    revalidatePath("/movies");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function toggleClientStatusAction(formData: FormData) {
  await requireUserTypes(["ADMIN", "MANAGER"]);

  const clientId = String(formData.get("clientId") || "");
  if (!clientId) throw new Error("Client is required.");

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found.");

  await db.client.update({
    where: { id: clientId },
    data: { isActive: !client.isActive },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}
