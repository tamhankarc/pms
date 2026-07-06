import Link from "next/link";
import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { canAccessMenuItem, isHR } from "@/lib/permissions";
import { formatDateInIst, formatTimeInIst } from "@/lib/ist";
import {
  getPredictiveLeaveLedger,
  LEAVE_LEDGER_START_DATE_KEY,
} from "@/lib/leave-admin-ledger";

type SearchParams = {
  userId?: string;
  fromDate?: string;
  toDate?: string;
  page?: string;
};

function signedNumber(value: number) {
  if (value > 0) return `+${value.toFixed(2)}`;
  return value.toFixed(2);
}

function eventLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default async function LeaveLedgerPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireUser();
  if (!isHR(user) && !canAccessMenuItem(user, "leave-admin")) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Predictive Leave Ledger"
          description="Only leave administration users can access this page."
        />
      </div>
    );
  }

  const params = (await searchParams) ?? {};
  const ledger = await getPredictiveLeaveLedger({
    userId: params.userId || undefined,
    fromDateKey: params.fromDate || LEAVE_LEDGER_START_DATE_KEY,
    toDateKey: params.toDate || undefined,
    page: Number(params.page || 1),
    pageSize: 50,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Predictive Leave Ledger"
        description="Estimated leave additions and deductions based on current balances, quarterly casual credits, and approved leaves from 1 June 2026 onward."
        actions={<Link className="btn-secondary" href="/leave-admin">Back to Leave Administration</Link>}
      />

      <section className="card p-5">
        <AutoSubmitFilterForm className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto]">
          <div>
            <label className="label" htmlFor="userId">User</label>
            <SearchableCombobox
              id="userId"
              name="userId"
              defaultValue={params.userId || ""}
              options={[
                { value: "", label: "All users with approved leaves" },
                ...ledger.userOptions.map((row) => ({ value: row.id, label: row.fullName })),
              ]}
              placeholder="All users with approved leaves"
              searchPlaceholder="Search users..."
              emptyLabel="No user found."
            />
          </div>
          <div>
            <label className="label" htmlFor="fromDate">From date</label>
            <input
              className="input"
              id="fromDate"
              name="fromDate"
              type="date"
              min={LEAVE_LEDGER_START_DATE_KEY}
              defaultValue={params.fromDate || LEAVE_LEDGER_START_DATE_KEY}
            />
          </div>
          <div>
            <label className="label" htmlFor="toDate">To date</label>
            <input
              className="input"
              id="toDate"
              name="toDate"
              type="date"
              min={LEAVE_LEDGER_START_DATE_KEY}
              defaultValue={params.toDate || ""}
            />
          </div>
          <div className="flex items-end gap-3">
            <Link className="btn-secondary" href="/leave-admin/leave-ledger">Reset</Link>
          </div>
        </AutoSubmitFilterForm>
      </section>

      <section className="card p-5">
        <h2 className="section-title">How this predictive ledger is calculated</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Only users with approved leaves from 1 June 2026 onward are shown.</li>
          <li>Opening balance is estimated from current leave balance, approved leave deductions, and recorded quarterly credits.</li>
          <li>Leave deductions use the approval timestamp because the current system deducts leaves immediately on approval.</li>
          <li>This is a predictive/audit-assist view only. A proper immutable leave ledger will be added later.</li>
        </ul>
      </section>

      <section className="table-wrap" id="leave-ledger-table">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="section-title">Ledger rows</h2>
          <p className="section-subtitle">
            Showing additions and subtractions for leave-eligible users with approved leaves from 1 June 2026 onward.
          </p>
        </div>
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">User</th>
              <th className="table-cell">Event date</th>
              <th className="table-cell">Type</th>
              <th className="table-cell">Description</th>
              <th className="table-cell">Casual change</th>
              <th className="table-cell">Earned change</th>
              <th className="table-cell">Unpaid days</th>
              <th className="table-cell">Casual balance</th>
              <th className="table-cell">Earned balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ledger.rows.map((row, index) => (
              <tr key={`${row.userId}-${row.referenceId ?? row.eventType}-${row.eventDate.toISOString()}-${index}`}>
                <td className="table-cell font-medium text-slate-900">{row.userName}</td>
                <td className="table-cell">
                  {formatDateInIst(row.eventDate)} {formatTimeInIst(row.eventDate)}
                </td>
                <td className="table-cell">{eventLabel(row.eventType)}</td>
                <td className="table-cell max-w-xl text-sm text-slate-700">{row.description}</td>
                <td className="table-cell">{signedNumber(row.casualChange)}</td>
                <td className="table-cell">{signedNumber(row.earnedChange)}</td>
                <td className="table-cell">{row.unpaidDays.toFixed(2)}</td>
                <td className="table-cell">{row.casualBalance.toFixed(2)}</td>
                <td className="table-cell">{row.earnedBalance.toFixed(2)}</td>
              </tr>
            ))}
            {ledger.rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-cell text-center text-sm text-slate-500">
                  No ledger rows found for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <PaginationControls
          basePath="/leave-admin/leave-ledger"
          currentPage={ledger.currentPage}
          totalPages={ledger.totalPages}
          totalItems={ledger.totalItems}
          pageSize={ledger.pageSize}
          searchParams={{ userId: params.userId, fromDate: params.fromDate, toDate: params.toDate, page: params.page }}
          anchor="#leave-ledger-table"
        />
      </section>
    </div>
  );
}
