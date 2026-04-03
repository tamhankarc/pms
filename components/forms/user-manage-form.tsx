"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import type { UserFormState } from "@/lib/actions/user-actions";

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

type FunctionalRole = (typeof operationalFunctionalRoles)[number] | "BILLING";

type SupervisorOption = {
  id: string;
  fullName: string;
  email: string;
  userType: "TEAM_LEAD" | "MANAGER";
  functionalRole: FunctionalRole | null;
};

type UserManageFormProps = {
  mode: "create" | "edit";
  action: (state: UserFormState, formData: FormData) => Promise<UserFormState>;
  supervisors: SupervisorOption[];
  initialValues?: {
    id?: string;
    fullName?: string;
    username?: string;
    email?: string;
    userType?: (typeof userTypes)[number];
    functionalRole?: FunctionalRole;
    employeeCode?: string | null;
    designation?: string | null;
    joiningDate?: string | null;
    phoneNumber?: string | null;
    isActive?: boolean;
    supervisorIds?: string[];
  };
};

const initialState: UserFormState = {};

function PasswordField({
  defaultVisible = false,
}: {
  defaultVisible?: boolean;
}) {
  const [visible, setVisible] = useState(defaultVisible);

  return (
    <div className="md:col-span-2">
      <FormLabel htmlFor="password" required>
        Temporary password
      </FormLabel>
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

export function UserManageForm({ mode, action, supervisors, initialValues }: UserManageFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [userType, setUserType] = useState<(typeof userTypes)[number]>(initialValues?.userType ?? "EMPLOYEE");
  const [functionalRole, setFunctionalRole] = useState<FunctionalRole>(initialValues?.functionalRole ?? "DEVELOPER");
  const [supervisorIds, setSupervisorIds] = useState<string[]>(initialValues?.supervisorIds ?? []);

  const canHaveSupervisors = userType === "EMPLOYEE";

  const availableFunctionalRoles = userType === "ACCOUNTS" ? (["BILLING"] as const) : operationalFunctionalRoles;

  const filteredSupervisors = useMemo(
    () =>
      supervisors.filter(
        (person) =>
          person.userType === "TEAM_LEAD" ||
          (person.userType === "MANAGER" && person.functionalRole === functionalRole),
      ),
    [supervisors, functionalRole],
  );

  const supervisorOptions = useMemo(
    () =>
      filteredSupervisors.map((person) => ({
        value: person.id,
        label: `${person.fullName} · ${person.userType.replaceAll("_", " ")}${
          person.userType === "MANAGER" && person.functionalRole
            ? ` · ${person.functionalRole.replaceAll("_", " ")}`
            : ""
        }`,
        keywords: `${person.fullName} ${person.email} ${person.userType} ${person.functionalRole ?? ""}`,
      })),
    [filteredSupervisors],
  );

  function handleUserTypeChange(nextUserType: (typeof userTypes)[number]) {
    setUserType(nextUserType);
    if (nextUserType === "ACCOUNTS") {
      setFunctionalRole("BILLING");
    } else if (functionalRole === "BILLING") {
      setFunctionalRole("DEVELOPER");
    }
    if (nextUserType !== "EMPLOYEE") {
      setSupervisorIds([]);
    }
  }

  return (
    <form action={formAction} className="card p-6">
      {mode === "edit" && initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}

      <h2 className="section-title">{mode === "create" ? "Create user" : "Edit user"}</h2>
      <p className="section-subtitle">
        Fields marked <span className="text-red-600">*</span> are required.
      </p>

      {state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      ) : null}
      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          User saved successfully.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormLabel htmlFor="fullName" required>
            Full name
          </FormLabel>
          <input id="fullName" className="input" name="fullName" defaultValue={initialValues?.fullName ?? ""} required />
        </div>

        <div>
          <FormLabel htmlFor="username" required>
            Username
          </FormLabel>
          <input id="username" className="input" name="username" defaultValue={initialValues?.username ?? ""} required />
          <p className="mt-1 text-xs text-slate-500">Used for login. Use letters, numbers, dot, underscore, or hyphen.</p>
        </div>

        <div>
          <FormLabel htmlFor="email" required>
            Email
          </FormLabel>
          <input id="email" className="input" name="email" type="email" defaultValue={initialValues?.email ?? ""} required />
        </div>

        {mode === "create" ? <PasswordField /> : null}

        <div>
          <FormLabel htmlFor="userType" required>
            User type
          </FormLabel>
          <SearchableCombobox
            id="userType"
            value={userType}
            onValueChange={(value) => handleUserTypeChange(value as (typeof userTypes)[number])}
            options={userTypes.map((type) => ({ value: type, label: type.replaceAll("_", " ") }))}
            placeholder="Select user type"
            searchPlaceholder="Search user types..."
            emptyLabel="No user type found."
            required
          />
          <input type="hidden" name="userType" value={userType} />
        </div>

        <div>
          <FormLabel htmlFor="functionalRole" required>
            Functional role
          </FormLabel>
          <SearchableCombobox
            id="functionalRole"
            value={functionalRole}
            onValueChange={(value) => setFunctionalRole(value as FunctionalRole)}
            options={availableFunctionalRoles.map((role) => ({ value: role, label: role.replaceAll("_", " ") }))}
            placeholder="Select functional role"
            searchPlaceholder="Search functional roles..."
            emptyLabel="No functional role found."
            required
          />
          <input type="hidden" name="functionalRole" value={functionalRole} />
          {userType === "ACCOUNTS" ? (
            <p className="mt-1 text-xs text-slate-500">Accounts users must use the Billing functional role.</p>
          ) : null}
        </div>

        <div>
          <FormLabel htmlFor="employeeCode">Employee code</FormLabel>
          <input id="employeeCode" className="input" name="employeeCode" defaultValue={initialValues?.employeeCode ?? ""} />
        </div>

        <div>
          <FormLabel htmlFor="designation">Designation</FormLabel>
          <input id="designation" className="input" name="designation" defaultValue={initialValues?.designation ?? ""} />
        </div>

        <div>
          <FormLabel htmlFor="joiningDate">Joining date</FormLabel>
          <input id="joiningDate" className="input" name="joiningDate" type="date" defaultValue={initialValues?.joiningDate ?? ""} />
        </div>

        <div>
          <FormLabel htmlFor="phoneNumber">Phone number</FormLabel>
          <input id="phoneNumber" className="input" name="phoneNumber" defaultValue={initialValues?.phoneNumber ?? ""} />
        </div>

        {canHaveSupervisors ? (
          <div className="md:col-span-2">
            <FormLabel htmlFor="supervisorIds" required>
              Assign Supervisor(s)
            </FormLabel>
            <SearchableMultiSelect
              id="supervisorIds"
              name="supervisorIds"
              value={supervisorIds}
              onValueChange={setSupervisorIds}
              options={supervisorOptions}
              placeholder="Select supervisor(s)"
              searchPlaceholder="Search supervisors..."
              emptyLabel="No supervisor found."
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              Employees must have at least one assigned Team Lead or a Manager with the same functional role.
            </p>
          </div>
        ) : null}

        {userType === "ACCOUNTS" ? (
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Accounts users are not assigned to supervisors. They will only see the billing dashboard and can change their own password.
          </div>
        ) : null}

        {mode === "edit" ? (
          <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} />
            Active user
          </label>
        ) : null}

        <div className="md:col-span-2">
          <button className="btn-primary w-full" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create user" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
