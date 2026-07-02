import { db } from "@/lib/db";

export async function getCopyDeckOptions() {
  const [clients, movies, projects, subProjects, countries] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.movie.findMany({ where: { isActive: true }, select: { id: true, title: true, clientId: true }, orderBy: { title: "asc" } }),
    db.project.findMany({ where: { isActive: true }, select: { id: true, name: true, clientId: true }, orderBy: { name: "asc" } }),
    db.subProject.findMany({ where: { isActive: true }, select: { id: true, name: true, projectId: true, project: { select: { clientId: true } } }, orderBy: { name: "asc" } }),
    db.country.findMany({ where: { isActive: true }, select: { id: true, name: true, isoCode: true }, orderBy: { name: "asc" } }),
  ]);
  const australia = countries.find((country) => country.isoCode?.toUpperCase() === "AU" || country.name.toLowerCase() === "australia");
  if (!australia) throw new Error("Australia must exist as an active Country before Copy Decks can be used.");
  return {
    clients,
    movies: movies.map((item) => ({ id: item.id, name: item.title, clientId: item.clientId })),
    projects,
    subProjects: subProjects.map((item) => ({ id: item.id, name: item.name, projectId: item.projectId, clientId: item.project.clientId })),
    countries,
    australiaId: australia.id,
  };
}
