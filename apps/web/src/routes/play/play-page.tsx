import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { ButtonSpinner } from '../../components/ui/spinner';
import { FormField, TextInput, TextArea } from '../../components/ui/form-field';
import { playerApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import { LiveCountdown } from '../../features/live/live-countdown';
import { useLiveConnection } from '../../features/live/use-live-connection';
import type { LiveSessionState } from '../../types/live';
import type {
  AttemptResult,
  JoinSessionResponse,
  PlayerQuestion,
  PlayerSession,
  StartAttemptResponse,
} from '../../types/sessions';
import { PlayerSurveyPanel } from './player-survey-panel';
import { PlayerDeliveryPanel } from './player-delivery-panel';

/**
 * /play/:joinCode — واجهة الطالب (Phase 4).
 * مجهولة تمامًا: الـGuest Token في HttpOnly Cookie يُرسل تلقائيًا.
 * الاستعادة بعد إعادة التحميل من السيرفر فقط عبر GET /me (لا localStorage).
 * mobile-first · RTL · أهداف لمس ≥44px · الاسم 2-50 حرفًا.
 */

type PlayerStage =
  | { kind: 'loading' }
  | { kind: 'join'; session: PlayerSession }
  | { kind: 'ready'; session: PlayerSession; displayName: string; attemptId: string | null }
  | { kind: 'live'; session: PlayerSession; displayName: string; attemptId: string | null }
  | { kind: 'playing'; attempt: StartAttemptResponse }
  | { kind: 'result'; attemptId: string }
  | { kind: 'unavailable'; message: string };

/** انحراف ساعة الخادم عن ساعة العميل — يُحدَّث مع كل استجابة تحمل serverNow */
function useServerClock() {
  const offsetRef = useRef(0);
  const sync = useCallback((serverNow: string) => {
    offsetRef.current = Date.parse(serverNow) - Date.now();
  }, []);
  const now = useCallback(() => new Date(Date.now() + offsetRef.current), []);
  return { sync, now };
}

function useCountdown(deadlineAt: string | null | undefined, now: () => Date): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!deadlineAt) {
      setRemaining(null);
      return;
    }
    const deadline = Date.parse(deadlineAt);
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - now().getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineAt, now]);
  return remaining;
}

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayPage() {
  const { joinCode } = useParams<{ joinCode: string }>();
  const queryClient = useQueryClient();
  const clock = useServerClock();

  const [stage, setStage] = useState<PlayerStage>({ kind: 'loading' });
  const [displayName, setDisplayName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ['player-session', joinCode],
    queryFn: ({ signal }) => playerApi.getSession(joinCode!, signal),
    enabled: Boolean(joinCode),
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (sessionQuery.isSuccess && stage.kind === 'loading') {
      const s = sessionQuery.data;
       if (s.status === 'Active' && s.canJoin) {
         setStage({ kind: 'join', session: s });
        // الاستعادة بعد F5 من السيرفر عبر الكوكي فقط — بدون حفظ الاسم في localStorage
        restoreMutation.mutate();
      } else if (s.status === 'Scheduled') {
        setStage({ kind: 'unavailable', message: 'الجلسة لم تُفعَّل بعد. انتظر المعلم.' });
       } else if (s.status === 'Finished') {
         setStage({ kind: 'unavailable', message: 'انتهت هذه الجلسة.' });
         restoreMutation.mutate();
      } else {
        setStage({ kind: 'unavailable', message: 'هذه الجلسة لم تعد متاحة.' });
      }
    } else if (sessionQuery.isError && stage.kind === 'loading') {
      const e = sessionQuery.error;
      setStage({
        kind: 'unavailable',
        message:
          e instanceof HttpError && e.status === 404
            ? 'رمز الانضمام غير صحيح. تأكد من الرمز مع معلمك.'
            : 'تعذر الاتصال. تحقق من الإنترنت ثم أعد تحميل الصفحة.',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionQuery.isSuccess, sessionQuery.isError, sessionQuery.data, sessionQuery.error, stage.kind]);

  // يوجه اللاعب حسب حالة الخادم الفعلية (منسّق مشترك بين /me و /join)
  function dispatchResult(joinCode: string, result: JoinSessionResponse, session: PlayerSession) {
    if (result.attemptId && result.attemptStatus === 'InProgress') {
      // استئناف محاولة قائمة (F5 / إعادة فتح)
      if (session.mode === 'Live') {
        setStage({ kind: 'live', session, displayName: result.displayName, attemptId: result.attemptId });
      } else {
        startMutation.mutate();
      }
    } else if (result.attemptId && (result.attemptStatus === 'Finished' || result.attemptStatus === 'TimedOut')) {
      // محاولة منتهية — نعرض النتيجة مباشرة دون شاشة استعداد
      void queryClient.invalidateQueries({ queryKey: ['player-result', joinCode, result.attemptId] });
      setStage({ kind: 'result', attemptId: result.attemptId });
    } else if (session.status === 'Active' && session.mode === 'Live') {
      setStage({ kind: 'live', session, displayName: result.displayName, attemptId: result.attemptId });
    } else {
      setStage((prev) =>
        prev.kind === 'join' || prev.kind === 'ready'
          ? { kind: 'ready', session: prev.session, displayName: result.displayName, attemptId: result.attemptId }
          : prev,
      );
    }
  }

  // استعادة تلقائية بعد إعادة تحميل الصفحة: السيرفر يقرّر الوجهة من الكوكي فقط
  const restoreMutation = useMutation({
    mutationFn: () => playerApi.getCurrentPlayer(joinCode!),
    onSuccess: (result) => {
      setActionError(null);
      dispatchResult(joinCode!, result, sessionQuery.data!);
    },
    onError: (error) => {
      // 401 = لا كوكي صالح ⇒ نترك شاشة الانضمام. بقية الأخطاء غير مؤذية للعرض.
      if (!(error instanceof HttpError && error.status === 401)) {
        setActionError('تعذر استعادة جلستك. أدخل اسمك للانضمام من جديد.');
      }
    },
  });

  const joinMutation = useMutation({
    mutationFn: (name: string) => playerApi.join(joinCode!, { displayName: name }),
    onSuccess: (result) => {
      setActionError(null);
      dispatchResult(joinCode!, result, sessionQuery.data!);
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        setActionError('الجلسة لم تعد تقبل منضمّين جددًا.');
      } else if (error instanceof HttpError && error.status === 429) {
        setActionError('محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.');
      } else {
        setActionError('تعذر الانضمام. أعد المحاولة.');
      }
    },
  });

  const startMutation = useMutation({
    mutationFn: () => playerApi.startAttempt(joinCode!),
    onSuccess: (attempt) => {
      clock.sync(attempt.serverNow);
      setActionError(null);
      setStage({ kind: 'playing', attempt });
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        setActionError('لا يمكن بدء المحاولة الآن — ربما انتهت الجلسة.');
      } else {
        setActionError('تعذر بدء المحاولة. أعد المحاولة.');
      }
    },
  });

  function onJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = displayName.trim();
    if (name.length < 2) {
      setNameError('الاسم قصير جدًا (حرفان على الأقل).');
      return;
    }
    if (name.length > 50) {
      setNameError('الاسم طويل جدًا (50 حرفًا كحد أقصى).');
      return;
    }
    setNameError(null);
    setActionError(null);
    joinMutation.mutate(name);
  }

  // ─── شاشات ────────────────────────────────────────────────────────────────

  if (stage.kind === 'loading') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center p-4">
        <p className="text-center text-sm text-slate-500">جارٍ تحميل الجلسة…</p>
      </main>
    );
  }

  if (stage.kind === 'unavailable') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center p-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <h1 className="mb-2 text-lg font-bold text-slate-900">غير متاح</h1>
          <p className="text-sm text-slate-600">{stage.message}</p>
        </div>
      </main>
    );
  }

  if (stage.kind === 'join') {
    const { session } = stage;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center p-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="mb-1 text-xl font-bold text-slate-900">{session.title}</h1>
          {session.description ? (
            <p className="mb-3 text-sm text-slate-600">{session.description}</p>
          ) : null}
          <dl className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <div className="flex gap-1">
              <dt>الأسئلة:</dt>
              <dd>{session.questionCount}</dd>
            </div>
            <div className="flex gap-1">
              <dt>النقاط:</dt>
              <dd>{session.totalPoints}</dd>
            </div>
            <div className="flex gap-1">
              <dt>النجاح من:</dt>
              <dd dir="ltr">{session.passingPercentage}%</dd>
            </div>
            {session.timeMode !== 'None' && session.timeLimitSeconds ? (
              <div className="flex gap-1">
                <dt>الوقت:</dt>
                <dd>
                  {session.timeMode === 'TotalTime'
                    ? `${Math.round(session.timeLimitSeconds / 60)} دقيقة إجمالًا`
                    : `${session.timeLimitSeconds} ثانية لكل سؤال`}
                </dd>
              </div>
            ) : null}
          </dl>
          {session.instructions ? (
            <p className="mb-4 rounded-lg bg-sky-50 p-3 text-xs text-sky-800">{session.instructions}</p>
          ) : null}
          <form onSubmit={onJoinSubmit} className="flex flex-col gap-3">
            <FormField id="display-name" label="اسمك (سيظهر للمعلم)" error={nameError}>
              {(props) => (
                <TextInput
                  {...props}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  minLength={2}
                  maxLength={50}
                  required
                  autoComplete="name"
                  placeholder="اكتب اسمك هنا"
                />
              )}
            </FormField>
            {actionError ? (
              <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                {actionError}
              </p>
            ) : null}
            <Button type="submit" disabled={joinMutation.isPending}>
              {joinMutation.isPending ? <ButtonSpinner /> : null}
              {joinMutation.isPending ? 'جارٍ الانضمام…' : 'انضمام'}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  if (stage.kind === 'ready') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center p-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <h1 className="mb-1 text-xl font-bold text-slate-900">أهلًا {stage.displayName} 👋</h1>
          <p className="mb-4 text-sm text-slate-600">
            {stage.attemptId
              ? 'لديك محاولة سابقة — ستكمل من حيث توقفت.'
              : 'عند الضغط على "ابدأ" سيبدأ الوقت (إن وُجد). ركّز وبالتوفيق!'}
          </p>
          {actionError ? (
            <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {actionError}
            </p>
          ) : null}
          <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
            {startMutation.isPending ? <ButtonSpinner /> : null}
            {startMutation.isPending ? 'جارٍ البدء…' : stage.attemptId ? 'استئناف المحاولة' : 'ابدأ الاختبار'}
          </Button>
        </div>
      </main>
    );
  }

  if (stage.kind === 'playing') {
    return (
      <PlayingView
        joinCode={joinCode!}
        attempt={stage.attempt}
        clockSync={clock.sync}
        clockNow={clock.now}
        onFinished={(attemptId) => {
          void queryClient.invalidateQueries({ queryKey: ['player-result', joinCode, attemptId] });
          setStage({ kind: 'result', attemptId });
        }}
      />
    );
  }

  if (stage.kind === 'live') {
    return (
      <LivePlayerView
        joinCode={joinCode!}
        session={stage.session}
        displayName={stage.displayName}
        initialAttemptId={stage.attemptId}
      />
    );
  }

  return <ResultView joinCode={joinCode!} attemptId={stage.attemptId} />;
}

