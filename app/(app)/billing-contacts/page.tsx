import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { BillingContactForm } from "@/components/forms/billing-contact-form";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageContactPersons } from "@/lib/permissions";
import { deleteBillingContactAction, saveBillingContactAction } from "@/lib/actions/billing-contact-actions";
import { getBillingReportCatalogForClient } from "@/lib/billing-reports/amazon";

const fallbackReports = [
  { value: "social-assets", label: "Social Assets" },
  { value: "localization", label: "Localization" },
  { value: "domestic-deliverable", label: "Domestic Deliverable" },
  { value: "intl-deliverable", label: "INTL Deliverable" },
  { value: "other-deliverable", label: "Other Deliverable" },
  { value: "billing-summary", label: "Billing Summary" },
  { value: "billing-summary-history", label: "Billing Summary History" },
  { value: "filmik", label: "Filmik Billing Report" },
  { value: "generic", label: "Generic Billing Report" },
];

function formatLevel(level: string) {
  if (level === "CLIENT_PROJECT") return "Client + Project";
  if (level === "CLIENT_BILLING_REPORT") return "Client + Billing Report";
  return "Client";
}

type BillingContactAssignmentRow = {
  id: string;
  assignmentLevel: string;
  billingReportType: string | null;
  client: {
    name: string;
  };
  contactPerson: {
    name: string;
    email: string;
  };
  project: {
    name: string;
  } | null;
};

export default async function BillingContactsPage() {
  const user = await requireUser();
  if (!canManageContactPersons(user)) redirect("/dashboard");
  const [clients, contactPersons, projects, assignments] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.contactPerson.findMany({ where: { client: { isActive: true } }, select: { id: true, clientId: true, name: true, email: true }, orderBy: [{ client: { name: "asc" } }, { name: "asc" }] }),
    db.project.findMany({ where: { isActive: true }, select: { id: true, clientId: true, name: true }, orderBy: [{ client: { name: "asc" } }, { name: "asc" }] }),
    db.billingContactAssignment.findMany({ include: { client: true, contactPerson: true, project: true }, orderBy: [{ client: { name: "asc" } }, { assignmentLevel: "asc" }] }),
  ]);
  const catalogReports = clients.flatMap((client: { id: string; name: string }) => {
    const catalog = getBillingReportCatalogForClient(client.name, client.id) ?? {};
    return Object.entries(catalog).map(([value, item]) => ({ value, label: item.title }));
  });
  const reportMap = new Map([...fallbackReports, ...catalogReports].map((item) => [item.value, item]));
  const reports = Array.from(reportMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-6">
      <PageHeader title="Billing Contacts" description="Assign Bill To contacts for Client, Client + Project, or Client + Billing Report." actions={<Link href="/contact-persons" className="btn-secondary">Contact Persons</Link>} />
      <div className="max-w-4xl"><BillingContactForm clients={clients} contactPersons={contactPersons} projects={projects} reports={reports} action={saveBillingContactAction} /></div>
      <div className="table-wrapper">
        <table className="min-w-full text-sm"><thead><tr><th className="table-head">Client</th><th className="table-head">Level</th><th className="table-head">Project / Report</th><th className="table-head">Bill To</th><th className="table-head">Actions</th></tr></thead><tbody>
          {assignments.map((assignment: BillingContactAssignmentRow) => <tr key={assignment.id}><td className="table-cell font-medium text-slate-900">{assignment.client.name}</td><td className="table-cell">{formatLevel(assignment.assignmentLevel)}</td><td className="table-cell">{assignment.project?.name ?? (assignment.billingReportType ? (reportMap.get(assignment.billingReportType)?.label ?? assignment.billingReportType) : "All reports")}</td><td className="table-cell">Bill To: {assignment.contactPerson.name} ({assignment.contactPerson.email})</td><td className="table-cell"><form action={deleteBillingContactAction}><input type="hidden" name="id" value={assignment.id} /><button className="btn-secondary text-xs" type="submit">Remove</button></form></td></tr>)}
          {!assignments.length ? <tr><td className="table-cell text-slate-500" colSpan={5}>No billing contacts assigned.</td></tr> : null}
        </tbody></table>
      </div>
    </div>
  );
}
