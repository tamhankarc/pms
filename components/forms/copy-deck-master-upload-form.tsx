"use client";

import { useActionState } from "react";
import { uploadCopyDeckMasterAction, type CopyDeckActionState } from "@/lib/actions/copy-deck-actions";

export function CopyDeckMasterUploadForm() {
  const [state, action, pending] = useActionState<CopyDeckActionState, FormData>(uploadCopyDeckMasterAction, {});
  return <form action={action} className="card space-y-4 p-5">
    <div><h2 className="section-title">Upload wide master</h2><p className="section-subtitle">The first source column must be English, English Text, Source Text, or Copy. Every other populated header is treated as a market/locale; blank translation cells never overwrite existing values.</p></div>
    <input className="input" type="file" name="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
    {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
    {state.success ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
    <button className="btn-primary" disabled={pending}>{pending ? "Uploading..." : "Upload Master"}</button>
  </form>;
}
