export const FILMIK_CLIENT_ID = "cmne6ed2o0000jo04t3363pqz";
export const SONY_PICTURES_CLIENT_ID = "cmn66d3q40002l104n6wvefvl";
export const SONY_PICTURES_CLASSICS_CLIENT_ID = "cmospbmq30000jl047ytmd4po";

// Add client IDs here when a client should be hidden from Billing Reports menu and /billing-reports.
export const EXCLUDED_BILLING_REPORT_CLIENT_IDS: string[] = [];

export function isBillingReportClientExcluded(clientId: string) {
  return EXCLUDED_BILLING_REPORT_CLIENT_IDS.includes(clientId);
}

export const billingReportClientVisibilityWhere = {
  isActive: true,
  id: { notIn: EXCLUDED_BILLING_REPORT_CLIENT_IDS },
  projects: { some: { isActive: true, status: "ACTIVE" as const } },
};
