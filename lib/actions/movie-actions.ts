"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserTypes } from "@/lib/auth";

export type MovieFormState = {
  success?: boolean;
  error?: string;
};

const movieSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  title: z.string().min(2, "Movie title is required."),
  code: z.string().trim().optional(),
  description: z.string().optional(),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

export async function createMovieAction(
  _prevState: MovieFormState,
  formData: FormData,
): Promise<MovieFormState> {
  try {
    await requireUserTypes(["ADMIN", "MANAGER"]);

    const parsed = movieSchema.safeParse({
      clientId: formData.get("clientId"),
      title: formData.get("title"),
      code: formData.get("code") || "",
      description: formData.get("description") || "",
      isActive: formData.get("isActive") ?? "on",
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid movie payload.",
      };
    }

    await db.movie.create({
      data: {
        clientId: parsed.data.clientId,
        title: parsed.data.title,
        code: parsed.data.code?.trim() || null,
        description: parsed.data.description?.trim() || null,
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/movies");
    revalidatePath("/projects/new");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function updateMovieAction(
  _prevState: MovieFormState,
  formData: FormData,
): Promise<MovieFormState> {
  try {
    await requireUserTypes(["ADMIN", "MANAGER"]);

    const parsed = movieSchema.safeParse({
      id: formData.get("id"),
      clientId: formData.get("clientId"),
      title: formData.get("title"),
      code: formData.get("code") || "",
      description: formData.get("description") || "",
      isActive: formData.get("isActive") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return {
        success: false,
        error: parsed.success ? "Movie is required." : parsed.error.issues[0]?.message,
      };
    }

    await db.movie.update({
      where: { id: parsed.data.id },
      data: {
        clientId: parsed.data.clientId,
        title: parsed.data.title,
        code: parsed.data.code?.trim() || null,
        description: parsed.data.description?.trim() || null,
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/movies");
    revalidatePath(`/movies/${parsed.data.id}`);
    revalidatePath("/projects/new");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function toggleMovieStatusAction(formData: FormData) {
  await requireUserTypes(["ADMIN", "MANAGER"]);

  const movieId = String(formData.get("movieId") || "");
  if (!movieId) throw new Error("Movie is required.");

  const movie = await db.movie.findUnique({ where: { id: movieId } });
  if (!movie) throw new Error("Movie not found.");

  await db.movie.update({
    where: { id: movieId },
    data: { isActive: !movie.isActive },
  });

  revalidatePath("/movies");
  revalidatePath(`/movies/${movieId}`);
  revalidatePath("/projects/new");
}
