"use client";

import { useState } from "react";
import { updateProfileAction } from "@/lib/actions/profile-actions";
import { FormLabel } from "@/components/ui/form-label";

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
    currentAddress: string | null;
    permanentAddress: string | null;
    permanentSameAsCurrent: boolean;
  };
}) {
  const [sameAsCurrent, setSameAsCurrent] = useState(user.permanentSameAsCurrent);
  const [currentAddress, setCurrentAddress] = useState(user.currentAddress ?? "");
  const [permanentAddress, setPermanentAddress] = useState(user.permanentAddress ?? "");

  return (
    <form action={updateProfileAction} className="card p-6">
      <h2 className="section-title">Update profile</h2>
      <p className="section-subtitle">
        You can update your phone number and address details here. Core user details are read-only.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <FormLabel htmlFor="fullName">Full name</FormLabel>
          <input id="fullName" className="input bg-slate-50" defaultValue={user.fullName} disabled readOnly />
        </div>

        <div>
          <FormLabel htmlFor="email">Email</FormLabel>
          <input id="email" className="input bg-slate-50" defaultValue={user.email} disabled readOnly />
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

        <div className="md:col-span-2">
          <FormLabel htmlFor="phoneNumber">Phone number</FormLabel>
          <input id="phoneNumber" className="input" name="phoneNumber" defaultValue={user.phoneNumber ?? ""} />
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="currentAddress">Current address</FormLabel>
          <textarea
            id="currentAddress"
            className="input min-h-28"
            name="currentAddress"
            value={currentAddress}
            onChange={(event) => setCurrentAddress(event.target.value)}
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input
            id="permanentSameAsCurrent"
            type="checkbox"
            name="permanentSameAsCurrent"
            checked={sameAsCurrent}
            onChange={(event) => setSameAsCurrent(event.target.checked)}
          />
          <label htmlFor="permanentSameAsCurrent" className="text-sm text-slate-700">
            Permanent address is same as current address
          </label>
        </div>

        <div className="md:col-span-2">
          <FormLabel htmlFor="permanentAddress">Permanent address</FormLabel>
          <textarea
            id="permanentAddress"
            className="input min-h-28"
            name="permanentAddress"
            value={sameAsCurrent ? currentAddress : permanentAddress}
            onChange={(event) => setPermanentAddress(event.target.value)}
            readOnly={sameAsCurrent}
            disabled={sameAsCurrent}
          />
        </div>
      </div>

      <button className="btn-primary mt-6">Save profile</button>
    </form>
  );
}
