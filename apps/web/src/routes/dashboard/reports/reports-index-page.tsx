import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { quizzesApi, sessionsApi } from '../../../data/api-client/endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';
import { SESSION_MODE_LABELS, SESSION_STATUS_LABELS } from '../../../types/sessions';

export default function ReportsIndexPage() {
  const tenantId = getActiveTenantId()!;
  const [chosenQuizId, setChosenQuizId] = useState('');
  const quizzesQuery = useQuery({
    queryKey: ['quizzes', tenantId, 'reports'],
    queryFn: ({ signal }) => quizzesApi.list(tenantId, { pageSize: 100 }, signal),
  });
  const quizzes = quizzesQuery.data?.items ?? [];
  const selectedQuizId = chosenQuizId || quizzes[0]?.id || '';
  const sessionsQuery = useQuery({
    queryKey: ['quiz-sessions', tenantId, selectedQuizId, 'reports'],
    queryFn: ({ signal }) => sessionsApi.list(tenantId, selectedQuizId, 1, 100, signal),
    enabled: Boolean(selectedQuizId),
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900">النتائج والتقارير</h1>
        <p className="mt-1 text-sm text-slate-600">اختر اختبارًا ثم افتح تقرير الجلسة المطلوبة.</p>
      </header>

      {quizzesQuery.isPending ? <LoadingBlock label="جارٍ تحميل الاختبارات…" /> : null}
      {quizzesQuery.isError ? (
        <RetryBlock message="تعذر تحميل الاختبارات." onRetry={() => void quizzesQuery.refetch()} />
      ) : null}
      {quizzesQuery.data && quizzes.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="font-semibold text-slate-900">لا توجد اختبارات بعد</h2>
          <p className="mt-2 text-sm text-slate-600">أنشئ اختبارًا وشغّل جلسة طلاب لتظهر النتائج هنا.</p>
          <Link to="/dashboard/quizzes/new" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">إنشاء اختبار</Link>
        </section>
      ) : null}

      {quizzes.length > 0 ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <label className="flex max-w-lg flex-col gap-2 text-sm font-semibold text-slate-800">
            الاختبار
            <select value={selectedQuizId} onChange={(event) => setChosenQuizId(event.target.value)} className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal">
              {quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
            </select>
          </label>

          {sessionsQuery.isPending ? <LoadingBlock label="جارٍ تحميل جلسات الاختبار…" /> : null}
          {sessionsQuery.isError ? (
            <RetryBlock message="تعذر تحميل جلسات الاختبار." onRetry={() => void sessionsQuery.refetch()} />
          ) : null}
          {sessionsQuery.data && sessionsQuery.data.items.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-5 text-sm text-slate-700">
              <p>لا توجد جلسات لهذا الاختبار. أنشئ جلسة وشارك رابطها مع الطلاب أولًا.</p>
              <Link to={`/dashboard/quizzes/${selectedQuizId}/sessions`} className="mt-3 inline-flex min-h-11 items-center font-semibold text-sky-700 hover:underline">إنشاء جلسة</Link>
            </div>
          ) : null}
          {sessionsQuery.data && sessionsQuery.data.items.length > 0 ? (
            <ul className="divide-y divide-slate-200">
              {sessionsQuery.data.items.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-slate-900">{session.label || session.quizTitle}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {SESSION_STATUS_LABELS[session.status]} · {SESSION_MODE_LABELS[session.mode]} · {session.attemptCount} محاولة
                    </p>
                  </div>
                  <Link to={`/dashboard/reports/${session.id}?quizId=${selectedQuizId}`} className="inline-flex min-h-11 items-center rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">عرض التقرير</Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return <div role="status" className="animate-pulse rounded-lg bg-slate-100 p-4 text-sm text-slate-600">{label}</div>;
}

function RetryBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-md border border-rose-300 bg-white px-4 py-2 font-semibold hover:bg-rose-100">إعادة المحاولة</button>
    </div>
  );
}
