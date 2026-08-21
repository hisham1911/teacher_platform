import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ButtonSpinner } from '../../components/ui/spinner';
import { playerApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import type { AttemptResult, StartAttemptResponse } from '../../types/sessions';
import { PlayerSurveyAction, PlayerSurveyPanel } from './player-survey-panel';
import { PlayerDeliveryPanel } from './player-delivery-panel';
import { StudentAudioPlayer } from './student-audio-player';

/**
 * /play — واجهة التحدي المتدرج (SessionMode = ProgressiveChallenge).
 * سلم مستويات ظاهر على سطح المكتب، وشريط تقدم مختصر على الجوال.
 * قرار الصحة والتقدم والنقاط خادمي بالكامل؛ العرض فقط يعتمد على استجابات الخادم.
 * هوية بصرية أصلية داكنة، RTL، أهداف لمس ≥44px، واحترام prefers-reduced-motion.
 */

/** مهلة عرض التغذية الراجعة قبل الانتقال التلقائي (ملّي ثانية). */
const FEEDBACK_MS = 1400;

type FeedbackPhase = 'none' | 'correct' | 'wrong';

export function ProgressivePlayerView({
  joinCode,
  attempt,
  quizTitle,
  clockSync,
  onFinished,
}: {
  joinCode: string;
  attempt: StartAttemptResponse;
  quizTitle: string;
  clockSync: (serverNow: string) => void;
  onFinished: (attemptId: string) => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(attempt.currentQuestionIndex);
  const [score, setScore] = useState(attempt.scoreSoFar);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackPhase>('none');
  const [actionError, setActionError] = useState<string | null>(null);
  const advanceTimer = useRef<number | null>(null);

  const questionQuery = useQuery({
    queryKey: ['player-question', joinCode, attempt.attemptId, questionIndex],
    queryFn: ({ signal }) => playerApi.getCurrentQuestion(joinCode, attempt.attemptId, signal),
    staleTime: 0,
    retry: false,
  });

  const question = questionQuery.data;

  // إعادة الضبط عند وصول سؤال جديد (استئناف/تقدم)
  useEffect(() => {
    if (question) {
      clockSync(question.serverNow);
      setSelectedOption(null);
      setFeedback('none');
      setActionError(null);
    }
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
      if (wasLastLevel) {
        onFinished(attempt.attemptId);
      } else {
        setQuestionIndex((index) => index + 1);
      }
    }, FEEDBACK_MS);
  }

  const answerMutation = useMutation({
    mutationFn: (payload: { quizVersionItemId: string; answerJson: string }) =>
      playerApi.submitAnswer(joinCode, attempt.attemptId, payload),
    onSuccess: (saved) => {
      clockSync(saved.serverNow);
      setActionError(null);
      if (saved.isCorrect === true) {
        setScore((value) => value + (saved.scoreAwarded ?? 0));
        setFeedback('correct');
        advanceAfterCorrect(question != null && question.index >= question.totalQuestions - 1);
      } else if (saved.isCorrect === false) {
        // إجابة خاطئة — الخادم أنهى التحدي فورًا
        setFeedback('wrong');
        advanceTimer.current = window.setTimeout(goToResult, FEEDBACK_MS + 600);
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
          // السيرفر يقرر المستوى الصحيح — أعد جلب السؤال الحالي
          void questionQuery.refetch();
          return;
        }
        setActionError('تم تسجيل إجابة مختلفة لهذا السؤال مسبقًا.');
      } else if (error instanceof HttpError && error.status === 400) {
        setActionError('تعذر حفظ الإجابة — البيانات غير صالحة. أعد المحاولة.');
      } else if (error instanceof HttpError && error.status === 429) {
        setActionError('محاولات كثيرة. انتظر لحظة.');
      } else {
        setActionError('تعذر حفظ الإجابة. تحقق من الاتصال.');
      }
    },
  });

  if (questionQuery.isLoading) {
    return (
      <ProgressiveShell>
        <div role="status" className="grid min-h-dvh place-items-center">
          <p className="challenge-panel px-6 py-4 text-sm font-bold text-sky-100">جارٍ تجهيز المستوى…</p>
        </div>
      </ProgressiveShell>
    );
  }

  if (questionQuery.isError || !question) {
    const e = questionQuery.error;
    if (e instanceof HttpError && e.status === 409) {
      goToResult();
      return null;
    }
    return (
      <ProgressiveShell>
        <section className="challenge-panel mx-auto mt-16 max-w-md p-6 text-center">
          <h1 className="text-lg font-black text-white">تعذر تحميل المستوى</h1>
          <p className="mt-2 text-sm leading-7 text-sky-200">تحقق من اتصالك ثم حاول مجددًا. تقدمك محفوظ.</p>
          <button
            type="button"
            onClick={() => void questionQuery.refetch()}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--challenge-accent)] px-6 text-sm font-black text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
            إعادة المحاولة
          </button>
        </section>
      </ProgressiveShell>
    );
  }

  const levelNumber = question.index + 1;
  const totalLevels = question.totalQuestions;
  const isLocked = feedback !== 'none' || answerMutation.isPending;

  return (
    <ProgressiveShell>
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 pb-8 pt-4 sm:px-6">
        <ProgressiveTopBar quizTitle={quizTitle} level={levelNumber} totalLevels={totalLevels} score={score} />

        <div className="flex flex-1 gap-6 lg:flex-row-reverse">
          {/* سلم المستويات — سطح المكتب فقط */}
          <aside className="hidden w-56 shrink-0 lg:block" aria-label="سلم المستويات">
            <LevelLadder total={totalLevels} current={levelNumber} />
          </aside>

          <main className="flex min-w-0 flex-1 flex-col items-center justify-center">
            <section
              className={`challenge-panel challenge-enter w-full max-w-2xl p-5 sm:p-8 ${feedback === 'correct' ? 'challenge-flash-ok' : ''} ${feedback === 'wrong' ? 'challenge-flash-bad' : ''}`}
              data-testid="challenge-question-card"
              data-level={levelNumber}>
              <div className="flex items-center justify-between gap-3">
                <p className="rounded-full bg-white/10 px-3 py-1 text-xs font-black tracking-wide text-[var(--challenge-accent)]">
                  المستوى {levelNumber}
                </p>
                <p className="text-xs font-bold text-sky-300">{question.points} نقطة</p>
              </div>

              <h1 dir="auto" className="mt-5 text-balance text-center text-2xl font-black leading-relaxed text-white sm:text-3xl">
                {question.prompt}
              </h1>

              {question.mediaAssetId ? (
                <div className="mt-6 rounded-2xl bg-white p-3 shadow-[0_2px_12px_rgb(0_0_0/0.35)]">
                  {question.questionType === 'Listening' ? (
                    <StudentAudioPlayer src={playerApi.mediaUrl(joinCode, attempt.attemptId, question.mediaAssetId)} />
                  ) : (
                    <img
                      src={playerApi.mediaUrl(joinCode, attempt.attemptId, question.mediaAssetId)}
                      alt="وسيط مرفق بالسؤال"
                      loading="lazy"
                      className="max-h-72 w-full rounded-xl object-contain"
                      data-testid="question-media-image"
                    />
                  )}
                </div>
              ) : null}

              <fieldset className="mt-7 flex flex-col gap-3" disabled={isLocked}>
                <legend className="sr-only">اختر إجابة</legend>
                {question.options.map((opt, index) => (
                  <ChallengeOption
                    key={opt.optionId}
                    label={String.fromCharCode(65 + index)}
                    text={opt.optionText}
                    selected={selectedOption === opt.optionId}
                    disabled={isLocked}
                    onSelect={() => setSelectedOption(opt.optionId)}
                  />
                ))}
              </fieldset>

              <button
                type="button"
                disabled={!selectedOption || isLocked}
                onClick={() =>
                  selectedOption &&
                  answerMutation.mutate({
                    quizVersionItemId: question.quizVersionItemId,
                    answerJson: JSON.stringify({ optionId: selectedOption }),
                  })
                }
                className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--challenge-accent)] text-base font-black text-slate-950 transition-transform duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                data-testid="challenge-lock-answer">
                {answerMutation.isPending ? <ButtonSpinner /> : null}
                {answerMutation.isPending ? 'جارٍ التثبيت…' : 'تثبيت الإجابة'}
              </button>

              <div aria-live="polite" className="mt-4 flex min-h-8 justify-center">
                {feedback === 'correct' && !answerMutation.isPending ? (
                  <p role="status" className="challenge-feedback-ok" data-testid="challenge-feedback-correct">
                    إجابة صحيحة ✓ صعود للمستوى التالي…
                  </p>
                ) : null}
                {feedback === 'wrong' ? (
                  <p role="status" className="challenge-feedback-bad" data-testid="challenge-feedback-wrong">
                    إجابة خاطئة — انتهى التحدي
                  </p>
                ) : null}
                {feedback !== 'none' && feedback !== 'wrong' ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearAdvanceTimer();
                      if (question.index >= totalLevels - 1) {
                        goToResult();
                      } else {
                        setQuestionIndex((index) => index + 1);
                      }
                    }}
                    className="ml-4 self-center rounded-lg border border-white/25 px-4 py-1.5 text-xs font-bold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
                    متابعة الآن
                  </button>
                ) : null}
              </div>

              {actionError ? (
                <p role="alert" className="mt-3 rounded-xl bg-rose-500/15 p-3 text-center text-sm font-bold text-rose-200">
                  {actionError}
                </p>
              ) : null}
            </section>
          </main>
        </div>
      </div>
    </ProgressiveShell>
  );
}

