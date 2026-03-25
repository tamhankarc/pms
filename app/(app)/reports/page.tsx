import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getVisibleProjects } from "@/lib/queries";
import { db } from "@/lib/db";
import { formatMinutes } from "@/lib/utils";

type RoleRow = {
  projectId: string;
  projectName: string;
  clientName: string;
  roleName: string;
  approvedMinutes: number;
};

type MonthlyRow = {
  projectId: string;
  projectName: string;
  clientName: string;
  monthKey: string;
  approvedMinutes: number;
  includedMinutes: number;
  overageMinutes: number;
};

type FixedFullRow = {
  projectId: string;
  projectName: string;
  clientName: string;
  contractedMinutes: number;
  approvedMinutes: number;
  remainingMinutes: number;
};

type BillableRow = {
  projectId: string;
  projectName: string;
  clientName: string;
  approvedBillableMinutes: number;
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    clientId?: string;
    billingModel?: string;
  }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim().toLowerCase();
  const clientId = params.clientId ?? "all";
  const billingModel = params.billingModel ?? "all";

  const visibleProjects = await getVisibleProjects(user);
  const filteredProjects = visibleProjects.filter((project) => {
    const matchesQ =
      !q ||
      project.name.toLowerCase().includes(q) ||
      (project.code ?? "").toLowerCase().includes(q) ||
      project.client.name.toLowerCase().includes(q) ||
      (project.movie?.title ?? "").toLowerCase().includes(q);

    const matchesClient = clientId === "all" ? true : project.clientId === clientId;
    const matchesBilling = billingModel === "all" ? true : project.billingModel === billingModel;

    return matchesQ && matchesClient && matchesBilling;
  });

  const visibleProjectIds = filteredProjects.map((project) => project.id);
  const safeProjectIds = visibleProjectIds.length ? visibleProjectIds : ["__none__"];

  const [approvedEntries, approvedBillableEntries] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        status: "APPROVED",
      },
      include: {
        project: { include: { client: true } },
        employee: true,
      },
      orderBy: { workDate: "desc" },
    }),
    db.timeEntry.findMany({
      where: {
        projectId: { in: safeProjectIds },
        status: "APPROVED",
        isBillable: true,
      },
      include: {
        project: { include: { client: true } },
      },
    }),
  ]);

  const clients = Array.from(
    new Map(
      visibleProjects.map((project) => [
        project.client.id,
        { id: project.client.id, name: project.client.name },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const roleMap = new Map<string, RoleRow>();
  for (const entry of approvedEntries) {
    const roleName = (entry.employee.functionalRole ?? "UNASSIGNED").replaceAll("_", " ");
    const key = `${entry.projectId}__${roleName}`;
    const existing = roleMap.get(key);
    if (existing) {
      existing.approvedMinutes += entry.minutesSpent;
    } else {
      roleMap.set(key, {
        projectId: entry.projectId,
        projectName: entry.project.name,
        clientName: entry.project.client.name,
        roleName,
        approvedMinutes: entry.minutesSpent,
      });
    }
  }
  const effortByProjectRole = Array.from(roleMap.values()).sort((a, b) => {
    if (a.projectName === b.projectName) return a.roleName.localeCompare(b.roleName);
    return a.projectName.localeCompare(b.projectName);
  });

  const monthlyMap = new Map<string, MonthlyRow>();
  for (const entry of approvedEntries) {
    if (entry.project.billingModel !== "FIXED_MONTHLY") continue;
    const monthKey = new Date(entry.workDate).toISOString().slice(0, 7);
    const key = `${entry.projectId}__${monthKey}`;
    const includedMinutes = Number(entry.project.fixedMonthlyHours ?? 0) * 60;
    const existing = monthlyMap.get(key);
    if (existing) {
      existing.approvedMinutes += entry.minutesSpent;
      existing.overageMinutes = Math.max(existing.approvedMinutes - existing.includedMinutes, 0);
    } else {
      const approvedMinutes = entry.minutesSpent;
      monthlyMap.set(key, {
        projectId: entry.projectId,
        projectName: entry.project.name,
        clientName: entry.project.client.name,
        monthKey,
        approvedMinutes,
        includedMinutes,
        overageMinutes: Math.max(approvedMinutes - includedMinutes, 0),
      });
    }
  }
  const monthlyOverages = Array.from(monthlyMap.values()).sort((a, b) => {
    if (a.monthKey === b.monthKey) return a.projectName.localeCompare(b.projectName);
    return b.monthKey.localeCompare(a.monthKey);
  });

  const fixedFullMap = new Map<string, FixedFullRow>();
  for (const project of filteredProjects.filter((item) => item.billingModel === "FIXED_FULL")) {
    fixedFullMap.set(project.id, {
      projectId: project.id,
      projectName: project.name,
      clientName: project.client.name,
      contractedMinutes: Number(project.fixedContractHours ?? 0) * 60,
      approvedMinutes: 0,
      remainingMinutes: Number(project.fixedContractHours ?? 0) * 60,
    });
  }
  for (const entry of approvedEntries) {
    const row = fixedFullMap.get(entry.projectId);
    if (!row) continue;
    row.approvedMinutes += entry.minutesSpent;
    row.remainingMinutes = Math.max(row.contractedMinutes - row.approvedMinutes, 0);
  }
  const fixedHoursBalance = Array.from(fixedFullMap.values()).sort((a, b) =>
    a.projectName.localeCompare(b.projectName),
  );

  const billableMap = new Map<string, BillableRow>();
  for (const entry of approvedBillableEntries) {
    const existing = billableMap.get(entry.projectId);
    if (existing) {
      existing.approvedBillableMinutes += entry.minutesSpent;
    } else {
      billableMap.set(entry.projectId, {
        projectId: entry.projectId,
        projectName: entry.project.name,
        clientName: entry.project.client.name,
        approvedBillableMinutes: entry.minutesSpent,
      });
    }
  }
  const billableSummary = Array.from(billableMap.values()).sort((a, b) =>
    a.projectName.localeCompare(b.projectName),
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Operational reporting based on approved effort, billable effort, and fixed-hour consumption using the current schema."
      />

      <div className="mb-6 card p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto]" method="get">
          <input
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Search by project, code, client, or movie"
          />
          <select className="input" name="clientId" defaultValue={clientId}>
            <option value="all">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <select className="input" name="billingModel" defaultValue={billingModel}>
            <option value="all">All billing models</option>
            <option value="HOURLY">Hourly</option>
            <option value="FIXED_FULL">Fixed - Full Project</option>
            <option value="FIXED_MONTHLY">Fixed - Monthly</option>
          </select>
          <button className="btn-secondary" type="submit">Apply</button>
        </form>
      </div>

      <div className="space-y-8">
        <section className="table-wrap">
          <div className="border-b border-slate-200 px-4 py-4">
            <h2 className="section-title">Time per role per project</h2>
            <p className="section-subtitle">Approved effort grouped by project and functional role.</p>
          </div>
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Project</th>
                <th className="table-cell">Client</th>
                <th className="table-cell">Role</th>
                <th className="table-cell">Approved effort</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {effortByProjectRole.map((row) => (
                <tr key={`${row.projectId}-${row.roleName}`}>
                  <td className="table-cell">
                    <Link href={`/projects/${row.projectId}`} className="font-medium text-blue-600 hover:underline">
                      {row.projectName}
                    </Link>
                  </td>
                  <td className="table-cell">{row.clientName}</td>
                  <td className="table-cell">{row.roleName}</td>
                  <td className="table-cell">{formatMinutes(row.approvedMinutes)}</td>
                </tr>
              ))}
              {effortByProjectRole.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-cell text-center text-sm text-slate-500">
                    No approved effort found for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="table-wrap">
          <div className="border-b border-slate-200 px-4 py-4">
            <h2 className="section-title">Fixed monthly overage</h2>
            <p className="section-subtitle">Approved effort against included monthly hours for fixed-monthly projects.</p>
          </div>
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Project</th>
                <th className="table-cell">Client</th>
                <th className="table-cell">Month</th>
                <th className="table-cell">Approved effort</th>
                <th className="table-cell">Included effort</th>
                <th className="table-cell">Overage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyOverages.map((row) => (
                <tr key={`${row.projectId}-${row.monthKey}`}>
                  <td className="table-cell">
                    <Link href={`/projects/${row.projectId}`} className="font-medium text-blue-600 hover:underline">
                      {row.projectName}
                    </Link>
                  </td>
                  <td className="table-cell">{row.clientName}</td>
                  <td className="table-cell">{row.monthKey}</td>
                  <td className="table-cell">{formatMinutes(row.approvedMinutes)}</td>
                  <td className="table-cell">{formatMinutes(row.includedMinutes)}</td>
                  <td className="table-cell">{formatMinutes(row.overageMinutes)}</td>
                </tr>
              ))}
              {monthlyOverages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-sm text-slate-500">
                    No fixed-monthly overage data found for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="table-wrap">
          <div className="border-b border-slate-200 px-4 py-4">
            <h2 className="section-title">Fixed full-project hours balance</h2>
            <p className="section-subtitle">Approved effort versus contracted hours for fixed-full projects.</p>
          </div>
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Project</th>
                <th className="table-cell">Client</th>
                <th className="table-cell">Contracted effort</th>
                <th className="table-cell">Approved effort</th>
                <th className="table-cell">Remaining effort</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fixedHoursBalance.map((row) => (
                <tr key={row.projectId}>
                  <td className="table-cell">
                    <Link href={`/projects/${row.projectId}`} className="font-medium text-blue-600 hover:underline">
                      {row.projectName}
                    </Link>
                  </td>
                  <td className="table-cell">{row.clientName}</td>
                  <td className="table-cell">{formatMinutes(row.contractedMinutes)}</td>
                  <td className="table-cell">{formatMinutes(row.approvedMinutes)}</td>
                  <td className="table-cell">{formatMinutes(row.remainingMinutes)}</td>
                </tr>
              ))}
              {fixedHoursBalance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-cell text-center text-sm text-slate-500">
                    No fixed-full projects found for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="table-wrap">
          <div className="border-b border-slate-200 px-4 py-4">
            <h2 className="section-title">Approved billable effort by project</h2>
            <p className="section-subtitle">Billable approved time only. This keeps reports effort-first rather than money-first.</p>
          </div>
          <table className="table-base">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Project</th>
                <th className="table-cell">Client</th>
                <th className="table-cell">Approved billable effort</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {billableSummary.map((row) => (
                <tr key={row.projectId}>
                  <td className="table-cell">
                    <Link href={`/projects/${row.projectId}`} className="font-medium text-blue-600 hover:underline">
                      {row.projectName}
                    </Link>
                  </td>
                  <td className="table-cell">{row.clientName}</td>
                  <td className="table-cell">{formatMinutes(row.approvedBillableMinutes)}</td>
                </tr>
              ))}
              {billableSummary.length === 0 ? (
                <tr>
                  <td colSpan={3} className="table-cell text-center text-sm text-slate-500">
                    No approved billable effort found for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
