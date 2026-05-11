"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageNewsletters } from "@/lib/permissions";
import { NewsletterType } from "@prisma/client";

export type NewsletterFormState = { success?: boolean; error?: string };

const SONY_PICTURES_CLIENT_ID = "cmn66d3q40002l104n6wvefvl";
const newsletterSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  projectId: z.string().optional(),
  name: z.string().trim().min(2, "Newsletter name is required."),
  newsletterType: z.enum(["ISG", "AFFIRM", "HOME"]).optional().nullable(),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

async function requireCanManageNewsletters() {
  const user = await requireUserForAction();
  if (!canManageNewsletters(user)) throw new Error("You are not allowed to manage newsletters.");
  return user;
}

async function validateProjectForClient(clientId: string, projectId?: string | null) {
  if (!projectId) return null;
  return db.project.findFirst({ where: { id: projectId, clientId, isActive: true }, select: { id: true } });
}

function normalizeNewsletterType(clientId: string, value?: NewsletterType | null) {
  if (clientId !== SONY_PICTURES_CLIENT_ID) return null;
  return value || null;
}

export async function createNewsletterAction(_prevState: NewsletterFormState, formData: FormData): Promise<NewsletterFormState> {
  try {
    await requireCanManageNewsletters();
    const parsed = newsletterSchema.safeParse({
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId") || undefined,
      name: formData.get("name"),
      newsletterType: formData.get("newsletterType") || undefined,
      isActive: formData.get("isActive") ?? "on",
    });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid newsletter payload." };
    const client = await db.client.findUnique({ where: { id: parsed.data.clientId }, select: { id: true, showNewslettersInEntries: true } });
    if (!client) return { success: false, error: "Client not found." };
    if (parsed.data.projectId && !(await validateProjectForClient(client.id, parsed.data.projectId))) return { success: false, error: "Selected project is invalid for this client." };
    await db.newsletter.create({ data: { clientId: client.id, projectId: parsed.data.projectId || null, name: parsed.data.name.trim(), newsletterType: normalizeNewsletterType(client.id, parsed.data.newsletterType), isActive: Boolean(parsed.data.isActive) } });
    revalidatePath("/newsletters"); revalidatePath("/time-entries"); revalidatePath("/estimates"); revalidatePath(`/billing-reports/${SONY_PICTURES_CLIENT_ID}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateNewsletterAction(_prevState: NewsletterFormState, formData: FormData): Promise<NewsletterFormState> {
  try {
    await requireCanManageNewsletters();
    const parsed = newsletterSchema.safeParse({
      id: formData.get("id"),
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId") || undefined,
      name: formData.get("name"),
      newsletterType: formData.get("newsletterType") || undefined,
      isActive: formData.get("isActive") ?? undefined,
    });
    if (!parsed.success || !parsed.data.id) return { success: false, error: parsed.success ? "Newsletter is required." : parsed.error.issues[0]?.message };
    const existing = await db.newsletter.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
    if (!existing) return { success: false, error: "Newsletter not found." };
    if (parsed.data.projectId && !(await validateProjectForClient(parsed.data.clientId, parsed.data.projectId))) return { success: false, error: "Selected project is invalid for this client." };
    await db.newsletter.update({ where: { id: parsed.data.id }, data: { clientId: parsed.data.clientId, projectId: parsed.data.projectId || null, name: parsed.data.name.trim(), newsletterType: normalizeNewsletterType(parsed.data.clientId, parsed.data.newsletterType), isActive: Boolean(parsed.data.isActive) } });
    revalidatePath("/newsletters"); revalidatePath(`/newsletters/${parsed.data.id}`); revalidatePath("/time-entries"); revalidatePath("/estimates"); revalidatePath(`/billing-reports/${SONY_PICTURES_CLIENT_ID}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function toggleNewsletterStatusAction(formData: FormData) {
  await requireCanManageNewsletters();
  const newsletterId = String(formData.get("newsletterId") || "");
  if (!newsletterId) throw new Error("Newsletter is required.");
  const newsletter = await db.newsletter.findUnique({ where: { id: newsletterId } });
  if (!newsletter) throw new Error("Newsletter not found.");
  await db.newsletter.update({ where: { id: newsletterId }, data: { isActive: !newsletter.isActive } });
  revalidatePath("/newsletters"); revalidatePath(`/newsletters/${newsletterId}`);
}
