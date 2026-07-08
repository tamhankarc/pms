import { canCreateOrEditProject } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { NewProjectForm } from "@/components/forms/new-project-form";
export default async function NewProjectPage() {
  const currentUser = await requireUser();
  if (!canCreateOrEditProject(currentUser)) redirect("/dashboard");

  const [
    clients,
    projectTypes,
    filmikResourceTypes,
    contactPersons,
    countries,
    movies,
    assetTypes,
    lensTypes,
    assetNames,
    newsletters,
  ] = await Promise.all([
    db.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        enableProjectTypes: true,
        showCountriesInTimeEntries: true,
        showMoviesInEntries: true,
        showAssetTypesInEntries: true,
        showLensTypesInEntries: true,
        showAssetNamesInEntries: true,
        showNewslettersInEntries: true,
      },
    }),
    db.projectType.findMany({
      where: { isActive: true, client: { isActive: true } },
      select: { id: true, name: true, clientId: true },
      orderBy: { name: "asc" },
    }),
    db.filmikResourceType.findMany({
      where: { clientId: "cmne6ed2o0000jo04t3363pqz", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.contactPerson.findMany({ where: { client: { isActive: true } }, orderBy: [{ client: { name: "asc" } }, { name: "asc" }], select: { id: true, clientId: true, name: true, email: true } }),
    db.country.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.movie.findMany({ where: { isActive: true }, select: { id: true, clientId: true, title: true }, orderBy: { title: "asc" } }),
    db.assetType.findMany({ where: { isActive: true }, select: { id: true, clientId: true, name: true }, orderBy: { name: "asc" } }),
    db.lensType.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.assetName.findMany({ where: { isActive: true }, select: { id: true, clientId: true, movieId: true, name: true }, orderBy: { name: "asc" } }),
    db.newsletter.findMany({ where: { isActive: true }, select: { id: true, clientId: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create project"
        description="Create a project for a client. Project Types are shown only for clients that have them enabled."
      />
      <NewProjectForm
        clients={clients}
        projectTypes={projectTypes}
        filmikResourceTypes={filmikResourceTypes}
        contactPersons={contactPersons}
        countries={countries}
        movies={movies}
        assetTypes={assetTypes}
        lensTypes={lensTypes}
        assetNames={assetNames}
        newsletters={newsletters}
        isAdmin={currentUser.userType === "ADMIN"}
      />
    </div>
  );
}
