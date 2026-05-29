export function formatUserTypeLabel(userType: string | null | undefined) {
  if (!userType) return "—";
  return userType === "HR"
    ? "Administration/HR"
    : userType.replaceAll("_", " ");
}

export function formatFunctionalRoleLabel(role: string | null | undefined) {
  if (!role) return "UNASSIGNED";
  return role.replaceAll("_", " ");
}
