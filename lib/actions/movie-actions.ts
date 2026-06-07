"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { canManageMovies, canViewCostData } from "@/lib/permissions";
import { generateMovieCode } from "@/lib/project-code";

const WARNER_CLIENT_ID = "cmn66av4j0001l104077m5vxz";
const SONY_PICTURES_CLIENT_ID = "cmn66d3q40002l104n6wvefvl";
function canConfigureMovieBillingRegion(clientId: string) {
  return clientId === WARNER_CLIENT_ID || clientId === SONY_PICTURES_CLIENT_ID;
}

export type MovieFormState = {
  success?: boolean;
  error?: string;
};

const movieSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  title: z.string().min(2, "Movie title is required."),
  contactPersonId: z.string().optional(),
  description: z.string().optional(),
  status: z
    .enum(["WORKING", "COMPLETED", "COMPLETED_BILLED"])
    .default("WORKING"),
  billingDomestic: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  billingIntl: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  billingOther: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  billingSocial: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  billingPortal: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  contactPersonIds: z.array(z.string()).optional(),
  otherCountryIds: z.array(z.string()).optional(),
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  sonyTicketingBannerCost: z.coerce
    .number()
    .nonnegative("Ticketing Banner cost cannot be negative.")
    .optional(),
  sonyEmailTicketingBannerCost: z.coerce
    .number()
    .nonnegative("Email Ticketing Banner cost cannot be negative.")
    .optional(),
  sonyCoppaSite: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
  sonyGlobalEpkSite: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional(),
});

