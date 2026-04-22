"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { isHR } from "@/lib/permissions";
import { getIstDateKey } from "@/lib/ist";

export async function updateLeaveAdminUserAction(formData: FormData) {
  const user = await requireUserForAction();
  if (!isHR(user)) throw new Error("Only HR can update leave admin settings.");

  const userId = String(formData.get("userId") || "");
  const year = Number(formData.get("year") || getIstDateKey().slice(0, 4));
  const casualLeaves = Number(formData.get("casualLeaves") || 0);
  const earnedLeaves = Number(formData.get("earnedLeaves") || 0);
  const shift = String(formData.get("shift") || "DAY");
  const employmentStatus = String(formData.get("employmentStatus") || "PROBATION");
  const returnTo = String(formData.get("returnTo") || "/leave-admin").trim();

  if (!userId) throw new Error("User is required.");

  await db.leaveYearProfile.upsert({
    where: { userId_year: { userId, year } },
    update: {
      casualLeaves: new Prisma.Decimal(casualLeaves.toFixed(2)),
      earnedLeaves: new Prisma.Decimal(earnedLeaves.toFixed(2)),
      shift: shift as "DAY" | "NIGHT",
      employmentStatus: employmentStatus as "PROBATION" | "PERMANENT",
    },
    create: {
      userId,
      year,
      casualLeaves: new Prisma.Decimal(casualLeaves.toFixed(2)),
      earnedLeaves: new Prisma.Decimal(earnedLeaves.toFixed(2)),
      shift: shift as "DAY" | "NIGHT",
      employmentStatus: employmentStatus as "PROBATION" | "PERMANENT",
    },
  });

  revalidatePath("/leave-admin");
  revalidatePath(`/leave-admin/${userId}`);
  revalidatePath("/leave-requests");
  const safeReturnTo = returnTo.startsWith("/leave-admin") ? returnTo : "/leave-admin";
  redirect(safeReturnTo);
}

export async function createOfficialHolidayAction(formData: FormData) {
  const user = await requireUserForAction();
  if (!isHR(user)) throw new Error("Only HR can manage official holidays.");

  const name = String(formData.get("name") || "").trim();
  const holidayDate = String(formData.get("holidayDate") || "").trim();

  if (!name || !holidayDate) throw new Error("Holiday name and date are required.");

  await db.officialHoliday.create({
    data: {
      name,
      holidayDate: new Date(`${holidayDate}T00:00:00+05:30`),
      year: Number(holidayDate.slice(0, 4)),
    },
  });

  revalidatePath("/leave-admin");
  revalidatePath("/leave-requests");
}

export async function deleteOfficialHolidayAction(formData: FormData) {
  const user = await requireUserForAction();
  if (!isHR(user)) throw new Error("Only HR can manage official holidays.");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Holiday is required.");

  await db.officialHoliday.delete({ where: { id } });

  revalidatePath("/leave-admin");
  revalidatePath("/leave-requests");
}