"use client";

import { useRouter } from "next/navigation";

type NoScrollFilterProps = {
  action: string;
  className?: string;
  label: string;
  name: string;
  value: string;
  type: "month" | "number";
  hiddenInputs: Array<{ name: string; value: string }>;
  min?: string;
  max?: string;
};

export function NoScrollFilter({
  action,
  className,
  label,
  name,
  value,
  type,
  hiddenInputs,
  min,
  max,
}: NoScrollFilterProps) {
  const router = useRouter();

  function submit(nextValue: string) {
    const params = new URLSearchParams();
    hiddenInputs.forEach((input) => {
      if (input.name && input.value) params.append(input.name, input.value);
    });
    if (nextValue) params.set(name, nextValue);
    router.replace(`${action}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className={className}>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        min={min}
        max={max}
        className="input"
        defaultValue={value}
        onBlur={(event) => submit(event.currentTarget.value)}
      />
    </div>
  );
}