async function requireCanManageMovies() {
  const user = await requireUserForAction();
  if (!canManageMovies(user))
    throw new Error("You are not allowed to manage movies.");
  return user;
}
export async function createMovieAction(
  _prevState: MovieFormState,
  formData: FormData,
): Promise<MovieFormState> {
  try {
    const user = await requireCanManageMovies();

    const parsed = movieSchema.safeParse({
      clientId: formData.get("clientId"),
      title: formData.get("title"),
      contactPersonId: String(formData.get("contactPersonId") ?? ""),
      contactPersonIds: formData.getAll("contactPersonIds").map(String),
      description: formData.get("description") || "",
      status: formData.get("status") ?? "WORKING",
      billingDomestic: formData.get("billingDomestic") ?? undefined,
      billingIntl: formData.get("billingIntl") ?? undefined,
      billingOther: formData.get("billingOther") ?? undefined,
      billingSocial: formData.get("billingSocial") ?? undefined,
      billingPortal: formData.get("billingPortal") ?? undefined,
      otherCountryIds: formData.getAll("otherCountryIds").map(String),
      isActive: formData.get("isActive") ?? "on",
      sonyTicketingBannerCost: formData.get("sonyTicketingBannerCost") || 0,
      sonyEmailTicketingBannerCost:
        formData.get("sonyEmailTicketingBannerCost") || 0,
      sonyCoppaSite: formData.get("sonyCoppaSite") ?? undefined,
      sonyGlobalEpkSite: formData.get("sonyGlobalEpkSite") ?? undefined,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid movie payload.",
      };
    }

    const canConfigureRegion = canConfigureMovieBillingRegion(
      parsed.data.clientId,
    );
    const billingSocial =
      parsed.data.clientId === WARNER_CLIENT_ID
        ? Boolean(parsed.data.billingSocial)
        : false;
    const billingDomestic = canConfigureRegion
      ? Boolean(parsed.data.billingDomestic)
      : !canConfigureRegion;
    const billingIntl = canConfigureRegion
      ? Boolean(parsed.data.billingIntl)
      : false;
    const billingOther = canConfigureRegion
      ? Boolean(parsed.data.billingOther)
      : false;
    const billingPortal = canConfigureRegion
      ? Boolean(parsed.data.billingPortal)
      : false;
    const contactPersonIds = Array.from(
      new Set(
        parsed.data.contactPersonIds ??
          (parsed.data.contactPersonId ? [parsed.data.contactPersonId] : []),
      ),
    ).filter(Boolean);
    const otherCountryIds = billingOther
      ? (parsed.data.otherCountryIds ?? [])
      : [];

    if ((billingDomestic || billingIntl || billingSocial) && billingOther)
      return {
        success: false,
        error: "Other cannot be selected with Domestic, INTL, or Social.",
      };
    if (
      !billingDomestic &&
      !billingIntl &&
      !billingOther &&
      !billingSocial &&
      !billingPortal
    )
      return {
        success: false,
        error: "Select at least one movie billing region.",
      };
    if (billingOther && !otherCountryIds.length)
      return {
        success: false,
        error: "Select one or more countries for Other billing region.",
      };

    if (contactPersonIds.length) {
      const contactPersonCount = await db.contactPerson.count({
        where: { id: { in: contactPersonIds }, clientId: parsed.data.clientId },
      });
      if (contactPersonCount !== contactPersonIds.length)
        return {
          success: false,
          error:
            "One or more selected contact persons do not belong to selected client.",
        };
    }

    const generatedCode = await generateMovieCode(
      parsed.data.clientId,
      parsed.data.title,
    );

    await db.movie.create({
      data: {
        clientId: parsed.data.clientId,
        contactPersonId: contactPersonIds[0] || null,
        title: parsed.data.title.trim(),
        code: generatedCode,
        description: parsed.data.description?.trim() || null,
        status: parsed.data.status,
        billingRegion: billingOther
          ? "OTHER"
          : billingPortal && !billingDomestic && !billingIntl && !billingSocial
            ? "PORTAL"
            : billingSocial && !billingDomestic && !billingIntl
              ? "SOCIAL"
              : billingIntl && !billingDomestic
                ? "INTL"
                : "DOMESTIC",
        billingDomestic,
        billingIntl,
        billingOther,
        billingSocial,
        billingPortal,
        contactPersons: contactPersonIds.length
          ? { connect: contactPersonIds.map((id) => ({ id })) }
          : undefined,
        otherCountryIds: billingOther ? JSON.stringify(otherCountryIds) : null,
        sonyTicketingBannerCost: canViewCostData(user)
          ? (parsed.data.sonyTicketingBannerCost ?? 0)
          : 0,
        sonyEmailTicketingBannerCost: canViewCostData(user)
          ? (parsed.data.sonyEmailTicketingBannerCost ?? 0)
          : 0,
        sonyCoppaSite:
          parsed.data.clientId === SONY_PICTURES_CLIENT_ID
            ? Boolean(parsed.data.sonyCoppaSite)
            : false,
        sonyGlobalEpkSite:
          parsed.data.clientId === SONY_PICTURES_CLIENT_ID
            ? Boolean(parsed.data.sonyGlobalEpkSite)
            : false,
        billingUnitsJson: JSON.stringify(
          Object.fromEntries(
            Array.from(formData.entries())
              .filter(([key]) => key.startsWith("billingHeadUnit_"))
              .map(([key, value]): [string, number] => [
                key.replace("billingHeadUnit_", ""),
                Number(value || 0),
              ])
              .filter(([, value]) => Number.isFinite(value) && value > 0),
          ),
        ),
        isActive: Boolean(parsed.data.isActive),
      },
    });

    revalidatePath("/movies");
    revalidatePath("/movies/new");
    revalidatePath("/projects/new");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    redirect("/movies");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
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
    const user = await requireCanManageMovies();

    const parsed = movieSchema.safeParse({
      id: formData.get("id"),
      clientId: formData.get("clientId"),
      title: formData.get("title"),
      contactPersonId: String(formData.get("contactPersonId") ?? ""),
      contactPersonIds: formData.getAll("contactPersonIds").map(String),
      description: formData.get("description") || "",
      status: formData.get("status") ?? "WORKING",
      billingDomestic: formData.get("billingDomestic") ?? undefined,
      billingIntl: formData.get("billingIntl") ?? undefined,
      billingOther: formData.get("billingOther") ?? undefined,
      billingSocial: formData.get("billingSocial") ?? undefined,
      billingPortal: formData.get("billingPortal") ?? undefined,
      otherCountryIds: formData.getAll("otherCountryIds").map(String),
      isActive: formData.get("isActive") ?? undefined,
      sonyTicketingBannerCost: formData.get("sonyTicketingBannerCost") || 0,
      sonyEmailTicketingBannerCost:
        formData.get("sonyEmailTicketingBannerCost") || 0,
      sonyCoppaSite: formData.get("sonyCoppaSite") ?? undefined,
      sonyGlobalEpkSite: formData.get("sonyGlobalEpkSite") ?? undefined,
    });

    if (!parsed.success || !parsed.data.id) {
      return {
        success: false,
        error: parsed.success
          ? "Movie is required."
          : parsed.error.issues[0]?.message,
      };
    }

    const existingMovie = await db.movie.findUnique({
      where: { id: parsed.data.id },
      select: {
        code: true,
        sonyTicketingBannerCost: true,
        sonyEmailTicketingBannerCost: true,
        sonyCoppaSite: true,
        sonyGlobalEpkSite: true,
        billingUnitsJson: true,
      },
    });

    if (!existingMovie) {
      return { success: false, error: "Movie not found." };
    }

    const canConfigureRegion = canConfigureMovieBillingRegion(
      parsed.data.clientId,
    );
    const billingSocial =
      parsed.data.clientId === WARNER_CLIENT_ID
        ? Boolean(parsed.data.billingSocial)
        : false;
    const billingDomestic = canConfigureRegion
      ? Boolean(parsed.data.billingDomestic)
      : !canConfigureRegion;
    const billingIntl = canConfigureRegion
      ? Boolean(parsed.data.billingIntl)
      : false;
    const billingOther = canConfigureRegion
      ? Boolean(parsed.data.billingOther)
      : false;
    const billingPortal = canConfigureRegion
      ? Boolean(parsed.data.billingPortal)
      : false;
    const contactPersonIds = Array.from(
      new Set(
        parsed.data.contactPersonIds ??
          (parsed.data.contactPersonId ? [parsed.data.contactPersonId] : []),
      ),
    ).filter(Boolean);
    const otherCountryIds = billingOther
      ? (parsed.data.otherCountryIds ?? [])
      : [];

    if ((billingDomestic || billingIntl || billingSocial) && billingOther)
      return {
        success: false,
        error: "Other cannot be selected with Domestic, INTL, or Social.",
      };
    if (
      !billingDomestic &&
      !billingIntl &&
      !billingOther &&
      !billingSocial &&
      !billingPortal
    )
      return {
        success: false,
        error: "Select at least one movie billing region.",
      };
    if (billingOther && !otherCountryIds.length)
      return {
        success: false,
        error: "Select one or more countries for Other billing region.",
      };

    if (contactPersonIds.length) {
      const contactPersonCount = await db.contactPerson.count({
        where: { id: { in: contactPersonIds }, clientId: parsed.data.clientId },
      });
      if (contactPersonCount !== contactPersonIds.length)
        return {
          success: false,
          error:
            "One or more selected contact persons do not belong to selected client.",
        };
    }

    const code =
      existingMovie.code?.trim() ||
      (await generateMovieCode(parsed.data.clientId, parsed.data.title));

    await db.movie.update({
      where: { id: parsed.data.id },
      data: {
        clientId: parsed.data.clientId,
        contactPersonId: contactPersonIds[0] || null,
        title: parsed.data.title.trim(),
        code,
        description: parsed.data.description?.trim() || null,
        status: parsed.data.status,
        billingRegion: billingOther
          ? "OTHER"
          : billingPortal && !billingDomestic && !billingIntl && !billingSocial
            ? "PORTAL"
            : billingSocial && !billingDomestic && !billingIntl
              ? "SOCIAL"
              : billingIntl && !billingDomestic
                ? "INTL"
                : "DOMESTIC",
        billingDomestic,
        billingIntl,
        billingOther,
        billingSocial,
        billingPortal,
        contactPersons: { set: contactPersonIds.map((id) => ({ id })) },
        otherCountryIds: billingOther ? JSON.stringify(otherCountryIds) : null,
        sonyTicketingBannerCost: canViewCostData(user)
          ? (parsed.data.sonyTicketingBannerCost ?? 0)
          : existingMovie.sonyTicketingBannerCost,
        sonyEmailTicketingBannerCost: canViewCostData(user)
          ? (parsed.data.sonyEmailTicketingBannerCost ?? 0)
          : existingMovie.sonyEmailTicketingBannerCost,
        sonyCoppaSite:
          parsed.data.clientId === SONY_PICTURES_CLIENT_ID
            ? Boolean(parsed.data.sonyCoppaSite)
            : false,
        sonyGlobalEpkSite:
          parsed.data.clientId === SONY_PICTURES_CLIENT_ID
            ? Boolean(parsed.data.sonyGlobalEpkSite)
            : false,
        billingUnitsJson: canViewCostData(user)
          ? JSON.stringify(
              Object.fromEntries(
                Array.from(formData.entries())
                  .filter(([key]) => key.startsWith("billingHeadUnit_"))
                  .map(([key, value]): [string, number] => [
                    key.replace("billingHeadUnit_", ""),
                    Number(value || 0),
                  ])
                  .filter(([, value]) => Number.isFinite(value) && value > 0),
              ),
            )
          : existingMovie.billingUnitsJson,
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
  await requireCanManageMovies();

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

async function requireCanDeleteMovies() {
  const user = await requireUserForAction();
  if (user.userType !== "ADMIN" || user.functionalRole !== "OTHER") {
    throw new Error(
      "Only Admin users with functional role Other can delete titles.",
    );
  }
  return user;
}

export async function deleteMovieAction(formData: FormData) {
  let redirectTo = "/movies";

  try {
    await requireCanDeleteMovies();
    const movieId = String(formData.get("movieId") || "");

    if (!movieId) {
      throw new Error("Title is required.");
    }

    const movie = await db.movie.findUnique({
      where: { id: movieId },
      select: { id: true },
    });

    if (!movie) {
      throw new Error("Title not found.");
    }

    await db.movie.delete({
      where: { id: movieId },
    });

    revalidatePath("/movies");
    revalidatePath("/projects/new");
    revalidatePath("/time-entries");
    revalidatePath("/estimates");
    revalidatePath("/billing-reports");
    redirectTo = "/movies?deleteSuccess=Title%20deleted.";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete title.";
    redirectTo = `/movies?deleteError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

export async function completeMovieBillingAction(formData: FormData) {
  await requireCanManageMovies();

  const movieId = String(formData.get("movieId") || "");
  const billingDateValue = String(formData.get("billingDate") || "");
  const invoiceNumber = String(formData.get("invoiceNumber") || "").trim();
  const returnTo = String(formData.get("returnTo") || "/billing-reports");

  if (!movieId) throw new Error("Title is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(billingDateValue))
    throw new Error("Billing date is required.");
  if (!invoiceNumber) throw new Error("Invoice number is required.");

  const movie = await db.movie.findUnique({
    where: { id: movieId },
    select: { clientId: true },
  });
  if (!movie) throw new Error("Title not found.");

  await db.movie.update({
    where: { id: movieId },
    data: {
      status: "COMPLETED_BILLED",
      billingDate: new Date(`${billingDateValue}T00:00:00`),
      billingInvoiceNumber: invoiceNumber,
    },
  });

  await db.purchaseOrder.updateMany({
    where: {
      clientId: movie.clientId,
      assignments: { some: { movieId } },
    },
    data: { status: "PROCESSED" },
  });

  revalidatePath("/movies");
  revalidatePath(`/movies/${movieId}`);
  revalidatePath("/billing-reports");
  redirect(returnTo.startsWith("/") ? returnTo : "/billing-reports");
}

export async function completeClientMonthBillingAction(formData: FormData) {
  await requireCanManageMovies();

  const clientId = String(formData.get("clientId") || "");
  const monthValue = String(formData.get("month") || "");
  const billingDateValue = String(formData.get("billingDate") || "");
  // const invoiceNumber = String(formData.get("invoiceNumber") || "").trim();
  const returnTo = String(formData.get("returnTo") || "/billing-reports");

  if (!clientId) throw new Error("Client is required.");
  if (!/^\d{4}-\d{2}$/.test(monthValue))
    throw new Error("Billing month is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(billingDateValue))
    throw new Error("Billing date is required.");

  const [yearText, monthText] = monthValue.split("-");
  const month = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1));
  const billingDate = new Date(`${billingDateValue}T00:00:00`);

  await db.clientMonthlyBilling.upsert({
    where: { clientId_month: { clientId, month } },
    update: { billingDate },
    create: { clientId, month, billingDate },
  });

  revalidatePath("/billing-reports");
  redirect(returnTo.startsWith("/") ? returnTo : "/billing-reports");
}
