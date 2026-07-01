import Link from "next/link";
import { redirect } from "next/navigation";
import type { PurchaseOrderStatus } from "@prisma/client";

import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { PageHeader } from "@/components/ui/page-header";
import { DeleteButton } from "@/components/ui/delete-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { requireUser } from "@/lib/auth";
import { deletePurchaseOrderAction } from "@/lib/actions/purchase-order-actions";
import { db } from "@/lib/db";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";
import { canManagePurchaseOrders } from "@/lib/permissions";

function formatMoney(amount: unknown, currency: string) {
  const value = Number(amount ?? 0);

  return `${currency || "USD"} ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function assignmentLabel(po: {
  assignments: Array<{
    assignmentMode: string;
    movie?: {
      title: string;
    } | null;
    project?: {
      name: string;
    } | null;
    billingReportType: string | null;
    countries?: Array<{
      country?: {
        name: string;
        isoCode: string | null;
      } | null;
    }>;
  }>;
}) {
  if (!po.assignments.length) return "—";

  const mode = po.assignments[0]?.assignmentMode ?? "TITLE";

  if (mode === "TITLE") {
    const titles = po.assignments
      .map((assignment) => assignment.movie?.title)
      .filter(Boolean);
    const type = titles.length > 1 ? "Residual" : "Normal";

    return `${type}: ${titles.join(", ") || "—"}`;
  }

  if (mode === "TITLE_COUNTRY") {
    const titles = po.assignments
      .map((assignment) => assignment.movie?.title)
      .filter(Boolean);
    const countries = Array.from(
      new Set(
        po.assignments.flatMap((assignment) =>
          (assignment.countries ?? [])
            .map((item) => item.country?.isoCode || item.country?.name)
            .filter(Boolean),
        ),
      ),
    );
    return `Title + Country: ${titles.join(", ") || "—"} · ${countries.join(", ") || "—"}`;
  }

  if (mode === "TITLE_BILLING_REPORT") {
    return `Title + Billing Report: ${po.assignments[0]?.billingReportType || "—"}`;
  }

  if (mode === "TITLE_PROJECT") {
    return `Title + Project: ${po.assignments[0]?.project?.name || "—"}`;
  }

  if (mode === "PROJECT") {
    return `Project: ${po.assignments[0]?.project?.name || "—"}`;
  }

  return mode.replaceAll("_", " ");
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    clientId?: string;
    status?: string;
    page?: string;
    deleteError?: string;
    deleteSuccess?: string;
  }>;
}) {
  const user = await requireUser();

  if (!canManagePurchaseOrders(user)) {
    redirect("/dashboard");
  }

  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const clientId = params.clientId ?? "all";
  const status = params.status ?? "all";
  const page = parsePageParam(params.page);
  const deleteError = params.deleteError ?? "";
  const deleteSuccess = params.deleteSuccess ?? "";

  const [clients, purchaseOrders] = await Promise.all([
    db.client.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.purchaseOrder.findMany({
      where: {
        ...(q
          ? {
              OR: [
                {
                  poNumber: {
                    contains: q,
                  },
                },
                {
                  notes: {
                    contains: q,
                  },
                },
              ],
            }
          : {}),
        ...(clientId !== "all" ? { clientId } : {}),
        ...(status !== "all" ? { status: status as PurchaseOrderStatus } : {}),
      },
      include: {
        client: true,
        assignments: {
          include: {
            movie: {
              select: {
                title: true,
              },
            },
            project: {
              select: {
                name: true,
              },
            },
            countries: {
              include: {
                country: {
                  select: {
                    name: true,
                    isoCode: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        {
          client: {
            name: "asc",
          },
        },
        {
          poNumber: "asc",
        },
      ],
    }),
  ]);

  const { items, currentPage, totalPages, totalItems, pageSize } = paginateItems(
    purchaseOrders,
    page,
    DEFAULT_PAGE_SIZE,
  );

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="Create and assign POs by Title, Billing Report, or Project based on client requirement."
        actions={
          <Link href="/purchase-orders/new" className="btn-primary">
            Create Purchase Order
          </Link>
        }
      />

      {deleteError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      ) : null}

      {deleteSuccess ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {deleteSuccess}
        </div>
      ) : null}

      <div className="mb-6 card p-4">
        <AutoSubmitFilterForm
          className="grid gap-3 md:grid-cols-[1fr_220px_180px_auto]"
          method="get"
        >
          <input
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Search PO number or notes"
          />
          <SearchableCombobox
            id="clientId"
            name="clientId"
            defaultValue={clientId}
            options={[
              { value: "all", label: "All clients" },
              ...clients.map((client) => ({
                value: client.id,
                label: client.name,
              })),
            ]}
            placeholder="All clients"
            searchPlaceholder="Search clients..."
            emptyLabel="No client found."
          />
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
        </AutoSubmitFilterForm>
      </div>

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">PO Number</th>
              <th className="table-cell">Client</th>
              <th className="table-cell">Amount</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Assignment</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((po) => (
              <tr key={po.id}>
                <td className="table-cell font-medium text-slate-900">
                  {po.poNumber}
                </td>
                <td className="table-cell">{po.client.name}</td>
                <td className="table-cell">{formatMoney(po.amount, po.currency)}</td>
                <td className="table-cell">{po.status.replaceAll("_", " ")}</td>
                <td className="table-cell">{assignmentLabel(po)}</td>
                <td className="table-cell">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="btn-secondary text-xs"
                    >
                      Edit
                    </Link>
                    <form action={deletePurchaseOrderAction}>
                      <input type="hidden" name="id" value={po.id} />
                      <DeleteButton confirmMessage="Delete this purchase order?" />
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {purchaseOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="table-cell text-center text-sm text-slate-500"
                >
                  No Purchase Orders found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <PaginationControls
          basePath="/purchase-orders"
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          searchParams={{ q, clientId, status }}
        />
      </div>
    </div>
  );
}
