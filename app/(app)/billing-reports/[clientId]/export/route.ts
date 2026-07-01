import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canViewBillingReports } from "@/lib/permissions";
import {
  buildClientTitleSummaryFilters,
  getSonyTitleSummaryData,
  getWarnerTitleSummaryData,
} from "@/lib/billing-reports/title-summary";
import {
  buildAmazonBillingReportFilters,
  buildWarnerDomesticDeliverableFilters,
  getAmazonBillingReportData,
  getBillingReportCatalogForClient,
  GENERIC_TITLE_REPORTS,
  getWarnerDomesticDeliverableData,
  getWarnerIntlDeliverableData,
  getWarnerOtherDeliverableData,
  getWarnerPortalReportData,
  getUniversalBillingSummaryData,
  buildBillingHistoryFilters,
  getBillingHistoryData,
  normalizeAmazonReportType,
} from "@/lib/billing-reports/amazon";
import { db } from "@/lib/db";
import {
  FILMIK_CLIENT_ID,
  SONY_PICTURES_CLASSICS_CLIENT_ID,
  isBillingReportClientExcluded,
} from "@/lib/billing-reports/config";
import {
  buildGenericBillingReportFilters,
  buildGenericBillingSummaryHistoryFilters,
  getGenericBillingReportData,
  getGenericBillingSummaryHistoryData,
} from "@/lib/billing-reports/generic";
import {
  buildSonyNewsletterBillingFilters,
  buildSonyPicturesReportFilters,
  buildSonyBillingSummaryHistoryFilters,
  getSonyNewsletterBillingData,
  getSonyPicturesReportData,
  getSonyBillingSummaryHistoryData,
} from "@/lib/billing-reports/sony";
import {
  buildFilmikBillingReportFilters,
  getFilmikBillingReportData,
  getFilmikBillingReportFileName,
} from "@/lib/billing-reports/filmik";
import {
  buildRoyalBillingFilters,
  getRoyalBillingReportData,
  getRoyalBillingReportFileName,
  ROYAL_CARIBBEAN_CLIENT_NAME,
} from "@/lib/billing-reports/royal";
import {
  buildAmazonReportExcel,
  buildAmazonReportFileName,
  buildAmazonReportPdf,
  buildUniversalBillingSummaryExcel,
  buildUniversalBillingSummaryPdf,
  buildWarnerDomesticReportExcel,
  buildWarnerDomesticReportFileName,
  buildWarnerDomesticReportPdf,
  buildWarnerPortalReportExcel,
  buildWarnerPortalReportPdf,
  getWarnerPortalReportFileName,
  buildGenericBillingReportExcel,
  buildGenericBillingReportPdf,
  getGenericBillingReportFileName,
  buildSonyPicturesReportExcel,
  buildSonyPicturesReportPdf,
  buildSonyNewsletterBillingExcel,
  buildSonyNewsletterBillingPdf,
  buildFilmikBillingReportExcel,
  buildFilmikBillingReportPdf,
  getSonyPicturesReportFileName,
  getSonyNewsletterBillingFileName,
  buildRoyalBillingReportExcel,
  buildRoyalBillingReportPdf,
  buildBillingHistoryReportExcel,
  buildBillingHistoryReportPdf,
  getBillingHistoryReportFileName,
  buildGenericBillingSummaryHistoryExcel,
  buildGenericBillingSummaryHistoryPdf,
  getGenericBillingSummaryHistoryFileName,
  buildSonyBillingSummaryHistoryExcel,
  buildSonyBillingSummaryHistoryPdf,
  getSonyBillingSummaryHistoryFileName,
  buildClientTitleSummaryExcel,
  buildClientTitleSummaryPdf,
  getClientTitleSummaryFileName,
} from "@/lib/billing-reports/export";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canViewBillingReports(user))
    return new Response("Forbidden", { status: 403 });

  const { clientId } = await params;
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      showMoviesInEntries: true,
      poAssignmentMode: true,
    },
  });
  if (!client || isBillingReportClientExcluded(client.id))
    redirect("/billing-reports");

  const { searchParams } = new URL(request.url);
  const configuredReportCatalog = getBillingReportCatalogForClient(
    client.name,
    client.id,
  );
  const usesGenericProjectReports =
    !configuredReportCatalog && client.poAssignmentMode === "PROJECT";
  const reportCatalog =
    configuredReportCatalog ??
    (client.showMoviesInEntries || usesGenericProjectReports
      ? GENERIC_TITLE_REPORTS
      : null);
  const requestedReport = searchParams.get("report");
  const reportType = reportCatalog
    ? requestedReport &&
      Object.prototype.hasOwnProperty.call(reportCatalog, requestedReport)
      ? (requestedReport as import("@/lib/billing-reports/amazon").AmazonReportType)
      : (Object.keys(
          reportCatalog,
        )[0] as import("@/lib/billing-reports/amazon").AmazonReportType)
    : normalizeAmazonReportType(requestedReport, client.name, client.id);
  const reportDefinition = reportCatalog?.[reportType];
  const format = searchParams.get("format") === "pdf" ? "pdf" : "excel";

  if (
    client.name.trim().toLowerCase() ===
    ROYAL_CARIBBEAN_CLIENT_NAME.toLowerCase()
  ) {
    const filters = buildRoyalBillingFilters(searchParams);
    const data = await getRoyalBillingReportData({ clientId, filters });
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildRoyalBillingReportPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getRoyalBillingReportFileName(data, "pdf")}"`,
        },
      });
    }

    const excel = buildRoyalBillingReportExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${getRoyalBillingReportFileName(data, "xls")}"`,
      },
    });
  }

  if (reportDefinition?.kind === "billing-history") {
    const filters = buildBillingHistoryFilters(searchParams);
    const data = await getBillingHistoryData({ clientId, filters });
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildBillingHistoryReportPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getBillingHistoryReportFileName(data, "pdf")}"`,
        },
      });
    }

    const excel = buildBillingHistoryReportExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${getBillingHistoryReportFileName(data, "xls")}"`,
      },
    });
  }

  if (reportDefinition?.kind === "title-summary") {
    const filters = buildClientTitleSummaryFilters(searchParams);
    const data =
      client.id === "cmn66av4j0001l104077m5vxz"
        ? await getWarnerTitleSummaryData({ clientId, filters })
        : client.id === "cmn66d3q40002l104n6wvefvl"
          ? await getSonyTitleSummaryData({ clientId, filters })
          : null;
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildClientTitleSummaryPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getClientTitleSummaryFileName(data, "pdf")}"`,
        },
      });
    }

    const excel = await buildClientTitleSummaryExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${getClientTitleSummaryFileName(data, "xlsx")}"`,
      },
    });
  }

  if (reportDefinition?.kind === "time-entry-summary") {
    const filters = buildAmazonBillingReportFilters(searchParams);
    const data = await getUniversalBillingSummaryData({ clientId, filters });
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildUniversalBillingSummaryPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${buildAmazonReportFileName({ ...data, projectName: "", movieOptions: [], assetTypeOptions: [], rows: [], summaryRows: [], titleSummaryRows: [], completedTitleSummaryRows: [], countryOptions: [], contactPersons: "-" }, "pdf")}"`,
        },
      });
    }

    const excel = buildUniversalBillingSummaryExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildAmazonReportFileName({ ...data, projectName: "", movieOptions: [], assetTypeOptions: [], rows: [], summaryRows: [], titleSummaryRows: [], completedTitleSummaryRows: [], countryOptions: [], contactPersons: "-" }, "xls")}"`,
      },
    });
  }

  if (reportDefinition?.kind === "warner-portals") {
    const data = await getWarnerPortalReportData({
      clientId,
      month: searchParams.get("month") ?? undefined,
      projectType: reportType === "dvd-sites" ? "DVD" : "PORTAL",
      reportType: reportType === "dvd-sites" ? "dvd-sites" : "portals",
      reportTitle: reportType === "dvd-sites" ? "DVD Sites" : "Portals",
    });
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildWarnerPortalReportPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getWarnerPortalReportFileName(data, "pdf")}"`,
        },
      });
    }

    const excel = buildWarnerPortalReportExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${getWarnerPortalReportFileName(data, "xls")}"`,
      },
    });
  }

  if (reportDefinition?.kind === "deliverable") {
    const filters = buildWarnerDomesticDeliverableFilters(searchParams);
    const data =
      reportType === "intl-deliverable"
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

  if (reportDefinition?.kind === "sony-movie") {
    const filters = buildSonyPicturesReportFilters(searchParams);
    const data = await getSonyPicturesReportData({
      clientId,
      filters,
      variant: reportType === "canada-other" ? "canada-other" : "main",
    });
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildSonyPicturesReportPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getSonyPicturesReportFileName(data, "pdf")}"`,
        },
      });
    }

    const excel = buildSonyPicturesReportExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${getSonyPicturesReportFileName(data, "xls")}"`,
      },
    });
  }

  if (reportDefinition?.kind === "sony-summary-history") {
    const filters = buildSonyBillingSummaryHistoryFilters(searchParams);
    const data = await getSonyBillingSummaryHistoryData({ clientId, filters });
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildSonyBillingSummaryHistoryPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getSonyBillingSummaryHistoryFileName(data, "pdf")}"`,
        },
      });
    }

    const excel = buildSonyBillingSummaryHistoryExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${getSonyBillingSummaryHistoryFileName(data, "xls")}"`,
      },
    });
  }

  if (reportDefinition?.kind === "sony-newsletters") {
    const filters = buildSonyNewsletterBillingFilters(searchParams);
    const data = await getSonyNewsletterBillingData({ clientId, filters });
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildSonyNewsletterBillingPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getSonyNewsletterBillingFileName(data, "pdf")}"`,
        },
      });
    }

    const excel = buildSonyNewsletterBillingExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${getSonyNewsletterBillingFileName(data, "xls")}"`,
      },
    });
  }

  if (
    client.id === FILMIK_CLIENT_ID &&
    reportDefinition?.kind === "generic-filmik"
  ) {
    const filters = buildFilmikBillingReportFilters(searchParams);
    const data = await getFilmikBillingReportData(filters);
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildFilmikBillingReportPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getFilmikBillingReportFileName(data, "pdf")}"`,
        },
      });
    }

    const excel = buildFilmikBillingReportExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${getFilmikBillingReportFileName(data, "xls")}"`,
      },
    });
  }

  const isSonyPicturesClassicsReport =
    client.id === SONY_PICTURES_CLASSICS_CLIENT_ID;
  const genericOptions =
    reportDefinition?.kind === "generic-movie"
      ? {
          movieSpecific: !usesGenericProjectReports,
          openDateRange: isSonyPicturesClassicsReport,
        }
      : undefined;

  if (reportDefinition?.kind === "generic-summary-history") {
    const filters = buildGenericBillingSummaryHistoryFilters(searchParams);
    const data = await getGenericBillingSummaryHistoryData({
      clientId,
      filters,
    });
    if (!data) redirect("/billing-reports");

    if (format === "pdf") {
      const pdf = buildGenericBillingSummaryHistoryPdf(data);
      return new Response(Buffer.from(pdf, "binary"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getGenericBillingSummaryHistoryFileName(data, "pdf")}"`,
        },
      });
    }

    const excel = buildGenericBillingSummaryHistoryExcel(data);
    return new Response(excel, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${getGenericBillingSummaryHistoryFileName(data, "xls")}"`,
      },
    });
  }

  if (!reportDefinition || genericOptions) {
    const genericFilters = buildGenericBillingReportFilters(searchParams);
    const filters = isSonyPicturesClassicsReport
      ? {
          ...genericFilters,
          fromDate: searchParams.get("fromDate") ?? "",
          toDate: searchParams.get("toDate") ?? "",
          movieId: searchParams.get("movieId") ?? "all",
        }
      : genericFilters;
    const data = await getGenericBillingReportData({
      clientId,
      filters,
      options: genericOptions,
    });
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

  if (reportDefinition.kind === "placeholder")
    return new Response(
      "Export is not available yet for this placeholder report.",
      { status: 404 },
    );

  const filters = buildAmazonBillingReportFilters(searchParams);
  const data = await getAmazonBillingReportData({
    clientId,
    reportType,
    filters,
  });
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
