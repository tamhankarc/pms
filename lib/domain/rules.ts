export function assertProjectHasAtLeastOneCountry(countryIds: string[]) {
  if (!Array.isArray(countryIds) || countryIds.length < 1) {
    throw new Error("A project must have at least one country.");
  }
}

export function assertEmployeeHasAtLeastOneSupervisor(supervisorIds: string[]) {
  if (!Array.isArray(supervisorIds) || supervisorIds.length < 1) {
    throw new Error("An employee must be assigned to at least one Team Lead or Manager.");
  }
}

export function assertUniqueIds(ids: string[], label: string) {
  const cleaned = ids.filter(Boolean);
  const unique = new Set(cleaned);
  if (cleaned.length != unique.size) {
    throw new Error(`Duplicate ${label} values are not allowed.`);
  }
}

export function assertReviewableProjectState(
  status: string,
  isActive: boolean,
) {
  if (!isActive) {
    throw new Error("This project is inactive and cannot accept estimates or time entries.");
  }

  if (["ARCHIVED", "COMPLETED", "ON_HOLD"].includes(status)) {
    throw new Error(`Project is ${status.toLowerCase().replace("_", " ")} and cannot accept new estimates or time entries.`);
  }
}

export function assertMinutesPositive(minutes: number, fieldName = "Minutes") {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }
}

export function assertEstimatePositive(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("Estimated minutes must be greater than zero.");
  }
}
