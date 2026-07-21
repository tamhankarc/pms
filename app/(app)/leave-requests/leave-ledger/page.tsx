import Link from "next/link";
import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { requireUser } from "@/lib/auth";
import { canAccessLeaveRequests, canAccessMenuItem, isAdmin, isHR } from "@/lib/permissions";
import { formatDateInIst, formatTimeInIst } from "@/lib/ist";
import {
  getUnifiedLeaveLedger,
  LEAVE_LEDGER_START_DATE_KEY,
} from "@/lib/leave-admin-ledger";

type SearchParams = {
  fromDate?: string;
  toDate?: string;
  page?: string;
};

function signedNumber(value: number) {
  if (value > 0) return `+${value.toFixed(2)}`;
  return value.toFixed(2);
}

export default async function MyLeaveLedgerPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireUser();
  if (
    !canAccessLeaveRequests(user) &&
    !canAccessMenuItem(user, "leave-requests") &&
    !isAdmin(user) &&
    !isHR(user)
  ) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Leave Ledger"
          description="This account does not have access to leave records."
        />
      </div>
    );
  }

  const params = (await searchParams) ?? {};
  const ledger = await getUnifiedLeaveLedger({
    userId: user.id,
    fromDateKey: params.fromDate || LEAVE_LEDGER_START_DATE_KEY,
    toDateKey: params.toDate || undefined,
    page: Number(params.page || 1),
    pageSize: 50,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Leave Ledger"
        description="Your complete Casual and Earned Leave balance history in one continuous ledger."
        actions={
          <Link className="btn-secondary" href="/leave-requests">
            Back to Leave Requests
          </Link>
        }
      />

      <section className="card p-5">
        <AutoSubmitFilterForm className="grid gap-4 md:grid-cols-[180px_180px_auto]">
          <div>
            <label className="label" htmlFor="fromDate">
              From date
            </label>
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
            <label className="label" htmlFor="toDate">
              To date
            </label>
            <input
              className="input"
              id="toDate"
              name="toDate"
              type="date"
              min={LEAVE_LEDGER_START_DATE_KEY}
              defaultValue={params.toDate || ""}
            />
          </div>
          <div className="flex items-end">
            <Link
              className="btn-secondary"
              href="/leave-requests/leave-ledger"
            >
              Reset
            </Link>
          </div>
        </AutoSubmitFilterForm>
      </section>

      <section className="card p-5">
        <h2 className="section-title">Ledger rules</h2>
        <p className="mt-2 text-sm text-slate-600">
          Opening balances, quarterly credits, leave deductions, adjustments,
          and reversals are shown using one running-balance format. Approved
          future leave appears here when its leave date is processed.
        </p>
      </section>

      <section className="table-wrap" id="my-leave-ledger-table">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="section-title">Ledger rows</h2>
          <p className="section-subtitle">
            Your leave balance changes from {LEAVE_LEDGER_START_DATE_KEY} onward.
          </p>
        </div>
        <table className="table-base">
          <thead className="table-head">
            <tr>
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
              <tr
                key={`${row.referenceId ?? row.eventType}-${row.eventDate.toISOString()}-${index}`}
              >
                <td className="table-cell">
                  {formatDateInIst(row.eventDate)} {formatTimeInIst(row.eventDate)}
                </td>
                <td className="table-cell">
                  {row.eventType.replaceAll("_", " ")}
                </td>
                <td className="table-cell max-w-xl text-sm text-slate-700">
                  {row.description}
                </td>
                <td className="table-cell">{signedNumber(row.casualChange)}</td>
                <td className="table-cell">{signedNumber(row.earnedChange)}</td>
                <td className="table-cell">{row.unpaidDays.toFixed(2)}</td>
                <td className="table-cell">{row.casualBalance.toFixed(2)}</td>
                <td className="table-cell">{row.earnedBalance.toFixed(2)}</td>
              </tr>
            ))}
            {ledger.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="table-cell text-center text-sm text-slate-500"
                >
                  No leave ledger rows found for the selected dates.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <PaginationControls
          basePath="/leave-requests/leave-ledger"
          currentPage={ledger.currentPage}
          totalPages={ledger.totalPages}
          totalItems={ledger.totalItems}
          pageSize={ledger.pageSize}
          searchParams={{
            fromDate: params.fromDate,
            toDate: params.toDate,
            page: params.page,
          }}
          anchor="#my-leave-ledger-table"
        />
      </section>
    </div>
  );
}
