"use client";

import { useState } from "react";
import { reviewLeaveRequestAction } from "@/lib/actions/leave-actions";

type Decision = "APPROVED" | "REJECTED" | "RECONSIDER";

function ReviewButton({
  id,
  decision,
  label,
  comment,
}: {
  id: string;
  decision: Decision;
  label: string;
  comment: string;
}) {
  return (
    <form action={reviewLeaveRequestAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="comment" value={comment} />
      <button
        type="submit"
        className={decision === "APPROVED" ? "btn-primary text-xs" : "btn-secondary text-xs"}
      >
        {label}
      </button>
    </form>
  );
}

export function LeaveReviewActions({ id }: { id: string }) {
  const [comment, setComment] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={2}
        className="input min-h-20"
        placeholder="Optional comment for approval / rejection / reconsideration"
      />
      <div className="flex flex-wrap gap-2">
        <ReviewButton id={id} decision="APPROVED" label="Approve" comment={comment} />
        <ReviewButton id={id} decision="REJECTED" label="Reject" comment={comment} />
        <ReviewButton id={id} decision="RECONSIDER" label="Reconsider" comment={comment} />
      </div>
    </div>
  );
}