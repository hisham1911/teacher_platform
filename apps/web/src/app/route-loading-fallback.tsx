export function RouteLoadingFallback() {
  return (
    <div className="mx-auto flex min-h-[40vh] w-full max-w-3xl flex-col justify-center gap-4" role="status" aria-label="جارٍ فتح الصفحة">
      <span className="text-sm font-semibold text-slate-700">جارٍ فتح الصفحة…</span>
      <div className="animate-pulse space-y-3" aria-hidden="true">
        <div className="h-7 w-48 rounded bg-slate-200" />
        <div className="h-24 rounded-xl bg-slate-100" />
        <div className="h-24 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
