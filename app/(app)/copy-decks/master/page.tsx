import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageCopyDeckMaster } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { CopyDeckMasterUploadForm } from "@/components/forms/copy-deck-master-upload-form";
import { ensureDefaultCopyDeckMarkets, ensureLegacyCopyDeckCompatibility } from "@/lib/copy-decks/markets";

export default async function CopyDeckMasterPage() {
  const user = await requireUser();
  if (!canManageCopyDeckMaster(user)) redirect("/copy-decks");
  await ensureDefaultCopyDeckMarkets();
  await ensureLegacyCopyDeckCompatibility();
  const count = await db.copyDeckMasterText.count();
  return <div className="space-y-6">
    <PageHeader title="Copy Deck Master" description={`${count} English master text entries with market/locale translations. Only Admin users with functional role Other can download or upload this master.`} actions={<><Link className="btn-secondary" href="/copy-decks">Back</Link><Link className="btn-primary" href="/copy-decks/master/export">Download Wide Master XLSX</Link></>} />
    <CopyDeckMasterUploadForm />
  </div>;
}
