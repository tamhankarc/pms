import { saveAnnouncementAction } from "@/lib/actions/announcement-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { isHR } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { AnnouncementAudienceSelector } from "@/components/announcements/announcement-audience-selector";

const IST_OFFSET_MINUTES = 5 * 60 + 30;

function toDateTimeLocalValueIst(value: Date) {
  const istMs = value.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 16);
}

function formatDateTimeInIst(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export default async function AnnouncementsPage() {
  const user = await requireUser();
  if (!isHR(user)) redirect("/dashboard");

  const [announcements, eligibleUsers] = await Promise.all([
    db.dashboardAnnouncement.findMany({
      include: {
        recipients: {
          include: {
            user: {
              select: { id: true, fullName: true, userType: true, functionalRole: true },
            },
          },
        },
      },
      orderBy: [{ endsAt: "desc" }, { createdAt: "desc" }],
    }),
    db.user.findMany({
      where: {
        isActive: true,
        NOT: {
          OR: [
            { AND: [{ userType: "ADMIN" }, { functionalRole: "DIRECTOR" }] },
            { userType: "ACCOUNTS" },
          ],
        },
      },
      select: { id: true, fullName: true, userType: true, functionalRole: true },
      orderBy: [{ fullName: "asc" }],
    }),
  ]);

  const userOptions = eligibleUsers.map((row) => ({
    value: row.id,
    label: `${row.fullName} (${row.userType.replaceAll("_", " ")}${
      row.functionalRole ? ` - ${row.functionalRole.replaceAll("_", " ")}` : ""
    })`,
  }));

  const now = new Date();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Announcements"
        description="Create scheduled dashboard announcements for all users or selected users. All date-times on this page are in IST."
      />

      <section className="card p-6">
        <h2 className="section-title">Create announcement</h2>
        <p className="section-subtitle">
          Heading is optional. Expired announcements can be reused by editing them below. Date-times are interpreted in IST.
        </p>

        <form action={saveAnnouncementAction} className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Heading (optional)</label>
            <input name="heading" className="input mt-1" />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea name="description" className="input mt-1 min-h-28" required />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Start date-time (IST)</label>
              <input type="datetime-local" name="startsAt" className="input mt-1" required />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">End date-time (IST)</label>
              <input type="datetime-local" name="endsAt" className="input mt-1" required />
            </div>
          </div>

          <AnnouncementAudienceSelector
            modeName="audienceMode"
            userIdsName="userIds"
            options={userOptions}
            defaultMode="all"
            defaultUserIds={[]}
          />

          <button className="btn-primary" type="submit">
            Save announcement
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {announcements.map((announcement) => {
          const defaultMode: "all" | "specific" = announcement.targetAll ? "all" : "specific";

          return (
            <section key={announcement.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="section-title">{announcement.heading || "Untitled announcement"}</h2>
                  <p className="section-subtitle">
                    {formatDateTimeInIst(announcement.startsAt)} IST - {formatDateTimeInIst(announcement.endsAt)} IST
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    announcement.endsAt < now
                      ? "bg-slate-200 text-slate-700"
                      : announcement.startsAt > now
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {announcement.endsAt < now
                    ? "Expired"
                    : announcement.startsAt > now
                      ? "Scheduled"
                      : "Active"}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{announcement.description}</p>

              <p className="mt-3 text-sm text-slate-500">
                Audience:{" "}
                {announcement.targetAll
                  ? "All Users"
                  : announcement.recipients.map((recipient) => recipient.user.fullName).join(", ") ||
                    "No users selected"}
              </p>

              <form action={saveAnnouncementAction} className="mt-5 space-y-4 border-t border-slate-200 pt-5">
                <input type="hidden" name="id" value={announcement.id} />

                <div>
                  <label className="text-sm font-medium text-slate-700">Heading (optional)</label>
                  <input name="heading" className="input mt-1" defaultValue={announcement.heading ?? ""} />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Description</label>
                  <textarea
                    name="description"
                    className="input mt-1 min-h-28"
                    defaultValue={announcement.description}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Start date-time (IST)</label>
                    <input
                      type="datetime-local"
                      name="startsAt"
                      className="input mt-1"
                      defaultValue={toDateTimeLocalValueIst(announcement.startsAt)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">End date-time (IST)</label>
                    <input
                      type="datetime-local"
                      name="endsAt"
                      className="input mt-1"
                      defaultValue={toDateTimeLocalValueIst(announcement.endsAt)}
                      required
                    />
                  </div>
                </div>

                <AnnouncementAudienceSelector
                  modeName="audienceMode"
                  userIdsName="userIds"
                  options={userOptions}
                  defaultMode={defaultMode}
                  defaultUserIds={announcement.recipients.map((recipient) => recipient.userId)}
                />

                <button className="btn-primary" type="submit">
                  Update announcement
                </button>
              </form>
            </section>
          );
        })}

        {announcements.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">No announcements created yet.</div>
        ) : null}
      </section>
    </div>
  );
}