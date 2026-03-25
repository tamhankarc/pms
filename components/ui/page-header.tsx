import { ReactNode } from "react";
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode; }) {
  return <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>{description ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p> : null}</div>{actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}</div>;
}
