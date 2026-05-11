import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { NewsletterForm } from "@/components/forms/newsletter-form";
import { updateNewsletterAction } from "@/lib/actions/newsletter-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageNewsletters } from "@/lib/permissions";

export default async function EditNewsletterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManageNewsletters(user)) redirect("/dashboard");
  const { id } = await params;
  const [clients, newsletter] = await Promise.all([
    db.client.findMany({ where: { isActive: true, showNewslettersInEntries: true }, select: { id: true, name: true, showNewslettersInEntries: true }, orderBy: { name: "asc" } }),
    db.newsletter.findUnique({ where: { id } }),
  ]);
  if (!newsletter) notFound();
  return <div className="space-y-6"><PageHeader title={`Edit Newsletter · ${newsletter.name}`} description="Update newsletter details." actions={<Link href="/newsletters" className="btn-secondary">Back to Newsletters</Link>} /><div className="max-w-3xl"><NewsletterForm clients={clients} action={updateNewsletterAction} title={`Edit Newsletter: ${newsletter.name}`} submitLabel="Save changes" initialValues={{ id: newsletter.id, clientId: newsletter.clientId, name: newsletter.name, newsletterType: newsletter.newsletterType, isActive: newsletter.isActive }} /></div></div>;
}