// ─── المسابقة المباشرة ─────────────────────────────────────────────────────

function LivePlayerView({
  joinCode,
  session,
  displayName,
  initialAttemptId,
}: {
  joinCode: string;
  session: PlayerSession;
  displayName: string;
  initialAttemptId: string | null;
}) {
  const queryClient = useQueryClient();
  const [attemptId, setAttemptId] = useState(initialAttemptId);
  const [answerSaved, setAnswerSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => playerApi.startAttempt(joinCode),
    onSuccess: (attempt) => {
      setAttemptId(attempt.attemptId);
      setActionError(null);
    },
    onError: () => setActionError('تعذر تثبيت دخولك إلى المسابقة. أعد المحاولة.'),
  });
  useEffect(() => {
    if (!attemptId && !startMutation.isPending && !startMutation.isError) {
      startMutation.mutate();
    }
    // يبدأ مرة واحدة؛ POST idempotent على الخادم.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const stateQuery = useQuery({
    queryKey: ['player-live-state', joinCode],
    queryFn: ({ signal }) => playerApi.getLiveState(joinCode, signal),
    refetchInterval: 2_000,
    retry: false,
  });
  const applyState = useCallback((state: LiveSessionState) => {
    queryClient.setQueryData(['player-live-state', joinCode], state);
    setAnswerSaved(false);
  }, [queryClient, joinCode]);
  const getToken = useCallback(async () => {
    const token = await playerApi.getLiveToken(joinCode);
    return token.accessToken;
  }, [joinCode]);
  const connectionStatus = useLiveConnection({
    enabled: stateQuery.data?.sessionStatus === 'Active',
    getAccessToken: getToken,
    onState: applyState,
  });

  const state = stateQuery.data;
  const questionQuery = useQuery({
    queryKey: ['player-live-question', joinCode, attemptId, state?.currentQuestion?.quizVersionItemId],
    queryFn: ({ signal }) => playerApi.getCurrentQuestion(joinCode, attemptId!, signal),
    enabled: Boolean(attemptId && state?.phase === 'QuestionOpen' && state.currentQuestion),
    retry: false,
  });
  const answerMutation = useMutation({
    mutationFn: (payload: { quizVersionItemId: string; answerJson: string }) =>
      playerApi.submitAnswer(joinCode, attemptId!, payload),
    onSuccess: () => {
      setAnswerSaved(true);
      setActionError(null);
      void questionQuery.refetch();
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 400) {
        setActionError('الإجابة غير صالحة ولم تُسجّل. راجع اختيارك وحاول مجددًا.');
      } else if (error instanceof HttpError && error.status === 409) {
        setActionError('أُغلق السؤال أو سُجّلت له إجابة مختلفة بالفعل.');
        void stateQuery.refetch();
      } else {
        setActionError('تعذر تسجيل الإجابة. تحقق من الاتصال وحاول مجددًا.');
      }
    },
  });

  if (!attemptId && startMutation.isPending) {
    return <LiveShell><p className="text-center text-sm text-slate-500">جارٍ تثبيت دخولك…</p></LiveShell>;
  }
  if (stateQuery.isLoading || !state) {
    return <LiveShell><p className="text-center text-sm text-slate-500">جارٍ الاتصال بالمسابقة…</p></LiveShell>;
  }
  if (state.phase === 'Finished') {
    return attemptId
      ? <ResultView joinCode={joinCode} attemptId={attemptId} />
      : <LiveShell><p className="text-center text-sm text-slate-600">انتهت المسابقة قبل بدء محاولتك.</p></LiveShell>;
  }

  const question = questionQuery.data;
  const isAnswered = answerSaved || question?.alreadyAnswered === true;

  return (
    <LiveShell>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-sky-700">مسابقة مباشرة</p>
          <h1 className="mt-1 text-xl font-black text-slate-950">{session.title}</h1>
          <p className="text-sm text-slate-500">أهلًا {displayName}</p>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-400'}`} title={connectionStatus === 'connected' ? 'متصل لحظيًا' : 'التحديث الدوري يعمل'} />
      </header>

      {state.phase === 'Lobby' ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-7 text-center">
          <div className="mx-auto mb-4 h-3 w-3 animate-pulse rounded-full bg-sky-600" />
          <h2 className="text-lg font-bold text-slate-950">أنت داخل قاعة الانتظار</h2>
          <p className="mt-2 text-sm text-slate-600">سيظهر السؤال هنا عندما يفتحه المعلم. لا تغلق الصفحة.</p>
          <p className="mt-4 text-xs text-sky-800">انضم {state.participantCount} مشارك</p>
        </div>
      ) : null}

      {state.phase === 'QuestionOpen' ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-700">السؤال {state.currentQuestionIndex + 1} من {state.totalQuestions}</p>
            <LiveCountdown closesAt={state.questionClosesAt} serverNow={state.serverNow} />
          </div>
          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-sky-600" style={{ width: `${((state.currentQuestionIndex + 1) / state.totalQuestions) * 100}%` }} />
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {questionQuery.isLoading || !question ? (
              <p className="py-12 text-center text-sm text-slate-500">جارٍ تحميل السؤال…</p>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold leading-8 text-slate-950">{question.prompt}</h2>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{question.points} نقطة</span>
                </div>
                {question.mediaAssetId ? <QuestionMedia joinCode={joinCode} attemptId={attemptId!} mediaId={question.mediaAssetId} questionType={question.questionType} /> : null}
                <div className="mt-4">
                  <AnswerEditor
                    key={question.quizVersionItemId}
                    question={question}
                    disabled={answerMutation.isPending || isAnswered}
                    onSubmit={(answerJson) => answerMutation.mutate({ quizVersionItemId: question.quizVersionItemId, answerJson })}
                  />
                </div>
                {isAnswered ? <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-800">تم تسجيل إجابتك ✓</p> : null}
              </>
            )}
          </section>
        </>
      ) : null}

      {state.phase === 'QuestionClosed' ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-950 p-6 text-center text-white">
            <h2 className="text-xl font-black">أُغلق السؤال</h2>
            <p className="mt-1 text-sm text-slate-300">انتظر السؤال التالي من المعلم.</p>
          </div>
          <Leaderboard state={state} />
        </div>
      ) : null}

      {actionError ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}
    </LiveShell>
  );
}

function LiveShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center bg-slate-50 p-4">{children}</main>;
}

function Leaderboard({ state }: { state: LiveSessionState }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-bold text-slate-900">الترتيب الحالي</h3>
      {state.leaderboard.length === 0 ? <p className="mt-3 text-sm text-slate-500">لا توجد درجات مسجلة بعد.</p> : (
        <ol className="mt-3 space-y-2">
          {state.leaderboard.slice(0, 10).map((entry) => (
            <li key={`${entry.rank}-${entry.displayName}`} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span><b className="me-2 text-sky-700">#{entry.rank}</b>{entry.displayName}</span>
              <span dir="ltr" className="font-mono font-bold">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ─── شاشة اللعب ─────────────────────────────────────────────────────────────

function PlayingView({
  joinCode,
  attempt,
  clockSync,
  clockNow,
  onFinished,
}: {
  joinCode: string;
  attempt: StartAttemptResponse;
  clockSync: (serverNow: string) => void;
  clockNow: () => Date;
  onFinished: (attemptId: string) => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(attempt.currentQuestionIndex);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; scoreAwarded: number } | null>(null);

  const questionQuery = useQuery({
    queryKey: ['player-question', joinCode, attempt.attemptId, questionIndex],
    queryFn: ({ signal }) => playerApi.getCurrentQuestion(joinCode, attempt.attemptId, signal),
    staleTime: 0,
  });

  useEffect(() => {
    if (questionQuery.data) {
      clockSync(questionQuery.data.serverNow);
      setLastFeedback(null);
    }
  }, [questionQuery.data, clockSync]);

  const question = questionQuery.data;
  const remaining = useCountdown(question?.deadlineAt ?? attempt.deadlineAt, clockNow);

  // انتهاء الوقت → إنهاء تلقائي (settle-on-request: الخادم يحسم عند أول طلب)
  const finishMutation = useMutation({
    mutationFn: () => playerApi.finish(joinCode, attempt.attemptId),
    onSuccess: () => onFinished(attempt.attemptId),
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        // المحاولة منتهية أصلًا → اعرض النتيجة
        onFinished(attempt.attemptId);
      } else {
        setActionError('تعذر إنهاء المحاولة. أعد المحاولة.');
      }
    },
  });

  useEffect(() => {
    if (remaining === 0 && !finishMutation.isPending && !finishMutation.isSuccess) {
      finishMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const answerMutation = useMutation({
    mutationFn: (payload: { quizVersionItemId: string; answerJson: string }) =>
      playerApi.submitAnswer(joinCode, attempt.attemptId, payload),
    onSuccess: (result) => {
      clockSync(result.serverNow);
      if (result.isCorrect != null && result.scoreAwarded != null) {
        setLastFeedback({ isCorrect: result.isCorrect, scoreAwarded: result.scoreAwarded });
      }
      setActionError(null);
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 400) {
        const body = error.body as { title?: string } | null;
        setActionError(
          body?.title === 'InvalidAnswerPayload'
            ? 'تعذر حفظ الإجابة — البيانات غير صالحة. أعد المحاولة.'
            : 'تعذر حفظ الإجابة — تأكد من إدخال إجابة صحيحة.',
        );
      } else if (error instanceof HttpError && error.status === 409) {
        const body = error.body as { title?: string } | null;
        if (body?.title === 'AttemptFinished' || body?.title === 'SessionNotActive') {
          onFinished(attempt.attemptId);
          return;
        }
        setActionError('تم تسجيل إجابة مختلفة لهذا السؤال مسبقًا.');
      } else if (error instanceof HttpError && error.status === 429) {
        setActionError('محاولات كثيرة. انتظر لحظة.');
      } else {
        setActionError('تعذر حفظ الإجابة. تحقق من الاتصال.');
      }
    },
  });

  if (questionQuery.isLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center p-4">
        <p className="text-center text-sm text-slate-500">جارٍ تحميل السؤال…</p>
      </main>
    );
  }

  if (questionQuery.isError || !question) {
    const e = questionQuery.error;
    if (e instanceof HttpError && e.status === 409) {
      // المحاولة انتهت (وقت/إنهاء جلسة)
      onFinished(attempt.attemptId);
      return null;
    }
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center p-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p role="alert" className="mb-3 text-sm text-rose-700">تعذر تحميل السؤال.</p>
          <Button variant="secondary" onClick={() => void questionQuery.refetch()}>
            إعادة المحاولة
          </Button>
        </div>
      </main>
    );
  }

  const isLast = question.index >= question.totalQuestions - 1;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col p-4">
      {/* شريط الحالة */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">
          سؤال {question.index + 1} من {question.totalQuestions}
        </p>
        {remaining != null ? (
          <p
            role="timer"
            dir="ltr"
            className={`rounded-md px-2 py-1 font-mono text-sm font-bold ${
              remaining <= 30 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
            }`}>
            {formatRemaining(remaining)}
          </p>
        ) : null}
      </header>

      {/* شريط التقدم */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-sky-600 transition-all"
          style={{ width: `${((question.index + 1) / question.totalQuestions) * 100}%` }}
        />
      </div>

      <section className="flex flex-1 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-base font-semibold leading-relaxed text-slate-900">{question.prompt}</h1>
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {question.points} نقطة
          </span>
        </div>

        {question.mediaAssetId ? (
          <QuestionMedia
            joinCode={joinCode}
            attemptId={attempt.attemptId}
            mediaId={question.mediaAssetId}
            questionType={question.questionType}
          />
        ) : null}

        <AnswerEditor
          key={question.quizVersionItemId}
          question={question}
          disabled={answerMutation.isPending || question.alreadyAnswered}
          onSubmit={(answerJson) =>
            answerMutation.mutate({ quizVersionItemId: question.quizVersionItemId, answerJson })
          }
        />

        {question.alreadyAnswered ? (
          <p className="rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-500">
            تم تسجيل إجابتك لهذا السؤال مسبقًا.
          </p>
        ) : null}

        {lastFeedback ? (
          <p
            role="status"
            className={`rounded-lg p-2 text-center text-sm font-medium ${
              lastFeedback.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
            {lastFeedback.isCorrect
              ? `إجابة صحيحة ✓ (+${lastFeedback.scoreAwarded})`
              : 'إجابة غير صحيحة'}
          </p>
        ) : null}

        {actionError ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p>
        ) : null}
      </section>

      <footer className="mt-4 flex gap-2">
        {isLast ? (
          <Button
            onClick={() => finishMutation.mutate()}
            disabled={finishMutation.isPending}
            >
            {finishMutation.isPending ? <ButtonSpinner /> : null}
            إنهاء الاختبار
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setQuestionIndex((i) => i + 1)}
            disabled={answerMutation.isPending}>
            السؤال التالي ←
          </Button>
        )}
      </footer>
    </main>
  );
}

// ─── وسائط السؤال ───────────────────────────────────────────────────────────

function QuestionMedia({
  joinCode,
  attemptId,
  mediaId,
  questionType,
}: {
  joinCode: string;
  attemptId: string;
  mediaId: string;
  questionType: PlayerQuestion['questionType'];
}) {
  const url = playerApi.mediaUrl(joinCode, attemptId, mediaId);
  if (questionType === 'Listening') {
    return (
      <audio controls preload="none" src={url} className="w-full" data-testid="question-media-audio">
        المتصفح لا يدعم تشغيل الصوت.
      </audio>
    );
  }
  return (
    <img
      src={url}
      alt="وسيط مرفق بالسؤال"
      loading="lazy"
      className="max-h-64 w-full rounded-lg object-contain"
      data-testid="question-media-image"
    />
  );
}

// ─── محرر الإجابة حسب النوع ─────────────────────────────────────────────────

function AnswerEditor({
  question,
  disabled,
  onSubmit,
}: {
  question: PlayerQuestion;
  disabled: boolean;
  onSubmit: (answerJson: string) => void;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [ordered, setOrdered] = useState<string[]>(() => question.options.map((o) => o.optionId));

  const type = question.questionType;

  if (type === 'MultipleChoice' || type === 'TrueFalse' || type === 'Listening') {
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">اختر إجابة</legend>
        {question.options.map((opt) => (
          <label
            key={opt.optionId}
            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${
              selectedOption === opt.optionId
                ? 'border-sky-500 bg-sky-50 text-sky-900'
                : 'border-slate-300 bg-white text-slate-800'
            } ${disabled ? 'opacity-60' : ''}`}>
            <input
              type="radio"
              name={`q-${question.quizVersionItemId}`}
              value={opt.optionId}
              checked={selectedOption === opt.optionId}
              disabled={disabled}
              onChange={() => setSelectedOption(opt.optionId)}
              className="h-5 w-5 accent-sky-600"
            />
            <span>{opt.optionText}</span>
          </label>
        ))}
        <Button
          type="button"
          disabled={disabled || !selectedOption}
          onClick={() => onSubmit(JSON.stringify({ optionId: selectedOption }))}>
          تثبيت الإجابة
        </Button>
      </fieldset>
    );
  }

  if (type === 'ShortAnswer') {
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 2) {
            onSubmit(JSON.stringify({ text: text.trim() }));
          }
        }}>
        <TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          minLength={2}
          maxLength={4000}
          rows={3}
          disabled={disabled}
          placeholder="اكتب إجابتك هنا"
          aria-label="إجابتك"
        />
        <Button type="submit" disabled={disabled || text.trim().length < 2}>
          تثبيت الإجابة
        </Button>
      </form>
    );
  }

  // Ordering — أزرار أعلى/أسفل (مناسبة للمس بدل السحب والإفلات)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500">رتّب العناصر بالترتيب الصحيح:</p>
      <ol className="flex flex-col gap-2">
        {ordered.map((optionId, idx) => {
          const opt = question.options.find((o) => o.optionId === optionId);
          return (
            <li
              key={optionId}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white p-2">
              <span className="w-6 text-center font-mono text-sm font-bold text-slate-500">
                {idx + 1}
              </span>
              <span className="flex-1 text-sm text-slate-800">{opt?.optionText ?? optionId}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label={`أنقل "${opt?.optionText ?? ''}" للأعلى`}
                  disabled={disabled || idx === 0}
                  onClick={() =>
                    setOrdered((prev) => {
                      const next = [...prev];
                      const a = next[idx - 1];
                      const b = next[idx];
                      if (a !== undefined && b !== undefined) {
                        next[idx - 1] = b;
                        next[idx] = a;
                      }
                      return next;
                    })
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`أنقل "${opt?.optionText ?? ''}" للأسفل`}
                  disabled={disabled || idx === ordered.length - 1}
                  onClick={() =>
                    setOrdered((prev) => {
                      const next = [...prev];
                      const a = next[idx];
                      const b = next[idx + 1];
                      if (a !== undefined && b !== undefined) {
                        next[idx] = b;
                        next[idx + 1] = a;
                      }
                      return next;
                    })
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        disabled={disabled}
        onClick={() => onSubmit(JSON.stringify({ orderedOptionIds: ordered }))}>
        تثبيت الترتيب
      </Button>
    </div>
  );
}

// ─── شاشة النتيجة ───────────────────────────────────────────────────────────

function ResultView({ joinCode, attemptId }: { joinCode: string; attemptId: string }) {
  const resultQuery = useQuery({
    queryKey: ['player-result', joinCode, attemptId],
    queryFn: ({ signal }) => playerApi.getResult(joinCode, attemptId, signal),
    retry: false,
  });

  if (resultQuery.isLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center p-4">
        <p className="text-center text-sm text-slate-500">جارٍ تحميل النتيجة…</p>
      </main>
    );
  }

  if (resultQuery.isError || !resultQuery.data) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center p-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p role="alert" className="mb-3 text-sm text-rose-700">
            تعذر تحميل النتيجة. قد تكون الجلسة أُلغيت.
          </p>
          <Button variant="secondary" onClick={() => void resultQuery.refetch()}>
            إعادة المحاولة
          </Button>
        </div>
      </main>
    );
  }

  const result: AttemptResult = resultQuery.data;
  const finished = result.status === 'Finished' || result.status === 'TimedOut';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 p-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="mb-1 text-xl font-bold text-slate-900">
          {finished ? 'انتهى الاختبار 🎉' : 'محاولتك قيد التنفيذ'}
        </h1>
        <p className="mb-4 text-sm text-slate-600">{result.displayName}</p>

        {finished && result.score != null && result.maxScore != null ? (
          <>
            <p dir="ltr" className="mb-1 text-4xl font-bold text-slate-900">
              {result.score} / {result.maxScore}
            </p>
            {result.percentage != null ? (
              <p dir="ltr" className="mb-3 text-lg text-slate-600">{Math.round(result.percentage)}%</p>
            ) : null}
            {result.passed != null ? (
              <p
                className={`mb-4 inline-block rounded-full px-4 py-1 text-sm font-bold ${
                  result.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                {result.passed ? 'ناجح ✓' : 'لم تتجاوز درجة النجاح'}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mb-4 text-sm text-slate-500">
            أجبت على {result.answeredCount} من {result.totalQuestions} سؤالًا.
          </p>
        )}

        <dl className="mx-auto flex max-w-xs flex-col gap-1 text-start text-xs text-slate-500">
          <div className="flex justify-between">
            <dt>الأسئلة المجابة:</dt>
            <dd dir="ltr">
              {result.answeredCount} / {result.totalQuestions}
            </dd>
          </div>
          {result.durationMs != null ? (
            <div className="flex justify-between">
              <dt>المدة:</dt>
              <dd dir="ltr">{Math.round(result.durationMs / 1000)} ثانية</dd>
            </div>
          ) : null}
          {result.status === 'TimedOut' ? (
            <div className="flex justify-between">
              <dt>الحالة:</dt>
              <dd>انتهت المهلة الزمنية</dd>
            </div>
          ) : null}
        </dl>
      </div>
      {finished && result.passed != null ? (
        <PlayerDeliveryPanel joinCode={joinCode} attemptId={attemptId} passed={result.passed} />
      ) : null}
      {finished ? <PlayerSurveyPanel joinCode={joinCode} attemptId={attemptId} /> : null}
    </main>
  );
}
