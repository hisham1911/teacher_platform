import { useState, useEffect } from 'react';
import { Trophy, RotateCcw, Lightbulb, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import type { QuizQuestion } from '../../data/content/types';

interface InlineQuizProps {
  questions: QuizQuestion[];
}

function playQuizTone(isCorrect: boolean) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isCorrect) {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.frequency.setValueAtTime(261.63, ctx.currentTime); // C4
      osc.frequency.exponentialRampToValueAtTime(196, ctx.currentTime + 0.2); // G3
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // AudioContext blocked or unsupported
  }
}

/**
 * اختبار تفاعلي فوري — يعرض سؤالاً واحداً في كل مرة،
 * يلوّن الإجابة فور الاختيار مع صوت تفاعلي ثم ينتقل تلقائياً للسؤال التالي.
 */
export function InlineQuiz({ questions }: InlineQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  }, [questions]);

  const question = questions[currentIndex];

  function handleSelect(optionIndex: number) {
    if (selected !== null) return;
    const current = questions[currentIndex];
    if (!current) return;
    setSelected(optionIndex);
    const isCorrect = !!current.options[optionIndex]?.isCorrect;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    playQuizTone(isCorrect);
  }

  function handleNext() {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelected(null);
    } else {
      setFinished(true);
    }
  }

  function reset() {
    setCurrentIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  }

  if (questions.length === 0 || !question) return null;

  if (finished) {
    const percentage = Math.round((score / questions.length) * 100);
    const passed = percentage >= 75;
    return (
      <div
        className={`rounded-2xl sm:rounded-3xl border p-6 sm:p-8 text-center shadow-md backdrop-blur-md transition-all ${
          passed
            ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
            : 'border-amber-200 bg-amber-50/90 text-amber-950'
        }`}
      >
        <span className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-white shadow-xs">
          {passed ? (
            <Trophy className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-600" />
          ) : (
            <RotateCcw className="h-8 w-8 sm:h-10 sm:w-10 text-amber-600" />
          )}
        </span>
        <h3 className="mt-4 text-2xl sm:text-3xl font-black tabular-nums" dir="ltr">
          {score} / {questions.length}
        </h3>
        <p className="mt-1 text-base sm:text-lg font-bold text-slate-700">
          {percentage}% نسبة الإجابات الصحيحة
        </p>
        <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-600">
          {passed
            ? 'ممتاز جداً! استيعابك للقاعدة ومفرداتها رائع.'
            : 'أداء جيد! يمكنك إعادة المحاولة لتحقيق العلامة الكاملة.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-7 text-xs sm:text-sm font-black text-white shadow-md shadow-violet-700/20 hover:bg-violet-800 transition-all active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          <span>إعادة الاختبار</span>
        </button>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-5 sm:p-7 shadow-xs backdrop-blur-xl">
      {/* Quiz Header & Progress */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs font-black text-slate-500">
          <span>
            السؤال {currentIndex + 1} من {questions.length}
          </span>
          <span className="rounded-full bg-violet-100 px-3 py-0.5 font-bold text-violet-800">
            النقاط: {score}
          </span>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Prompt */}
      <p className="text-base sm:text-xl font-black leading-relaxed text-slate-900 select-text" dir="ltr">
        {question.prompt}
      </p>

      {/* Hint */}
      {question.hint && selected !== null && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-xs sm:text-sm font-bold text-sky-900 border border-sky-100 animate-page-enter">
          <Lightbulb className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
          <p className="leading-5">{question.hint}</p>
        </div>
      )}

      {/* Options */}
      <div className="mt-5 flex flex-col gap-2.5">
        {question.options.map((option, optIdx) => {
          const letter = String.fromCharCode(65 + optIdx);
          let style =
            'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50 text-slate-800';
          let badgeStyle = 'bg-slate-100 text-slate-600';

          if (selected !== null) {
            if (option.isCorrect) {
              style =
                'border-emerald-500 bg-emerald-50 text-emerald-950 font-black ring-2 ring-emerald-400/50';
              badgeStyle = 'bg-emerald-600 text-white';
            } else if (optIdx === selected && !option.isCorrect) {
              style =
                'border-rose-500 bg-rose-50 text-rose-950 font-black ring-2 ring-rose-400/50';
              badgeStyle = 'bg-rose-600 text-white';
            } else {
              style = 'border-slate-100 bg-slate-50/70 text-slate-400 opacity-60';
              badgeStyle = 'bg-slate-200 text-slate-400';
            }
          }

          return (
            <button
              key={optIdx}
              type="button"
              onClick={() => handleSelect(optIdx)}
              disabled={selected !== null}
              className={`flex items-center gap-3 rounded-xl sm:rounded-2xl border-2 px-4 py-3 sm:px-5 sm:py-3.5 text-left text-sm sm:text-base font-bold transition-all active:scale-[0.99] min-h-[50px] ${style}`}
              dir="ltr"
            >
              <span
                className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl text-xs font-black transition-colors ${badgeStyle}`}
              >
                {letter}
              </span>
              <span className="flex-1">{option.text}</span>
              {selected !== null && option.isCorrect && (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              )}
              {selected !== null && optIdx === selected && !option.isCorrect && (
                <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Action / Next Question button once answered */}
      {selected !== null && (
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4 animate-page-enter">
          <span className="text-xs font-bold text-slate-600">
            {question.options[selected]?.isCorrect
              ? '✅ إجابة صحيحة وممتازة!'
              : '💡 راجعي الملاحظة التعليمية بالأعلى لمعرفة القاعدة.'}
          </span>
          <button
            type="button"
            onClick={handleNext}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-sm shadow-violet-700/20 hover:bg-violet-800 transition active:scale-95"
          >
            <span>
              {currentIndex + 1 === questions.length ? 'عرض النتيجة النهائية' : 'السؤال التالي'}
            </span>
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default InlineQuiz;
