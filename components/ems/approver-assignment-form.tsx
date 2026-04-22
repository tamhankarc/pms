"use client";

import { useState, useTransition } from "react";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { assignApproversAction } from "@/lib/actions/leave-actions";

export function ApproverAssignmentForm({
  approvers,
  selectedApproverIds,
}: {
  approvers: Array<{ id: string; fullName: string; email: string; userType: string; functionalRole?: string | null }>;
  selectedApproverIds: string[];
}) {
  const [approverIds, setApproverIds] = useState<string[]>(selectedApproverIds);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="card p-6">
      <div>
        <h2 className="section-title">Approver assignment</h2>
        <p className="section-subtitle">
          Selected approvers can approve leave requests for all Employees, Role Based Managers, and Team Leads.
        </p>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <label className="label" htmlFor="approverIds">Approvers</label>
          <SearchableMultiSelect
            id="approverIds"
            value={approverIds}
            onValueChange={setApproverIds}
            options={approvers.map((approver) => ({
              value: approver.id,
              label: `${approver.fullName}`,
              keywords: `${approver.email} ${approver.functionalRole ?? ""}`,
            }))}
            placeholder="Select approvers"
            searchPlaceholder="Search approvers..."
            emptyLabel="No approver found."
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            className="btn-primary w-full lg:w-auto lg:min-w-[160px]"
            disabled={pending}
            onClick={() => {
              setError("");
              setSuccess("");
              const formData = new FormData();
              approverIds.forEach((id) => formData.append("approverIds", id));
              startTransition(async () => {
                try {
                  await assignApproversAction(formData);
                  setSuccess("Approver assignment updated.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to assign approvers.");
                }
              });
            }}
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}
