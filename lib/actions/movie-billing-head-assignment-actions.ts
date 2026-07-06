"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import {
  canDeleteMovieBillingHeads,
  canManageMovieBillingHeads,
  canViewCostData,
} from "@/lib/permissions";

export type MovieBillingHeadAssignmentFormState = {
  success?: boolean;
  error?: string;
};

const checkboxSchema = z.preprocess(
  (value) => value === "on" || value === "true" || value === "1",
  z.boolean(),
);

const schema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client is required."),
  movieId: z.string().min(1, "Movie is required."),
  billingHeadId: z.string().min(1, "Billing head is required."),
  countryIds: z.array(z.string()).min(1, "Select at least one country."),
  units: z.coerce.number().min(0, "Units cannot be negative.").optional(),
  isActive: checkboxSchema,
});

function isUsCountry(country: { isoCode: string | null; name: string }) {
  const iso = (country.isoCode ?? "").toUpperCase();
  const name = country.name.trim().toLowerCase();
  return iso === "US" || name === "united states" || name === "usa";
}

async function validateOptionalHeadForSelection(
  clientId: string,
  countryIds: string[],
  movieId: string,
  billingHeadId: string,
) {
  const [countries, movie, head] = await Promise.all([
    db.country.findMany({
      where: { id: { in: countryIds }, isActive: true },
      select: { id: true, isoCode: true, name: true },
    }),
    db.movie.findUnique({
      where: { id: movieId },
      select: {
        id: true,
        clientId: true,
        status: true,
        isActive: true,
        title: true,
        billingDomestic: true,
        billingIntl: true,
        billingOther: true,
      },
    }),
    db.movieBillingHead.findUnique({
      where: { id: billingHeadId },
      select: {
        id: true,
        clientId: true,
        isActive: true,
        costType: true,
        domesticActive: true,
        intlActive: true,
        otherActive: true,
        domesticCompulsionType: true,
        intlCompulsionType: true,
        otherCompulsionType: true,
      },
    }),
  ]);

  if (countries.length !== countryIds.length)
    return {
      ok: false as const,
      error: "One or more selected countries are invalid.",
    };
  if (
    !movie ||
    movie.clientId !== clientId ||
    movie.status !== "WORKING" ||
    !movie.isActive
  )
    return {
      ok: false as const,
      error: "Select a Working movie for the selected client.",
    };
  if (!head || head.clientId !== clientId || !head.isActive)
    return {
      ok: false as const,
      error:
        "Select a valid Fixed - Optional billing head for the selected client.",
    };

  const domesticHeadValid =
    head.domesticActive && head.domesticCompulsionType === "FIXED_OPTIONAL";
  const intlHeadValid =
    head.intlActive && head.intlCompulsionType === "FIXED_OPTIONAL";
  const otherHeadValid =
    head.otherActive && head.otherCompulsionType === "FIXED_OPTIONAL";
  const movieAllowsDomestic = movie.billingDomestic;
  const movieAllowsIntl = movie.billingIntl;
  const movieAllowsOther = movie.billingOther;

  for (const country of countries) {
    const isDomestic = isUsCountry(country);
    if (isDomestic) {
      if (!movieAllowsDomestic || !domesticHeadValid)
        return {
          ok: false as const,
          error:
            "Selected billing head is not valid for Domestic / US billing.",
        };
    } else if (movieAllowsOther) {
      if (!otherHeadValid)
        return {
          ok: false as const,
          error:
            "Selected billing head is not valid for Other billing for the selected movie/country.",
        };
    } else if (!movieAllowsIntl || !intlHeadValid) {
      return {
        ok: false as const,
        error:
          "Selected billing head is not valid for INTL billing for the selected movie/country.",
      };
    }
  }

  return { ok: true as const, costType: head.costType };
}

async function requireCanManageMovieBillingHeads() {
  const user = await requireUserForAction();
  if (!canManageMovieBillingHeads(user))
    throw new Error("You are not allowed to manage movie billing heads.");
  return user;
}

function getAssignmentGroupWhere(row: {
  clientId: string;
  movieId: string;
  billingHeadId: string;
  units: unknown;
  isActive: boolean;
}) {
  return {
    clientId: row.clientId,
    movieId: row.movieId,
    billingHeadId: row.billingHeadId,
    units: row.units == null ? null : Number(row.units),
    isActive: row.isActive,
  };
}

