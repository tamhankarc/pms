export default function UnsupportedDevicePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-blue-50 p-6">
      <div className="card w-full max-w-xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">Internal EMS</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Desktop access only</h1>
        <p className="mt-3 text-sm text-slate-600">
          Employee Management System is available only on desktop, laptop, or MacBook browsers. Please switch to a desktop-class device to continue.
        </p>
      </div>
    </main>
  );
}
