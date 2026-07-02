import { getSession } from "@/lib/auth";
import { canAccessCopyDecks } from "@/lib/permissions";
import { buildCopyDeckWorkbook } from "@/lib/copy-decks/export";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canAccessCopyDecks(user)) return new Response("Forbidden", { status: 403 });
  try {
    const { id } = await params;
    const result = await buildCopyDeckWorkbook(id);
    return new Response(result.buffer, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
    } });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Unable to export copy deck.", { status: 400 });
  }
}