async function saveAssignments(
  data: z.infer<typeof schema>,
  canEditCosts: boolean,
) {
  const valid = await validateOptionalHeadForSelection(
    data.clientId,
    data.countryIds,
    data.movieId,
    data.billingHeadId,
  );
  if (!valid.ok) return { success: false as const, error: valid.error };

  for (const countryId of data.countryIds) {
    const nextUnits =
      valid.costType === "PER_UNIT_COST"
        ? canEditCosts
          ? (data.units ?? 0)
          : 0
        : null;

    await db.movieBillingHeadAssignment.upsert({
      where: {
        countryId_movieId_billingHeadId: {
          countryId,
          movieId: data.movieId,
          billingHeadId: data.billingHeadId,
        },
      },
      create: {
        clientId: data.clientId,
        countryId,
        movieId: data.movieId,
        billingHeadId: data.billingHeadId,
        units: nextUnits,
        isActive: data.isActive,
      },
      update: {
        clientId: data.clientId,
        units: nextUnits,
        isActive: data.isActive,
      },
    });
  }

  return { success: true as const };
}

async function updateAssignments(
  data: z.infer<typeof schema>,
  canEditCosts: boolean,
) {
  if (!data.id)
    return {
      success: false as const,
      error: "Movie billing head is required.",
    };

  const existingAssignment = await db.movieBillingHeadAssignment.findUnique({
    where: { id: data.id },
    include: {
      movie: { select: { status: true, title: true } },
    },
  });

  if (!existingAssignment) {
    return { success: false as const, error: "Movie billing head not found." };
  }

  if (existingAssignment.movie.status === "COMPLETED_BILLED") {
    return {
      success: false as const,
      error: `This movie billing head belongs to the billed title ${existingAssignment.movie.title} and cannot be edited.`,
    };
  }

  const valid = await validateOptionalHeadForSelection(
    data.clientId,
    data.countryIds,
    data.movieId,
    data.billingHeadId,
  );
  if (!valid.ok) return { success: false as const, error: valid.error };

  const existingGroupWhere = getAssignmentGroupWhere(existingAssignment);
  const existingRows = await db.movieBillingHeadAssignment.findMany({
    where: existingGroupWhere,
    select: { id: true, countryId: true, units: true },
  });
  const existingUnitsByCountry = new Map<string, number>();
  for (const row of existingRows)
    existingUnitsByCountry.set(row.countryId, Number(row.units ?? 0));

  const [primaryCountryId, ...remainingCountryIds] = data.countryIds;
  if (!primaryCountryId)
    return { success: false as const, error: "Select at least one country." };

  const getNextUnits = (countryId: string) =>
    valid.costType === "PER_UNIT_COST"
      ? canEditCosts
        ? (data.units ?? 0)
        : (existingUnitsByCountry.get(countryId) ??
          Number(existingAssignment.units ?? 0))
      : null;

  await db.$transaction(async (tx) => {
    await tx.movieBillingHeadAssignment.deleteMany({
      where: {
        ...existingGroupWhere,
        NOT: { id: data.id },
      },
    });

    await tx.movieBillingHeadAssignment.deleteMany({
      where: {
        clientId: data.clientId,
        movieId: data.movieId,
        billingHeadId: data.billingHeadId,
        countryId: { in: data.countryIds },
        NOT: { id: data.id },
      },
    });

    await tx.movieBillingHeadAssignment.update({
      where: { id: data.id },
      data: {
        clientId: data.clientId,
        countryId: primaryCountryId,
        movieId: data.movieId,
        billingHeadId: data.billingHeadId,
        units: getNextUnits(primaryCountryId),
        isActive: data.isActive,
      },
    });

    for (const countryId of remainingCountryIds) {
      await tx.movieBillingHeadAssignment.upsert({
        where: {
          countryId_movieId_billingHeadId: {
            countryId,
            movieId: data.movieId,
            billingHeadId: data.billingHeadId,
          },
        },
        create: {
          clientId: data.clientId,
          countryId,
          movieId: data.movieId,
          billingHeadId: data.billingHeadId,
          units: getNextUnits(countryId),
          isActive: data.isActive,
        },
        update: {
          clientId: data.clientId,
          units: getNextUnits(countryId),
          isActive: data.isActive,
        },
      });
    }
  });

  return { success: true as const };
}

