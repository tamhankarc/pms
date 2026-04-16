"use client";

import { useActionState, useEffect, useState } from "react";
import { updateProfileAction } from "@/lib/actions/profile-actions";
import { FormLabel } from "@/components/ui/form-label";
import { AddressFields } from "@/components/forms/address-fields";
import { createDefaultAddress, type AddressValue } from "@/lib/address";

const initialState = {
  success: false,
  message: "",
};

function SubmitButton() {
  return <button className="btn-primary mt-6">Save profile</button>;
}

export function ProfileForm({
  user,
}: {
  user: {
    fullName: string;
    email: string;
    userType: string;
    functionalRole: string | null;
    employeeCode: string | null;
    designation: string | null;
    joiningDate: Date | null;
    phoneNumber: string | null;
    secondaryPhoneNumber: string | null;
    permanentSameAsCurrent: boolean;
    currentAddressLine: string | null;
    currentCity: string | null;
    currentState: string | null;
    currentCountry: "IN" | "US" | null;
    currentPostalCode: string | null;
    permanentAddressLine: string | null;
    permanentCity: string | null;
    permanentState: string | null;
    permanentCountry: "IN" | "US" | null;
    permanentPostalCode: string | null;
  };
}) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);
  const [sameAsCurrent, setSameAsCurrent] = useState(user.permanentSameAsCurrent);
  const [currentAddress, setCurrentAddress] = useState<AddressValue>({
    addressLine: user.currentAddressLine ?? "",
    city: user.currentCity ?? "",
    state: user.currentState ?? "",
    country: user.currentCountry ?? "IN",
    postalCode: user.currentPostalCode ?? "",
  });
  const [permanentAddress, setPermanentAddress] = useState<AddressValue>({
    addressLine: user.permanentAddressLine ?? "",
    city: user.permanentCity ?? "",
    state: user.permanentState ?? "",
    country: user.permanentCountry ?? user.currentCountry ?? "IN",
    postalCode: user.permanentPostalCode ?? "",
  });

  useEffect(() => {
    if (sameAsCurrent) {
      setPermanentAddress(currentAddress);
    }
  }, [sameAsCurrent, currentAddress]);

  return (
    <form action={formAction} className="card p-6">
      <h2 className="section-title">Update profile</h2>
      <p className="section-subtitle">
        You can update your phone numbers and address details here. Core user details are read-only.
      </p>

      {state?.message ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <FormLabel htmlFor="fullName">Full name</FormLabel>
          <input id="fullName" name="fullName" className="input bg-slate-50" defaultValue={user.fullName ?? ""} readOnly />
        </div>

        <div>
          <FormLabel htmlFor="email">Email</FormLabel>
          <input id="email" className="input bg-slate-50" defaultValue={user.email ?? ""} disabled readOnly />
        </div>

        <div>
          <FormLabel htmlFor="userType">User type</FormLabel>
          <input id="userType" className="input bg-slate-50" defaultValue={user.userType.replaceAll("_", " ")} disabled readOnly />
        </div>

        <div>
          <FormLabel htmlFor="functionalRole">Functional role</FormLabel>
          <input
            id="functionalRole"
            className="input bg-slate-50"
            defaultValue={(user.functionalRole ?? "UNASSIGNED").replaceAll("_", " ")}
            disabled
            readOnly
          />
        </div>

        <div>
          <FormLabel htmlFor="employeeCode">Employee code</FormLabel>
          <input id="employeeCode" className="input bg-slate-50" defaultValue={user.employeeCode ?? ""} disabled readOnly />
        </div>

        <div>
          <FormLabel htmlFor="designation">Designation</FormLabel>
          <input id="designation" className="input bg-slate-50" defaultValue={user.designation ?? ""} disabled readOnly />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="joiningDate">Joining date</FormLabel>
          <input
            id="joiningDate"
            className="input bg-slate-50"
            defaultValue={user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : ""}
            disabled
            readOnly
          />
        </div>

        <div>
          <FormLabel htmlFor="phoneNumber">Primary phone number</FormLabel>
          <input id="phoneNumber" className="input" name="phoneNumber" defaultValue={user.phoneNumber ?? ""} />
        </div>

        <div>
          <FormLabel htmlFor="secondaryPhoneNumber">Secondary phone number</FormLabel>
          <input
            id="secondaryPhoneNumber"
            className="input"
            name="secondaryPhoneNumber"
            defaultValue={user.secondaryPhoneNumber ?? ""}
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
      </div>

      <SubmitButton />
    </form>
  );
}
