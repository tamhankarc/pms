"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageContactPersons } from "@/lib/permissions";

export type ContactPersonFormState = { success?: boolean; error?: string };

const contactPersonSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  assignmentMode: z.enum(["project", "movie"]),
  projectId: z.string().optional(),
  movieId: z.string().optional(),
  name: z.string().trim().min(2, "Name is required."),
  email: z.string().trim().email("Valid email is required."),
  contactNumber: z.string().trim().optional(),
});

async function validateAssignment(clientId: string, assignmentMode: "project" | "movie", projectId?: string, movieId?: string) {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, showMoviesInEntries: true } });
  if (!client) throw new Error("Selected client was not found.");

  if (assignmentMode === "movie") {
    if (!client.showMoviesInEntries) throw new Error("Movie-specific contact persons are only available for clients with Movie dropdown enabled.");
    if (!movieId) throw new Error("Movie is required.");
    const movie = await db.movie.findFirst({ where: { id: movieId, clientId }, select: { id: true } });
    if (!movie) throw new Error("Selected movie does not belong to selected client.");
    return { projectId: null, movieId };
  }

  if (!projectId) throw new Error("Project is required.");
  const project = await db.project.findFirst({ where: { id: projectId, clientId }, select: { id: true } });
  if (!project) throw new Error("Selected project does not belong to selected client.");
  return { projectId, movieId: null };
}

async function requireCanManageContactPersons() {
  const user = await requireUserForAction();
  if (!canManageContactPersons(user)) throw new Error("You are not allowed to manage contact persons.");
  return user;
}

export async function createContactPersonAction(_prevState: ContactPersonFormState, formData: FormData): Promise<ContactPersonFormState> {
  try {
    await requireCanManageContactPersons();
    const parsed = contactPersonSchema.safeParse({
      clientId: String(formData.get("clientId") ?? ""),
      assignmentMode: String(formData.get("assignmentMode") ?? "project"),
      projectId: String(formData.get("projectId") ?? ""),
      movieId: String(formData.get("movieId") ?? ""),
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      contactNumber: String(formData.get("contactNumber") ?? ""),
    });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid contact person payload." };
    const assignment = await validateAssignment(parsed.data.clientId, parsed.data.assignmentMode, parsed.data.projectId, parsed.data.movieId);
    await db.contactPerson.create({
      data: {
        clientId: parsed.data.clientId,
        projectId: assignment.projectId,
        movieId: assignment.movieId,
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
    const parsed = contactPersonSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      clientId: String(formData.get("clientId") ?? ""),
      assignmentMode: String(formData.get("assignmentMode") ?? "project"),
      projectId: String(formData.get("projectId") ?? ""),
      movieId: String(formData.get("movieId") ?? ""),
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      contactNumber: String(formData.get("contactNumber") ?? ""),
    });
    if (!parsed.success || !parsed.data.id) return { success: false, error: parsed.success ? "Contact Person is required." : parsed.error.issues[0]?.message };
    const assignment = await validateAssignment(parsed.data.clientId, parsed.data.assignmentMode, parsed.data.projectId, parsed.data.movieId);
    const existing = await db.contactPerson.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
    if (!existing) return { success: false, error: "Contact Person not found." };
    await db.contactPerson.update({
      where: { id: parsed.data.id },
      data: {
        clientId: parsed.data.clientId,
        projectId: assignment.projectId,
        movieId: assignment.movieId,
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
