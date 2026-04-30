"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserTypesForAction } from "@/lib/auth";
import { generateMovieCode } from "@/lib/project-code";

export type MovieFormState = {
  success?: boolean;
  error?: string;
};

const movieSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  title: z.string().min(2, "Movie title is required."),
  description: z.string().optional(),
  status: z.enum(["WORKING", "COMPLETED", "COMPLETED_BILLED"]).default("WORKING"),
  billingDomestic: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  billingIntl: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  billingOther: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  otherCountryIds: z.array(z.string()).optional(),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

export async function createMovieAction(
  _prevState: MovieFormState,
  formData: FormData,
): Promise<MovieFormState> {
  try {
    await requireUserTypesForAction(["ADMIN", "OPERATIONS"]);

    const parsed = movieSchema.safeParse({
      clientId: formData.get("clientId"),
      title: formData.get("title"),
      description: formData.get("description") || "",
      status: formData.get("status") ?? "WORKING",
      billingDomestic: formData.get("billingDomestic") ?? undefined,
      billingIntl: formData.get("billingIntl") ?? undefined,
      billingOther: formData.get("billingOther") ?? undefined,
      otherCountryIds: formData.getAll("otherCountryIds").map(String),
      isActive: formData.get("isActive") ?? "on",
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid movie payload.",
      };
    }

    if ((parsed.data.billingDomestic || parsed.data.billingIntl) && parsed.data.billingOther) return { success: false, error: "Domestic/INTL and Other cannot be selected together." };
    if (!parsed.data.billingDomestic && !parsed.data.billingIntl && !parsed.data.billingOther) return { success: false, error: "Select at least one movie billing region." };
    if (parsed.data.billingOther && !(parsed.data.otherCountryIds?.length)) return { success: false, error: "Select one or more countries for Other billing region." };

    const generatedCode = await generateMovieCode(parsed.data.clientId, parsed.data.title);

    await db.movie.create({
      data: {
        clientId: parsed.data.clientId,
        title: parsed.data.title.trim(),
        code: generatedCode,
        description: parsed.data.description?.trim() || null,
        status: parsed.data.status,
        billingRegion: parsed.data.billingOther ? "OTHER" : parsed.data.billingIntl && !parsed.data.billingDomestic ? "INTL" : "DOMESTIC",
        billingDomestic: Boolean(parsed.data.billingDomestic),
        billingIntl: Boolean(parsed.data.billingIntl),
        billingOther: Boolean(parsed.data.billingOther),
        otherCountryIds: parsed.data.billingOther ? JSON.stringify(parsed.data.otherCountryIds ?? []) : null,
        billingUnitsJson: JSON.stringify(
          Object.fromEntries(
            Array.from(formData.entries())
              .filter(([key]) => key.startsWith("billingHeadUnit_"))
              .map(([key, value]): [string, number] => [
                key.replace("billingHeadUnit_", ""),
                Number(value || 0),
              ])
              .filter(([, value]) => Number.isFinite(value) && value > 0)
          )
        ),
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/movies");
    revalidatePath("/projects/new");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
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
    await requireUserTypesForAction(["ADMIN", "OPERATIONS"]);

    const parsed = movieSchema.safeParse({
      id: formData.get("id"),
      clientId: formData.get("clientId"),
      title: formData.get("title"),
      description: formData.get("description") || "",
      status: formData.get("status") ?? "WORKING",
      billingDomestic: formData.get("billingDomestic") ?? undefined,
      billingIntl: formData.get("billingIntl") ?? undefined,
      billingOther: formData.get("billingOther") ?? undefined,
      otherCountryIds: formData.getAll("otherCountryIds").map(String),
      isActive: formData.get("isActive") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return {
        success: false,
        error: parsed.success ? "Movie is required." : parsed.error.issues[0]?.message,
      };
    }

    const existingMovie = await db.movie.findUnique({
      where: { id: parsed.data.id },
      select: { code: true },
    });

    if (!existingMovie) {
      return { success: false, error: "Movie not found." };
    }

    if ((parsed.data.billingDomestic || parsed.data.billingIntl) && parsed.data.billingOther) return { success: false, error: "Domestic/INTL and Other cannot be selected together." };
    if (!parsed.data.billingDomestic && !parsed.data.billingIntl && !parsed.data.billingOther) return { success: false, error: "Select at least one movie billing region." };
    if (parsed.data.billingOther && !(parsed.data.otherCountryIds?.length)) return { success: false, error: "Select one or more countries for Other billing region." };

    const code = existingMovie.code?.trim() || (await generateMovieCode(parsed.data.clientId, parsed.data.title));

    await db.movie.update({
      where: { id: parsed.data.id },
      data: {
        clientId: parsed.data.clientId,
        title: parsed.data.title.trim(),
        code,
        description: parsed.data.description?.trim() || null,
        status: parsed.data.status,
        billingRegion: parsed.data.billingOther ? "OTHER" : parsed.data.billingIntl && !parsed.data.billingDomestic ? "INTL" : "DOMESTIC",
        billingDomestic: Boolean(parsed.data.billingDomestic),
        billingIntl: Boolean(parsed.data.billingIntl),
        billingOther: Boolean(parsed.data.billingOther),
        otherCountryIds: parsed.data.billingOther ? JSON.stringify(parsed.data.otherCountryIds ?? []) : null,
        billingUnitsJson: JSON.stringify(
          Object.fromEntries(
            Array.from(formData.entries())
              .filter(([key]) => key.startsWith("billingHeadUnit_"))
              .map(([key, value]): [string, number] => [
                key.replace("billingHeadUnit_", ""),
                Number(value || 0),
              ])
              .filter(([, value]) => Number.isFinite(value) && value > 0)
          )
        ),
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/movies");
    revalidatePath(`/movies/${parsed.data.id}`);
    revalidatePath("/projects/new");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function toggleMovieStatusAction(formData: FormData) {
  await requireUserTypesForAction(["ADMIN", "OPERATIONS"]);

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
