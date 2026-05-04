import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canViewBillingReports } from "@/lib/permissions";
import {
  buildAmazonBillingReportFilters,
  getAmazonBillingReportData,
  normalizeAmazonReportType,
} from "@/lib/billing-reports/amazon";
import {
  buildAmazonReportExcel,
  buildAmazonReportFileName,
  buildAmazonReportPdf,
} from "@/lib/billing-reports/export";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canViewBillingReports(user)) return new Response("Forbidden", { status: 403 });

  const { clientId } = await params;
  const { searchParams } = new URL(request.url);
  const reportType = normalizeAmazonReportType(searchParams.get("report"));
  const filters = buildAmazonBillingReportFilters(searchParams);
  const format = searchParams.get("format") === "pdf" ? "pdf" : "excel";

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
