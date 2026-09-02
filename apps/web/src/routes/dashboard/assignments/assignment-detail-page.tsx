import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { assignmentsApi } from '../../../data/api-client/phase2-endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';

const pct = (value: number | null) => value == null ? '—' : `${Math.round(value)}%`;

export default function AssignmentDetailPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const tenantId = getActiveTenantId();
  const detail = useQuery({ queryKey: ['assignment', tenantId, assignmentId], queryFn: ({ signal }) => assignmentsApi.get(tenantId!, assignmentId!, signal), enabled: Boolean(tenantId && assignmentId) });
  const results = useQuery({ queryKey: ['assignment-results', tenantId, assignmentId], queryFn: ({ signal }) => assignmentsApi.results(tenantId!, assignmentId!, signal), enabled: Boolean(tenantId && assignmentId) });

  if (detail.isLoading) return <div role="status" className="teacher-surface p-8">جارٍ تحميل الإسناد…</div>;
  if (detail.isError || !detail.data) return <div role="alert" className="teacher-surface p-6 text-rose-800">تعذر فتح الإسناد.</div>;

  const item = detail.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/dashboard/reports" className="inline-flex min-h-11 items-center text-sm font-bold text-violet-700">← النتائج</Link>
        <Link to={`/dashboard/activities/${item.quizId}/assign?versionId=${encodeURIComponent(item.quizVersionId)}&title=${encodeURIComponent(item.activityTitle)}`} className="inline-flex min-h-11 items-center rounded-xl border border-violet-200 px-4 text-sm font-bold text-violet-800">إسناد مرة أخرى</Link>
      </div>

      <header className="teacher-surface p-6">
        <p className="text-sm font-bold text-violet-700">تم إسناد النشاط</p>
        <h1 dir="auto" className="mt-1 text-2xl font-black text-slate-950">{item.activityTitle}</h1>
        <div className="mt-5 grid grid-cols-3 gap-3"><Stat label="وصل إلى" value={item.recipientCount} /><Stat label="بدأ" value={item.startedCount} /><Stat label="مكتمل" value={item.completedCount} /></div>
        {item.dueAt ? <p className="mt-4 text-sm font-bold text-amber-800">الموعد النهائي: {new Date(item.dueAt).toLocaleString('ar-EG')}</p> : null}
      </header>

      <section className="teacher-surface overflow-hidden" aria-labelledby="assignment-progress-heading">
        <div className="border-b border-slate-200 p-5"><h2 id="assignment-progress-heading" className="text-xl font-black text-slate-950">تقدم الطلاب</h2><p className="mt-1 text-sm text-slate-500">كل طالب مرتبط بمحاولته ونتيجته داخل هذا الإسناد.</p></div>
        {results.isLoading ? <p role="status" className="p-5 text-sm text-slate-500">جارٍ تحميل النتائج…</p> : null}
        {results.isError ? <p role="alert" className="m-5 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-800">تعذر تحميل نتائج الطلاب الآن.</p> : null}
        {results.data ? <ul className="divide-y divide-slate-100">{results.data.map((row) => <li key={row.studentId} className="grid min-h-16 grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3"><div><p className="font-bold text-slate-900">{row.studentName}</p><p className="text-xs text-slate-500">{row.status ? (row.status === 'InProgress' ? 'جاري' : 'مكتمل') : 'لم يبدأ'}</p></div><span className="text-sm font-black text-violet-700">{pct(row.percentage)}</span>{row.attemptId ? <Link to={`/dashboard/attempts/${row.attemptId}`} className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-violet-700">التفاصيل</Link> : <span className="w-16" />}</li>)}</ul> : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-slate-50 p-4 text-center"><p className="text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>;
}
