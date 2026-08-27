import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ButtonSpinner } from '../../components/ui/spinner';
import { playerApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import type { AttemptResult, StartAttemptResponse } from '../../types/sessions';
import { PlayerSurveyAction, PlayerSurveyPanel } from './player-survey-panel';
import { PlayerDeliveryPanel } from './player-delivery-panel';
import { StudentAudioPlayer } from './student-audio-player';

const FEEDBACK_MS = 1500;
const systemNow = () => new Date();
const STATIONS = ['🌍', '🌙', '🛰️', '🪐', '☄️', '🔭', '🌌', '⭐', '🚀', '🏆'];
const OPTION_STYLES = [
  'challenge-option-a',
  'challenge-option-b',
  'challenge-option-c',
  'challenge-option-d',
] as const;

type FeedbackPhase = 'none' | 'correct' | 'wrong';

function useDeadlineCountdown(deadlineAt: string | null | undefined, now: () => Date): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!deadlineAt) {
      setRemaining(null);
      return;
    }
    const deadline = Date.parse(deadlineAt);
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - now().getTime()) / 1000)));
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [deadlineAt, now]);
  return remaining;
}

function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function stationIcon(level: number) {
  return STATIONS[(level - 1) % STATIONS.length] ?? '⭐';
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

export function ProgressivePlayerView({
  joinCode,
  attempt,
  quizTitle,
  clockSync,
  clockNow = systemNow,
  onFinished,
  autoAdvanceMs = FEEDBACK_MS,
}: {
  joinCode: string;
  attempt: StartAttemptResponse;
  quizTitle: string;
  clockSync: (serverNow: string) => void;
  clockNow?: () => Date;
  onFinished: (attemptId: string) => void;
  autoAdvanceMs?: number;
}) {
  const [questionIndex, setQuestionIndex] = useState(attempt.currentQuestionIndex);
  const [score, setScore] = useState(attempt.scoreSoFar);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackPhase>('none');
  const [lastAward, setLastAward] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const advanceTimer = useRef<number | null>(null);

  const questionQuery = useQuery({
    queryKey: ['player-question', joinCode, attempt.attemptId, questionIndex],
    queryFn: ({ signal }) => playerApi.getCurrentQuestion(joinCode, attempt.attemptId, signal),
    staleTime: 0,
    retry: false,
  });

  const question = questionQuery.data;
  const remaining = useDeadlineCountdown(question?.deadlineAt, clockNow);

  useEffect(() => {
    if (!question) return;
    clockSync(question.serverNow);
    setSelectedOption(null);
    setFeedback('none');
    setLastAward(0);
    setActionError(null);
  }, [question, clockSync]);

  function clearAdvanceTimer() {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }

  useEffect(() => () => clearAdvanceTimer(), []);

  function goToResult() {
    clearAdvanceTimer();
    onFinished(attempt.attemptId);
  }

  function advanceAfterCorrect(wasLastLevel: boolean) {
    clearAdvanceTimer();
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null;
      if (wasLastLevel) onFinished(attempt.attemptId);
      else setQuestionIndex((index) => index + 1);
    }, autoAdvanceMs);
  }

  const finishMutation = useMutation({
    mutationFn: () => playerApi.finish(joinCode, attempt.attemptId),
    onSuccess: goToResult,
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        goToResult();
        return;
      }
      setActionError('انتهى الوقت، لكن تعذر عرض النتيجة. حاول مرة أخرى.');
    },
  });

  useEffect(() => {
    if (remaining === 0 && !finishMutation.isPending && !finishMutation.isSuccess) {
      clearAdvanceTimer();
      vibrate([80, 60, 80]);
      finishMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const answerMutation = useMutation({
    mutationFn: (payload: { quizVersionItemId: string; answerJson: string }) =>
      playerApi.submitAnswer(joinCode, attempt.attemptId, payload),
    onSuccess: (saved) => {
      clockSync(saved.serverNow);
      setActionError(null);
      if (saved.isCorrect === true) {
        const award = saved.scoreAwarded ?? 0;
        setScore((value) => value + award);
        setLastAward(award);
        setFeedback('correct');
        vibrate(45);
        advanceAfterCorrect(question != null && question.index >= question.totalQuestions - 1);
      } else if (saved.isCorrect === false) {
        setFeedback('wrong');
        vibrate([100, 60, 120]);
        advanceTimer.current = window.setTimeout(goToResult, autoAdvanceMs + 650);
      }
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        const body = error.body as { title?: string } | null;
        if (body?.title === 'AttemptFinished' || body?.title === 'SessionNotActive') {
          goToResult();
          return;
        }
        if (body?.title === 'NotCurrentLevel') {
          void questionQuery.refetch();
          return;
        }
        setActionError('تم تسجيل إجابة مختلفة لهذا المستوى مسبقًا.');
      } else if (error instanceof HttpError && error.status === 429) {
        setActionError('محاولات كثيرة. انتظر لحظة ثم حاول مرة أخرى.');
      } else {
        setActionError('تعذر حفظ الإجابة. تحقق من الاتصال.');
      }
    },
  });

  if (questionQuery.isLoading) {
    return <ProgressiveShell><div role="status" className="grid min-h-dvh place-items-center"><div className="challenge-panel challenge-enter px-7 py-6 text-center"><div className="mx-auto mb-3 text-4xl challenge-float">🚀</div><p className="text-sm font-black text-sky-100">جارٍ تجهيز المحطة التالية…</p></div></div></ProgressiveShell>;
  }

  if (questionQuery.isError || !question) {
    const error = questionQuery.error;
    if (error instanceof HttpError && error.status === 409) {
      goToResult();
      return null;
    }
    return <ProgressiveShell><section className="challenge-panel mx-auto mt-16 max-w-md p-6 text-center"><div className="text-5xl">🛰️</div><h1 className="mt-4 text-xl font-black text-white">فقدنا الاتصال بالمحطة</h1><p className="mt-2 text-sm leading-7 text-sky-200">التقدم محفوظ. تحقق من الاتصال ثم أعد المحاولة.</p><button type="button" onClick={() => void questionQuery.refetch()} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--challenge-accent)] px-6 text-sm font-black text-slate-950">إعادة المحاولة</button></section></ProgressiveShell>;
  }

  const levelNumber = question.index + 1;
  const totalLevels = question.totalQuestions;
  const isLocked = feedback !== 'none' || answerMutation.isPending || finishMutation.isPending || remaining === 0;

  return (
    <ProgressiveShell>
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-3 px-3 pb-7 pt-3 sm:gap-4 sm:px-5 sm:pt-4">
        <MissionTopBar quizTitle={quizTitle} level={levelNumber} totalLevels={totalLevels} score={score} remaining={remaining} />
        <MobileMissionPath total={totalLevels} current={levelNumber} />

        <div className="flex flex-1 gap-5 lg:flex-row-reverse">
          <aside className="hidden w-60 shrink-0 lg:block" aria-label="مسار المهمة"><LevelLadder total={totalLevels} current={levelNumber} /></aside>

          <main className="flex min-w-0 flex-1 flex-col items-center justify-center">
            <section className={`challenge-panel challenge-enter relative w-full max-w-3xl overflow-hidden p-4 sm:p-7 ${feedback === 'correct' ? 'challenge-flash-ok' : ''} ${feedback === 'wrong' ? 'challenge-flash-bad' : ''}`} data-testid="challenge-question-card" data-level={levelNumber}>
              <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-12 h-36 w-36 rounded-full bg-fuchsia-500/10 blur-2xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -right-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl" />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-2xl shadow-inner">{stationIcon(levelNumber)}</span><div><p className="text-[10px] font-black tracking-[0.18em] text-sky-300">MISSION STATION</p><p className="text-sm font-black text-[var(--challenge-accent)]">المحطة {levelNumber}</p></div></div>
                <div className="text-left"><p className="text-[10px] font-bold text-sky-300">REWARD</p><p className="text-sm font-black text-white">+{question.points} ⭐</p></div>
              </div>

              <h1 dir="auto" className="relative mt-5 text-balance text-center text-2xl font-black leading-relaxed text-white sm:mt-7 sm:text-3xl">{question.prompt}</h1>

              {question.mediaAssetId ? <div className="relative mt-5 rounded-2xl bg-white p-3 shadow-[0_2px_12px_rgb(0_0_0/0.35)]">{question.questionType === 'Listening' ? <StudentAudioPlayer src={playerApi.mediaUrl(joinCode, attempt.attemptId, question.mediaAssetId)} /> : <img src={playerApi.mediaUrl(joinCode, attempt.attemptId, question.mediaAssetId)} alt="وسيط مرفق بالسؤال" loading="lazy" className="max-h-72 w-full rounded-xl object-contain" data-testid="question-media-image" />}</div> : null}

              <fieldset className="relative mt-6 grid gap-3 sm:grid-cols-2" disabled={isLocked}>
                <legend className="sr-only">اختر إجابة</legend>
                {question.options.map((option, index) => <ChallengeOption key={option.optionId} label={String.fromCharCode(65 + index)} text={option.optionText} selected={selectedOption === option.optionId} disabled={isLocked} styleClass={OPTION_STYLES[index % OPTION_STYLES.length]!} onSelect={() => setSelectedOption(option.optionId)} />)}
              </fieldset>

              <button type="button" disabled={!selectedOption || isLocked} onClick={() => selectedOption && answerMutation.mutate({ quizVersionItemId: question.quizVersionItemId, answerJson: JSON.stringify({ optionId: selectedOption }) })} className="relative mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--challenge-accent)] text-base font-black text-slate-950 shadow-[0_8px_28px_rgb(250_204_21/0.2)] transition-transform duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none" data-testid="challenge-lock-answer">{answerMutation.isPending ? <ButtonSpinner /> : null}{answerMutation.isPending ? 'جارٍ تثبيت الإجابة…' : 'تأكيد الإجابة 🚀'}</button>

              <div aria-live="polite" className="relative mt-4 flex min-h-12 items-center justify-center">
                {remaining === 0 ? <p role="status" className="challenge-feedback-bad" data-testid="challenge-feedback-timeout">⌛ انتهى وقت المستوى — جارٍ تثبيت النتيجة</p> : null}
                {feedback === 'correct' && !answerMutation.isPending ? <div className="challenge-level-up text-center" data-testid="challenge-feedback-correct"><p className="text-lg font-black text-emerald-200">LEVEL UP! ✨</p><p className="text-sm font-bold text-emerald-300">إجابة صحيحة · +{lastAward} نقطة · صعود للمستوى التالي…</p></div> : null}
                {feedback === 'wrong' ? <div className="challenge-feedback-bad text-center" data-testid="challenge-feedback-wrong"><p className="font-black">MISSION PAUSED</p><p className="text-sm">إجابة خاطئة — انتهى التحدي</p></div> : null}
                {feedback === 'correct' ? <button type="button" onClick={() => { clearAdvanceTimer(); if (question.index >= totalLevels - 1) goToResult(); else setQuestionIndex((index) => index + 1); }} className="mr-3 min-h-11 rounded-xl border border-white/25 px-4 text-xs font-black text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">متابعة الآن</button> : null}
              </div>

              {actionError ? <p role="alert" className="relative mt-3 rounded-xl bg-rose-500/15 p-3 text-center text-sm font-bold text-rose-200">{actionError}</p> : null}
            </section>
          </main>
        </div>
      </div>
    </ProgressiveShell>
  );
}

