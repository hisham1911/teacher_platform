import { useState, useEffect } from 'react';
import type { QuizQuestion } from '../../data/content/types';

interface InlineQuizProps {
  questions: QuizQuestion[];
}

function playQuizTone(isCorrect: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((prev) => prev + 1);
        setSelected(null);
      } else {
        setFinished(true);
      }
    }, 1300);
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
        className={`rounded-3xl border p-8 text-center shadow-lg backdrop-blur-md transition-all ${
          passed ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950' : 'border-amber-200 bg-amber-50/90 text-amber-950'
        }`}
      >
        <span className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm text-4xl">
          {passed ? '🎉' : '💪'}
        </span>
        <h3 className="mt-4 text-3xl font-black">
          {score} / {questions.length}
        </h3>
        <p className="mt-1 text-lg font-bold text-slate-600">{percentage}% إجابات صحيحة</p>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          {passed ? 'ممتاز جداً! استيعابك للقاعدة رائع.' : 'أداء جيد! يمكنك إعادة المحاولة لتحقيق نتيجة كاملة.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet-700 px-8 text-sm font-black text-white shadow-md shadow-violet-700/20 hover:bg-violet-800 hover:shadow-lg transition-all"
        >
          أعد الاختبار ↻
        </button>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-md backdrop-blur-xl sm:p-8">
      {/* Quiz Header & Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-black text-slate-500">
          <span>السؤال {currentIndex + 1} من {questions.length}</span>
          <span className="rounded-full bg-violet-100 px-3 py-1 font-bold text-violet-800">
            النقاط: {score}
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Prompt */}
      <p className="text-xl font-black leading-relaxed text-slate-900 sm:text-2xl" dir="ltr">
        {question.prompt}
      </p>

      {/* Hint */}
      {question.hint && selected !== null && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-sky-50 p-3.5 text-sm font-bold text-sky-900 border border-sky-100 animate-page-enter">
          <span className="text-base shrink-0">💡</span>
          <p className="leading-6">{question.hint}</p>
        </div>
      )}

      {/* Options */}
      <div className="mt-6 flex flex-col gap-3">
        {question.options.map((option, optIdx) => {
          const letter = String.fromCharCode(65 + optIdx);
          let style = 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50 text-slate-800';
          let badgeStyle = 'bg-slate-100 text-slate-600';

          if (selected !== null) {
            if (option.isCorrect) {
              style = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-black ring-2 ring-emerald-400/50';
              badgeStyle = 'bg-emerald-600 text-white';
            } else if (optIdx === selected && !option.isCorrect) {
              style = 'border-rose-500 bg-rose-50 text-rose-950 font-black ring-2 ring-rose-400/50';
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
              className={`flex items-center gap-3.5 rounded-2xl border-2 px-5 py-4 text-left text-base font-bold transition-all ${style}`}
              dir="ltr"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-colors ${badgeStyle}`}>
                {letter}
              </span>
              <span className="flex-1">{option.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default InlineQuiz;
