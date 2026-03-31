"use client";

import { useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";

const operationalFunctionalRoles = [
  "DEVELOPER",
  "QA",
  "DESIGNER",
  "LOCALIZATION",
  "DEVOPS",
  "PROJECT_MANAGER",
  "OTHER",
] as const;

const userTypes = [
  "EMPLOYEE",
  "TEAM_LEAD",
  "MANAGER",
  "ADMIN",
  "REPORT_VIEWER",
  "ACCOUNTS",
] as const;

type FunctionalRole =
  | (typeof operationalFunctionalRoles)[number]
  | "BILLING";

function PasswordField() {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <FormLabel htmlFor="password" required>Temporary password</FormLabel>
      <div className="relative">
        <input id="password" className="input pr-24" name="password" type={visible ? "text" : "password"} required />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-600 hover:text-slate-900"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? "Hide" : "Show"} temporary password`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export function UserCreateForm({
  teamLeads,
  action,
}: {
  teamLeads: { id: string; fullName: string; email: string }[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [userType, setUserType] = useState<(typeof userTypes)[number]>("EMPLOYEE");
  const [functionalRole, setFunctionalRole] = useState<FunctionalRole>("DEVELOPER");

  const availableFunctionalRoles = userType === "ACCOUNTS"
    ? (["BILLING"] as const)
    : operationalFunctionalRoles;

  const showSupervisors = userType === "EMPLOYEE";

  const supervisorOptions = useMemo(() => teamLeads, [teamLeads]);

  function handleUserTypeChange(nextUserType: (typeof userTypes)[number]) {
    setUserType(nextUserType);
    if (nextUserType === "ACCOUNTS") {
      setFunctionalRole("BILLING");
    } else if (functionalRole === "BILLING") {
      setFunctionalRole("DEVELOPER");
    }
  }

  return (
    <form action={action} className="card p-6">
      <h2 className="section-title">Create user</h2>
      <p className="section-subtitle">
        Fields marked <span className="text-red-600">*</span> are required.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <FormLabel htmlFor="fullName" required>Full name</FormLabel>
          <input id="fullName" className="input" name="fullName" required />
        </div>

        <div>
          <FormLabel htmlFor="username" required>Username</FormLabel>
          <input id="username" className="input" name="username" required />
        </div>

        <div>
          <FormLabel htmlFor="email" required>Email</FormLabel>
          <input id="email" className="input" name="email" type="email" required />
        </div>

        <PasswordField />

        <div>
          <FormLabel htmlFor="userType" required>User type</FormLabel>
          <select
            id="userType"
            className="input"
            name="userType"
            value={userType}
            onChange={(e) => handleUserTypeChange(e.target.value as (typeof userTypes)[number])}
          >
            {userTypes.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FormLabel htmlFor="functionalRole" required>Functional role</FormLabel>
          <select
            id="functionalRole"
            className="input"
            name="functionalRole"
            value={functionalRole}
            onChange={(e) => setFunctionalRole(e.target.value as FunctionalRole)}
          >
            {availableFunctionalRoles.map((role) => (
              <option key={role} value={role}>
                {role.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FormLabel htmlFor="phoneNumber">Phone number</FormLabel>
          <input id="phoneNumber" className="input" name="phoneNumber" />
        </div>

        {showSupervisors ? (
          <div>
            <FormLabel htmlFor="teamLeadIds" required>Assign Supervisor(s)</FormLabel>
            <select id="teamLeadIds" className="input min-h-36" name="teamLeadIds" multiple required>
              {supervisorOptions.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.fullName} ({lead.email})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Hold Ctrl/Cmd to select multiple supervisors.
            </p>
          </div>
        ) : null}

        {userType === "ACCOUNTS" ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Accounts users are not assigned to groups or supervisors and will access only the billing dashboard.
          </div>
        ) : null}

        <button className="btn-primary w-full">Create user</button>
      </div>
    </form>
  );
}