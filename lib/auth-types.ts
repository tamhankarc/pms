export type CurrentUser = {
  id: string;
  userType:
    | "ADMIN"
    | "MANAGER"
    | "TEAM_LEAD"
    | "EMPLOYEE"
    | "REPORT_VIEWER";
  functionalRole?:
    | "DEVELOPER"
    | "QA"
    | "DESIGNER"
    | "LOCALIZATION"
    | "DEVOPS"
    | "PROJECT_MANAGER"
    | "OTHER"
    | "UNASSIGNED"
    | null;
  email?: string;
  fullName?: string | null;
};
