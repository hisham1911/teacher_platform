import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ButtonSpinner } from '../../components/ui/spinner';
import { TextInput } from '../../components/ui/form-field';
import { playerApi } from '../../data/api-client/endpoints';
import { studentPortalApi } from '../../data/api-client/student-portal-endpoints';
import { HttpError } from '../../data/api-client/http-error';
import type { JoinSessionResponse, PlayerSession } from '../../types/sessions';
import { normalizeStudentCode } from '../../types/students';
import { ProgressivePlayerView, ProgressiveResultView, ProgressiveShell } from './progressive-player';
import { LivePlayerView } from './live-player-view';
import { SelfPacedPlayerView } from './self-paced-player';
import { ResultView } from './player-result-view';
import type { PlayerStage } from './player-stage';
import { sessionTimeLabel, useServerClock } from './player-time';
import { StudentButton, StudentError, StudentLearningVisual, StudentLoading, StudentShell, StudentSparkBrand } from './student-ui';

/**
 * /play/:joinCode — bootstrap and identity boundary for the student player.
 * Guest resume remains server-backed through the HttpOnly cookie. Portal binding is tried only
 * after guest restore returns 401, and managed legacy student-code join remains a compatibility path.
 * Mode-specific attempt runtimes are delegated to dedicated views.
 */
