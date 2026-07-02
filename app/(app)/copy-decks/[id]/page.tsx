import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAccessCopyDecks } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { CopyDeckCorrectedUploadForm } from "@/components/forms/copy-deck-corrected-upload-form";

export default async function CopyDeckPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canAccessCopyDecks(user)) redirect("/dashboard");
  const { id } = await params;
  const deck = await db.copyDeck.findUnique({
    where: { id },
    include: { client: true, movie: true, project: true, subProject: true, market: true, marketSelections: { include: { market: true }, orderBy: { createdAt: "asc" } }, country: true, rows: { include: { translations: true }, orderBy: { rowOrder: "asc" } } },
  });
  if (!deck) notFound();
  return <div className="space-y-6">
    <PageHeader title={deck.name} description={`${deck.client.name} · ${deck.marketSelections.length ? deck.marketSelections.map((selection) => selection.market.name).join(", ") : deck.market?.name ?? deck.country?.name ?? "No market"}`} actions={<><Link className="btn-secondary" href="/copy-decks">Back</Link><Link className="btn-primary" href={`/copy-decks/${deck.id}/export`}>Download XLSX</Link></>} />
    <CopyDeckCorrectedUploadForm copyDeckId={deck.id} />
    <div className="table-wrap"><table className="table-base"><thead className="table-head"><tr><th className="table-cell">#</th><th className="table-cell">English Text</th>{(deck.marketSelections.length ? deck.marketSelections.map((selection) => selection.market) : deck.market ? [deck.market] : []).map((market) => <th className="table-cell" key={market.id}>{market.name}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{deck.rows.map((row) => <tr key={row.id}><td className="table-cell">{row.rowOrder}</td><td className="table-cell max-w-xl whitespace-pre-wrap">{row.englishText}</td>{(deck.marketSelections.length ? deck.marketSelections.map((selection) => selection.market) : deck.market ? [deck.market] : []).map((market) => { const translation = row.translations.find((item) => item.marketId === market.id); return <td className="table-cell max-w-xl whitespace-pre-wrap" key={market.id}><div>{translation?.translatedText ?? (market.id === row.marketId ? row.translatedText : "—")}</div>{translation ? <span className={translation.source === "ENGLISH_FALLBACK" ? "badge-rose" : "badge-slate"}>{translation.source.replaceAll("_", " ")}</span> : null}</td>; })}</tr>)}</tbody>
    </table></div>
  </div>;
}
