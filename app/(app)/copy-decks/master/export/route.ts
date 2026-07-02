import { getSession } from "@/lib/auth";
import { canManageCopyDeckMaster } from "@/lib/permissions";
import { buildCopyDeckMasterWorkbook } from "@/lib/copy-decks/export";

export async function GET() {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canManageCopyDeckMaster(user)) return new Response("Forbidden", { status: 403 });
  try {
    return new Response(await buildCopyDeckMasterWorkbook(), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="copy-deck-master.xlsx"',
    } });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Unable to export master.", { status: 400 });
  }
}