export function ProgressiveShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="challenge-shell min-h-dvh overflow-x-clip" dir="rtl">
      {children}
    </main>
  );
}

function ProgressiveTopBar({
  quizTitle,
  level,
  totalLevels,
  score,
}: {
  quizTitle: string;
  level: number;
  totalLevels: number;
  score: number;
}) {
  const progressPercentage = totalLevels > 0 ? Math.min(100, Math.round(((level - 1) / totalLevels) * 100)) : 0;
  return (
    <header className="challenge-panel flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
      <h1 dir="auto" className="min-w-0 truncate text-sm font-black text-sky-100">{quizTitle}</h1>
      <div className="flex items-center gap-3">
        <p className="whitespace-nowrap text-sm font-black text-white" data-testid="challenge-level-indicator">
          المستوى <span className="text-[var(--challenge-accent)]">{level}</span> / {totalLevels}
        </p>
        <p className="whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-xs font-black text-[var(--challenge-accent)]" data-testid="challenge-score-indicator">
          النقاط: {score}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="تقدم التحدي"
        aria-valuemin={0}
        aria-valuemax={totalLevels}
        aria-valuenow={level - 1}
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[var(--challenge-accent)] transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </header>
  );
}

function LevelLadder({ total, current }: { total: number; current: number }) {
  return (
    <ol className="challenge-panel sticky top-4 flex flex-col gap-1 p-3">
      {Array.from({ length: total }, (_, index) => {
        const level = index + 1;
        const state = level < current ? 'cleared' : level === current ? 'current' : 'upcoming';
        return (
          <li key={level}>
            <span
              aria-current={state === 'current' ? 'step' : undefined}
              className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-bold ${
                state === 'cleared'
                  ? 'text-emerald-300'
                  : state === 'current'
                    ? 'bg-[var(--challenge-accent)] text-slate-950 shadow-[0_0_14px_rgb(250_204_21/0.35)] motion-reduce:shadow-none'
                    : 'text-sky-300/60'
              }`}
              data-testid={`challenge-level-${level}`}>
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black ${
                  state === 'cleared'
                    ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
                    : state === 'current'
                      ? 'border-slate-900 bg-slate-900 text-[var(--challenge-accent)]'
                      : 'border-white/20 text-inherit'
                }`}>
                {state === 'cleared' ? '✓' : level}
              </span>
              المستوى {level}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ChallengeOption({
  label,
  text,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  text: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const optionDirection = /[\u0600-\u06ff]/.test(text) ? 'rtl' : 'ltr';
  return (
    <label
      dir={optionDirection}
      className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border p-4 text-base font-semibold transition-[background-color,border-color,color] duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky-300 motion-reduce:transition-none ${
        selected
          ? 'border-[var(--challenge-accent)] bg-white/15 text-white'
          : 'border-white/15 bg-white/[0.06] text-sky-100 hover:border-white/40'
      } ${disabled ? 'cursor-default opacity-70' : 'active:translate-y-px'}`}
      data-testid="challenge-option">
      <input type="radio" name="challenge-option" checked={selected} disabled={disabled} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
          selected ? 'border-[var(--challenge-accent)] bg-[var(--challenge-accent)] text-slate-950' : 'border-white/25 text-sky-200'
        }`}>
        {label}
      </span>
      <span className="min-w-0 flex-1">{text}</span>
    </label>
  );
}

/**
 * شاشة نتيجة التحدي المتدرج: فوز عند إكمال كل المستويات، أو "انتهى التحدي"
 * مع أعلى مستوى تم الوصول إليه. تمر النتيجة في نفس مسار الاستبيان والشهادة الحالي.
 */
export function ProgressiveResultView({ joinCode, attemptId }: { joinCode: string; attemptId: string }) {
  const resultQuery = useQuery({
    queryKey: ['player-result', joinCode, attemptId],
    queryFn: ({ signal }) => playerApi.getResult(joinCode, attemptId, signal),
    retry: false,
  });

  if (resultQuery.isLoading) {
    return (
      <ProgressiveShell>
        <div role="status" className="grid min-h-dvh place-items-center">
          <p className="challenge-panel px-6 py-4 text-sm font-bold text-sky-100">جارٍ تجهيز نتيجتك…</p>
        </div>
      </ProgressiveShell>
    );
  }

  if (resultQuery.isError || !resultQuery.data) {
    return (
      <ProgressiveShell>
        <section className="challenge-panel mx-auto mt-16 max-w-md p-6 text-center">
          <h1 className="text-lg font-black text-white">تعذر عرض النتيجة</h1>
          <p className="mt-2 text-sm leading-7 text-sky-200">حاول مرة أخرى.</p>
          <button
            type="button"
            onClick={() => void resultQuery.refetch()}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--challenge-accent)] px-6 text-sm font-black text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
            إعادة المحاولة
          </button>
        </section>
      </ProgressiveShell>
    );
  }

  const attemptResult: AttemptResult = resultQuery.data;
  const completedAll = attemptResult.answeredCount >= attemptResult.totalQuestions;
  const percentage =
    attemptResult.percentage == null ? null : Math.min(100, Math.max(0, Math.round(attemptResult.percentage)));

  return (
    <ProgressiveShell>
      <div className="challenge-enter mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-12">
        <section className="challenge-panel overflow-hidden text-center" data-testid="challenge-result-banner">
          <div
            className={`px-6 py-10 sm:px-10 ${
              completedAll ? 'challenge-result-win' : 'challenge-result-lose'
            }`}>
            <div
              aria-hidden="true"
              className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full text-4xl font-black ${
                completedAll ? 'bg-[var(--challenge-accent)] text-slate-950' : 'bg-white/10 text-rose-300'
              }`}>
              {completedAll ? '★' : '✕'}
            </div>
            <h1 className="text-balance text-3xl font-black text-white sm:text-4xl">
              {completedAll ? 'أكملت التحدي!' : 'انتهى التحدي'}
            </h1>
            {!completedAll ? (
              <p className="mt-3 text-lg font-bold text-sky-200" data-testid="challenge-reached-level">
                وصلت إلى المستوى {attemptResult.answeredCount} من {attemptResult.totalQuestions}
              </p>
            ) : null}
            <p className="mt-2 text-sm font-semibold text-sky-300">أحسنت يا <bdi>{attemptResult.displayName}</bdi></p>
          </div>

          <dl className="flex justify-center divide-x divide-x-reverse divide-white/10 bg-black/20 px-5 py-5 text-center">
            <div className="flex-1 px-3">
              <dt className="text-xs font-bold text-sky-300">المستوى</dt>
              <dd className="mt-1 text-base font-black text-white" dir="ltr">
                {attemptResult.answeredCount} / {attemptResult.totalQuestions}
              </dd>
            </div>
            <div className="flex-1 px-3">
              <dt className="text-xs font-bold text-sky-300">النقاط</dt>
              <dd className="mt-1 text-base font-black text-white" dir="ltr">
                {attemptResult.score ?? 0} / {attemptResult.maxScore ?? 0}
              </dd>
            </div>
            {percentage != null ? (
              <div className="flex-1 px-3">
                <dt className="text-xs font-bold text-sky-300">النسبة</dt>
                <dd className="mt-1 text-base font-black text-white" dir="ltr">{percentage}%</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {attemptResult.passed != null ? (
          <PlayerDeliveryPanel
            joinCode={joinCode}
            attemptId={attemptId}
            passed={attemptResult.passed}
            surveyAction={<PlayerSurveyAction joinCode={joinCode} attemptId={attemptId} />}
          />
        ) : null}
        <PlayerSurveyPanel joinCode={joinCode} attemptId={attemptId} />
      </div>
    </ProgressiveShell>
  );
}
