"use client";

type DeleteButtonProps = {
  label?: string;
  confirmMessage: string;
  className?: string;
};

export function DeleteButton({
  label = "Delete",
  confirmMessage,
  className = "btn-secondary text-xs",
}: DeleteButtonProps) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {label}
    </button>
  );
}
