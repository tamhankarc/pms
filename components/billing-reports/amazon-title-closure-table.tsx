"use client";

import { Fragment, useEffect, useState } from "react";
import { AmazonTitleClosureButton } from "@/components/billing-reports/amazon-title-closure-button";
import type { BillingHistoryData } from "@/lib/billing-reports/amazon";

type AmazonTitleClosureTableProps = {
  rows: BillingHistoryData["summaryRows"];
  includeAction: boolean;
  returnTo: string;
  action: (formData: FormData) => void | Promise<void>;
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCost(value?: number) {
  return usdFormatter.format(value ?? 0);
}

export function AmazonTitleClosureTable({
  rows,
  includeAction,
  returnTo,
  action,
}: AmazonTitleClosureTableProps) {
  const [messageRow, setMessageRow] = useState<{
    itemId: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!messageRow) return;
    const timer = window.setTimeout(() => setMessageRow(null), 10000);
    return () => window.clearTimeout(timer);
  }, [messageRow]);

  const columnCount = includeAction ? 5 : 4;

  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-cell">Title</th>
            <th className="table-cell">PO Number</th>
            <th className="table-cell">Total Cost</th>
            {includeAction ? (
              <th className="table-cell">Status</th>
            ) : (
              <th className="table-cell">Billing Date</th>
            )}
            {includeAction ? <th className="table-cell">Action</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <Fragment key={row.itemId}>
              <tr>
                <td className="table-cell font-medium text-slate-900">
                  {row.titleName ?? row.itemName}
                </td>
                <td className="table-cell">{row.poNumber || "-"}</td>
                <td className="table-cell font-semibold text-slate-900">
                  {formatCost(row.totalCost ?? row.cost)}
                </td>
                <td className="table-cell">
                  {includeAction ? row.status : row.billingDate}
                </td>
                {includeAction ? (
                  <td className="table-cell">
                    {row.movieId ? (
                      <AmazonTitleClosureButton
                        movieId={row.movieId}
                        returnTo={returnTo}
                        allMonthsBilled={row.allMonthsBilled ?? false}
                        unbilledMonthsMessage={row.unbilledMonthsMessage}
                        action={action}
                        onBlocked={(message) =>
                          setMessageRow({ itemId: row.itemId, message })
                        }
                      />
                    ) : (
                      "-"
                    )}
                  </td>
                ) : null}
              </tr>
              {messageRow?.itemId === row.itemId ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                      {messageRow.message}
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columnCount}
                className="table-cell text-center text-sm text-slate-500"
              >
                No title / PO records available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
