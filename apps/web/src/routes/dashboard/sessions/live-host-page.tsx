import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { liveApi, sessionsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { LiveCountdown } from '../../../features/live/live-countdown';
import { useLiveConnection } from '../../../features/live/use-live-connection';
import { getActiveTenantId } from '../../../lib/auth/session';
import type { LiveControlRequest, LiveSessionState } from '../../../types/live';

const PHASE_LABELS = {
  Lobby: 'قاعة الانتظار',
  QuestionOpen: 'السؤال مفتوح',
  QuestionClosed: 'عرض النتائج',
  Finished: 'انتهت المسابقة',
} as const;

export default function LiveHostPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const quizId = searchParams.get('quizId');
  const tenantId = getActiveTenantId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [actionError, setActionError] = useState<string | null>(null);

  const stateQuery = useQuery({
    queryKey: ['live-state', tenantId, quizId, sessionId],
    queryFn: ({ signal }) => liveApi.getState(tenantId!, quizId!, sessionId!, signal),
    enabled: Boolean(tenantId && quizId && sessionId),
    refetchInterval: 3_000,
  });
  const sessionQuery = useQuery({
    queryKey: ['session-detail', tenantId, quizId, sessionId],
    queryFn: ({ signal }) => sessionsApi.get(tenantId!, quizId!, sessionId!, signal),
    enabled: Boolean(tenantId && quizId && sessionId),
  });

  const applyLiveState = useCallback((state: LiveSessionState) => {
    queryClient.setQueryData(['live-state', tenantId, quizId, sessionId], state);
  }, [queryClient, tenantId, quizId, sessionId]);
  const getToken = useCallback(async () => {
    const token = await liveApi.getTeacherToken(tenantId!, quizId!, sessionId!);
    return token.accessToken;
  }, [tenantId, quizId, sessionId]);
  const connectionStatus = useLiveConnection({
    enabled: Boolean(tenantId && quizId && sessionId && stateQuery.data),
    getAccessToken: getToken,
    onState: applyLiveState,
  });

  const controlMutation = useMutation({
    mutationFn: (action: 'open' | 'close' | 'finish') => {
      const state = stateQuery.data!;
      const payload: LiveControlRequest = { baseRevision: state.revision };
      if (action === 'open') {
        payload.durationSeconds = durationSeconds;
        return liveApi.openNext(tenantId!, quizId!, sessionId!, payload);
      }
      if (action === 'close') return liveApi.closeQuestion(tenantId!, quizId!, sessionId!, payload);
      return liveApi.finish(tenantId!, quizId!, sessionId!, payload);
    },
    onSuccess: (state) => {
      setActionError(null);
      applyLiveState(state);
    },
    onError: (error) => {
      setActionError(error instanceof HttpError && error.status === 409
        ? 'تغيّرت حالة المسابقة. جرى تحديث الشاشة؛ حاول مرة أخرى.'
        : 'تعذر تنفيذ الأمر. تحقق من الاتصال وحاول مجددًا.');
      void stateQuery.refetch();
    },
  });

  if (!tenantId) {
    navigate('/onboarding/choose', { replace: true });
    return null;
  }
  if (!quizId) {
    return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">معرّف الاختبار مفقود من الرابط.</p>;
  }
  if (stateQuery.isLoading || sessionQuery.isLoading) {
    return <p className="text-sm text-slate-500">جارٍ تجهيز لوحة البث…</p>;
  }
  if (!stateQuery.data || !sessionQuery.data) {
    return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">تعذر فتح المسابقة المباشرة.</p>;
  }

  const state = stateQuery.data;
  const session = sessionQuery.data;
  const canOpen = state.sessionStatus === 'Active' && (state.phase === 'Lobby' || state.phase === 'QuestionClosed')
    && state.currentQuestionIndex + 1 < state.totalQuestions;
  const canFinish = state.sessionStatus === 'Active' && state.phase !== 'QuestionOpen';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header className="overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-sky-300">LIVE CONTROL</p>
            <h1 className="mt-1 text-2xl font-black">{session.label ?? session.quizTitle}</h1>
            <p className="mt-1 text-sm text-slate-300">رمز الانضمام <span dir="ltr" className="font-mono text-lg font-bold text-white">{session.joinCode}</span></p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {connectionStatus === 'connected' ? 'متصل لحظيًا' : 'التحديث الدوري يعمل'}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-slate-800 pt-5">
          <div>
            <p className="text-sm text-slate-400">الحالة</p>
            <p className="text-xl font-bold">{PHASE_LABELS[state.phase]}</p>
          </div>
          {state.phase === 'QuestionOpen' ? <LiveCountdown closesAt={state.questionClosesAt} serverNow={state.serverNow} /> : null}
          <div className="flex gap-5 text-center">
            <Metric value={state.participantCount} label="مشارك" />
            <Metric value={state.attemptCount} label="بدأ" />
            <Metric value={state.answeredCount} label="أجاب" />
          </div>
        </div>
      </header>

      {actionError ? <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{actionError}</p> : null}

      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {state.currentQuestion ? (
            <>
              <p className="text-sm font-bold text-sky-700">السؤال {state.currentQuestion.index + 1} من {state.totalQuestions}</p>
              <h2 className="mt-2 text-xl font-bold leading-8 text-slate-950">{state.currentQuestion.prompt}</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {state.currentQuestion.options.map((option, index) => (
                  <div key={option.optionId} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800">
                    <span className="me-2 text-sky-700">{index + 1}.</span>{option.optionText}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <p className="text-lg font-bold text-slate-900">الطلاب يرون قاعة الانتظار</p>
              <p className="mt-1 text-sm text-slate-500">افتح السؤال الأول عندما يصبح الجميع جاهزًا.</p>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">لوحة الترتيب</h2>
          {state.leaderboard.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">تظهر الدرجات بعد إغلاق السؤال.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {state.leaderboard.map((entry) => (
                <li key={`${entry.rank}-${entry.displayName}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span><b className="me-2 text-sky-700">#{entry.rank}</b>{entry.displayName}</span>
                  <span dir="ltr" className="font-mono font-bold">{entry.score}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </section>

      <section aria-label="أوامر المسابقة" className="sticky bottom-3 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
        {(state.phase === 'Lobby' || state.phase === 'QuestionClosed') && state.sessionStatus === 'Active' ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            مدة السؤال بالثواني
            <input
              type="number"
              min={5}
              max={300}
              value={durationSeconds}
              onChange={(event) => setDurationSeconds(Math.min(300, Math.max(5, Number(event.target.value))))}
              className="min-h-11 w-28 rounded-md border border-slate-300 px-3 text-base text-slate-900"
            />
          </label>
        ) : null}
        {canOpen ? (
          <Button onClick={() => controlMutation.mutate('open')} disabled={controlMutation.isPending}>
            {controlMutation.isPending ? <ButtonSpinner /> : null}
            {state.currentQuestionIndex < 0 ? 'فتح السؤال الأول' : 'فتح السؤال التالي'}
          </Button>
        ) : null}
        {state.phase === 'QuestionOpen' ? (
          <Button variant="secondary" onClick={() => controlMutation.mutate('close')} disabled={controlMutation.isPending}>إغلاق السؤال الآن</Button>
        ) : null}
        {canFinish ? (
          <Button variant="danger" onClick={() => controlMutation.mutate('finish')} disabled={controlMutation.isPending}>إنهاء المسابقة</Button>
        ) : null}
        <Link to={`/dashboard/sessions/${session.id}?quizId=${quizId}`} className="min-h-11 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">تفاصيل الجلسة</Link>
      </section>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div><p className="text-2xl font-black tabular-nums">{value}</p><p className="text-xs text-slate-400">{label}</p></div>;
}
