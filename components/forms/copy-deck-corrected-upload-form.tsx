"use client";

import { useActionState } from "react";
import { uploadCorrectedCopyDeckAction, type CopyDeckActionState } from "@/lib/actions/copy-deck-actions";

export function CopyDeckCorrectedUploadForm({ copyDeckId }: { copyDeckId: string }) {
  const [state, action, pending] = useActionState<CopyDeckActionState, FormData>(uploadCorrectedCopyDeckAction, {});
  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="copyDeckId" value={copyDeckId} />
      <div><h2 className="section-title">Upload corrected client copy</h2><p className="section-subtitle">Existing Row IDs are updated. Rows without a Row ID are added to this deck and the master.</p></div>
      <input className="input" type="file" name="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
      <button className="btn-primary" disabled={pending}>{pending ? "Uploading..." : "Upload corrected copy"}</button>
    </form>
  );
}
