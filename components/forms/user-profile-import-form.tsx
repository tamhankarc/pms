"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { importUserProfileSheetAction } from "@/lib/actions/user-import-actions";

export function UserProfileImportForm() {
  const [state, formAction, pending] = useActionState(
    importUserProfileSheetAction,
    {
      success: false,
      applied: false,
      message: "Upload an Excel file to preview updates before applying them.",
      totalRows: 0,
      readyRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      results: [],
    },
  );

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <form action={formAction} className="space-y-5">
          <div>
            <label className="label" htmlFor="file">
              Excel file (.xlsx)
            </label>
            <input
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="input"
              id="file"
              name="file"
              required
              type="file"
            />
            <p className="mt-2 text-sm text-slate-500">
              Required headers: Username, Email, Employee Code, Casual Leaves
              Remaining, Earned Leaves Remaining, Designation, Joining Date.
              Username and Email are used only as validators to match existing
              users.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-secondary inline-flex items-center gap-2"
              disabled={pending}
              name="intent"
              type="submit"
              value="preview"
            >
              <Upload className="h-4 w-4" /> Preview only
            </button>
            <button
              className="btn-primary inline-flex items-center gap-2"
              disabled={pending}
              name="intent"
              type="submit"
              value="apply"
            >
              <Upload className="h-4 w-4" /> Apply updates
            </button>
          </div>
          {pending ? (
            <p className="text-sm text-slate-500">
              Processing uploaded sheet...
            </p>
          ) : null}
        </form>
      </section>

      <section className="card p-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="section-title">Import result</h2>
            <p className="section-subtitle">{state.message}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="badge-slate">Total: {state.totalRows}</span>
            <span className="badge-emerald">Ready: {state.readyRows}</span>
            <span className="badge-emerald">Updated: {state.updatedRows}</span>
            <span className={state.skippedRows ? "badge-rose" : "badge-slate"}>
              Skipped: {state.skippedRows}
            </span>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Row</th>
                <th className="table-cell">Username</th>
                <th className="table-cell">Email</th>
                <th className="table-cell">Employee</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Message / Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.results.map((row) => (
                <tr key={`${row.rowNumber}-${row.email}`}>
                  <td className="table-cell">{row.rowNumber}</td>
                  <td className="table-cell">{row.username}</td>
                  <td className="table-cell">{row.email}</td>
                  <td className="table-cell">{row.employeeName ?? "—"}</td>
                  <td className="table-cell">
                    <span
                      className={
                        row.status === "skipped"
                          ? "badge-rose"
                          : row.status === "updated"
                            ? "badge-emerald"
                            : "badge-slate"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="table-cell min-w-[280px]">
                    <div className="font-medium text-slate-800">
                      {row.message}
                    </div>
                    {row.changes?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                        {row.changes.map((change) => (
                          <li key={change}>{change}</li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                </tr>
              ))}
              {state.results.length === 0 ? (
                <tr>
                  <td
                    className="table-cell text-center text-sm text-slate-500"
                    colSpan={6}
                  >
                    No sheet processed yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
