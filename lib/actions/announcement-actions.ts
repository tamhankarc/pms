"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

function parseDateTimeLocalAsIst(value: FormDataEntryValue | null, fieldLabel: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${fieldLabel} is required.`);

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`${fieldLabel} is invalid.`);

  const [, year, month, day, hour, minute] = match;

  const utcMs =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0,
    ) -
    (5 * 60 + 30) * 60 * 1000;

  return new Date(utcMs);
}

export async function saveAnnouncementAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const headingRaw = String(formData.get("heading") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const audienceMode = String(formData.get("audienceMode") ?? "all").trim();
  const targetAll = audienceMode === "all";

  const heading = headingRaw || null;
  const startsAt = parseDateTimeLocalAsIst(formData.get("startsAt"), "Start date-time");
  const endsAt = parseDateTimeLocalAsIst(formData.get("endsAt"), "End date-time");

  const rawUserIds = formData.getAll("userIds");
  const userIds = Array.from(
    new Set(
      rawUserIds
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );

  if (!description) {
    throw new Error("Description is required.");
  }

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error("Valid start and end date-time are required.");
  }

  if (endsAt <= startsAt) {
    throw new Error("End date-time must be after start date-time.");
  }

  if (!targetAll && userIds.length === 0) {
    throw new Error("Select at least one specific user.");
  }

  if (id) {
    await db.dashboardAnnouncement.update({
      where: { id },
      data: {
        heading,
        description,
        startsAt,
        endsAt,
        targetAll,
        recipients: {
          deleteMany: {},
          ...(targetAll
            ? {}
            : {
                createMany: {
                  data: userIds.map((userId) => ({ userId })),
                },
              }),
        },
      },
    });
  } else {
    await db.dashboardAnnouncement.create({
      data: {
        heading,
        description,
        startsAt,
        endsAt,
        targetAll,
        ...(targetAll
          ? {}
          : {
              recipients: {
                createMany: {
                  data: userIds.map((userId) => ({ userId })),
                },
              },
            }),
      },
    });
  }

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
}