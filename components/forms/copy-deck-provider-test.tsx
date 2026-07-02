"use client";

import { useActionState } from "react";
import {
  testCopyDeckTranslationProviderAction,
  type CopyDeckProviderTestState,
} from "@/lib/actions/copy-deck-actions";

export function CopyDeckProviderTest() {
  const [state, action, pending] = useActionState<
    CopyDeckProviderTestState,
    FormData
  >(testCopyDeckTranslationProviderAction, {});

  return (
    <form action={action} className="card max-w-4xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">Translation provider check</h2>
          <p className="section-subtitle">
            Sends one small English-to-French test before processing a full
            copy deck.
          </p>
        </div>
        <button className="btn-secondary" disabled={pending}>
          {pending ? "Testing..." : "Test Translation Provider"}
        </button>
      </div>
      {state.success ? (
        <p className="mt-3 text-sm text-emerald-700">{state.message}</p>
      ) : null}
      {state.error ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
