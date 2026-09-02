import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ButtonSpinner } from '../../components/ui/spinner';
import { playerApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import { QUESTION_TYPE_LABELS } from '../../types/questions';
import type { StartAttemptResponse } from '../../types/sessions';
import { AnswerEditor, QuestionMedia } from './player-question-renderer';
import { formatRemaining, useCountdown } from './player-time';
import { QuestionProgress, StudentButton, StudentError, StudentLoading, StudentShell } from './student-ui';

export function SelfPacedPlayerView({ joinCode, attempt, activityTitle, clockSync, clockNow, onFinished }: { joinCode: string; attempt: StartAttemptResponse; activityTitle: string; clockSync: (serverNow: string) => void; clockNow: () => Date; onFinished: (attemptId: string) => void }) {
  const [questionIndex, setQuestionIndex] = useState(attempt.currentQuestionIndex);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; scoreAwarded: number } | null>(null);
  const [answeredQuestionId, setAnsweredQuestionId] = useState<string | null>(null);
  const [skipConfirmation, setSkipConfirmation] = useState<'next' | 'finish' | null>(null);

  const questionQuery = useQuery({ queryKey: ['player-question', joinCode, attempt.attemptId, questionIndex], queryFn: ({ signal }) => playerApi.getCurrentQuestion(joinCode, attempt.attemptId, signal), staleTime: 0 });
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
  const finishMutation = useMutation({
    mutationFn: () => playerApi.finish(joinCode, attempt.attemptId),
    onSuccess: () => onFinished(attempt.attemptId),
    onError: (error) => { if (error instanceof HttpError && error.status === 409) onFinished(attempt.attemptId); else setActionError('تعذر إنهاء المحاولة. أعد المحاولة.'); },
  });
  useEffect(() => {
    if (remaining === 0 && !finishMutation.isPending && !finishMutation.isSuccess) finishMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const answerMutation = useMutation({
    mutationFn: (payload: { quizVersionItemId: string; answerJson: string }) => playerApi.submitAnswer(joinCode, attempt.attemptId, payload),
    onSuccess: (savedAnswer) => { clockSync(savedAnswer.serverNow); setAnsweredQuestionId(savedAnswer.quizVersionItemId); if (savedAnswer.isCorrect != null && savedAnswer.scoreAwarded != null) setLastFeedback({ isCorrect: savedAnswer.isCorrect, scoreAwarded: savedAnswer.scoreAwarded }); setActionError(null); },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 400) {
        const body = error.body as { title?: string } | null;
        setActionError(body?.title === 'InvalidAnswerPayload' ? 'تعذر حفظ الإجابة — البيانات غير صالحة. أعد المحاولة.' : 'تعذر حفظ الإجابة — تأكد من إدخال إجابة صحيحة.');
      } else if (error instanceof HttpError && error.status === 409) {
        const body = error.body as { title?: string } | null;
        if (body?.title === 'AttemptFinished' || body?.title === 'SessionNotActive') { onFinished(attempt.attemptId); return; }
        setActionError('تم تسجيل إجابة مختلفة لهذا السؤال مسبقًا.');
      } else if (error instanceof HttpError && error.status === 429) setActionError('محاولات كثيرة. انتظر لحظة.');
      else setActionError('تعذر حفظ الإجابة. تحقق من الاتصال.');
    },
  });

  if (questionQuery.isLoading) return <StudentLoading message="جارٍ تحميل السؤال…" />;
  if (questionQuery.isError || !question) {
    const error = questionQuery.error;
    if (error instanceof HttpError && error.status === 409) { onFinished(attempt.attemptId); return null; }
    return <StudentError title="تعذر تحميل السؤال" message="تحقق من اتصالك ثم حاول مرة أخرى. إجاباتك السابقة محفوظة." action={<StudentButton variant="secondary" onClick={() => void questionQuery.refetch()}>إعادة المحاولة</StudentButton>} />;
  }

  const isLast = question.index >= question.totalQuestions - 1;
  const currentQuestionAnswered = question.alreadyAnswered || answeredQuestionId === question.quizVersionItemId;
  function continueFromCurrentQuestion() { setSkipConfirmation(null); if (isLast) finishMutation.mutate(); else setQuestionIndex((index) => index + 1); }
  function requestQuestionProgress() { if (currentQuestionAnswered) { continueFromCurrentQuestion(); return; } setSkipConfirmation(isLast ? 'finish' : 'next'); }

  return (
    <StudentShell width="wide">
      <div className="student-enter flex flex-1 flex-col">
        <header className="mb-4 flex items-start justify-between gap-4 pt-2 sm:items-center">
          <div className="min-w-0"><p className="text-xs font-black text-[var(--student-violet)]">نشاطك الآن</p><h1 dir="auto" className="mt-1 text-xl font-black text-[var(--student-ink)]">{activityTitle}</h1><p className="mt-1 text-xs font-semibold text-[var(--student-muted)]">ثبّت إجابتك قبل الانتقال إلى السؤال التالي.</p></div>
          {remaining != null ? <p role="timer" dir="ltr" aria-label={`الوقت المتبقي ${formatRemaining(remaining)}`} className={`shrink-0 rounded-full px-3 py-2 font-mono text-sm font-black tabular-nums ${remaining <= 30 ? 'bg-rose-100 text-rose-800' : 'bg-white text-slate-800 shadow-[0_1px_4px_rgb(15_23_42/0.08)]'}`}>{formatRemaining(remaining)}</p> : null}
        </header>
        <QuestionProgress current={question.index + 1} total={question.totalQuestions} />
        <section className="student-panel mt-4 flex flex-col p-5 sm:p-9">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{QUESTION_TYPE_LABELS[question.questionType]}</span><span className="text-xs font-semibold text-[var(--student-muted)]">{question.points} نقطة</span></div>
          <h2 dir="auto" className="mx-auto max-w-3xl text-pretty text-center text-2xl font-black leading-relaxed text-[var(--student-ink)] sm:text-3xl">{question.prompt}</h2>
          {question.mediaAssetId ? <div className="mt-6"><QuestionMedia joinCode={joinCode} attemptId={attempt.attemptId} mediaId={question.mediaAssetId} questionType={question.questionType} presentation="student" /></div> : null}
          <div className="mx-auto mt-8 w-full max-w-3xl"><AnswerEditor key={question.quizVersionItemId} question={question} answerState={answerMutation.isPending ? 'saving' : currentQuestionAnswered ? 'saved' : 'editing'} presentation="student" onSubmit={(answerJson) => answerMutation.mutate({ quizVersionItemId: question.quizVersionItemId, answerJson })} /></div>
          <div aria-live="polite" className="mt-4 flex min-h-6 justify-center">{lastFeedback && !answerMutation.isPending ? <p role="status" className={`rounded-xl p-3 text-center text-sm font-bold ${lastFeedback.isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{lastFeedback.isCorrect ? `إجابة صحيحة ✓ (+${lastFeedback.scoreAwarded})` : 'تم حفظ الإجابة — ليست صحيحة هذه المرة'}</p> : null}</div>
          {actionError ? <p role="alert" className="mx-auto mt-3 w-full max-w-3xl rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}
        </section>
        <footer className="sticky bottom-0 z-20 mt-3 bg-[var(--student-bg)] py-3"><div className="flex justify-start">{isLast ? <StudentButton variant={currentQuestionAnswered ? 'primary' : 'secondary'} onClick={requestQuestionProgress} disabled={answerMutation.isPending || finishMutation.isPending} className="w-full text-base sm:w-64">{finishMutation.isPending ? <ButtonSpinner /> : null}إنهاء النشاط</StudentButton> : <StudentButton variant={currentQuestionAnswered ? 'primary' : 'secondary'} onClick={requestQuestionProgress} disabled={answerMutation.isPending} className="w-full text-base sm:w-64">السؤال التالي ←</StudentButton>}</div></footer>
      </div>
      {skipConfirmation ? <SkipConfirmationDialog isFinish={skipConfirmation === 'finish'} onStay={() => setSkipConfirmation(null)} onSkip={continueFromCurrentQuestion} /> : null}
    </StudentShell>
  );
}

function SkipConfirmationDialog({ isFinish, onStay, onSkip }: { isFinish: boolean; onStay: () => void; onSkip: () => void }) {
  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="skip-question-title" aria-describedby="skip-question-description" className="student-panel w-full rounded-b-none p-6 sm:max-w-md sm:rounded-2xl"><div aria-hidden="true" className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-xl font-black text-amber-900">!</div><h2 id="skip-question-title" className="text-lg font-black text-[var(--student-ink)]">لم تجب عن هذا السؤال بعد</h2><p id="skip-question-description" className="mt-2 text-sm leading-7 text-[var(--student-muted)]">يمكنك البقاء والإجابة، أو تجاوز السؤال عمدًا وسيبقى بلا إجابة.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><StudentButton autoFocus onClick={onStay}>ابقَ وأجب</StudentButton><StudentButton variant="secondary" onClick={onSkip}>{isFinish ? 'تجاوز وإنهاء النشاط' : 'تجاوز هذا السؤال'}</StudentButton></div></section></div>;
}