export function ProgressiveShell({ children }: { children: React.ReactNode }) {
  return <main className="challenge-shell min-h-dvh overflow-x-clip" dir="rtl"><div aria-hidden="true" className="challenge-stars" />{children}</main>;
}

function MissionTopBar({ quizTitle, level, totalLevels, score, remaining }: { quizTitle: string; level: number; totalLevels: number; score: number; remaining: number | null }) {
  const progressPercentage = totalLevels > 0 ? Math.min(100, Math.round(((level - 1) / totalLevels) * 100)) : 0;
  return (
    <header className="challenge-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0"><p className="text-[9px] font-black tracking-[0.2em] text-cyan-300">SPARK MISSION</p><h1 dir="auto" className="max-w-[14rem] truncate text-sm font-black text-white sm:max-w-sm">{quizTitle}</h1></div>
        <div className="flex items-center gap-2"><p className="whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white" data-testid="challenge-level-indicator">المستوى <span className="text-[var(--challenge-accent)]">{level}</span> / {totalLevels}</p><p className="whitespace-nowrap rounded-full bg-amber-300/15 px-3 py-1.5 text-xs font-black text-amber-200" data-testid="challenge-score-indicator">النقاط: {score}</p>{remaining != null ? <p className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black ${remaining <= 10 ? 'bg-rose-400/20 text-rose-200 challenge-urgent' : 'bg-white/10 text-sky-100'}`} data-testid="challenge-time-indicator" aria-label={`الوقت المتبقي ${formatRemaining(remaining)}`}>⏱ <span dir="ltr">{formatRemaining(remaining)}</span></p> : null}</div>
      </div>
      <div role="progressbar" aria-label="تقدم التحدي" aria-valuemin={0} aria-valuemax={totalLevels} aria-valuenow={level - 1} className="h-1.5 w-full overflow-hidden bg-white/10"><div className="h-full rounded-l-full bg-gradient-to-l from-amber-300 via-fuchsia-400 to-cyan-300 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${progressPercentage}%` }} /></div>
    </header>
  );
}

