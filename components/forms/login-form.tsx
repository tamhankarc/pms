"use client";
import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth-actions";
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return <form action={action} className="card w-full max-w-md p-8"><div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">Internal PMS</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back</h1><p className="mt-2 text-sm text-slate-500">Sign in with your company credentials to manage projects, effort, and billing visibility.</p></div><div className="mt-8 space-y-5"><div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" placeholder="you@company.com" required /></div><div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" placeholder="••••••••" required /></div>{state && typeof state === "object" && "error" in state ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error as string}</p> : null}<button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button></div></form>;
}
