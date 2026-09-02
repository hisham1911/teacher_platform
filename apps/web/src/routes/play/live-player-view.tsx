import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LiveCountdown } from '../../features/live/live-countdown';
import { useLiveConnection } from '../../features/live/use-live-connection';
import { playerApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import type { LiveSessionState } from '../../types/live';
import type { PlayerSession } from '../../types/sessions';
import { AnswerEditor, QuestionMedia } from './player-question-renderer';
import { ResultView } from './player-result-view';

export function LivePlayerView({ joinCode, session, displayName, initialAttemptId }: { joinCode: string; session: PlayerSession; displayName: string; initialAttemptId: string | null }) {
  const queryClient = useQueryClient();
  const [attemptId, setAttemptId] = useState(initialAttemptId);
  const [answerSaved, setAnswerSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => playerApi.startAttempt(joinCode),
    onSuccess: (attempt) => { setAttemptId(attempt.attemptId); setActionError(null); },
    onError: () => setActionError('تعذر تثبيت دخولك إلى المسابقة. أعد المحاولة.'),
  });
  useEffect(() => {
    if (!attemptId && !startMutation.isPending && !startMutation.isError) startMutation.mutate();
    // POST is idempotent and should be invoked once when no attempt exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const stateQuery = useQuery({ queryKey: ['player-live-state', joinCode], queryFn: ({ signal }) => playerApi.getLiveState(joinCode, signal), refetchInterval: 2_000, retry: false });
  const applyState = useCallback((state: LiveSessionState) => { queryClient.setQueryData(['player-live-state', joinCode], state); setAnswerSaved(false); }, [queryClient, joinCode]);
  const getToken = useCallback(async () => (await playerApi.getLiveToken(joinCode)).accessToken, [joinCode]);
  const connectionStatus = useLiveConnection({ enabled: stateQuery.data?.sessionStatus === 'Active', getAccessToken: getToken, onState: applyState });

  const state = stateQuery.data;
  const questionQuery = useQuery({
    queryKey: ['player-live-question', joinCode, attemptId, state?.currentQuestion?.quizVersionItemId],
    queryFn: ({ signal }) => playerApi.getCurrentQuestion(joinCode, attemptId!, signal),
    enabled: Boolean(attemptId && state?.phase === 'QuestionOpen' && state.currentQuestion),
    retry: false,
  });
  const answerMutation = useMutation({
    mutationFn: (payload: { quizVersionItemId: string; answerJson: string }) => playerApi.submitAnswer(joinCode, attemptId!, payload),
    onSuccess: () => { setAnswerSaved(true); setActionError(null); void questionQuery.refetch(); },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 400) setActionError('الإجابة غير صالحة ولم تُسجّل. راجع اختيارك وحاول مجددًا.');
      else if (error instanceof HttpError && error.status === 409) { setActionError('أُغلق السؤال أو سُجّلت له إجابة مختلفة بالفعل.'); void stateQuery.refetch(); }
      else setActionError('تعذر تسجيل الإجابة. تحقق من الاتصال وحاول مجددًا.');
    },
  });

  if (!attemptId && startMutation.isPending) return <LiveShell><p className="text-center text-sm text-slate-500">جارٍ تثبيت دخولك…</p></LiveShell>;
  if (stateQuery.isLoading || !state) return <LiveShell><p className="text-center text-sm text-slate-500">جارٍ الاتصال بالمسابقة…</p></LiveShell>;
  if (state.phase === 'Finished') return attemptId ? <ResultView joinCode={joinCode} attemptId={attemptId} /> : <LiveShell><p className="text-center text-sm text-slate-600">انتهت المسابقة قبل بدء محاولتك.</p></LiveShell>;

  const question = questionQuery.data;
  const isAnswered = answerSaved || question?.alreadyAnswered === true;
  return (
    <LiveShell>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold tracking-widest text-sky-700">مسابقة مباشرة</p><h1 className="mt-1 text-xl font-black text-slate-950">{session.title}</h1><p className="text-sm text-slate-500">أهلًا {displayName}</p></div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-400'}`} title={connectionStatus === 'connected' ? 'متصل لحظيًا' : 'التحديث الدوري يعمل'} />
      </header>

      {state.phase === 'Lobby' ? <div className="rounded-2xl border border-sky-200 bg-sky-50 p-7 text-center"><div className="mx-auto mb-4 h-3 w-3 animate-pulse rounded-full bg-sky-600 motion-reduce:animate-none" /><h2 className="text-lg font-bold text-slate-950">أنت داخل قاعة الانتظار</h2><p className="mt-2 text-sm text-slate-600">سيظهر السؤال هنا عند فتحه. لا تغلق الصفحة.</p><p className="mt-4 text-xs text-sky-800">انضم {state.participantCount} مشارك</p></div> : null}

      {state.phase === 'QuestionOpen' ? <><div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-700">السؤال {state.currentQuestionIndex + 1} من {state.totalQuestions}</p><LiveCountdown closesAt={state.questionClosesAt} serverNow={state.serverNow} /></div><div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-sky-600" style={{ width: `${((state.currentQuestionIndex + 1) / state.totalQuestions) * 100}%` }} /></div><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{questionQuery.isLoading || !question ? <p className="py-12 text-center text-sm text-slate-500">جارٍ تحميل السؤال…</p> : <><div className="mb-4 flex items-start justify-between gap-2"><h2 className="text-lg font-bold leading-8 text-slate-950">{question.prompt}</h2><span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{question.points} نقطة</span></div>{question.mediaAssetId ? <QuestionMedia joinCode={joinCode} attemptId={attemptId!} mediaId={question.mediaAssetId} questionType={question.questionType} presentation="live" /> : null}<div className="mt-4"><AnswerEditor key={question.quizVersionItemId} question={question} answerState={answerMutation.isPending ? 'saving' : isAnswered ? 'saved' : 'editing'} presentation="live" onSubmit={(answerJson) => answerMutation.mutate({ quizVersionItemId: question.quizVersionItemId, answerJson })} /></div>{isAnswered ? <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-800">تم تسجيل إجابتك ✓</p> : null}</>}</section></> : null}

      {state.phase === 'QuestionClosed' ? <div className="space-y-4"><div className="rounded-2xl bg-slate-950 p-6 text-center text-white"><h2 className="text-xl font-black">أُغلق السؤال</h2><p className="mt-1 text-sm text-slate-300">انتظر السؤال التالي.</p></div><Leaderboard state={state} /></div> : null}
      {actionError ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}
    </LiveShell>
  );
}

function LiveShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center bg-slate-50 p-4">{children}</main>;
}

function Leaderboard({ state }: { state: LiveSessionState }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-bold text-slate-900">الترتيب الحالي</h3>{state.leaderboard.length === 0 ? <p className="mt-3 text-sm text-slate-500">لا توجد درجات مسجلة بعد.</p> : <ol className="mt-3 space-y-2">{state.leaderboard.slice(0, 10).map((entry) => <li key={`${entry.rank}-${entry.displayName}`} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span><b className="me-2 text-sky-700">#{entry.rank}</b>{entry.displayName}</span><span dir="ltr" className="font-mono font-bold">{entry.score}</span></li>)}</ol>}</section>;
}
