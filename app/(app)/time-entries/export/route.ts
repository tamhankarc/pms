import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAccessMenuItem } from "@/lib/permissions";
import {
  buildTimeEntriesWorkbook,
  getTimeEntryFilterData,
  getTimeEntryRows,
  type TimeEntryListSearchParams,
} from "@/lib/time-entry-reporting";

function getParams(url: string): TimeEntryListSearchParams {
  const searchParams = new URL(url).searchParams;
  return {
    clientId: searchParams.get("clientId") || undefined,
    projectId: searchParams.get("projectId") || undefined,
    subProjectId: searchParams.get("subProjectId") || undefined,
    fromDate: searchParams.get("fromDate") || undefined,
    toDate: searchParams.get("toDate") || undefined,
    userId: searchParams.get("userId") || undefined,
    search: searchParams.get("search") || undefined,
  };
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!canAccessMenuItem(user, "time-entries")) redirect("/dashboard");

  const params = getParams(request.url);
  const filterData = await getTimeEntryFilterData(user);
  const { entries } = await getTimeEntryRows({ user, params, filterData });
  const buffer = await buildTimeEntriesWorkbook({ entries });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="time_entries.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
