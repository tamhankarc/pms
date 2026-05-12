import { LoginForm } from "@/components/forms/login-form";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(resolvedSearchParams.returnTo) ? resolvedSearchParams.returnTo[0] : resolvedSearchParams.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : "";
  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-blue-50 p-6"><LoginForm returnTo={returnTo} /></main>;
}
