import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { quizzesApi, sessionsApi } from '../../../data/api-client/endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';
import { SESSION_MODE_LABELS, SESSION_STATUS_LABELS, type SessionStatus } from '../../../types/sessions';

export default function ReportsIndexPage() {
  const tenantId = getActiveTenantId()!;
  const [chosenQuizId, setChosenQuizId] = useState('');
  const quizzesQuery = useQuery({ queryKey: ['quizzes', tenantId, 'reports'], queryFn: ({ signal }) => quizzesApi.list(tenantId, { pageSize: 100 }, signal) });
  const quizzes = quizzesQuery.data?.items ?? [];
  const selectedQuizId = chosenQuizId || quizzes[0]?.id || '';
  const sessionsQuery = useQuery({ queryKey: ['quiz-sessions', tenantId, selectedQuizId, 'reports'], queryFn: ({ signal }) => sessionsApi.list(tenantId, selectedQuizId, 1, 100, signal), enabled: Boolean(selectedQuizId) });

  return (
    <div className="flex flex-col gap-7">
      <header className="max-w-3xl"><h1 className="text-balance text-2xl font-black text-[var(--teacher-ink)]">النتائج</h1><p className="mt-2 text-sm leading-6 text-[var(--teacher-muted)]">اختر النشاط لترى جلساته وعدد المشاركين وتفتح التقرير.</p></header>

      {quizzesQuery.isPending ? <ReportsLoading /> : null}
      {quizzesQuery.isError ? <RetryBlock message="تعذر تحميل الأنشطة الآن." onRetry={() => void quizzesQuery.refetch()} /> : null}
      {quizzesQuery.data && quizzes.length === 0 ? <EmptyState title="لا توجد نتائج بعد" description="بعد مشاركة أول نشاط مع الطلاب، ستظهر نتائجه هنا." actionLabel="إنشاء نشاط" actionTo="/dashboard/activities/new" /> : null}

      {quizzes.length > 0 ? (
        <section aria-labelledby="reports-list-heading" className="teacher-surface overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
            <div><h2 id="reports-list-heading" className="text-lg font-black text-[var(--teacher-ink)]">جلسات النشاط</h2><p className="mt-1 text-sm text-[var(--teacher-muted)]">اختر النشاط، ثم افتح الجلسة التي تريد مراجعتها.</p></div>
            <label className="flex w-full flex-col gap-1.5 text-sm font-bold text-slate-700 sm:max-w-sm">النشاط<select value={selectedQuizId} onChange={(event) => setChosenQuizId(event.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus:border-[var(--teacher-primary)] focus:outline-2 focus:outline-[var(--teacher-primary)]">{quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}</select></label>
          </div>

          <div className="p-4 sm:p-5">
            {sessionsQuery.isPending ? <SessionRowsLoading /> : null}
            {sessionsQuery.isError ? <RetryBlock message="تعذر تحميل جلسات النشاط." onRetry={() => void sessionsQuery.refetch()} /> : null}
            {sessionsQuery.data && sessionsQuery.data.items.length === 0 ? <EmptyState compact title="لا توجد نتائج لهذا النشاط" description="شارك النشاط مع الطلاب أولًا، ثم ستظهر الجلسات هنا." actionLabel="فتح النشاط" actionTo={`/dashboard/activities/${selectedQuizId}/manage`} /> : null}
            {sessionsQuery.data && sessionsQuery.data.items.length > 0 ? (
              <ul className="divide-y divide-slate-200">
                {sessionsQuery.data.items.map((session) => (
                  <li key={session.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black text-slate-900">{session.quizTitle}</h3><SessionStatusBadge status={session.status} /></div><p className="mt-1 text-sm font-medium text-slate-700">{session.label || 'جلسة بدون عنوان'}</p><dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600"><div className="flex gap-1.5"><dt>النوع:</dt><dd className="font-semibold text-slate-800">{SESSION_MODE_LABELS[session.mode]}</dd></div><div className="flex gap-1.5"><dt>التاريخ:</dt><dd className="font-semibold text-slate-800">{formatDate(session.finishedAt ?? session.activatedAt ?? session.createdAt)}</dd></div><div className="flex gap-1.5"><dt>الطلاب:</dt><dd className="font-semibold text-slate-800">{session.participantCount}</dd></div></dl></div>
                      <Link to={`/dashboard/reports/${session.id}?quizId=${selectedQuizId}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[var(--teacher-primary)] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)]">فتح النتائج</Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatDate(dateTime: string) { return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(dateTime)); }
function SessionStatusBadge({ status }: { status: SessionStatus }) { const tone = status === 'Finished' ? 'bg-emerald-50 text-emerald-800' : status === 'Cancelled' ? 'bg-rose-50 text-rose-800' : status === 'Active' ? 'bg-sky-50 text-sky-800' : 'bg-slate-100 text-slate-700'; return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{SESSION_STATUS_LABELS[status]}</span>; }
function ReportsLoading() { return <div role="status" aria-label="جارٍ تحميل النتائج" className="teacher-surface space-y-4 p-5 motion-safe:animate-pulse"><div className="h-11 w-full max-w-sm rounded-lg bg-slate-200" /><div className="h-20 rounded-xl bg-slate-100" /><div className="h-20 rounded-xl bg-slate-100" /></div>; }
function SessionRowsLoading() { return <div role="status" aria-label="جارٍ تحميل الجلسات" className="space-y-3 motion-safe:animate-pulse"><div className="h-24 rounded-xl bg-slate-100" /><div className="h-24 rounded-xl bg-slate-100" /></div>; }
function RetryBlock({ message, onRetry }: { message: string; onRetry: () => void }) { return <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800"><p>{message}</p><button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 font-bold transition-colors hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">إعادة المحاولة</button></div>; }
function EmptyState({ title, description, actionLabel, actionTo, compact = false }: { title: string; description: string; actionLabel: string; actionTo: string; compact?: boolean }) { return <section className={`rounded-xl border border-dashed border-slate-300 bg-white text-center ${compact ? 'px-5 py-8' : 'px-6 py-12'}`}><h2 className="font-black text-slate-900">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{description}</p><Link to={actionTo} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--teacher-primary)] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)]">{actionLabel}</Link></section>; }
