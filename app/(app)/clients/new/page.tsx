import Link from "next/link";
import { ClientForm } from "@/components/forms/client-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClientAction } from "@/lib/actions/client-actions";

export default async function NewClientPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create client"
        description="Create a client and configure optional dropdowns for downstream Time Entries and Estimates. Client code is generated automatically."
        actions={<Link href="/clients" className="btn-secondary">Back to clients</Link>}
      />
      <div className="max-w-3xl"><ClientForm mode="create" action={createClientAction} /></div>
    </div>
  );
}
