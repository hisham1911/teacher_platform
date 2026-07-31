export function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status">
      <span className="text-sm text-slate-500">جاري التحميل…</span>
    </div>
  );
}