function MobileMissionPath({ total, current }: { total: number; current: number }) {
  const visible = Array.from({ length: total }, (_, index) => index + 1);
  return <div className="challenge-panel overflow-hidden p-3 lg:hidden" aria-label="مسار المهمة"><div className="overflow-x-auto pb-1"><ol className="flex min-w-max items-center gap-1.5">{visible.map((level) => { const cleared = level < current; const active = level === current; return <li key={level} className="flex items-center gap-1.5"><span aria-current={active ? 'step' : undefined} className={`flex h-10 min-w-10 items-center justify-center rounded-xl border px-2 text-sm font-black ${cleared ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200' : active ? 'border-amber-300 bg-amber-300 text-slate-950 shadow-[0_0_18px_rgb(253_224_71/0.28)]' : 'border-white/10 bg-white/[0.04] text-sky-300/55'}`}>{cleared ? '✓' : stationIcon(level)}</span>{level < total ? <span className={`h-0.5 w-4 rounded-full ${cleared ? 'bg-emerald-400/70' : 'bg-white/10'}`} /> : null}</li>; })}</ol></div></div>;
}

function LevelLadder({ total, current }: { total: number; current: number }) {
  return <ol className="challenge-panel sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col gap-1 overflow-y-auto p-3"><li className="px-2 pb-2"><p className="text-[9px] font-black tracking-[0.2em] text-cyan-300">MISSION MAP</p><p className="text-sm font-black text-white">المسار إلى القمة</p></li>{Array.from({ length: total }, (_, index) => { const level = index + 1; const state = level < current ? 'cleared' : level === current ? 'current' : 'upcoming'; return <li key={level}><span aria-current={state === 'current' ? 'step' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-1.5 text-sm font-bold ${state === 'cleared' ? 'text-emerald-300' : state === 'current' ? 'bg-[var(--challenge-accent)] text-slate-950 shadow-[0_0_14px_rgb(250_204_21/0.35)]' : 'text-sky-300/55'}`} data-testid={`challenge-level-${level}`}><span aria-hidden="true" className="text-xl">{state === 'cleared' ? '✓' : stationIcon(level)}</span><span>المستوى {level}</span></span></li>; })}</ol>;
}

function ChallengeOption({ label, text, selected, disabled, styleClass, onSelect }: { label: string; text: string; selected: boolean; disabled: boolean; styleClass: string; onSelect: () => void }) {
  const optionDirection = /[\u0600-\u06ff]/.test(text) ? 'rtl' : 'ltr';
  return <label dir={optionDirection} className={`challenge-answer ${styleClass} ${selected ? 'challenge-answer-selected' : ''} ${disabled ? 'cursor-default opacity-70' : 'cursor-pointer active:translate-y-px'}`} data-testid="challenge-option"><input type="radio" name="challenge-option" checked={selected} disabled={disabled} onChange={onSelect} className="sr-only" /><span aria-hidden="true" className="challenge-answer-label">{label}</span><span className="min-w-0 flex-1 text-base font-bold sm:text-lg">{text}</span></label>;
}

export function ProgressiveResultView({ joinCode, attemptId }: { joinCode: string; attemptId: string }) {
  const resultQuery = useQuery({ queryKey: ['player-result', joinCode, attemptId], queryFn: ({ signal }) => playerApi.getResult(joinCode, attemptId, signal), retry: false });

  if (resultQuery.isLoading) return <ProgressiveShell><div role="status" className="grid min-h-dvh place-items-center"><p className="challenge-panel px-6 py-4 text-sm font-bold text-sky-100">جارٍ تجهيز تقرير المهمة…</p></div></ProgressiveShell>;
  if (resultQuery.isError || !resultQuery.data) return <ProgressiveShell><section className="challenge-panel mx-auto mt-16 max-w-md p-6 text-center"><h1 className="text-lg font-black text-white">تعذر عرض النتيجة</h1><p className="mt-2 text-sm leading-7 text-sky-200">التقدم محفوظ. حاول مرة أخرى.</p><button type="button" onClick={() => void resultQuery.refetch()} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--challenge-accent)] px-6 text-sm font-black text-slate-950">إعادة المحاولة</button></section></ProgressiveShell>;

  const result: AttemptResult = resultQuery.data;
  const timedOut = result.status === 'TimedOut';
  const completedAll = result.status === 'Finished' && result.passed === true && result.answeredCount >= result.totalQuestions && result.score === result.maxScore;
  const percentage = result.percentage == null ? null : Math.min(100, Math.max(0, Math.round(result.percentage)));
  const reachedLevel = Math.min(result.answeredCount + (timedOut ? 1 : 0), result.totalQuestions);

  return (
    <ProgressiveShell>
      <div className="challenge-enter mx-auto flex min-h-dvh w-full max-w-4xl flex-col justify-center gap-5 px-4 py-8 sm:px-6 sm:py-12">
        <section className="challenge-panel overflow-hidden text-center" data-testid="challenge-result-banner">
          <div className={`relative overflow-hidden px-6 py-10 sm:px-10 sm:py-12 ${completedAll ? 'challenge-result-win' : 'challenge-result-lose'}`}>
            {completedAll ? <div aria-hidden="true" className="challenge-confetti"><span>✦</span><span>★</span><span>✦</span><span>⭐</span><span>✦</span></div> : null}
            <div aria-hidden="true" className={`mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] text-5xl font-black ${completedAll ? 'bg-[var(--challenge-accent)] text-slate-950 shadow-[0_0_36px_rgb(250_204_21/0.28)]' : 'bg-white/10 text-rose-300'}`}>{completedAll ? '🚀' : timedOut ? '⌛' : '🛰️'}</div>
            <p className={`text-xs font-black tracking-[0.22em] ${completedAll ? 'text-amber-200' : 'text-sky-300'}`}>{completedAll ? 'MISSION COMPLETE' : timedOut ? 'MISSION TIMEOUT' : 'MISSION PAUSED'}</p>
            <h1 className="mt-2 text-balance text-3xl font-black text-white sm:text-5xl">{completedAll ? 'أكملت التحدي!' : timedOut ? 'انتهى الوقت' : 'انتهى التحدي'}</h1>
            {!completedAll ? <p className="mt-3 text-lg font-bold text-sky-200" data-testid="challenge-reached-level">{timedOut ? 'توقف التحدي عند المستوى' : 'وصلت إلى المستوى'} {reachedLevel} من {result.totalQuestions}</p> : <p className="mt-3 text-lg font-bold text-amber-100">تم فتح جميع المحطات بنجاح ✨</p>}
            <p className="mt-3 text-sm font-semibold text-sky-300">أحسنت يا <bdi>{result.displayName}</bdi></p>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-x-reverse divide-white/10 bg-black/20 px-3 py-5 text-center sm:px-6">
            <div className="px-2"><dt className="text-xs font-bold text-sky-300">المستوى</dt><dd className="mt-1 text-base font-black text-white" dir="ltr">{result.answeredCount} / {result.totalQuestions}</dd></div>
            <div className="px-2"><dt className="text-xs font-bold text-sky-300">النقاط</dt><dd className="mt-1 text-base font-black text-white" dir="ltr">{result.score ?? 0} / {result.maxScore ?? 0}</dd></div>
            <div className="px-2"><dt className="text-xs font-bold text-sky-300">الإنجاز</dt><dd className="mt-1 text-base font-black text-[var(--challenge-accent)]" dir="ltr">{percentage ?? 0}%</dd></div>
          </dl>
        </section>

        {result.passed != null ? <PlayerDeliveryPanel joinCode={joinCode} attemptId={attemptId} passed={result.passed} surveyAction={<PlayerSurveyAction joinCode={joinCode} attemptId={attemptId} />} /> : null}
        <PlayerSurveyPanel joinCode={joinCode} attemptId={attemptId} />
      </div>
    </ProgressiveShell>
  );
}
