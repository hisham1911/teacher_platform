import { useQuery } from '@tanstack/react-query';
import { playerApi } from '../../data/api-client/endpoints';
import type { AttemptResult } from '../../types/sessions';
import { PlayerDeliveryPanel } from './player-delivery-panel';
import { PlayerSurveyAction, PlayerSurveyPanel } from './player-survey-panel';
import { StudentButton, StudentError, StudentLoading, StudentShell } from './student-ui';

export function ResultView({ joinCode, attemptId }: { joinCode: string; attemptId: string }) {
  const resultQuery = useQuery({ queryKey: ['player-result', joinCode, attemptId], queryFn: ({ signal }) => playerApi.getResult(joinCode, attemptId, signal), retry: false });
  if (resultQuery.isLoading) return <StudentLoading message="جارٍ تجهيز نتيجتك…" />;
  if (resultQuery.isError || !resultQuery.data) return <StudentError title="تعذر عرض النتيجة" message="لم نتمكن من تحميل نتيجتك الآن. حاول مرة أخرى." action={<StudentButton variant="secondary" onClick={() => void resultQuery.refetch()}>إعادة المحاولة</StudentButton>} />;

  const attemptResult: AttemptResult = resultQuery.data;
  const finished = attemptResult.status === 'Finished' || attemptResult.status === 'TimedOut';
  const scorePercentage = attemptResult.percentage == null ? null : Math.min(100, Math.max(0, Math.round(attemptResult.percentage)));

  return (
    <StudentShell width="wide">
      <div className="student-enter mx-auto flex w-full max-w-3xl flex-col gap-5 pt-4 sm:pt-8">
        <section className="student-panel overflow-hidden">
          <div className={`relative px-6 py-8 sm:px-10 sm:py-10 ${attemptResult.passed ? 'bg-[var(--student-orange-soft)]' : 'bg-amber-50'}`}>
            {attemptResult.passed ? <><span aria-hidden="true" className="absolute right-10 top-10 h-2.5 w-2.5 rounded-full bg-[var(--student-violet)] opacity-75" /><span aria-hidden="true" className="absolute bottom-10 left-12 h-3 w-3 rotate-45 rounded-sm bg-[var(--student-orange)]" /></> : null}
            <div className="relative flex flex-col items-center gap-7 text-center sm:flex-row sm:text-right">
              {attemptResult.passed ? <div aria-hidden="true" className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-amber-400 text-5xl font-black text-amber-950 shadow-[0_2px_8px_rgb(180_83_9/0.18)]">★</div> : null}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-black ${attemptResult.passed ? 'text-emerald-800' : 'text-amber-900'}`}>{finished ? 'النتيجة' : 'محاولتك قيد التنفيذ'}</p>
                <h1 className="mt-2 text-balance text-3xl font-black text-[var(--student-ink)] sm:text-4xl">{attemptResult.passed ? <>أحسنت يا <bdi>{attemptResult.displayName}</bdi>!</> : <bdi>{attemptResult.displayName}</bdi>}</h1>
                {attemptResult.passed != null ? <p className={`mt-3 text-base font-bold leading-7 ${attemptResult.passed ? 'text-emerald-900' : 'text-slate-700'}`}>{attemptResult.passed ? 'أكملت النشاط بنجاح' : 'لم تصل إلى درجة النجاح هذه المرة'}</p> : null}
              </div>
              {finished && scorePercentage != null && attemptResult.score != null && attemptResult.maxScore != null ? (
                <div className="student-score-ring" style={{ '--student-score': `${scorePercentage * 3.6}deg`, '--student-score-color': attemptResult.passed ? 'var(--student-primary)' : 'var(--student-orange)' } as React.CSSProperties}>
                  <div className="relative z-10 text-center"><p dir="ltr" className="text-4xl font-black tracking-tight text-[var(--student-ink)]">{scorePercentage}%</p><p dir="ltr" className="mt-1 text-sm font-bold text-slate-700">{attemptResult.score} / {attemptResult.maxScore}</p></div>
                </div>
              ) : null}
            </div>
            {!finished ? <p className="mt-5 text-center text-sm text-[var(--student-muted)]">أجبت على {attemptResult.answeredCount} من {attemptResult.totalQuestions} سؤالًا.</p> : null}
          </div>
          <dl className="flex justify-center divide-x divide-x-reverse divide-slate-200 px-5 py-5 text-center sm:px-8">
            <div className="flex-1 px-3"><dt className="text-xs text-[var(--student-muted)]">المجاب</dt><dd dir="ltr" className="mt-1 text-base font-black text-[var(--student-ink)]">{attemptResult.answeredCount} / {attemptResult.totalQuestions}</dd></div>
            {attemptResult.durationMs != null ? <div className="flex-1 px-3"><dt className="text-xs text-[var(--student-muted)]">المدة</dt><dd className="mt-1 text-base font-black text-[var(--student-ink)]">{Math.max(1, Math.round(attemptResult.durationMs / 60_000))} دقيقة</dd></div> : null}
            {attemptResult.status === 'TimedOut' ? <div className="flex-1 px-3"><dt className="text-xs text-[var(--student-muted)]">الحالة</dt><dd className="mt-1 text-base font-black text-amber-900">انتهى الوقت</dd></div> : null}
          </dl>
        </section>
        {finished && attemptResult.passed != null ? <PlayerDeliveryPanel joinCode={joinCode} attemptId={attemptId} passed={attemptResult.passed} surveyAction={<PlayerSurveyAction joinCode={joinCode} attemptId={attemptId} />} /> : null}
        {finished ? <PlayerSurveyPanel joinCode={joinCode} attemptId={attemptId} /> : null}
      </div>
    </StudentShell>
  );
}