export default function PlayPage() {
  const { joinCode } = useParams<{ joinCode: string }>();
  const queryClient = useQueryClient();
  const clock = useServerClock();
  const [stage, setStage] = useState<PlayerStage>({ kind: 'loading' });
  const [displayName, setDisplayName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [studentCode, setStudentCode] = useState('');
  const [studentCodeError, setStudentCodeError] = useState<string | null>(null);
  const [useStudentCode, setUseStudentCode] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [portalHint, setPortalHint] = useState<string | null>(null);

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
        restoreMutation.mutate();
      } else if (session.status === 'Scheduled') {
        setStage({ kind: 'unavailable', message: 'النشاط لم يبدأ بعد. انتظر إشارة المعلم.' });
      } else if (session.status === 'Finished') {
        setStage({ kind: 'unavailable', message: 'انتهى هذا النشاط.' });
        restoreMutation.mutate();
      } else {
        setStage({ kind: 'unavailable', message: 'هذا النشاط غير متاح الآن.' });
      }
    } else if (sessionQuery.isError && stage.kind === 'loading') {
      const error = sessionQuery.error;
      setStage({ kind: 'unavailable', message: error instanceof HttpError && error.status === 404 ? 'رمز الانضمام غير صحيح. تأكد من رمز النشاط.' : 'تعذر الاتصال. تحقق من الإنترنت ثم أعد تحميل الصفحة.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionQuery.isSuccess, sessionQuery.isError, sessionQuery.data, sessionQuery.error, stage.kind]);

  function applyPlayerState(currentJoinCode: string, playerState: JoinSessionResponse, session: PlayerSession) {
    if (playerState.attemptId && playerState.attemptStatus === 'InProgress') {
      if (session.mode === 'Live') setStage({ kind: 'live', session, displayName: playerState.displayName, attemptId: playerState.attemptId });
      else startMutation.mutate();
      return;
    }
    if (playerState.attemptId && (playerState.attemptStatus === 'Finished' || playerState.attemptStatus === 'TimedOut')) {
      void queryClient.invalidateQueries({ queryKey: ['player-result', currentJoinCode, playerState.attemptId] });
      setStage({ kind: 'result', attemptId: playerState.attemptId, session });
      return;
    }
    if (session.status === 'Active' && session.mode === 'Live') {
      setStage({ kind: 'live', session, displayName: playerState.displayName, attemptId: playerState.attemptId });
      return;
    }
    if (session.mode === 'ProgressiveChallenge') {
      setStage((previous) => previous.kind === 'join' || previous.kind === 'ready' || previous.kind === 'challenge-ready' ? { kind: 'challenge-ready', session: previous.session, displayName: playerState.displayName, attemptId: playerState.attemptId } : previous);
      return;
    }
    setStage((previous) => previous.kind === 'join' || previous.kind === 'ready' ? { kind: 'ready', session: previous.session, displayName: playerState.displayName, attemptId: playerState.attemptId } : previous);
  }

  const portalJoinMutation = useMutation({
    mutationFn: () => studentPortalApi.joinActivity(joinCode!),
    onSuccess: (playerState) => { setPortalHint(null); setActionError(null); applyPlayerState(joinCode!, playerState, sessionQuery.data!); },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 401) return;
      if (error instanceof HttpError && error.status === 404) { setPortalHint('هذا النشاط خارج مساحتك الحالية. يمكنك الانضمام إليه كضيف بالاسم.'); return; }
      if (error instanceof HttpError && error.status === 409) { setActionError('النشاط لم يعد يقبل منضمّين جددًا.'); return; }
      setActionError('تعذر ربط النشاط بمساحتك الآن. يمكنك المتابعة كضيف.');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => playerApi.getCurrentPlayer(joinCode!),
    onSuccess: (playerState) => { setActionError(null); applyPlayerState(joinCode!, playerState, sessionQuery.data!); },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 401) { portalJoinMutation.mutate(); return; }
      setActionError('تعذر استعادة دخولك. أدخل اسمك للانضمام من جديد.');
    },
  });

  const joinMutation = useMutation({
    mutationFn: (name: string) => playerApi.join(joinCode!, { displayName: name }),
    onSuccess: (playerState) => { setActionError(null); applyPlayerState(joinCode!, playerState, sessionQuery.data!); },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) setActionError('النشاط لم يعد يقبل منضمّين جددًا.');
      else if (error instanceof HttpError && error.status === 429) setActionError('محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.');
      else setActionError('تعذر الانضمام. أعد المحاولة.');
    },
  });

  const managedJoinMutation = useMutation({
    mutationFn: (code: string) => playerApi.joinWithStudentCode(joinCode!, code),
    onSuccess: (playerState) => { setActionError(null); setStudentCodeError(null); applyPlayerState(joinCode!, playerState, sessionQuery.data!); },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 404) setStudentCodeError('كود الطالب غير صحيح أو غير مفعّل.');
      else if (error instanceof HttpError && error.status === 409) setActionError('النشاط لم يعد يقبل منضمّين جددًا.');
      else if (error instanceof HttpError && error.status === 429) setActionError('محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.');
      else setActionError('تعذر الدخول بكود الطالب. أعد المحاولة.');
    },
  });

  const startMutation = useMutation({
    mutationFn: () => playerApi.startAttempt(joinCode!),
    onSuccess: (attempt) => {
      clock.sync(attempt.serverNow);
      setActionError(null);
      const session = sessionQuery.data!;
      if (session.mode === 'ProgressiveChallenge') setStage({ kind: 'challenge', attempt, session });
      else setStage({ kind: 'playing', attempt, session });
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) setActionError('لا يمكن بدء المحاولة الآن — ربما انتهى النشاط.');
      else setActionError('تعذر بدء المحاولة. أعد المحاولة.');
    },
  });

  function onJoinSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = displayName.trim();
    if (name.length < 2) { setNameError('الاسم قصير جدًا (حرفان على الأقل).'); return; }
    if (name.length > 50) { setNameError('الاسم طويل جدًا (50 حرفًا كحد أقصى).'); return; }
    setNameError(null); setActionError(null); joinMutation.mutate(name);
  }

  function onStudentCodeSubmit(event: React.FormEvent) {
    event.preventDefault();
    const code = normalizeStudentCode(studentCode);
    if (code.length < 6) { setStudentCodeError('اكتب كود الطالب كاملًا.'); return; }
    setStudentCodeError(null); setActionError(null); managedJoinMutation.mutate(code);
  }

  if (stage.kind === 'loading') return <StudentLoading message="جارٍ تجهيز النشاط…" />;
  if (stage.kind === 'unavailable') return <StudentError title="النشاط غير متاح الآن" message={stage.message} />;

  if (stage.kind === 'join') {
    const { session } = stage;
    return (
      <StudentShell centered width="wide">
        <section className="student-panel student-enter mx-auto w-full max-w-3xl overflow-hidden md:grid md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative flex flex-col items-center justify-center overflow-hidden bg-[var(--student-orange-soft)] px-6 py-8 text-center sm:px-8 md:py-10">
            <span aria-hidden="true" className="absolute right-8 top-8 h-2.5 w-2.5 rounded-full bg-[var(--student-orange)]" /><span aria-hidden="true" className="absolute bottom-12 left-10 h-3 w-3 rotate-45 rounded-sm bg-[var(--student-violet)] opacity-75" />
            <div className="mb-4"><StudentLearningVisual /></div><h2 dir="auto" className="rounded-full bg-white px-4 py-2 text-sm font-black text-[var(--student-ink)] shadow-[0_1px_4px_rgb(15_23_42/0.08)]">{session.title}</h2>
            <h1 className="mt-5 text-balance text-3xl font-black leading-tight text-[var(--student-ink)] sm:text-4xl">{session.mode === 'ProgressiveChallenge' ? 'جاهز تبدأ المهمة؟' : session.mode === 'Live' ? 'جاهز للمسابقة؟' : 'جاهز تبدأ؟'}</h1>
            {session.description ? <p className="mx-auto mt-3 max-w-sm text-pretty text-sm font-semibold leading-7 text-amber-950/75">{session.description}</p> : null}
          </div>
          <div className="p-6 sm:p-8">
            <dl className="flex items-stretch justify-center divide-x divide-x-reverse divide-slate-200 rounded-xl bg-slate-50 py-4 text-center"><div className="min-w-0 flex-1 px-3"><dt className="text-xs font-semibold text-[var(--student-muted)]">{session.mode === 'ProgressiveChallenge' ? 'المستويات' : 'الأسئلة'}</dt><dd className="mt-1 text-lg font-black text-emerald-800">{session.questionCount}</dd></div><div className="min-w-0 flex-1 px-3"><dt className="text-xs font-semibold text-[var(--student-muted)]">الوقت</dt><dd className="mt-1 text-sm font-black text-[var(--student-violet)]">{sessionTimeLabel(session)}</dd></div><div className="min-w-0 flex-1 px-3"><dt className="text-xs font-semibold text-[var(--student-muted)]">{session.mode === 'ProgressiveChallenge' ? 'النقاط' : 'النجاح'}</dt><dd dir="ltr" className="mt-1 text-lg font-black text-amber-700">{session.mode === 'ProgressiveChallenge' ? session.totalPoints : `${session.passingPercentage}%`}</dd></div></dl>
            {session.instructions ? <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-950">{session.instructions}</p> : null}
            {portalHint ? <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-900">{portalHint}</p> : null}
            {!useStudentCode ? <><button type="button" onClick={() => { setUseStudentCode(true); setActionError(null); }} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-violet-200 bg-violet-50 px-4 text-sm font-black text-violet-900 hover:border-violet-400 hover:bg-violet-100"><span aria-hidden="true">🎟️</span> لدي كود طالب</button><p className="mt-3 text-center text-xs font-semibold text-slate-500">أو ادخل بالاسم كضيف إذا لم يعطك المعلم كودًا.</p><form onSubmit={onJoinSubmit} className="mt-4 flex flex-col gap-3"><label htmlFor="display-name" className="text-base font-black">ما اسمك؟</label><TextInput id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={50} required autoComplete="name" placeholder="اكتب اسمك هنا" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'display-name-error' : undefined} className="min-h-14 rounded-xl px-4 text-base placeholder:text-slate-600 focus:border-emerald-700 focus:outline-emerald-700" />{nameError ? <p id="display-name-error" role="alert" className="text-sm text-rose-700">{nameError}</p> : null}{actionError ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}<StudentButton type="submit" disabled={joinMutation.isPending} className="mt-2 w-full text-base">{joinMutation.isPending ? <ButtonSpinner /> : null}{joinMutation.isPending ? 'جارٍ تجهيز دخولك…' : session.mode === 'ProgressiveChallenge' ? 'ادخل إلى المهمة' : 'ابدأ النشاط'}{!joinMutation.isPending ? <span aria-hidden="true" className="mr-2">←</span> : null}</StudentButton></form></> : <><button type="button" onClick={() => { setUseStudentCode(false); setStudentCodeError(null); setActionError(null); }} className="mt-6 inline-flex min-h-11 items-center text-sm font-black text-violet-700 hover:underline">الدخول بالاسم بدلًا من ذلك →</button><form onSubmit={onStudentCodeSubmit} className="mt-3 flex flex-col gap-3"><label htmlFor="student-code" className="text-base font-black">كود الطالب</label><TextInput id="student-code" dir="ltr" value={studentCode} onChange={(event) => { setStudentCode(normalizeStudentCode(event.target.value)); setStudentCodeError(null); }} minLength={6} maxLength={12} autoComplete="off" autoCapitalize="characters" placeholder="ABCD1234" aria-invalid={Boolean(studentCodeError)} aria-describedby={studentCodeError ? 'student-code-error' : undefined} className="min-h-14 rounded-xl px-4 text-center font-mono text-xl font-black tracking-[0.16em] placeholder:text-slate-400 focus:border-violet-700 focus:outline-violet-700" />{studentCodeError ? <p id="student-code-error" role="alert" className="text-sm font-bold text-rose-700">{studentCodeError}</p> : null}{actionError ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}<StudentButton type="submit" disabled={managedJoinMutation.isPending || studentCode.length < 6} className="mt-2 w-full text-base">{managedJoinMutation.isPending ? <ButtonSpinner /> : null}{managedJoinMutation.isPending ? 'جارٍ التحقق…' : 'دخول بكود الطالب'}{!managedJoinMutation.isPending ? <span aria-hidden="true" className="mr-2">←</span> : null}</StudentButton></form></>}
          </div>
        </section>
      </StudentShell>
    );
  }

  if (stage.kind === 'ready') {
    return <StudentShell centered width="wide"><section className="student-panel student-enter mx-auto w-full max-w-3xl overflow-hidden p-6 text-center sm:p-10"><div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8 sm:text-right"><div className="relative shrink-0"><span aria-hidden="true" className="absolute -right-2 top-3 h-2.5 w-2.5 rounded-full bg-[var(--student-orange)]" /><span aria-hidden="true" className="absolute -left-2 bottom-4 h-3 w-3 rotate-45 rounded-sm bg-[var(--student-violet)] opacity-70" /><StudentLearningVisual /><span aria-hidden="true" className="absolute -bottom-1 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-lg font-black text-white shadow-[0_2px_8px_rgb(5_150_105/0.2)]">✓</span></div><div><p className="text-sm font-black text-[var(--student-violet)]">كل شيء جاهز</p><h1 className="mt-2 text-balance text-3xl font-black text-[var(--student-ink)] sm:text-4xl">أنت جاهز، <bdi>{stage.displayName}</bdi>!</h1><p dir="auto" className="mt-3 text-lg font-black text-slate-700">{stage.session.title}</p></div></div><dl className="mx-auto mt-7 flex max-w-xl items-stretch justify-center divide-x divide-x-reverse divide-slate-200 rounded-xl bg-slate-50 py-5 text-center"><div className="min-w-0 flex-1 px-3"><dt className="text-xs text-[var(--student-muted)]">الأسئلة</dt><dd className="mt-1 font-black text-emerald-800">{stage.session.questionCount}</dd></div><div className="min-w-0 flex-1 px-3"><dt className="text-xs text-[var(--student-muted)]">الوقت</dt><dd className="mt-1 font-black text-[var(--student-violet)]">{sessionTimeLabel(stage.session)}</dd></div><div className="min-w-0 flex-1 px-3"><dt className="text-xs text-[var(--student-muted)]">النجاح</dt><dd dir="ltr" className="mt-1 font-black text-amber-700">{stage.session.passingPercentage}%</dd></div></dl><p className="mx-auto mt-5 max-w-xl rounded-xl bg-[var(--student-violet-soft)] p-4 text-sm font-semibold leading-7 text-violet-950">{stage.attemptId ? 'سنُعيدك إلى آخر سؤال وصلت إليه.' : 'اقرأ كل سؤال بهدوء، وثبّت إجابتك قبل الانتقال.'}</p>{actionError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}<StudentButton onClick={() => startMutation.mutate()} disabled={startMutation.isPending} className="mt-6 w-full text-base sm:w-72">{startMutation.isPending ? <ButtonSpinner /> : null}{startMutation.isPending ? 'جارٍ البدء…' : stage.attemptId ? 'استئناف المحاولة' : 'ابدأ الآن'}{!startMutation.isPending ? <span aria-hidden="true" className="mr-2">←</span> : null}</StudentButton></section></StudentShell>;
  }

  if (stage.kind === 'playing') return <SelfPacedPlayerView joinCode={joinCode!} attempt={stage.attempt} activityTitle={stage.session.title} clockSync={clock.sync} clockNow={clock.now} onFinished={(attemptId) => { void queryClient.invalidateQueries({ queryKey: ['player-result', joinCode, attemptId] }); setStage({ kind: 'result', attemptId, session: stage.session }); }} />;
  if (stage.kind === 'challenge-ready') return <ChallengeReadyView displayName={stage.displayName} session={stage.session} hasAttempt={stage.attemptId != null} onStart={() => startMutation.mutate()} starting={startMutation.isPending} error={actionError} />;
  if (stage.kind === 'challenge') return <ProgressivePlayerView joinCode={joinCode!} attempt={stage.attempt} quizTitle={stage.session.title} clockSync={clock.sync} clockNow={clock.now} onFinished={(attemptId) => { void queryClient.invalidateQueries({ queryKey: ['player-result', joinCode, attemptId] }); setStage({ kind: 'result', attemptId, session: stage.session }); }} />;
  if (stage.kind === 'live') return <LivePlayerView joinCode={joinCode!} session={stage.session} displayName={stage.displayName} initialAttemptId={stage.attemptId} />;
  if (stage.session?.mode === 'ProgressiveChallenge') return <ProgressiveResultView joinCode={joinCode!} attemptId={stage.attemptId} />;
  return <ResultView joinCode={joinCode!} attemptId={stage.attemptId} />;
}

function ChallengeReadyView({ displayName, session, hasAttempt, onStart, starting, error }: { displayName: string; session: PlayerSession; hasAttempt: boolean; onStart: () => void; starting: boolean; error: string | null }) {
  return (
    <ProgressiveShell>
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center px-4 py-10">
        <section className="challenge-panel challenge-enter w-full p-6 text-center sm:p-10" data-testid="challenge-ready">
          <div className="-mt-2 mb-1"><StudentSparkBrand inverse /></div><p className="text-xs font-black tracking-[0.2em] text-[var(--challenge-accent)]">SPARK CHALLENGE</p><h1 className="mt-3 text-balance text-3xl font-black text-white sm:text-4xl">جاهز تبدأ المهمة، <bdi>{displayName}</bdi>؟</h1><p dir="auto" className="mt-3 text-base font-bold text-sky-200">{session.title}</p>
          <dl className="mx-auto mt-6 flex max-w-md items-stretch justify-center divide-x divide-x-reverse divide-white/10 rounded-xl bg-white/[0.06] py-4"><div className="min-w-0 flex-1 px-3"><dt className="text-xs font-bold text-sky-300">المستويات</dt><dd dir="ltr" className="mt-1 text-lg font-black text-white">{session.questionCount}</dd></div><div className="min-w-0 flex-1 px-3"><dt className="text-xs font-bold text-sky-300">النقاط</dt><dd dir="ltr" className="mt-1 text-lg font-black text-white">{session.totalPoints}</dd></div><div className="min-w-0 flex-1 px-3"><dt className="text-xs font-bold text-sky-300">الوقت</dt><dd className="mt-1 text-sm font-black text-[var(--challenge-accent)]">{sessionTimeLabel(session)}</dd></div></dl>
          <p className="mx-auto mt-5 max-w-md rounded-xl bg-white/[0.06] p-4 text-sm font-semibold leading-7 text-sky-100">الإجابة الصحيحة تنقلك للمستوى التالي، والإجابة الخاطئة تنهي التحدي.{hasAttempt ? ' سنُعيدك إلى آخر مستوى وصلت إليه.' : ''} تم ترتيب الأسئلة من الأسهل إلى الأصعب.</p>
          {error ? <p role="alert" className="mx-auto mt-4 max-w-md rounded-xl bg-rose-500/15 p-3 text-sm font-bold text-rose-200">{error}</p> : null}
          <button type="button" onClick={onStart} disabled={starting} className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--challenge-accent)] px-8 text-base font-black text-slate-950 transition-transform duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none sm:w-72">{starting ? <ButtonSpinner /> : null}{starting ? 'جارٍ تجهيز المهمة…' : hasAttempt ? 'استئناف المهمة' : 'ابدأ المهمة'}</button>
        </section>
      </div>
    </ProgressiveShell>
  );
}