export async function createMovieBillingHeadAssignmentAction(
  _prevState: MovieBillingHeadAssignmentFormState,
  formData: FormData,
): Promise<MovieBillingHeadAssignmentFormState> {
  try {
    const user = await requireCanManageMovieBillingHeads();
    const parsed = schema.safeParse({
      clientId: formData.get("clientId"),
      movieId: formData.get("movieId"),
      billingHeadId: formData.get("billingHeadId"),
      countryIds: formData.getAll("countryIds").map(String),
      units: formData.get("units") || undefined,
      isActive: formData.get("isActive") ?? "off",
    });
    if (!parsed.success)
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message ||
          "Invalid movie billing head payload.",
      };

    const saved = await saveAssignments(parsed.data, canViewCostData(user));
    if (!saved.success) return { success: false, error: saved.error };

    revalidatePath("/movie-billing-heads");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function updateMovieBillingHeadAssignmentAction(
  _prevState: MovieBillingHeadAssignmentFormState,
  formData: FormData,
): Promise<MovieBillingHeadAssignmentFormState> {
  try {
    const user = await requireCanManageMovieBillingHeads();
    const parsed = schema.safeParse({
      id: formData.get("id"),
      clientId: formData.get("clientId"),
      movieId: formData.get("movieId"),
      billingHeadId: formData.get("billingHeadId"),
      countryIds: formData.getAll("countryIds").map(String),
      units: formData.get("units") || undefined,
      isActive: formData.get("isActive") ?? undefined,
    });
    if (!parsed.success || !parsed.data.id)
      return {
        success: false,
        error: parsed.success
          ? "Movie billing head is required."
          : parsed.error.issues[0]?.message,
      };

    const saved = await updateAssignments(parsed.data, canViewCostData(user));
    if (!saved.success) return { success: false, error: saved.error };

    revalidatePath("/movie-billing-heads");
    revalidatePath(`/movie-billing-heads/${parsed.data.id}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function toggleMovieBillingHeadAssignmentStatusAction(
  formData: FormData,
) {
  await requireCanManageMovieBillingHeads();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Movie billing head is required.");
  const row = await db.movieBillingHeadAssignment.findUnique({
    where: { id },
    include: { movie: { select: { status: true, title: true } } },
  });
  if (!row) throw new Error("Movie billing head not found.");
  if (row.movie.status === "COMPLETED_BILLED")
    throw new Error(
      "This movie billing head belongs to a title that has already been billed and cannot be edited.",
    );

  await db.movieBillingHeadAssignment.updateMany({
    where: getAssignmentGroupWhere(row),
    data: { isActive: !row.isActive },
  });

  revalidatePath("/movie-billing-heads");
  revalidatePath(`/movie-billing-heads/${id}`);
}

async function requireCanDeleteMovieBillingHeads() {
  const user = await requireUserForAction();
  if (!canDeleteMovieBillingHeads(user)) {
    throw new Error(
      "Only Admin users with functional role Other can delete title billing heads.",
    );
  }
  return user;
}

export async function deleteMovieBillingHeadAssignmentAction(
  formData: FormData,
) {
  let redirectTo = "/movie-billing-heads";

  try {
    await requireCanDeleteMovieBillingHeads();
    const id = String(formData.get("id") || "");

    if (!id) {
      throw new Error("Title billing head is required.");
    }

    const row = await db.movieBillingHeadAssignment.findUnique({
      where: { id },
    });

    if (!row) {
      throw new Error("Title billing head not found.");
    }

    await db.movieBillingHeadAssignment.deleteMany({
      where: getAssignmentGroupWhere(row),
    });

    revalidatePath("/movie-billing-heads");
    revalidatePath("/billing-reports");
    redirectTo =
      "/movie-billing-heads?deleteSuccess=Title%20billing%20head%20deleted.";
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to delete title billing head.";
    redirectTo = `/movie-billing-heads?deleteError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}
