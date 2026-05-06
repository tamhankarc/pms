import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canViewBillingReports } from "@/lib/permissions";
import {
  buildAmazonBillingReportFilters,
  buildWarnerDomesticDeliverableFilters,
  getAmazonBillingReportData,
  getBillingReportCatalogForClient,
  getWarnerDomesticDeliverableData,
  getWarnerIntlDeliverableData,
  getWarnerOtherDeliverableData,
  normalizeAmazonReportType,
} from "@/lib/billing-reports/amazon";
import { db } from "@/lib/db";
import { isBillingReportClientExcluded } from "@/lib/billing-reports/config";
import { buildGenericBillingReportFilters, getGenericBillingReportData } from "@/lib/billing-reports/generic";
import {
  buildAmazonReportExcel,
  buildAmazonReportFileName,
  buildAmazonReportPdf,
  buildWarnerDomesticReportExcel,
  buildWarnerDomesticReportFileName,
  buildWarnerDomesticReportPdf,
  buildGenericBillingReportExcel,
  buildGenericBillingReportPdf,
  getGenericBillingReportFileName,
} from "@/lib/billing-reports/export";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canViewBillingReports(user)) return new Response("Forbidden", { status: 403 });

  const { clientId } = await params;
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client || isBillingReportClientExcluded(client.id)) redirect("/billing-reports");

  const { searchParams } = new URL(request.url);
  const reportType = normalizeAmazonReportType(searchParams.get("report"), client.name);
  const reportDefinition = getBillingReportCatalogForClient(client.name, client.id)?.[reportType];
  const format = searchParams.get("format") === "pdf" ? "pdf" : "excel";

  if (reportDefinition?.kind === "deliverable") {
    const filters = buildWarnerDomesticDeliverableFilters(searchParams);
    const data = reportType === "intl-deliverable"
      ? await getWarnerIntlDeliverableData({ clientId, filters })
      : reportType === "other-deliverable"
        ? await getWarnerOtherDeliverableData({ clientId, filters })
        : await getWarnerDomesticDeliverableData({ clientId, filters });
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildWarnerDomesticReportPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${buildWarnerDomesticReportFileName(data, "pdf")}"`,
        },
      });
    }

    const excel = buildWarnerDomesticReportExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildWarnerDomesticReportFileName(data, "xls")}"`,
      },
    });
  }

  const genericOptions = reportDefinition?.kind === "generic-movie"
    ? { movieSpecific: true }
    : reportDefinition?.kind === "generic-filmik"
      ? { includeDeveloperCosts: true }
      : undefined;

  if (!reportDefinition || genericOptions) {
    const filters = buildGenericBillingReportFilters(searchParams);
    const data = await getGenericBillingReportData({ clientId, filters, options: genericOptions });
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildGenericBillingReportPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getGenericBillingReportFileName(data, "pdf")}"`,
        },
      });
    }

    const excel = buildGenericBillingReportExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${getGenericBillingReportFileName(data, "xls")}"`,
      },
    });
  }

  if (reportDefinition.kind === "placeholder") return new Response("Export is not available yet for this placeholder report.", { status: 404 });

  const filters = buildAmazonBillingReportFilters(searchParams);
  const data = await getAmazonBillingReportData({ clientId, reportType, filters });
  if (!data) redirect("/billing-reports");

  if (format === "pdf") {
    const pdf = buildAmazonReportPdf(data);
    return new Response(Buffer.from(pdf, "binary"), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildAmazonReportFileName(data, "pdf")}"`,
      },
    });
  }

  const excel = buildAmazonReportExcel(data);
  return new Response(excel, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildAmazonReportFileName(data, "xls")}"`,
    },
  });
}
