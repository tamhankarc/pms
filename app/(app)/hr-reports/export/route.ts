import { getSession } from "@/lib/auth";
import { canViewHRReports } from "@/lib/permissions";
import {
  buildHRReportPdf,
  buildHRReportWorkbook,
  getHRReportData,
  getHRReportFileName,
  normalizeHRReportType,
  validateReportDateRange,
} from "@/lib/hr-reports";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canViewHRReports(user)) return new Response("Forbidden", { status: 403 });
  try {
    const params = new URL(request.url).searchParams;
    const { fromDate, toDate } = validateReportDateRange(params.get("fromDate"), params.get("toDate"));
    const type = normalizeHRReportType(params.get("type"));
    const format = params.get("format") === "pdf" ? "pdf" : "xlsx";
    const data = await getHRReportData(type, fromDate, toDate);
    if (format === "pdf") {
      return new Response(buildHRReportPdf(data), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getHRReportFileName(data, "pdf")}"`,
        },
      });
    }
    return new Response(await buildHRReportWorkbook(data), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${getHRReportFileName(data, "xlsx")}"`,
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Unable to generate HR report.", { status: 400 });
  }
}
