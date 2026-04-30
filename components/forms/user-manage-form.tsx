"use client";

import { useActionState, useEffect, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { UserFormState } from "@/lib/actions/user-actions";
import { AddressFields } from "@/components/forms/address-fields";
import { createDefaultAddress, type AddressValue } from "@/lib/address";

const operationalFunctionalRoles = [
  "DEVELOPER",
  "QA",
  "DESIGNER",
  "LOCALIZATION",
  "DEVOPS",
  "PROJECT_MANAGER",
  "DIRECTOR",
  "OTHER",
] as const;

const userTypes = [
  "EMPLOYEE",
  "TEAM_LEAD",
  "MANAGER",
  "ADMIN",
  "REPORT_VIEWER",
  "ACCOUNTS",
  "HR",
  "OPERATIONS",
] as const;

type FunctionalRole = (typeof operationalFunctionalRoles)[number] | "BILLING";

type UserManageFormProps = {
  mode: "create" | "edit";
  action: (state: UserFormState, formData: FormData) => Promise<UserFormState>;
  allowOperationsUserType?: boolean;
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
    secondaryPhoneNumber?: string | null;
    isActive?: boolean;
    permanentSameAsCurrent?: boolean;
    currentAddressLine?: string | null;
    currentCity?: string | null;
    currentState?: string | null;
    currentCountry?: "IN" | "US" | null;
    currentPostalCode?: string | null;
    permanentAddressLine?: string | null;
    permanentCity?: string | null;
    permanentState?: string | null;
    permanentCountry?: "IN" | "US" | null;
    permanentPostalCode?: string | null;
  };
};

const initialState: UserFormState = {};

function PasswordField({ defaultVisible = false }: { defaultVisible?: boolean }) {
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

export function UserManageForm({ mode, action, initialValues, allowOperationsUserType = true }: UserManageFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [userType, setUserType] = useState<(typeof userTypes)[number]>(initialValues?.userType ?? "EMPLOYEE");
  const [functionalRole, setFunctionalRole] = useState<FunctionalRole>(initialValues?.functionalRole ?? "DEVELOPER");
  const [sameAsCurrent, setSameAsCurrent] = useState(initialValues?.permanentSameAsCurrent ?? false);
  const [currentAddress, setCurrentAddress] = useState<AddressValue>({
    addressLine: initialValues?.currentAddressLine ?? "",
    city: initialValues?.currentCity ?? "",
    state: initialValues?.currentState ?? "",
    country: initialValues?.currentCountry ?? "IN",
    postalCode: initialValues?.currentPostalCode ?? "",
  });
  const [permanentAddress, setPermanentAddress] = useState<AddressValue>({
    addressLine: initialValues?.permanentAddressLine ?? "",
    city: initialValues?.permanentCity ?? "",
    state: initialValues?.permanentState ?? "",
    country: initialValues?.permanentCountry ?? initialValues?.currentCountry ?? "IN",
    postalCode: initialValues?.permanentPostalCode ?? "",
  });

  useEffect(() => {
    if (sameAsCurrent) {
      setPermanentAddress(currentAddress);
    }
  }, [sameAsCurrent, currentAddress]);

  const availableUserTypes = allowOperationsUserType ? userTypes : userTypes.filter((type) => type !== "OPERATIONS");
  const availableFunctionalRoles = userType === "ACCOUNTS" ? (["BILLING"] as const) : operationalFunctionalRoles;

  function handleUserTypeChange(nextUserType: (typeof userTypes)[number]) {
    setUserType(nextUserType);
    if (nextUserType === "ACCOUNTS") {
      setFunctionalRole("BILLING");
    } else if (functionalRole === "BILLING") {
      setFunctionalRole("DEVELOPER");
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
            options={availableUserTypes.map((type) => ({ value: type, label: type.replaceAll("_", " ") }))}
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
          ) : userType === "HR" ? (
            <p className="mt-1 text-xs text-slate-500">HR users should typically use the Other functional role.</p>
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
          <FormLabel htmlFor="phoneNumber">Primary phone number</FormLabel>
          <input id="phoneNumber" className="input" name="phoneNumber" defaultValue={initialValues?.phoneNumber ?? ""} />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="secondaryPhoneNumber">Secondary phone number</FormLabel>
          <input
            id="secondaryPhoneNumber"
            className="input"
            name="secondaryPhoneNumber"
            defaultValue={initialValues?.secondaryPhoneNumber ?? ""}
          />
        </div>

        <AddressFields prefix="current" title="Current Address" value={currentAddress} onChange={setCurrentAddress} />

        <div className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input
            id="permanentSameAsCurrent"
            type="checkbox"
            name="permanentSameAsCurrent"
            checked={sameAsCurrent}
            onChange={(event) => {
              const checked = event.target.checked;
              setSameAsCurrent(checked);
              if (checked) {
                setPermanentAddress(currentAddress);
              } else if (!permanentAddress.country) {
                setPermanentAddress(createDefaultAddress(currentAddress.country));
              }
            }}
          />
          <label htmlFor="permanentSameAsCurrent" className="text-sm text-slate-700">
            Permanent address is same as current address
          </label>
        </div>

        <AddressFields
          prefix="permanent"
          title="Permanent Address"
          value={sameAsCurrent ? currentAddress : permanentAddress}
          onChange={setPermanentAddress}
          disabled={sameAsCurrent}
        />

        {userType === "ACCOUNTS" ? (
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Accounts users will only see the billing dashboard and can change their own password.
          </div>
        ) : userType === "HR" ? (
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            HR users can access EMS dashboard, leave approvals, users, profile, and password change pages.
          </div>
        ) : userType === "OPERATIONS" ? (
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Operations users can manage Clients, Movies, Asset Types, Countries, Languages, Projects, Sub Projects, User Assignments, and Contact Persons.
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
