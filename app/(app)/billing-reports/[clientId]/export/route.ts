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
  normalizeAmazonReportType,
} from "@/lib/billing-reports/amazon";
import { db } from "@/lib/db";
import {
  buildAmazonReportExcel,
  buildAmazonReportFileName,
  buildAmazonReportPdf,
  buildWarnerDomesticReportExcel,
  buildWarnerDomesticReportFileName,
  buildWarnerDomesticReportPdf,
} from "@/lib/billing-reports/export";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canViewBillingReports(user)) return new Response("Forbidden", { status: 403 });

  const { clientId } = await params;
  const client = await db.client.findUnique({ where: { id: clientId }, select: { name: true } });
  if (!client) redirect("/billing-reports");

  const { searchParams } = new URL(request.url);
  const reportType = normalizeAmazonReportType(searchParams.get("report"), client.name);
  const reportDefinition = getBillingReportCatalogForClient(client.name)?.[reportType];
  const format = searchParams.get("format") === "pdf" ? "pdf" : "excel";

  if (reportDefinition?.kind === "deliverable") {
    const filters = buildWarnerDomesticDeliverableFilters(searchParams);
    const data = reportType === "intl-deliverable"
      ? await getWarnerIntlDeliverableData({ clientId, filters })
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

  if (reportDefinition?.kind === "placeholder") return new Response("Export is not available yet for this placeholder report.", { status: 404 });

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
