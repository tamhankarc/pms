import { db } from "@/lib/db";
import {
  ensureDefaultCopyDeckMarkets,
  ensureLegacyCopyDeckCompatibility,
} from "@/lib/copy-decks/markets";

export async function getCopyDeckOptions() {
  const defaultMarket = await ensureDefaultCopyDeckMarkets();
  await ensureLegacyCopyDeckCompatibility();
  const [clients, movies, projects, subProjects, markets] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.movie.findMany({ where: { isActive: true }, select: { id: true, title: true, clientId: true }, orderBy: { title: "asc" } }),
    db.project.findMany({ where: { isActive: true }, select: { id: true, name: true, clientId: true }, orderBy: { name: "asc" } }),
    db.subProject.findMany({ where: { isActive: true }, select: { id: true, name: true, projectId: true, project: { select: { clientId: true } } }, orderBy: { name: "asc" } }),
    db.copyDeckMarket.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, isDefault: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
  ]);
  return {
    clients,
    movies: movies.map((item) => ({ id: item.id, name: item.title, clientId: item.clientId })),
    projects,
    subProjects: subProjects.map((item) => ({ id: item.id, name: item.name, projectId: item.projectId, clientId: item.project.clientId })),
    markets,
    australiaMarketId: defaultMarket.id,
  };
}
