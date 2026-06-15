"use client";

import { ChevronDown } from "lucide-react";

type Props = {
  users: string[];
};

export function SweepInTriggerUserList({ users }: Props) {
  if (users.length === 0) return <span className="text-slate-500">—</span>;
  if (users.length === 1) return <span>{users[0]}</span>;

  const [firstUser, ...remainingUsers] = users;

  return (
    <details className="group inline-block max-w-full">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg px-1 py-0.5 text-sm font-medium text-slate-900 transition hover:bg-slate-100">
        <span className="truncate">{firstUser}</span>
        <span className="text-xs font-normal text-slate-500">+{remainingUsers.length}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <ul className="space-y-1 text-sm text-slate-700">
          {remainingUsers.map((user) => (
            <li key={user}>{user}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
