import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { MobileLocationCorrectionClient } from "@/components/ems/mobile-location-correction-client";
import { requireUser } from "@/lib/auth";
import { canMarkAttendance } from "@/lib/permissions";

export default async function MobileLocationCorrectionPage() {
  const user = await requireUser();
  if (!canMarkAttendance(user)) redirect("/dashboard");

  return (
    <>
      <div className="mx-auto hidden max-w-2xl lg:block">
        <section className="card p-6">
          <h1 className="section-title">Mobile Location Check</h1>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            This page is mobile-only. Please open it from your phone browser.
          </div>
        </section>
      </div>
      <div className="mx-auto max-w-2xl space-y-6 lg:hidden">
        <PageHeader
          title="Mobile Location Check"
          description="Check your current mobile location and update today's eligible Mark-In or Mark-Out location if city or state is different."
        />
        <MobileLocationCorrectionClient />
      </div>
    </>
  );
}
