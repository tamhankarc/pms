import { getIstTimeParts } from "@/lib/ist";

export type AttendanceReminderKind = "MARK_IN" | "MARK_OUT";
export type AttendanceReminderShift = "DAY" | "NIGHT";

export function getActiveAttendanceReminderShift(
  kind: AttendanceReminderKind,
  now = new Date(),
): AttendanceReminderShift | null {
  const { hours, minutes } = getIstTimeParts(now);
  const total = hours * 60 + minutes;

  if (kind === "MARK_IN") {
    if (total >= 9 * 60 + 45 && total <= 10 * 60 + 45) return "DAY";
    if (total >= 21 * 60 + 30 && total <= 22 * 60 + 30) return "NIGHT";
    return null;
  }

  if (total >= 21 * 60 && total <= 22 * 60) return "DAY";
  if (total >= 9 * 60 && total <= 10 * 60) return "NIGHT";
  return null;
}

export function getAttendanceReminderAvailability(now = new Date()) {
  return {
    markInShift: getActiveAttendanceReminderShift("MARK_IN", now),
    markOutShift: getActiveAttendanceReminderShift("MARK_OUT", now),
  };
}
