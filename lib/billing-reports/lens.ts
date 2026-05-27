import { db } from "@/lib/db";

export type LensBillingAdjustment = {
  projectId: string;
  lensNames: string[];
  detailLines: string[];
  cost: number;
};

type ProjectLensType = {
  id: string;
  name: string;
  countries: Map<string, string>;
  firstSeenAt: Date;
  firstSeenCreatedAt: Date;
};

/**
 * Calculates Lens Type/platform billing from Time Entries.
 *
 * Pricing rule for each project within the supplied billing scope:
 * - One Lens Type/platform is billed at the client's first-platform rate.
 * - Each additional Lens Type/platform is billed at the client's subsequent-platform rate.
 * - Each platform is charged only for its own distinct countries/markets recorded in Time Entries.
 *
 * Formula:
 * (first platform rate × distinct countries for first platform)
 * + S(subsequent platform rate × distinct countries for each additional platform)
 *
 * Repeated Time Entries for the same project, Lens Type and country do not add another charge.
 * Lens Type entries without a selected country/market are not billable under this formula.
 * Since Lens Type currently has no explicit billing-priority/order field, the first platform is
 * determined by the earliest qualifying Time Entry. Entries on the same date are resolved by
 * creation time, then Lens Type name and id for stable results.
 */
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
      ...(countryIds
        ? { countryId: { in: countryIds } }
        : { countryId: { not: null } }),
      ...(movieId ? { movieId } : {}),
      ...(workDate && (workDate.gte || workDate.lte) ? { workDate } : {}),
    },
    select: {
      id: true,
      projectId: true,
      workDate: true,
      createdAt: true,
      project: {
        select: {
          billingModel: true,
          client: {
            select: {
              lensFirstPlatformCost: true,
              lensSubsequentPlatformCost: true,
            },
          },
        },
      },
      lensType: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, isoCode: true } },
    },
  });

  const grouped = new Map<
    string,
    {
      billingModel: string;
      firstPlatformCost: number;
      subsequentPlatformCost: number;
      lensTypes: Map<string, ProjectLensType>;
    }
  >();

  for (const entry of entries) {
    if (!entry.lensType) continue;

    const project = grouped.get(entry.projectId) ?? {
      billingModel: entry.project.billingModel,
      firstPlatformCost: Number(
        entry.project.client.lensFirstPlatformCost ?? 0,
      ),
      subsequentPlatformCost: Number(
        entry.project.client.lensSubsequentPlatformCost ?? 0,
      ),
      lensTypes: new Map<string, ProjectLensType>(),
    };

    const existingLens = project.lensTypes.get(entry.lensType.id);
    const lens: ProjectLensType = existingLens ?? {
      id: entry.lensType.id,
      name: entry.lensType.name,
      countries: new Map<string, string>(),
      firstSeenAt: entry.workDate,
      firstSeenCreatedAt: entry.createdAt,
    };

    const occursBeforeFirstSeen =
      entry.workDate.getTime() < lens.firstSeenAt.getTime() ||
      (entry.workDate.getTime() === lens.firstSeenAt.getTime() &&
        entry.createdAt.getTime() < lens.firstSeenCreatedAt.getTime());

    if (occursBeforeFirstSeen) {
      lens.firstSeenAt = entry.workDate;
      lens.firstSeenCreatedAt = entry.createdAt;
    }

    if (entry.country) {
      const marketName = entry.country.isoCode
        ? `${entry.country.name} (${entry.country.isoCode})`
        : entry.country.name;
      lens.countries.set(entry.country.id, marketName);
    }

    project.lensTypes.set(entry.lensType.id, lens);
    grouped.set(entry.projectId, project);
  }

  const result = new Map<string, LensBillingAdjustment>();

  for (const [projectId, project] of grouped.entries()) {
    const lensTypesByBillingOrder = Array.from(project.lensTypes.values()).sort(
      (a, b) => {
        const workDateDifference =
          a.firstSeenAt.getTime() - b.firstSeenAt.getTime();
        if (workDateDifference !== 0) return workDateDifference;

        const createdAtDifference =
          a.firstSeenCreatedAt.getTime() - b.firstSeenCreatedAt.getTime();
        if (createdAtDifference !== 0) return createdAtDifference;

        const nameDifference = a.name.localeCompare(b.name);
        return nameDifference !== 0 ? nameDifference : a.id.localeCompare(b.id);
      },
    );

    const isPerCountry = project.billingModel === "FIXED_PER_COUNTRY";
    const detailLines = lensTypesByBillingOrder.map((lens) => {
      const countries = Array.from(lens.countries.values()).sort((a, b) =>
        a.localeCompare(b),
      );
      return isPerCountry
        ? `${lens.name}: ${countries.length ? countries.join(", ") : "No country"}`
        : lens.name;
    });

    const cost = lensTypesByBillingOrder.reduce((sum, lens, index) => {
      const rate =
        index === 0
          ? project.firstPlatformCost
          : project.subsequentPlatformCost;
      return sum + rate * lens.countries.size;
    }, 0);

    result.set(projectId, {
      projectId,
      lensNames: lensTypesByBillingOrder.map((lens) => lens.name),
      detailLines,
      cost: Number(cost.toFixed(2)),
    });
  }

  return result;
}
