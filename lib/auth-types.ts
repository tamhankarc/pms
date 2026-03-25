export type CurrentUser = {
  id: string;
  userType:
    | "ADMIN"
    | "MANAGER"
    | "TEAM_LEAD"
    | "EMPLOYEE"
    | "REPORT_VIEWER";
  email?: string;
  fullName?: string | null;
};
