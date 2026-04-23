import ReportsPage from "../page";

type ReportSearchParams = Record<string, string | string[] | undefined>;

export default async function ReportSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportName: string }>;
  searchParams?: Promise<ReportSearchParams>;
}) {
  const resolvedParams = await params;

  return (
    <ReportsPage
      activeReportName={resolvedParams.reportName}
      searchParams={searchParams}
    />
  );
}