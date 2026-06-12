"use client";

import { type FormEvent } from "react";

type AmazonTitleClosureButtonProps = {
  movieId: string;
  returnTo: string;
  allMonthsBilled: boolean;
  unbilledMonthsMessage?: string;
  action: (formData: FormData) => void | Promise<void>;
  onBlocked?: (message: string) => void;
};

export function AmazonTitleClosureButton({
  movieId,
  returnTo,
  allMonthsBilled,
  unbilledMonthsMessage,
  action,
  onBlocked,
}: AmazonTitleClosureButtonProps) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!allMonthsBilled) {
      event.preventDefault();
      onBlocked?.(
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
    <form action={action} onSubmit={onSubmit}>
      <input type="hidden" name="movieId" value={movieId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className="btn-secondary">
        Close Title / PO
      </button>
    </form>
  );
}
