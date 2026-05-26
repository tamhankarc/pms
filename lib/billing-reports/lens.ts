import { db } from "@/lib/db";

export type LensBillingAdjustment = {
  projectId: string;
  lensNames: string[];
  detailLines: string[];
  cost: number;
};

export async function getLensBillingAdjustments({
  projectIds,
  movieId,
  workDate,
  countryIds,
}: {
  projectIds: string[];
  movieId?: string;
  workDate?: { gte?: Date; lte?: Date };
  countryIds?: string[];
}): Promise<Map<string, LensBillingAdjustment>> {
  if (!projectIds.length) return new Map();

  const entries = await db.timeEntry.findMany({
    where: {
      projectId: { in: projectIds },
      lensTypeId: { not: null },
      ...(movieId ? { movieId } : {}),
      ...(workDate && (workDate.gte || workDate.lte) ? { workDate } : {}),
      ...(countryIds ? { countryId: { in: countryIds } } : {}),
    },
    select: {
      projectId: true,
      project: { select: { billingModel: true } },
      lensType: { select: { id: true, name: true, cost: true } },
      country: { select: { id: true, name: true, isoCode: true } },
    },
  });

  const grouped = new Map<
    string,
    Map<
      string,
      {
        name: string;
        cost: number;
        billingModel: string;
        countries: Map<string, string>;
      }
    >
  >();

  for (const entry of entries) {
    if (!entry.lensType) continue;
    const projectLensTypes = grouped.get(entry.projectId) ?? new Map();
    const lens = projectLensTypes.get(entry.lensType.id) ?? {
      name: entry.lensType.name,
      cost: Number(entry.lensType.cost ?? 0),
      billingModel: entry.project.billingModel,
      countries: new Map<string, string>(),
    };
    if (entry.country) {
      lens.countries.set(
        entry.country.id,
        entry.country.isoCode
          ? `${entry.country.name} (${entry.country.isoCode})`
          : entry.country.name,
      );
    }
    projectLensTypes.set(entry.lensType.id, lens);
    grouped.set(entry.projectId, projectLensTypes);
  }

  const result = new Map<string, LensBillingAdjustment>();
  for (const [projectId, lensTypes] of grouped.entries()) {
    const values = Array.from(lensTypes.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const isPerCountry = values.some(
      (lens) => lens.billingModel === "FIXED_PER_COUNTRY",
    );
    const detailLines = values.map((lens) => {
      const countries = Array.from(lens.countries.values()).sort((a, b) =>
        a.localeCompare(b),
      );
      return isPerCountry
        ? `${lens.name}: ${countries.length ? countries.join(", ") : "No country"}`
        : lens.name;
    });
    const cost = values.reduce((sum, lens) => {
      if (lens.billingModel === "FIXED_PER_COUNTRY") {
        return sum + lens.cost * lens.countries.size;
      }
      return sum + lens.cost;
    }, 0);
    result.set(projectId, {
      projectId,
      lensNames: values.map((lens) => lens.name),
      detailLines,
      cost,
    });
  }
  return result;
}
