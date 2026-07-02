import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAccessCopyDecks, canAssignCopyDeckAccess, canManageCopyDeckMaster } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { CopyDeckFilterForm } from "@/components/forms/copy-deck-filter-form";
import { getCopyDeckOptions } from "@/lib/copy-decks/options";
import { DEFAULT_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";
import { PaginationControls } from "@/components/ui/pagination-controls";

export default async function CopyDecksPage({ searchParams }: {
  searchParams?: Promise<{ clientId?: string; movieId?: string; projectId?: string; subProjectId?: string; marketId?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (!canAccessCopyDecks(user)) redirect("/dashboard");
  const params = (await searchParams) ?? {};
  const options = await getCopyDeckOptions();
  const clientId = params.clientId ?? "";
  const marketId = clientId ? (params.marketId || options.australiaMarketId) : options.australiaMarketId;
  const decks = await db.copyDeck.findMany({
    where: {
      ...(clientId ? { clientId, marketId } : {}),
      ...(clientId && params.movieId ? { movieId: params.movieId } : {}),
      ...(clientId && params.projectId ? { projectId: params.projectId } : {}),
      ...(clientId && params.subProjectId ? { subProjectId: params.subProjectId } : {}),
    },
    include: { client: true, movie: true, project: true, subProject: true, market: true, country: true, createdBy: true, _count: { select: { rows: true } } },
    orderBy: { createdAt: "desc" },
  });
  const page = paginateItems(decks, parsePageParam(params.page), DEFAULT_PAGE_SIZE);
  return <div className="space-y-6">
    <PageHeader title="Copy Decks" description="Generate, download, and reconcile country-specific copy decks from English source spreadsheets." actions={<>
      {canAssignCopyDeckAccess(user) ? <Link className="btn-secondary" href="/copy-decks/access">Manage Access</Link> : null}
      {canManageCopyDeckMaster(user) ? <Link className="btn-secondary" href="/copy-decks/master">Master</Link> : null}
      <Link className="btn-primary" href="/copy-decks/new">Upload Copy Deck</Link>
    </>} />
    <CopyDeckFilterForm {...options} initial={{ clientId, movieId: params.movieId ?? "", projectId: params.projectId ?? "", subProjectId: params.subProjectId ?? "", marketId }} />
    <div className="table-wrap"><table className="table-base"><thead className="table-head"><tr>
      <th className="table-cell">Name</th><th className="table-cell">Client</th><th className="table-cell">Title / Project</th><th className="table-cell">Country/Market</th><th className="table-cell">Rows</th><th className="table-cell">Created</th><th className="table-cell">Action</th>
    </tr></thead><tbody className="divide-y divide-slate-100">
      {page.items.map((deck) => <tr key={deck.id}>
        <td className="table-cell font-medium">{deck.name}</td><td className="table-cell">{deck.client.name}</td>
        <td className="table-cell">{[deck.movie?.title, deck.project?.name, deck.subProject?.name].filter(Boolean).join(" / ") || "—"}</td>
        <td className="table-cell">{deck.market?.name ?? deck.country?.name ?? "—"}</td><td className="table-cell">{deck._count.rows}</td>
        <td className="table-cell">{deck.createdAt.toLocaleDateString()} by {deck.createdBy.fullName}</td>
        <td className="table-cell"><Link className="btn-secondary text-xs" href={`/copy-decks/${deck.id}`}>Open</Link></td>
      </tr>)}
      {!page.items.length ? <tr><td className="table-cell text-center text-slate-500" colSpan={7}>No copy decks found.</td></tr> : null}
    </tbody></table>
    <PaginationControls basePath="/copy-decks" currentPage={page.currentPage} totalPages={page.totalPages} totalItems={page.totalItems} pageSize={page.pageSize} searchParams={{ clientId: clientId || undefined, movieId: params.movieId, projectId: params.projectId, subProjectId: params.subProjectId, marketId: clientId ? marketId : undefined }} />
    </div>
  </div>;
}
