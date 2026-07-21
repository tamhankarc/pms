"use server";

export async function deletePastApprovedLeaveAction() {
  throw new Error(
    "Approved leave deletion has been disabled. Submit a cancellation request and let HR select the processed dates that must be restored.",
  );
}
