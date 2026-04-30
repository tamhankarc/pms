export type CurrentUser = {
  id: string;
  userType:
    | "ADMIN"
    | "MANAGER"
    | "TEAM_LEAD"
    | "EMPLOYEE"
    | "REPORT_VIEWER"
    | "ACCOUNTS"
    | "HR"
    | "OPERATIONS";
  functionalRole?:
    | "DEVELOPER"
    | "QA"
    | "DESIGNER"
    | "LOCALIZATION"
    | "DEVOPS"
    | "PROJECT_MANAGER"
    | "DIRECTOR"
    | "BILLING"
    | "OTHER"
    | "UNASSIGNED"
    | null;
  email?: string;
  fullName?: string | null;
};
