"use client";

type LeaveCancellationReviewButtonProps = {
  decision: "APPROVED" | "REJECTED";
  processedDateCount: number;
  scheduledDateCount: number;
  autoRestoreSingleDate?: boolean;
};

export function LeaveCancellationReviewButton({
  decision,
  processedDateCount,
  scheduledDateCount,
  autoRestoreSingleDate = false,
}: LeaveCancellationReviewButtonProps) {
  const isApproval = decision === "APPROVED";

  return (
    <button
      className={isApproval ? "btn-primary" : "btn-secondary"}
      type="submit"
      onClick={(event) => {
        const form = event.currentTarget.form;
        if (!form) {
          event.preventDefault();
          return;
        }

        const decisionInput = form.querySelector<HTMLInputElement>(
          'input[name="decision"]',
        );
        if (!decisionInput) {
          event.preventDefault();
          window.alert(
            "Unable to submit the cancellation review. Reload the page and try again.",
          );
          return;
        }
        decisionInput.value = decision;

        if (!isApproval) return;

        const reviewNote = form.querySelector<HTMLTextAreaElement>(
          'textarea[name="reviewNote"]',
        );
        const keepProcessedConfirmation =
          form.querySelector<HTMLInputElement>(
            'input[name="confirmKeepProcessedDates"]',
          );
        if (keepProcessedConfirmation) keepProcessedConfirmation.value = "";

        if (autoRestoreSingleDate) {
          if (!reviewNote?.value.trim()) {
            event.preventDefault();
            window.alert(
              "Enter an HR review note before restoring this processed leave date.",
            );
            reviewNote?.focus();
          }
          return;
        }

        if (processedDateCount === 0) return;

        const selectedDateCount = form.querySelectorAll<HTMLInputElement>(
          'input[name="restoreDateKeys"]:checked',
        ).length;

        if (selectedDateCount > 0) {
          if (!reviewNote?.value.trim()) {
            event.preventDefault();
            window.alert(
              "Enter an HR review note before restoring a processed leave date.",
            );
            reviewNote?.focus();
          }
          return;
        }

        if (scheduledDateCount === 0) {
          event.preventDefault();
          window.alert(
            "No processed leave date has been selected. Select at least one date to restore, or reject the cancellation request.",
          );
          return;
        }

        const confirmed = window.confirm(
          `No processed leave date has been selected. ${processedDateCount} processed date(s) will remain recorded as leave, and only ${scheduledDateCount} future date(s) will be cancelled. Continue?`,
        );
        if (!confirmed) {
          event.preventDefault();
          return;
        }
        if (keepProcessedConfirmation) {
          keepProcessedConfirmation.value = "YES";
        }
      }}
    >
      {isApproval ? "Approve cancellation" : "Reject cancellation"}
    </button>
  );
}
