import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { ButtonSpinner } from '../../components/ui/spinner';
import { TextInput, TextArea } from '../../components/ui/form-field';
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
import { QUESTION_TYPE_LABELS } from '../../types/questions';
import { PlayerSurveyAction, PlayerSurveyPanel } from './player-survey-panel';
import { PlayerDeliveryPanel } from './player-delivery-panel';
import { StudentAudioPlayer } from './student-audio-player';
import { QuestionProgress, StudentButton, StudentError, StudentLearningVisual, StudentLoading, StudentShell } from './student-ui';

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
  | { kind: 'playing'; attempt: StartAttemptResponse; session: PlayerSession }
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

function sessionTimeLabel(session: PlayerSession): string {
  if (session.timeMode === 'None' || !session.timeLimitSeconds) return 'بدون مؤقت';
  const seconds = session.timeMode === 'TotalTime'
    ? session.timeLimitSeconds
    : session.timeLimitSeconds * session.questionCount;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `حوالي ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
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
      const session = sessionQuery.data;
      if (session.status === 'Active' && session.canJoin) {
        setStage({ kind: 'join', session });
        // الاستعادة بعد F5 من السيرفر عبر الكوكي فقط — بدون حفظ الاسم في localStorage
        restoreMutation.mutate();
      } else if (session.status === 'Scheduled') {
        setStage({ kind: 'unavailable', message: 'الجلسة لم تُفعَّل بعد. انتظر المعلم.' });
      } else if (session.status === 'Finished') {
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
  function applyPlayerState(joinCode: string, playerState: JoinSessionResponse, session: PlayerSession) {
    if (playerState.attemptId && playerState.attemptStatus === 'InProgress') {
      // استئناف محاولة قائمة (F5 / إعادة فتح)
      if (session.mode === 'Live') {
        setStage({ kind: 'live', session, displayName: playerState.displayName, attemptId: playerState.attemptId });
      } else {
        startMutation.mutate();
      }
    } else if (playerState.attemptId && (playerState.attemptStatus === 'Finished' || playerState.attemptStatus === 'TimedOut')) {
      // محاولة منتهية — نعرض النتيجة مباشرة دون شاشة استعداد
      void queryClient.invalidateQueries({ queryKey: ['player-result', joinCode, playerState.attemptId] });
      setStage({ kind: 'result', attemptId: playerState.attemptId });
    } else if (session.status === 'Active' && session.mode === 'Live') {
      setStage({ kind: 'live', session, displayName: playerState.displayName, attemptId: playerState.attemptId });
    } else {
      setStage((prev) =>
        prev.kind === 'join' || prev.kind === 'ready'
          ? { kind: 'ready', session: prev.session, displayName: playerState.displayName, attemptId: playerState.attemptId }
          : prev,
      );
    }
  }

  // استعادة تلقائية بعد إعادة تحميل الصفحة: السيرفر يقرّر الوجهة من الكوكي فقط
  const restoreMutation = useMutation({
    mutationFn: () => playerApi.getCurrentPlayer(joinCode!),
    onSuccess: (playerState) => {
      setActionError(null);
      applyPlayerState(joinCode!, playerState, sessionQuery.data!);
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
    onSuccess: (playerState) => {
      setActionError(null);
      applyPlayerState(joinCode!, playerState, sessionQuery.data!);
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
      setStage({ kind: 'playing', attempt, session: sessionQuery.data! });
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
    return <StudentLoading message="جارٍ تجهيز الاختبار…" />;
  }

  if (stage.kind === 'unavailable') {
    return <StudentError title="الاختبار غير متاح الآن" message={stage.message} />;
  }

  if (stage.kind === 'join') {
    const { session } = stage;
    return (
      <StudentShell centered width="wide">
        <section className="student-panel student-enter mx-auto w-full max-w-3xl overflow-hidden md:grid md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative flex flex-col items-center justify-center overflow-hidden bg-[var(--student-orange-soft)] px-6 py-8 text-center sm:px-8 md:py-10">
            <span aria-hidden="true" className="absolute right-8 top-8 h-2.5 w-2.5 rounded-full bg-[var(--student-orange)]" />
            <span aria-hidden="true" className="absolute bottom-12 left-10 h-3 w-3 rotate-45 rounded-sm bg-[var(--student-violet)] opacity-75" />
            <div className="mb-4"><StudentLearningVisual /></div>
            <h2 dir="auto" className="rounded-full bg-white px-4 py-2 text-sm font-black text-[var(--student-ink)] shadow-[0_1px_4px_rgb(15_23_42/0.08)]">{session.title}</h2>
            <h1 className="mt-5 text-balance text-3xl font-black leading-tight text-[var(--student-ink)] sm:text-4xl">جاهز للتحدي؟</h1>
            {session.description ? <p className="mx-auto mt-3 max-w-sm text-pretty text-sm font-semibold leading-7 text-amber-950/75">{session.description}</p> : null}
          </div>

          <div className="p-6 sm:p-8">
            <dl className="flex items-stretch justify-center divide-x divide-x-reverse divide-slate-200 rounded-xl bg-slate-50 py-4 text-center">
              <div className="min-w-0 flex-1 px-3"><dt className="text-xs font-semibold text-[var(--student-muted)]">الأسئلة</dt><dd className="mt-1 text-lg font-black text-emerald-800">{session.questionCount}</dd></div>
              <div className="min-w-0 flex-1 px-3"><dt className="text-xs font-semibold text-[var(--student-muted)]">الوقت</dt><dd className="mt-1 text-sm font-black text-[var(--student-violet)]">{sessionTimeLabel(session)}</dd></div>
              <div className="min-w-0 flex-1 px-3"><dt className="text-xs font-semibold text-[var(--student-muted)]">النجاح</dt><dd dir="ltr" className="mt-1 text-lg font-black text-amber-700">{session.passingPercentage}%</dd></div>
            </dl>

            {session.instructions ? <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-950">{session.instructions}</p> : null}
            <form onSubmit={onJoinSubmit} className="mt-6 flex flex-col gap-3">
              <label htmlFor="display-name" className="text-base font-black">ما اسمك؟</label>
              <TextInput
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                minLength={2}
                maxLength={50}
                required
                autoComplete="name"
                placeholder="اكتب اسمك هنا"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'display-name-error' : undefined}
                className="min-h-14 rounded-xl px-4 text-base placeholder:text-slate-600 focus:border-emerald-700 focus:outline-emerald-700"
              />
              {nameError ? <p id="display-name-error" role="alert" className="text-sm text-rose-700">{nameError}</p> : null}
              {actionError ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}
              <StudentButton type="submit" disabled={joinMutation.isPending} className="mt-2 w-full text-base">
                {joinMutation.isPending ? <ButtonSpinner /> : null}
                {joinMutation.isPending ? 'جارٍ تجهيز دخولك…' : 'ابدأ الاختبار'}
                {!joinMutation.isPending ? <span aria-hidden="true" className="mr-2">←</span> : null}
              </StudentButton>
            </form>
          </div>
        </section>
      </StudentShell>
    );
  }

  if (stage.kind === 'ready') {
    return (
      <StudentShell centered width="wide">
        <section className="student-panel student-enter mx-auto w-full max-w-3xl overflow-hidden p-6 text-center sm:p-10">
          <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8 sm:text-right">
            <div className="relative shrink-0">
              <span aria-hidden="true" className="absolute -right-2 top-3 h-2.5 w-2.5 rounded-full bg-[var(--student-orange)]" />
              <span aria-hidden="true" className="absolute -left-2 bottom-4 h-3 w-3 rotate-45 rounded-sm bg-[var(--student-violet)] opacity-70" />
              <StudentLearningVisual />
              <span aria-hidden="true" className="absolute -bottom-1 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-lg font-black text-white shadow-[0_2px_8px_rgb(5_150_105/0.2)]">✓</span>
            </div>
            <div>
              <p className="text-sm font-black text-[var(--student-violet)]">كل شيء جاهز</p>
              <h1 className="mt-2 text-balance text-3xl font-black text-[var(--student-ink)] sm:text-4xl">أنت جاهز، <bdi>{stage.displayName}</bdi>!</h1>
              <p dir="auto" className="mt-3 text-lg font-black text-slate-700">{stage.session.title}</p>
            </div>
          </div>

          <dl className="mx-auto mt-7 flex max-w-xl items-stretch justify-center divide-x divide-x-reverse divide-slate-200 rounded-xl bg-slate-50 py-5 text-center">
            <div className="min-w-0 flex-1 px-3"><dt className="text-xs text-[var(--student-muted)]">الأسئلة</dt><dd className="mt-1 font-black text-emerald-800">{stage.session.questionCount}</dd></div>
            <div className="min-w-0 flex-1 px-3"><dt className="text-xs text-[var(--student-muted)]">الوقت</dt><dd className="mt-1 font-black text-[var(--student-violet)]">{sessionTimeLabel(stage.session)}</dd></div>
            <div className="min-w-0 flex-1 px-3"><dt className="text-xs text-[var(--student-muted)]">النجاح</dt><dd dir="ltr" className="mt-1 font-black text-amber-700">{stage.session.passingPercentage}%</dd></div>
          </dl>

          <p className="mx-auto mt-5 max-w-xl rounded-xl bg-[var(--student-violet-soft)] p-4 text-sm font-semibold leading-7 text-violet-950">
            {stage.attemptId ? 'سنُعيدك إلى آخر سؤال وصلت إليه.' : 'اقرأ كل سؤال بهدوء، وثبّت إجابتك قبل الانتقال.'}
          </p>
          {actionError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}
          <StudentButton onClick={() => startMutation.mutate()} disabled={startMutation.isPending} className="mt-6 w-full text-base sm:w-72">
            {startMutation.isPending ? <ButtonSpinner /> : null}
            {startMutation.isPending ? 'جارٍ البدء…' : stage.attemptId ? 'استئناف المحاولة' : 'ابدأ الآن'}
            {!startMutation.isPending ? <span aria-hidden="true" className="mr-2">←</span> : null}
          </StudentButton>
        </section>
      </StudentShell>
    );
  }

  if (stage.kind === 'playing') {
    return (
      <PlayingView
        joinCode={joinCode!}
        attempt={stage.attempt}
        quizTitle={stage.session.title}
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
                {question.mediaAssetId ? <QuestionMedia joinCode={joinCode} attemptId={attemptId!} mediaId={question.mediaAssetId} questionType={question.questionType} presentation="live" /> : null}
                <div className="mt-4">
                  <AnswerEditor
                    key={question.quizVersionItemId}
                    question={question}
                    answerState={answerMutation.isPending ? 'saving' : isAnswered ? 'saved' : 'editing'}
                    presentation="live"
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
  quizTitle,
  clockSync,
  clockNow,
  onFinished,
}: {
  joinCode: string;
  attempt: StartAttemptResponse;
  quizTitle: string;
  clockSync: (serverNow: string) => void;
  clockNow: () => Date;
  onFinished: (attemptId: string) => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(attempt.currentQuestionIndex);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; scoreAwarded: number } | null>(null);
  const [answeredQuestionId, setAnsweredQuestionId] = useState<string | null>(null);
  const [skipConfirmation, setSkipConfirmation] = useState<'next' | 'finish' | null>(null);

  const questionQuery = useQuery({
    queryKey: ['player-question', joinCode, attempt.attemptId, questionIndex],
    queryFn: ({ signal }) => playerApi.getCurrentQuestion(joinCode, attempt.attemptId, signal),
    staleTime: 0,
  });

  useEffect(() => {
    if (questionQuery.data) {
      clockSync(questionQuery.data.serverNow);
      setLastFeedback(null);
      setAnsweredQuestionId(questionQuery.data.alreadyAnswered ? questionQuery.data.quizVersionItemId : null);
      setSkipConfirmation(null);
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
    onSuccess: (savedAnswer) => {
      clockSync(savedAnswer.serverNow);
      setAnsweredQuestionId(savedAnswer.quizVersionItemId);
      if (savedAnswer.isCorrect != null && savedAnswer.scoreAwarded != null) {
        setLastFeedback({ isCorrect: savedAnswer.isCorrect, scoreAwarded: savedAnswer.scoreAwarded });
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
    return <StudentLoading message="جارٍ تحميل السؤال…" />;
  }

  if (questionQuery.isError || !question) {
    const e = questionQuery.error;
    if (e instanceof HttpError && e.status === 409) {
      // المحاولة انتهت (وقت/إنهاء جلسة)
      onFinished(attempt.attemptId);
      return null;
    }
    return (
      <StudentError
        title="تعذر تحميل السؤال"
        message="تحقق من اتصالك ثم حاول مرة أخرى. إجاباتك السابقة محفوظة."
        action={<StudentButton variant="secondary" onClick={() => void questionQuery.refetch()}>إعادة المحاولة</StudentButton>}
      />
    );
  }

  const isLast = question.index >= question.totalQuestions - 1;
  const currentQuestionAnswered = question.alreadyAnswered
    || answeredQuestionId === question.quizVersionItemId;

  function continueFromCurrentQuestion() {
    setSkipConfirmation(null);
    if (isLast) {
      finishMutation.mutate();
    } else {
      setQuestionIndex((index) => index + 1);
    }
  }

  function requestQuestionProgress() {
    if (currentQuestionAnswered) {
      continueFromCurrentQuestion();
      return;
    }

    setSkipConfirmation(isLast ? 'finish' : 'next');
  }

  return (
    <StudentShell width="wide">
      <div className="student-enter flex flex-1 flex-col">
        <header className="mb-4 flex items-start justify-between gap-4 pt-2 sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-black text-[var(--student-violet)]">اختبارك الآن</p>
            <h1 dir="auto" className="mt-1 text-xl font-black text-[var(--student-ink)]">{quizTitle}</h1>
            <p className="mt-1 text-xs font-semibold text-[var(--student-muted)]">ثبّت إجابتك قبل الانتقال إلى السؤال التالي.</p>
          </div>
          {remaining != null ? (
            <p
              role="timer"
              dir="ltr"
              aria-label={`الوقت المتبقي ${formatRemaining(remaining)}`}
              className={`shrink-0 rounded-full px-3 py-2 font-mono text-sm font-black tabular-nums ${remaining <= 30 ? 'bg-rose-100 text-rose-800' : 'bg-white text-slate-800 shadow-[0_1px_4px_rgb(15_23_42/0.08)]'}`}>
              {formatRemaining(remaining)}
            </p>
          ) : null}
        </header>

        <QuestionProgress current={question.index + 1} total={question.totalQuestions} />

        <section className="student-panel mt-4 flex flex-col p-5 sm:p-9">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              {QUESTION_TYPE_LABELS[question.questionType]}
            </span>
            <span className="text-xs font-semibold text-[var(--student-muted)]">{question.points} نقطة</span>
          </div>

          <h2 dir="auto" className="mx-auto max-w-3xl text-pretty text-center text-2xl font-black leading-relaxed text-[var(--student-ink)] sm:text-3xl">
            {question.prompt}
          </h2>

          {question.mediaAssetId ? (
            <div className="mt-6">
              <QuestionMedia
                joinCode={joinCode}
                attemptId={attempt.attemptId}
                mediaId={question.mediaAssetId}
                questionType={question.questionType}
                presentation="student"
              />
            </div>
          ) : null}

          <div className="mx-auto mt-8 w-full max-w-3xl">
            <AnswerEditor
              key={question.quizVersionItemId}
              question={question}
              answerState={answerMutation.isPending ? 'saving' : currentQuestionAnswered ? 'saved' : 'editing'}
              presentation="student"
              onSubmit={(answerJson) => answerMutation.mutate({ quizVersionItemId: question.quizVersionItemId, answerJson })}
            />
          </div>

          <div aria-live="polite" className="mt-4 flex min-h-6 justify-center">
            {lastFeedback && !answerMutation.isPending ? (
              <p role="status" className={`rounded-xl p-3 text-center text-sm font-bold ${lastFeedback.isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
                {lastFeedback.isCorrect ? `إجابة صحيحة ✓ (+${lastFeedback.scoreAwarded})` : 'تم حفظ الإجابة — ليست صحيحة هذه المرة'}
              </p>
            ) : null}
          </div>

          {actionError ? <p role="alert" className="mx-auto mt-3 w-full max-w-3xl rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}
        </section>

        <footer className="sticky bottom-0 z-20 mt-3 bg-[var(--student-bg)] py-3">
          <div className="flex justify-start">
            {isLast ? (
              <StudentButton variant={currentQuestionAnswered ? 'primary' : 'secondary'} onClick={requestQuestionProgress} disabled={answerMutation.isPending || finishMutation.isPending} className="w-full text-base sm:w-64">
                {finishMutation.isPending ? <ButtonSpinner /> : null}إنهاء الاختبار
              </StudentButton>
            ) : (
              <StudentButton variant={currentQuestionAnswered ? 'primary' : 'secondary'} onClick={requestQuestionProgress} disabled={answerMutation.isPending} className="w-full text-base sm:w-64">
                السؤال التالي ←
              </StudentButton>
            )}
          </div>
        </footer>

      </div>
      {skipConfirmation ? (
        <SkipConfirmationDialog
          isFinish={skipConfirmation === 'finish'}
          onStay={() => setSkipConfirmation(null)}
          onSkip={continueFromCurrentQuestion}
        />
      ) : null}
    </StudentShell>
  );
}

