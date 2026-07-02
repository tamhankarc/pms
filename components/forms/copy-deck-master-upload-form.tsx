"use client";

import { useActionState } from "react";
import { uploadCopyDeckMasterAction, type CopyDeckActionState } from "@/lib/actions/copy-deck-actions";

export function CopyDeckMasterUploadForm() {
  const [state, action, pending] = useActionState<CopyDeckActionState, FormData>(uploadCopyDeckMasterAction, {});
  return <form action={action} className="card space-y-4 p-5">
    <div><h2 className="section-title">Upload master corrections</h2><p className="section-subtitle">Use the downloaded master format. Rows with Master ID update existing entries; rows without one are matched by country and English text.</p></div>
    <input className="input" type="file" name="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
    {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
    {state.success ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
    <button className="btn-primary" disabled={pending}>{pending ? "Uploading..." : "Upload Master"}</button>
  </form>;
}
