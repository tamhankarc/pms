"use client";

import { useState } from "react";
import { FormLabel } from "@/components/ui/form-label";

const functionalRoles = [
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
] as const;

export function UserCreateForm({
  teamLeads,
  action,
}: {
  teamLeads: { id: string; fullName: string; email: string }[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [userType, setUserType] = useState<(typeof userTypes)[number]>("EMPLOYEE");

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
          <FormLabel htmlFor="email" required>Email</FormLabel>
          <input id="email" className="input" name="email" type="email" required />
        </div>

        <div>
          <FormLabel htmlFor="password" required>Temporary password</FormLabel>
          <input id="password" className="input" name="password" type="password" required />
        </div>

        <div>
          <FormLabel htmlFor="userType" required>User type</FormLabel>
          <select
            id="userType"
            className="input"
            name="userType"
            value={userType}
            onChange={(e) => setUserType(e.target.value as (typeof userTypes)[number])}
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
          <select id="functionalRole" className="input" name="functionalRole" defaultValue="DEVELOPER">
            {functionalRoles.map((role) => (
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

        {userType === "EMPLOYEE" ? (
          <div>
            <FormLabel htmlFor="teamLeadIds" required>Assign Team Lead(s)</FormLabel>
            <select id="teamLeadIds" className="input min-h-36" name="teamLeadIds" multiple required>
              {teamLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.fullName} ({lead.email})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Hold Ctrl/Cmd to select multiple Team Leads.
            </p>
          </div>
        ) : null}

        <button className="btn-primary w-full">Create user</button>
      </div>
    </form>
  );
}
