import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { createBillingTransactionAction } from "@/lib/actions/project-actions";
import { db } from "@/lib/db";
import { formatMinutes } from "@/lib/utils";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      movie: true,
      countries: { include: { country: true } },
      employeeGroups: { include: { employeeGroup: true } },
      assignedUsers: { include: { user: true } },
      billingTransactions: { orderBy: { createdAt: "desc" } },
      timeEntries: true,
    },
  });

  if (!project) notFound();

  const approvedMinutes = project.timeEntries
    .filter((entry) => entry.status === "APPROVED")
    .reduce((sum, entry) => sum + entry.minutesSpent, 0);

  const approvedBillableMinutes = project.timeEntries
    .filter((entry) => entry.status === "APPROVED" && entry.isBillable)
    .reduce((sum, entry) => sum + entry.minutesSpent, 0);

  const fixedHours =
    project.billingModel === "FIXED_FULL"
      ? Number(project.fixedContractHours ?? 0)
      : Number(project.fixedMonthlyHours ?? 0);

  return (
    <div>
      <PageHeader
        title={project.name}
        description={`${project.client.name} · ${project.billingModel.replaceAll("_", " ")} · ${project.movie?.title ?? "No movie linked"}`}
        actions={
          <Link className="btn-secondary" href={`/projects/${project.id}/edit`}>
            Edit project
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className="grid gap-5 md:grid-cols-3">
            <div className="card p-5">
              <p className="text-sm text-slate-500">Approved effort</p>
              <p className="mt-2 text-2xl font-semibold">{formatMinutes(approvedMinutes)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">Approved billable effort</p>
              <p className="mt-2 text-2xl font-semibold">{formatMinutes(approvedBillableMinutes)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">
                {project.billingModel === "FIXED_MONTHLY" ? "Included monthly hours" : "Fixed contract hours"}
              </p>
              <p className="mt-2 text-2xl font-semibold">{fixedHours || 0}</p>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="section-title">Project profile</h2>
            <p className="section-subtitle">
              This summary shows how the project is classified, who can see it, and how it is commercially tracked.
            </p>
            <dl className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Client</dt>
                <dd className="mt-1 text-sm text-slate-800">{project.client.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Movie</dt>
                <dd className="mt-1 text-sm text-slate-800">{project.movie?.title ?? "No movie linked"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Countries</dt>
                <dd className="mt-1 text-sm text-slate-800">
                  {project.countries.map((c) => c.country.name).join(", ")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Assignment type</dt>
                <dd className="mt-1 text-sm text-slate-800">
                  {project.assignedUsers.length > 0 ? "Individual users" : "Employee groups"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  {project.assignedUsers.length > 0 ? "Assigned users" : "Employee groups"}
                </dt>
                <dd className="mt-1 text-sm text-slate-800">
                  {project.assignedUsers.length > 0
                    ? project.assignedUsers.map((row) => row.user.fullName).join(", ")
                    : project.employeeGroups.map((g) => g.employeeGroup.name).join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Billing model</dt>
                <dd className="mt-1 text-sm text-slate-800">{project.billingModel.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Project code</dt>
                <dd className="mt-1 text-sm text-slate-800">{project.code || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
                <dd className="mt-1 text-sm text-slate-800">{project.status.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Active</dt>
                <dd className="mt-1 text-sm text-slate-800">{project.isActive ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </div>

          <div className="table-wrap">
            <div className="border-b border-slate-200 px-4 py-4">
              <h2 className="section-title">Billing transactions</h2>
              <p className="section-subtitle">
                Transactions are optional and are used for upgrade/adjustment tracking against the project.
              </p>
            </div>
            <table className="table-base">
              <thead className="table-head">
                <tr>
                  <th className="table-cell">Transaction type</th>
                  <th className="table-cell">Money adjustment</th>
                  <th className="table-cell">Hour adjustment</th>
                  <th className="table-cell">Description</th>
                  <th className="table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {project.billingTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="table-cell">{tx.transactionType.replaceAll("_", " ")}</td>
                    <td className="table-cell">{tx.amountMoney == null ? "—" : Number(tx.amountMoney)}</td>
                    <td className="table-cell">{tx.amountHours == null ? "—" : Number(tx.amountHours)}</td>
                    <td className="table-cell">{tx.description || "—"}</td>
                    <td className="table-cell">
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(tx.createdAt)}
                    </td>
                  </tr>
                ))}
                {project.billingTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-cell text-slate-500">No transactions yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="card p-6">
          <h2 className="section-title">Add billing transaction</h2>
          <p className="section-subtitle">
            Use this for project upgrades, partial billing records, or adjustments. Add a clear note for reporting clarity.
          </p>

          <form action={createBillingTransactionAction} className="mt-5 space-y-4">
            <input type="hidden" name="projectId" value={project.id} />
            <div>
              <label className="label">Type <span className="text-red-600">*</span></label>
              <select className="input" name="type" required>
                <option value="PARTIAL_BILLING">Partial billing</option>
                <option value="UPGRADE_PRE_COMPLETION">Upgrade before completion</option>
                <option value="UPGRADE_POST_COMPLETION">Upgrade after completion</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </select>
            </div>
            <div>
              <label className="label">Money adjustment <span className="text-red-600">*</span></label>
              <input className="input" name="amount" type="number" step="0.01" required />
            </div>
            <div>
              <label className="label">Note <span className="text-red-600">*</span></label>
              <textarea className="input min-h-28" name="note" required />
            </div>
            <button className="btn-primary w-full">Save transaction</button>
          </form>
        </aside>
      </div>
    </div>
  );
}
