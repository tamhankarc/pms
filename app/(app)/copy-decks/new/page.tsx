import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAccessCopyDecks } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { CopyDeckUploadForm } from "@/components/forms/copy-deck-upload-form";
import { getCopyDeckOptions } from "@/lib/copy-decks/options";

export default async function NewCopyDeckPage() {
  const user = await requireUser();
  if (!canAccessCopyDecks(user)) redirect("/dashboard");
  const options = await getCopyDeckOptions();
  return <div className="space-y-6">
    <PageHeader title="Upload Copy Deck" description="Upload an .xlsx workbook containing an English Text column. Existing master translations are reused before the configured provider is called." actions={<Link className="btn-secondary" href="/copy-decks">Back</Link>} />
    <CopyDeckUploadForm {...options} />
  </div>;
}
