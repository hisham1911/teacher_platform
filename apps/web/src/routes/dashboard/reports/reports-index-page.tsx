import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { quizzesApi, sessionsApi } from '../../../data/api-client/endpoints';
import { assignmentsApi } from '../../../data/api-client/phase2-endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';
import { SESSION_MODE_LABELS, SESSION_STATUS_LABELS, type SessionStatus } from '../../../types/sessions';
import type { Assignment } from '../../../types/phase2';

export default function ReportsIndexPage() {
  const tenantId = getActiveTenantId()!;
  const [chosenQuizId, setChosenQuizId] = useState('');

  const assignmentsQuery = useQuery({
    queryKey: ['assignments', tenantId, 'reports'],
    queryFn: ({ signal }) => assignmentsApi.list(tenantId, signal),
    enabled: Boolean(tenantId),
  });
  const quizzesQuery = useQuery({
    queryKey: ['quizzes', tenantId, 'reports'],
    queryFn: ({ signal }) => quizzesApi.list(tenantId, { pageSize: 100 }, signal),
    enabled: Boolean(tenantId),
  });
  const quizzes = quizzesQuery.data?.items ?? [];
  const selectedQuizId = chosenQuizId || quizzes[0]?.id || '';
  const sessionsQuery = useQuery({
    queryKey: ['quiz-sessions', tenantId, selectedQuizId, 'reports'],
    queryFn: ({ signal }) => sessionsApi.list(tenantId, selectedQuizId, 1, 100, signal),
    enabled: Boolean(tenantId && selectedQuizId),
  });

  return (
    <div className="flex flex-col gap-7">
      <header className="max-w-3xl">
        <h1 className="text-balance text-2xl font-black text-[var(--teacher-ink)]">النتائج</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--teacher-muted)]">ابدأ بالإسنادات التي وصلت لطلابك، ثم ارجع للتشغيلات السريعة وLive عند الحاجة.</p>
      </header>

      <section aria-labelledby="assignments-results-heading" className="teacher-surface overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:p-5">
          <p className="text-xs font-black text-violet-700">الإسنادات</p>
          <h2 id="assignments-results-heading" className="text-lg font-black text-[var(--teacher-ink)]">تقدم الطلاب في الأنشطة المرسلة</h2>
          <p className="text-sm text-[var(--teacher-muted)]">من هنا ترى من استلم النشاط، من بدأ، ومن أكمل، ثم تفتح نتيجة كل طالب.</p>
        </div>
        <div className="p-4 sm:p-5">
          {assignmentsQuery.isPending ? <AssignmentRowsLoading /> : null}
          {assignmentsQuery.isError ? <RetryBlock message="تعذر تحميل الإسنادات الآن." onRetry={() => void assignmentsQuery.refetch()} /> : null}
          {assignmentsQuery.data?.length === 0 ? (
            <EmptyState
              compact
              title="لا توجد إسنادات بعد"
              description="افتح أي نشاط واختر «إسناد لطلابي» لتحديد فصل أو طلاب بعينهم."
              actionLabel="فتح الأنشطة"
              actionTo="/dashboard/quizzes"
            />
          ) : null}
          {assignmentsQuery.data && assignmentsQuery.data.length > 0 ? (
            <ul className="divide-y divide-slate-200" aria-label="نتائج الإسنادات">
              {assignmentsQuery.data.map((assignment) => (
                <AssignmentRow key={assignment.id} assignment={assignment} />
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="quick-runs-heading" className="teacher-surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-black text-slate-500">مشاركة سريعة وLive</p>
            <h2 id="quick-runs-heading" className="mt-1 text-lg font-black text-[var(--teacher-ink)]">تشغيلات النشاط السابقة</h2>
            <p className="mt-1 text-sm text-[var(--teacher-muted)]">استخدم هذا السجل للروابط السريعة والمسابقات المباشرة التي لم تُرسل كإسناد.</p>
          </div>
          {quizzes.length > 0 ? (
            <label className="flex w-full flex-col gap-1.5 text-sm font-bold text-slate-700 sm:max-w-sm">
              النشاط
              <select value={selectedQuizId} onChange={(event) => setChosenQuizId(event.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus:border-[var(--teacher-primary)] focus:outline-2 focus:outline-[var(--teacher-primary)]">
                {quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
              </select>
            </label>
          ) : null}
        </div>

        <div className="p-4 sm:p-5">
          {quizzesQuery.isPending ? <ReportsLoading /> : null}
          {quizzesQuery.isError ? <RetryBlock message="تعذر تحميل الأنشطة الآن." onRetry={() => void quizzesQuery.refetch()} /> : null}
          {quizzesQuery.data && quizzes.length === 0 ? <EmptyState compact title="لا توجد تشغيلات بعد" description="بعد مشاركة أول نشاط أو تشغيل Live، ستظهر نتائجه هنا." actionLabel="إنشاء نشاط" actionTo="/dashboard/activities/new" /> : null}
          {quizzes.length > 0 && sessionsQuery.isPending ? <SessionRowsLoading /> : null}
          {quizzes.length > 0 && sessionsQuery.isError ? <RetryBlock message="تعذر تحميل تشغيلات النشاط." onRetry={() => void sessionsQuery.refetch()} /> : null}
          {sessionsQuery.data && sessionsQuery.data.items.length === 0 ? <EmptyState compact title="لا توجد تشغيلات لهذا النشاط" description="شارك النشاط برابط أو شغّل Live أولًا، ثم ستظهر النتائج هنا." actionLabel="فتح النشاط" actionTo={`/dashboard/activities/${selectedQuizId}/manage`} /> : null}
          {sessionsQuery.data && sessionsQuery.data.items.length > 0 ? (
            <ul className="divide-y divide-slate-200" aria-label="التشغيلات السابقة">
              {sessionsQuery.data.items.map((session) => (
                <li key={session.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black text-slate-900">{session.quizTitle}</h3><SessionStatusBadge status={session.status} /></div>
                      <p className="mt-1 text-sm font-medium text-slate-700">{session.label || 'تشغيل بدون عنوان'}</p>
                      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                        <div className="flex gap-1.5"><dt>النوع:</dt><dd className="font-semibold text-slate-800">{SESSION_MODE_LABELS[session.mode]}</dd></div>
                        <div className="flex gap-1.5"><dt>التاريخ:</dt><dd className="font-semibold text-slate-800">{formatDate(session.finishedAt ?? session.activatedAt ?? session.createdAt)}</dd></div>
                        <div className="flex gap-1.5"><dt>الطلاب:</dt><dd className="font-semibold text-slate-800">{session.participantCount}</dd></div>
                      </dl>
                    </div>
                    <Link to={`/dashboard/reports/${session.id}?quizId=${selectedQuizId}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[var(--teacher-primary)] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)]">فتح النتائج</Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AssignmentRow({ assignment }: { assignment: Assignment }) {
  const completed = assignment.recipientCount > 0 && assignment.completedCount >= assignment.recipientCount;
  const stateLabel = completed ? 'اكتمل' : assignment.startedCount > 0 ? 'جاري' : 'لم يبدأ';
  const stateTone = completed ? 'bg-emerald-50 text-emerald-800' : assignment.startedCount > 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700';
  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 dir="auto" className="truncate font-black text-slate-900">{assignment.activityTitle}</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${stateTone}`}>{stateLabel}</span>
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            <div className="flex gap-1.5"><dt>وصل إلى:</dt><dd className="font-semibold text-slate-800">{assignment.recipientCount}</dd></div>
            <div className="flex gap-1.5"><dt>بدأ:</dt><dd className="font-semibold text-slate-800">{assignment.startedCount}</dd></div>
            <div className="flex gap-1.5"><dt>أكمل:</dt><dd className="font-semibold text-slate-800">{assignment.completedCount}</dd></div>
            {assignment.dueAt ? <div className="flex gap-1.5"><dt>الموعد:</dt><dd className="font-semibold text-slate-800">{formatDate(assignment.dueAt)}</dd></div> : null}
          </dl>
        </div>
        <Link to={`/dashboard/assignments/${assignment.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-violet-700 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">تقدم الطلاب</Link>
      </div>
    </li>
  );
}

function formatDate(dateTime: string) { return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(dateTime)); }
function SessionStatusBadge({ status }: { status: SessionStatus }) { const tone = status === 'Finished' ? 'bg-emerald-50 text-emerald-800' : status === 'Cancelled' ? 'bg-rose-50 text-rose-800' : status === 'Active' ? 'bg-sky-50 text-sky-800' : 'bg-slate-100 text-slate-700'; return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{SESSION_STATUS_LABELS[status]}</span>; }
function ReportsLoading() { return <div role="status" aria-label="جارٍ تحميل الأنشطة" className="space-y-4 motion-safe:animate-pulse"><div className="h-11 w-full max-w-sm rounded-lg bg-slate-200" /><div className="h-20 rounded-xl bg-slate-100" /></div>; }
function AssignmentRowsLoading() { return <div role="status" aria-label="جارٍ تحميل الإسنادات" className="space-y-3 motion-safe:animate-pulse"><div className="h-24 rounded-xl bg-slate-100" /><div className="h-24 rounded-xl bg-slate-100" /></div>; }
function SessionRowsLoading() { return <div role="status" aria-label="جارٍ تحميل التشغيلات" className="space-y-3 motion-safe:animate-pulse"><div className="h-24 rounded-xl bg-slate-100" /><div className="h-24 rounded-xl bg-slate-100" /></div>; }
function RetryBlock({ message, onRetry }: { message: string; onRetry: () => void }) { return <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800"><p>{message}</p><button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 font-bold transition-colors hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">إعادة المحاولة</button></div>; }
function EmptyState({ title, description, actionLabel, actionTo, compact = false }: { title: string; description: string; actionLabel: string; actionTo: string; compact?: boolean }) { return <section className={`rounded-xl border border-dashed border-slate-300 bg-white text-center ${compact ? 'px-5 py-8' : 'px-6 py-12'}`}><h2 className="font-black text-slate-900">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{description}</p><Link to={actionTo} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--teacher-primary)] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)]">{actionLabel}</Link></section>; }
