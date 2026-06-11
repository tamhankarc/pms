import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { updateManualAttendanceLogAction } from "@/lib/actions/manual-attendance-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAddManualAttendance } from "@/lib/permissions";
import { getIstDateKey, getIstTimeParts } from "@/lib/ist";

function getIstTimeInputValue(date: Date) {
  const { hours, minutes } = getIstTimeParts(date);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildAttendanceHistoryHref({
  userId,
  fromDate,
  toDate,
  page,
}: {
  userId?: string;
  fromDate?: string;
  toDate?: string;
  page?: string;
}) {
  const search = new URLSearchParams();
  if (userId) search.set("userId", userId);
  if (fromDate) search.set("fromDate", fromDate);
  if (toDate) search.set("toDate", toDate);
  if (page && page !== "1") search.set("page", page);
  const query = search.toString();
  return query ? `/attendance-history?${query}` : "/attendance-history";
}

export default async function EditAttendanceLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ logId: string }>;
  searchParams?: Promise<{
    userId?: string;
    fromDate?: string;
    toDate?: string;
    page?: string;
  }>;
}) {
  const currentUser = await requireUser();
  if (!canAddManualAttendance(currentUser)) redirect("/dashboard");

  const { logId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const returnHref = buildAttendanceHistoryHref(resolvedSearchParams);

  const log = await db.attendanceLog.findUnique({
    where: { id: logId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          employeeCode: true,
        },
      },
    },
  });

  if (!log) {
    const search = new URLSearchParams();
    search.set("error", "Attendance log record was not found.");
    redirect(`/attendance-history?${search.toString()}`);
  }

  const attendanceDate = getIstDateKey(log.attendanceDate);
  const markedAtDate = getIstDateKey(log.markedAt);
  const markedAtTime = getIstTimeInputValue(log.markedAt);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Edit Attendance Log"
        description="Update one existing Mark-In or Mark-Out record."
      />

      <section className="card p-6">
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Editing record for <strong>{log.user.fullName}</strong>
          {log.user.employeeCode ? ` (${log.user.employeeCode})` : ""} · {log.user.email}
        </div>

        <form action={updateManualAttendanceLogAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="logId" value={log.id} />
          <input type="hidden" name="userId" value={log.userId} />
          <input type="hidden" name="fromDate" value={resolvedSearchParams.fromDate ?? ""} />
          <input type="hidden" name="toDate" value={resolvedSearchParams.toDate ?? ""} />

          <div className="xl:col-span-2">
            <label className="form-label">User</label>
            <div className="input-field flex items-center bg-slate-50 text-slate-700">
              {log.user.fullName} ({log.user.username})
            </div>
          </div>

          <div>
            <label htmlFor="actionType" className="form-label">
              Action
            </label>
            <SearchableCombobox
              id="actionType"
              name="actionType"
              required
              defaultValue={log.type}
              options={[
                { value: "MARK_IN", label: "Mark-In" },
                { value: "MARK_OUT", label: "Mark-Out" },
              ]}
              placeholder="Select action"
              searchPlaceholder="Search actions..."
              emptyLabel="No action found."
              buttonClassName="input-field"
            />
          </div>

          <div>
            <label htmlFor="attendanceDate" className="form-label">
              Attendance/work date
            </label>
            <input id="attendanceDate" name="attendanceDate" type="date" required defaultValue={attendanceDate} className="input-field" />
          </div>

          <div>
            <label htmlFor="markedAtDate" className="form-label">
              Marked-at date (IST)
            </label>
            <input id="markedAtDate" name="markedAtDate" type="date" required defaultValue={markedAtDate} className="input-field" />
          </div>

          <div>
            <label htmlFor="markedAtTime" className="form-label">
              Marked-at time (IST)
            </label>
            <input id="markedAtTime" name="markedAtTime" type="time" required defaultValue={markedAtTime} className="input-field" />
          </div>

          <div>
            <label htmlFor="city" className="form-label">
              City
            </label>
            <input id="city" name="city" type="text" className="input-field" placeholder="Optional" defaultValue={log.city ?? ""} />
          </div>

          <div>
            <label htmlFor="state" className="form-label">
              State
            </label>
            <input id="state" name="state" type="text" className="input-field" placeholder="Optional" defaultValue={log.state ?? ""} />
          </div>

          <div>
            <label htmlFor="latitude" className="form-label">
              Latitude
            </label>
            <input id="latitude" name="latitude" type="number" step="0.0000001" className="input-field" placeholder="0.0000000" defaultValue={String(log.latitude)} />
          </div>

          <div>
            <label htmlFor="longitude" className="form-label">
              Longitude
            </label>
            <input id="longitude" name="longitude" type="number" step="0.0000001" className="input-field" placeholder="0.0000000" defaultValue={String(log.longitude)} />
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <p className="text-xs text-slate-500">
              For night-shift Mark-Out after midnight, keep Attendance/work date as the shift start date and set Marked-at date to the next calendar date.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-4">
            <button type="submit" className="btn-primary">
              Update attendance log
            </button>
            <Link href={returnHref} className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