function SkipConfirmationDialog({ isFinish, onStay, onSkip }: { isFinish: boolean; onStay: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4">
      <section role="alertdialog" aria-modal="true" aria-labelledby="skip-question-title" aria-describedby="skip-question-description" className="student-panel w-full rounded-b-none p-6 sm:max-w-md sm:rounded-2xl">
        <div aria-hidden="true" className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-xl font-black text-amber-900">!</div>
        <h2 id="skip-question-title" className="text-lg font-black text-[var(--student-ink)]">لم تجب عن هذا السؤال بعد</h2>
        <p id="skip-question-description" className="mt-2 text-sm leading-7 text-[var(--student-muted)]">يمكنك البقاء والإجابة، أو تجاوز السؤال عمدًا وسيبقى بلا إجابة.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <StudentButton autoFocus onClick={onStay}>ابقَ وأجب</StudentButton>
          <StudentButton variant="secondary" onClick={onSkip}>{isFinish ? 'تجاوز وإنهاء الاختبار' : 'تجاوز هذا السؤال'}</StudentButton>
        </div>
      </section>
    </div>
  );
}

// ─── وسائط السؤال ───────────────────────────────────────────────────────────

function QuestionMedia({
  joinCode,
  attemptId,
  mediaId,
  questionType,
  presentation,
}: {
  joinCode: string;
  attemptId: string;
  mediaId: string;
  questionType: PlayerQuestion['questionType'];
  presentation: 'student' | 'live';
}) {
  const url = playerApi.mediaUrl(joinCode, attemptId, mediaId);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  if (questionType === 'Listening') {
    if (presentation === 'student') return <StudentAudioPlayer src={url} />;
    return (
      <div>
        <audio controls preload="metadata" src={url} onError={() => setPlaybackFailed(true)} className="w-full" data-testid="question-media-audio">
          المتصفح لا يدعم تشغيل الصوت.
        </audio>
        {playbackFailed ? <p role="alert" className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">تعذر تشغيل الصوت. أعد تحميل الصفحة، وإن استمرت المشكلة فأبلغ المعلم.</p> : null}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="وسيط مرفق بالسؤال"
      loading="lazy"
      className={presentation === 'student' ? 'max-h-80 w-full rounded-xl bg-slate-50 object-contain' : 'max-h-64 w-full rounded-lg object-contain'}
      data-testid="question-media-image"
    />
  );
}

// ─── محرر الإجابة حسب النوع ─────────────────────────────────────────────────

type AnswerState = 'editing' | 'saving' | 'saved';

function StudentSaveControl({
  answerState,
  label,
  disabled,
  type,
  onClick,
}: {
  answerState: AnswerState;
  label: string;
  disabled: boolean;
  type: 'button' | 'submit';
  onClick?: () => void;
}) {
  if (answerState === 'saved') {
    return <p role="status" className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800 sm:w-48 sm:self-start">تم حفظ إجابتك ✓</p>;
  }

  const isSaving = answerState === 'saving';
  return (
    <StudentButton type={type} disabled={disabled || isSaving} onClick={onClick} className="mt-2 w-full sm:w-48 sm:self-start">
      {isSaving ? <ButtonSpinner /> : null}
      {isSaving ? 'جارٍ الحفظ…' : label}
    </StudentButton>
  );
}

function AnswerEditor({
  question,
  answerState,
  presentation,
  onSubmit,
}: {
  question: PlayerQuestion;
  answerState: AnswerState;
  presentation: 'student' | 'live';
  onSubmit: (answerJson: string) => void;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [ordered, setOrdered] = useState<string[]>(() => question.options.map((o) => o.optionId));

  const type = question.questionType;
  const isStudent = presentation === 'student';
  const disabled = answerState !== 'editing';

  if (type === 'MultipleChoice' || type === 'TrueFalse' || type === 'Listening') {
    return (
      <fieldset className={`flex flex-col ${isStudent ? 'gap-3' : 'gap-2'}`}>
        <legend className="sr-only">اختر إجابة</legend>
        {question.options.map((opt, index) => {
          const optionDirection = /[\u0600-\u06ff]/.test(opt.optionText) ? 'rtl' : 'ltr';
          return (
            <label
              key={opt.optionId}
              dir={isStudent ? optionDirection : undefined}
              className={`flex cursor-pointer items-center gap-3 border transition-[background-color,border-color,color,transform] duration-200 focus-within:outline-2 focus-within:outline-offset-2 ${
                isStudent ? 'min-h-16 rounded-xl p-4 text-base focus-within:outline-emerald-700' : 'min-h-11 rounded-lg p-3 text-sm focus-within:outline-sky-600'
              } ${selectedOption === opt.optionId
                ? isStudent ? 'border-emerald-700 bg-emerald-50 text-emerald-950 shadow-[0_2px_8px_rgb(5_150_105/0.16)]' : 'border-sky-500 bg-sky-50 text-sky-900'
                : 'border-slate-300 bg-white text-slate-800 hover:border-emerald-500'
              } ${disabled ? 'cursor-default opacity-60' : 'active:translate-y-px'}`}>
              <input
                type="radio"
                name={`q-${question.quizVersionItemId}`}
                value={opt.optionId}
                checked={selectedOption === opt.optionId}
                disabled={disabled}
                onChange={() => setSelectedOption(opt.optionId)}
                className={isStudent ? 'sr-only' : 'h-5 w-5 accent-sky-600'}
              />
              {isStudent ? (
                <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black ${selectedOption === opt.optionId ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-slate-50 text-slate-600'}`}>
                  {String.fromCharCode(65 + index)}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 text-start font-semibold">{opt.optionText}</span>
              {isStudent && selectedOption === opt.optionId ? <span aria-hidden="true" className="text-lg font-black text-emerald-700">✓</span> : null}
            </label>
          );
        })}
        {isStudent ? (
          <StudentSaveControl
            answerState={answerState}
            label="تثبيت الإجابة"
            disabled={!selectedOption}
            type="button"
            onClick={() => onSubmit(JSON.stringify({ optionId: selectedOption }))}
          />
        ) : (
          <Button type="button" disabled={disabled || !selectedOption} onClick={() => onSubmit(JSON.stringify({ optionId: selectedOption }))}>تثبيت الإجابة</Button>
        )}
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
          className={isStudent ? 'min-h-36 rounded-xl p-4 text-base leading-7 placeholder:text-slate-500 focus:border-emerald-700 focus:outline-emerald-700' : ''}
        />
        {isStudent ? <StudentSaveControl answerState={answerState} label="تثبيت الإجابة" disabled={text.trim().length < 2} type="submit" /> : <Button type="submit" disabled={disabled || text.trim().length < 2}>تثبيت الإجابة</Button>}
      </form>
    );
  }

  // Ordering — أزرار أعلى/أسفل (مناسبة للمس بدل السحب والإفلات)
  return (
    <div className={`flex flex-col ${isStudent ? 'gap-3' : 'gap-2'}`}>
      <p className={isStudent ? 'text-sm font-semibold text-slate-700' : 'text-xs text-slate-500'}>رتّب العناصر بالترتيب الصحيح:</p>
      <ol className={`flex flex-col ${isStudent ? 'gap-3' : 'gap-2'}`}>
        {ordered.map((optionId, idx) => {
          const opt = question.options.find((o) => o.optionId === optionId);
          return (
            <li
              key={optionId}
              className={`flex items-center gap-2 border border-slate-300 bg-white ${isStudent ? 'min-h-16 rounded-xl p-3' : 'min-h-11 rounded-lg p-2'}`}>
              <span className={`text-center font-mono text-sm font-bold ${isStudent ? 'flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700' : 'w-6 text-slate-500'}`}>
                {idx + 1}
              </span>
              <span dir="auto" className={`flex-1 text-slate-800 ${isStudent ? 'text-base font-semibold' : 'text-sm'}`}>{opt?.optionText ?? optionId}</span>
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
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-40">
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
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-40">
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {isStudent ? (
        <StudentSaveControl answerState={answerState} label="تثبيت الترتيب" disabled={false} type="button" onClick={() => onSubmit(JSON.stringify({ orderedOptionIds: ordered }))} />
      ) : (
        <Button type="button" disabled={disabled} onClick={() => onSubmit(JSON.stringify({ orderedOptionIds: ordered }))}>تثبيت الترتيب</Button>
      )}
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
    return <StudentLoading message="جارٍ تجهيز نتيجتك…" />;
  }

  if (resultQuery.isError || !resultQuery.data) {
    return (
      <StudentError
        title="تعذر عرض النتيجة"
        message="لم نتمكن من تحميل نتيجتك الآن. حاول مرة أخرى."
        action={<StudentButton variant="secondary" onClick={() => void resultQuery.refetch()}>إعادة المحاولة</StudentButton>}
      />
    );
  }

  const attemptResult: AttemptResult = resultQuery.data;
  const finished = attemptResult.status === 'Finished' || attemptResult.status === 'TimedOut';
  const scorePercentage = attemptResult.percentage == null
    ? null
    : Math.min(100, Math.max(0, Math.round(attemptResult.percentage)));

  return (
    <StudentShell width="wide">
      <div className="student-enter mx-auto flex w-full max-w-3xl flex-col gap-5 pt-4 sm:pt-8">
        <section className="student-panel overflow-hidden">
          <div className={`relative px-6 py-8 sm:px-10 sm:py-10 ${attemptResult.passed ? 'bg-[var(--student-orange-soft)]' : 'bg-amber-50'}`}>
            {attemptResult.passed ? (
              <>
                <span aria-hidden="true" className="absolute right-10 top-10 h-2.5 w-2.5 rounded-full bg-[var(--student-violet)] opacity-75" />
                <span aria-hidden="true" className="absolute bottom-10 left-12 h-3 w-3 rotate-45 rounded-sm bg-[var(--student-orange)]" />
              </>
            ) : null}

            <div className="relative flex flex-col items-center gap-7 text-center sm:flex-row sm:text-right">
              {attemptResult.passed ? (
                <div aria-hidden="true" className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-amber-400 text-5xl font-black text-amber-950 shadow-[0_2px_8px_rgb(180_83_9/0.18)]">★</div>
              ) : null}

              <div className="min-w-0 flex-1">
                <p className={`text-sm font-black ${attemptResult.passed ? 'text-emerald-800' : 'text-amber-900'}`}>
                  {finished ? 'النتيجة' : 'محاولتك قيد التنفيذ'}
                </p>
                <h1 className="mt-2 text-balance text-3xl font-black text-[var(--student-ink)] sm:text-4xl">
                  {attemptResult.passed ? <>أحسنت يا <bdi>{attemptResult.displayName}</bdi>!</> : <bdi>{attemptResult.displayName}</bdi>}
                </h1>
                {attemptResult.passed != null ? (
                  <p className={`mt-3 text-base font-bold leading-7 ${attemptResult.passed ? 'text-emerald-900' : 'text-slate-700'}`}>
                    {attemptResult.passed ? 'اجتزت الاختبار بنجاح' : 'لم تصل إلى درجة النجاح هذه المرة'}
                  </p>
                ) : null}
              </div>

              {finished && scorePercentage != null && attemptResult.score != null && attemptResult.maxScore != null ? (
                <div
                  className="student-score-ring"
                  style={{
                    '--student-score': `${scorePercentage * 3.6}deg`,
                    '--student-score-color': attemptResult.passed ? 'var(--student-primary)' : 'var(--student-orange)',
                  } as React.CSSProperties}>
                  <div className="relative z-10 text-center">
                    <p dir="ltr" className="text-4xl font-black tracking-tight text-[var(--student-ink)]">{scorePercentage}%</p>
                    <p dir="ltr" className="mt-1 text-sm font-bold text-slate-700">{attemptResult.score} / {attemptResult.maxScore}</p>
                  </div>
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
        {finished && attemptResult.passed != null ? (
          <PlayerDeliveryPanel
            joinCode={joinCode}
            attemptId={attemptId}
            passed={attemptResult.passed}
            surveyAction={<PlayerSurveyAction joinCode={joinCode} attemptId={attemptId} />}
          />
        ) : null}
        {finished ? <PlayerSurveyPanel joinCode={joinCode} attemptId={attemptId} /> : null}
      </div>
    </StudentShell>
  );
}
