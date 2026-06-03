import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManagePurchaseOrders } from "@/lib/permissions";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";
import type { PurchaseOrderStatus } from "@prisma/client";

function formatMoney(amount: unknown, currency: string) {
  const value = Number(amount ?? 0);
  return `${currency || "USD"} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function assignmentLabel(po: { assignments: Array<{ assignmentMode: string; movie?: { title: string } | null; project?: { name: string } | null; billingReportType: string | null }> }) {
  if (!po.assignments.length) return "—";
  const mode = po.assignments[0]?.assignmentMode ?? "TITLE";
  if (mode === "TITLE") {
    const titles = po.assignments.map((assignment) => assignment.movie?.title).filter(Boolean);
    const type = titles.length > 1 ? "Residual" : "Normal";
    return `${type}: ${titles.join(", ") || "—"}`;
  }
  if (mode === "TITLE_BILLING_REPORT") return `Title + Billing Report: ${po.assignments[0]?.billingReportType || "—"}`;
  if (mode === "TITLE_PROJECT") return `Title + Project: ${po.assignments[0]?.project?.name || "—"}`;
  if (mode === "PROJECT") return `Project: ${po.assignments[0]?.project?.name || "—"}`;
  return mode.replaceAll("_", " ");
}

export default async function PurchaseOrdersPage({ searchParams }: { searchParams?: Promise<{ q?: string; clientId?: string; status?: string; page?: string }> }) {
  const user = await requireUser();
  if (!canManagePurchaseOrders(user)) redirect("/dashboard");
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const clientId = params.clientId ?? "all";
  const status = params.status ?? "all";
  const page = parsePageParam(params.page);

  const [clients, purchaseOrders] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.purchaseOrder.findMany({
      where: {
        ...(q ? { OR: [{ poNumber: { contains: q } }, { notes: { contains: q } }] } : {}),
        ...(clientId !== "all" ? { clientId } : {}),
        ...(status !== "all" ? { status: status as PurchaseOrderStatus } : {}),
      },
      include: { client: true, assignments: { include: { movie: { select: { title: true } }, project: { select: { name: true } } } } },
      orderBy: [{ client: { name: "asc" } }, { poNumber: "asc" }],
    }),
  ]);
  const { items, currentPage, totalPages, totalItems, pageSize } = paginateItems(purchaseOrders, page, DEFAULT_PAGE_SIZE);

  return <div>
    <PageHeader title="Purchase Orders" description="Create and assign POs by Title, Billing Report, or Project based on client requirement." actions={<Link href="/purchase-orders/new" className="btn-primary">Create Purchase Order</Link>} />
    <div className="mb-6 card p-4"><AutoSubmitFilterForm className="grid gap-3 md:grid-cols-[1fr_220px_180px_auto]" method="get">
      <input className="input" name="q" defaultValue={q} placeholder="Search PO number or notes" />
      <SearchableCombobox id="clientId" name="clientId" defaultValue={clientId} options={[{ value: "all", label: "All clients" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} placeholder="All clients" searchPlaceholder="Search clients..." emptyLabel="No client found." />
      <SearchableCombobox
        id="status"
        name="status"
        defaultValue={status}
        options={[
          { value: "all", label: "All statuses" },
          { value: "ACTIVE", label: "Active" },
          { value: "EXHAUSTED", label: "Exhausted" },
          { value: "EXPIRED", label: "Expired" },
          { value: "CANCELLED", label: "Cancelled" },
        ]}
        placeholder="All statuses"
        searchPlaceholder="Search statuses..."
        emptyLabel="No status found."
      />
    </AutoSubmitFilterForm></div>
    <div className="table-wrap"><table className="table-base"><thead className="table-head"><tr><th className="table-cell">PO Number</th><th className="table-cell">Client</th><th className="table-cell">Amount</th><th className="table-cell">Status</th><th className="table-cell">Assignment</th><th className="table-cell">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
      {items.map((po) => <tr key={po.id}><td className="table-cell font-medium text-slate-900">{po.poNumber}</td><td className="table-cell">{po.client.name}</td><td className="table-cell">{formatMoney(po.amount, po.currency)}</td><td className="table-cell">{po.status.replaceAll("_", " ")}</td><td className="table-cell">{assignmentLabel(po)}</td><td className="table-cell"><Link href={`/purchase-orders/${po.id}`} className="btn-secondary text-xs">Edit</Link></td></tr>)}
      {purchaseOrders.length === 0 ? <tr><td colSpan={6} className="table-cell text-center text-sm text-slate-500">No Purchase Orders found.</td></tr> : null}
    </tbody></table><PaginationControls basePath="/purchase-orders" currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} searchParams={{ q, clientId, status }} /></div>
  </div>;
}
