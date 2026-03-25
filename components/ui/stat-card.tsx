import { ReactNode } from "react";
export function StatCard({ label, value, icon, help }: { label: string; value: string; icon?: ReactNode; help?: string; }) {
  return <div className="card p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>{help ? <p className="mt-2 text-xs text-slate-500">{help}</p> : null}</div>{icon ? <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">{icon}</div> : null}</div></div>;
}
