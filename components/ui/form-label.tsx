import * as React from "react";

type FormLabelProps = {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
};

export function FormLabel({
  htmlFor,
  children,
  required = false,
  className = "",
}: FormLabelProps) {
  return (
    <label htmlFor={htmlFor} className={`label inline-flex items-center gap-1 ${className}`}>
      <span>{children}</span>
      {required ? <span className="text-red-600">*</span> : null}
    </label>
  );
}
