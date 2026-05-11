import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { NewsletterForm } from "@/components/forms/newsletter-form";
import { createNewsletterAction } from "@/lib/actions/newsletter-actions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageNewsletters } from "@/lib/permissions";

export default async function NewNewsletterPage() {
  const user = await requireUser();
  if (!canManageNewsletters(user)) redirect("/dashboard");
  const clients = await db.client.findMany({ where: { isActive: true, showNewslettersInEntries: true }, select: { id: true, name: true, showNewslettersInEntries: true }, orderBy: { name: "asc" } });
  return <div className="space-y-6"><PageHeader title="Create Newsletter" description="Create a client-specific newsletter." actions={<Link href="/newsletters" className="btn-secondary">Back to Newsletters</Link>} /><div className="max-w-3xl"><NewsletterForm clients={clients} action={createNewsletterAction} title="Create Newsletter" submitLabel="Create Newsletter" /></div></div>;
}
