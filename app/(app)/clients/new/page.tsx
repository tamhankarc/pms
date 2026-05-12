import { canManageClients, canViewCostData } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientForm } from "@/components/forms/client-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClientAction } from "@/lib/actions/client-actions";

export default async function NewClientPage() {
  const currentUser = await requireUser();
  if (!canManageClients(currentUser)) redirect("/dashboard");


  return (
    <div className="space-y-6">
      <PageHeader
        title="Create client"
        description="Create a client and configure optional dropdowns for downstream Time Entries and Estimates. Client code is generated automatically."
        actions={<Link href="/clients" className="btn-secondary">Back to clients</Link>}
      />
      <div className="max-w-3xl"><ClientForm mode="create" action={createClientAction} canEditCosts={canViewCostData(currentUser)} /></div>
    </div>
  );
}
