"use client";

import { useEffect, useState, type FormEvent } from "react";

type AmazonTitleClosureButtonProps = {
  movieId: string;
  returnTo: string;
  allMonthsBilled: boolean;
  unbilledMonthsMessage?: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function AmazonTitleClosureButton({
  movieId,
  returnTo,
  allMonthsBilled,
  unbilledMonthsMessage,
  action,
}: AmazonTitleClosureButtonProps) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 10000);
    return () => window.clearTimeout(timer);
  }, [message]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!allMonthsBilled) {
      event.preventDefault();
      setMessage(
        unbilledMonthsMessage ||
          "Please mark all months billed before closing this title / PO.",
      );
      return;
    }

    if (
      !window.confirm("All months are marked as billed. Close this title / PO?")
    ) {
      event.preventDefault();
    }
  }

  return (
    <div className="space-y-2">
      <form action={action} onSubmit={onSubmit}>
        <input type="hidden" name="movieId" value={movieId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit" className="btn-secondary">
          Close Title / PO
        </button>
      </form>
      {message ? (
        <p className="max-w-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {message}
        </p>
      ) : null}
    </div>
  );
}
