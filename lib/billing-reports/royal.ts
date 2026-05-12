import { db } from "@/lib/db";
import { formatUsd, getExportTimestamp, sanitizeFileSegment } from "@/lib/billing-reports/amazon";

export const ROYAL_CARIBBEAN_CLIENT_NAME = "Royal Caribbean Cruises";

export type RoyalBillingFilters = { month: string };
export type RoyalBillingRow = {
  projectId: string;
  projectName: string;
  contactPerson: string;
  billingModel: string;
  projectHours: number;
  fixedMonthlyHours: number | null;
  additionalHours: number | null;
  projectCost: number | null;
  excessHours: number;
  excessCost: number;
  totalCost: number;
};
export type RoyalBillingData = {
  client: { id: string; name: string; hourlyCost: number };
  filters: RoyalBillingFilters;
  rows: RoyalBillingRow[];
  totals: { projectCost: number; excessHours: number; excessCost: number; totalCost: number };
};

function getParamValue(searchParams: URLSearchParams | Record<string, string | string[] | undefined>, key: string) {
  if (searchParams instanceof URLSearchParams) return searchParams.get(key) ?? undefined;
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function defaultMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function buildRoyalBillingFilters(searchParams: URLSearchParams | Record<string, string | string[] | undefined>) {
  const month = getParamValue(searchParams, "month") || defaultMonthValue();
  return { month: /^\d{4}-\d{2}$/.test(month) ? month : defaultMonthValue() } satisfies RoyalBillingFilters;
}

export function royalMonthRange(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, monthNum - 1, 1)), end: new Date(Date.UTC(year, monthNum, 1)) };
}

function buildContactPersonLabel(contactPersons: { name: string; email: string }[]) {
  if (!contactPersons.length) return "-";
  return contactPersons.map((person) => `${person.name}${person.email ? ` (${person.email})` : ""}`).join(", ");
}

function formatBillingModel(value: string) {
  const labels: Record<string, string> = {
    HOURLY: "Hourly",
    FIXED_FULL: "Fixed Full",
    FIXED_MONTHLY: "Fixed Monthly",
    FIXED_PER_COUNTRY: "Fixed Per Country",
    FIXED_COST: "Fixed Cost",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export async function getRoyalBillingReportData({ clientId, filters }: { clientId: string; filters: RoyalBillingFilters }): Promise<RoyalBillingData | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      hourlyCost: true,
      projects: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          billingModel: true,
          fixedMonthlyHours: true,
          contactPersons: { orderBy: { name: "asc" }, select: { name: true, email: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!client) return null;
  const range = royalMonthRange(filters.month);
  const projectIds = client.projects.map((project) => project.id);
  const minutesGroups = projectIds.length
    ? await db.timeEntry.groupBy({
        by: ["projectId"],
        where: { projectId: { in: projectIds }, workDate: { gte: range.start, lt: range.end } },
        _sum: { minutesSpent: true },
      })
    : [];
  const minutesByProject = new Map(minutesGroups.map((group) => [group.projectId, Number(group._sum.minutesSpent ?? 0)]));
  const additionalRows = projectIds.length
    ? await db.projectMonthlyAdditionalHours.findMany({ where: { projectId: { in: projectIds }, month: range.start }, select: { projectId: true, hours: true } })
    : [];
  const additionalByProject = new Map(additionalRows.map((row) => [row.projectId, Number(row.hours ?? 0)]));
  const hourlyCost = Number(client.hourlyCost ?? 0);
  const rows = client.projects.map((project) => {
    const projectHours = Number(((minutesByProject.get(project.id) ?? 0) / 60).toFixed(2));
    const isFixedMonthly = project.billingModel === "FIXED_MONTHLY";
    const fixedMonthlyHours = isFixedMonthly ? Number(project.fixedMonthlyHours ?? 0) : null;
    const additionalHours = isFixedMonthly ? Number(additionalByProject.get(project.id) ?? 0) : null;
    const projectCost = isFixedMonthly ? Number((Number(fixedMonthlyHours ?? 0) * hourlyCost).toFixed(2)) : null;
    const excessHours = isFixedMonthly ? Math.max(0, Number((projectHours - (Number(fixedMonthlyHours ?? 0) + Number(additionalHours ?? 0))).toFixed(2))) : 0;
    const excessCost = Number((excessHours * hourlyCost).toFixed(2));
    const totalCost = Number((Number(projectCost ?? 0) + excessCost).toFixed(2));
    return {
      projectId: project.id,
      projectName: project.name,
      contactPerson: buildContactPersonLabel(project.contactPersons),
      billingModel: formatBillingModel(project.billingModel),
      projectHours,
      fixedMonthlyHours,
      additionalHours,
      projectCost,
      excessHours,
      excessCost,
      totalCost,
    } satisfies RoyalBillingRow;
  }).filter((row) => row.projectHours > 0 || row.billingModel === "Fixed Monthly");
  const totals = rows.reduce((acc, row) => ({
    projectCost: acc.projectCost + Number(row.projectCost ?? 0),
    excessHours: acc.excessHours + row.excessHours,
    excessCost: acc.excessCost + row.excessCost,
    totalCost: acc.totalCost + row.totalCost,
  }), { projectCost: 0, excessHours: 0, excessCost: 0, totalCost: 0 });
  return { client: { id: client.id, name: client.name, hourlyCost }, filters, rows, totals };
}

export function getRoyalBillingReportFileName(data: RoyalBillingData, extension: "xls" | "pdf") {
  return `${sanitizeFileSegment(data.client.name)}_${data.filters.month}_Billing_Report_${getExportTimestamp()}.${extension}`;
}

export { formatUsd };
