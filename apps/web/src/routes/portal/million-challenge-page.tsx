import { useState } from 'react';
import { Link } from 'react-router';
import {
  Award,
  Trophy,
  RotateCcw,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { challengeQuestions } from '../../data/content/challenge';

type Stage = 'welcome' | 'playing' | 'result';

function playTone(type: 'correct' | 'wrong' | 'win') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (type === 'correct') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(146.83, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'win') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.3);
      });
    }
  } catch {
    // AudioContext blocked
  }
}

export default function MillionChallengePage() {
  const [stage, setStage] = useState<Stage>('welcome');
  const [name, setName] = useState('');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [finalLevel, setFinalLevel] = useState(0);
  const [isCorrectFeedback, setIsCorrectFeedback] = useState<boolean | null>(null);

  const question = challengeQuestions[currentLevel];

  function handleStart() {
    if (name.trim().length < 2) return;
    setStage('playing');
    setCurrentLevel(0);
    setSelected(null);
    setTotalPoints(0);
    setIsCorrectFeedback(null);
  }

  function handleSelect(optIdx: number) {
    if (selected !== null) return;
    const current = challengeQuestions[currentLevel];
    if (!current) return;
    const picked = current.options[optIdx];
    if (!picked) return;

    setSelected(optIdx);
    const correct = picked.isCorrect;
    setIsCorrectFeedback(correct);
    playTone(correct ? 'correct' : 'wrong');

    const earned = current.points;
    const level = currentLevel;

    setTimeout(() => {
      if (correct) {
        setTotalPoints((prev) => prev + earned);
        if (level + 1 < challengeQuestions.length) {
          setCurrentLevel(level + 1);
          setSelected(null);
          setIsCorrectFeedback(null);
        } else {
          setFinalLevel(15);
          setStage('result');
          playTone('win');
        }
      } else {
        setFinalLevel(level);
        setStage('result');
      }
    }, 1800);
  }

  function handleRestart() {
    setStage('welcome');
    setName('');
    setCurrentLevel(0);
    setSelected(null);
    setTotalPoints(0);
    setFinalLevel(0);
    setIsCorrectFeedback(null);
  }

  const flashClass =
    isCorrectFeedback === true
      ? 'challenge-flash-ok'
      : isCorrectFeedback === false
      ? 'challenge-flash-bad'
      : '';

  return (
    <div className="challenge-shell flex min-h-dvh flex-col" dir="rtl">
      <PortalNav variant="dark" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12">
        {/* Breadcrumb on Mobile/Desktop */}
        <div className="mb-4 self-start max-w-6xl w-full mx-auto flex items-center gap-1.5 text-xs font-bold text-sky-200/70">
          <Link to="/competitions" className="hover:text-amber-400 transition">
            المسابقات
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-amber-400 font-black">مسابقة المليون</span>
        </div>

        {stage === 'welcome' && (
          <div className="challenge-panel challenge-enter w-full max-w-xl p-6 text-center sm:p-12">
            <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
              <Award className="h-9 w-9" />
            </span>
            <p className="text-xs font-black tracking-[0.2em] text-[var(--challenge-accent)]">
              MILLION CHALLENGE
            </p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">مسابقة المليون</h1>

            <div className="mt-6 rounded-2xl bg-white/5 p-5 text-right border border-white/10">
              <ul className="flex flex-col gap-3 text-xs sm:text-sm font-semibold leading-relaxed text-sky-100">
                <li className="flex items-start gap-2.5">
                  <span className="text-[var(--challenge-accent)] font-black">1.</span>
                  <span>15 سؤالاً متدرجة الصعوبة في قواعد ومفردات اللغة الإنجليزية.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[var(--challenge-accent)] font-black">2.</span>
                  <span>الإجابة الصحيحة ترفعك للمستوى التالي وتزيد مجموع نقاطك.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-black">3.</span>
                  <span>خطأ واحد ينهي الجولة فوراً — التركيز مطلوب للوصول للقمة!</span>
                </li>
              </ul>
            </div>

            <div className="mt-6">
              <input
                type="text"
                placeholder="اكتب اسمك هنا للبدء..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl bg-white/10 px-5 py-3.5 text-center text-base sm:text-lg font-bold text-white placeholder-white/40 outline-none ring-2 ring-white/10 transition-all focus:bg-white/15 focus:ring-[var(--challenge-accent)]"
                maxLength={30}
              />
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={name.trim().length < 2}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 px-8 py-4 text-base font-black text-slate-950 shadow-[0_0_30px_rgba(251,191,36,0.35)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
            >
              <Sparkles className="h-5 w-5" />
              <span>ابدأ التحدي الآن</span>
            </button>
          </div>
        )}

        {stage === 'playing' && question && (
          <div className="w-full max-w-6xl gap-6 lg:grid lg:grid-cols-12">
            {/* Desktop Ladder Sidebar */}
            <div className="hidden lg:col-span-3 lg:block">
              <div className="challenge-panel challenge-enter flex h-full flex-col-reverse justify-between rounded-2xl p-5 border border-white/10">
                {challengeQuestions.map((q, idx) => {
                  const isCurrent = idx === currentLevel;
                  const isPassed = idx < currentLevel;
                  const isMilestone = (idx + 1) % 5 === 0;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                        isCurrent
                          ? 'bg-[var(--challenge-accent)] text-slate-900 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                          : isPassed
                          ? 'text-emerald-400 font-semibold'
                          : isMilestone
                          ? 'text-white font-bold'
                          : 'text-sky-200/50'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      <span>♦ {q.points.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main Question Area */}
            <div className="lg:col-span-9">
              {/* Mobile Header / Ladder info */}
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/5 px-5 py-3 text-xs sm:text-sm font-bold text-sky-200 lg:hidden border border-white/10">
                <span>المستوى {question.level} من 15</span>
                <span className="flex items-center gap-1.5 text-[var(--challenge-accent)] font-black">
                  ♦ {question.points.toLocaleString()} نقطة
                </span>
              </div>

              <div className={`challenge-panel challenge-enter p-6 sm:p-10 ${flashClass}`}>
                <p
                  className="text-center text-xl sm:text-2xl font-black leading-relaxed text-white select-text"
                  dir="ltr"
                >
                  {question.prompt}
                </p>

                {isCorrectFeedback !== null && (
                  <div className="mt-5 flex justify-center">
                    <div
                      className={
                        isCorrectFeedback ? 'challenge-feedback-ok' : 'challenge-feedback-bad'
                      }
                    >
                      {isCorrectFeedback
                        ? 'إجابة صحيحة! ننتقل للسؤال التالي...'
                        : 'إجابة خاطئة! انتهى التحدي.'}
                    </div>
                  </div>
                )}
              </div>

              {/* 4 Options on Mobile & Desktop */}
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {question.options.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  let stateClass =
                    'bg-slate-800/70 border-slate-700 text-sky-100 hover:bg-slate-700 hover:border-slate-500';

                  if (selected !== null) {
                    if (opt.isCorrect) {
                      stateClass =
                        'bg-emerald-900/90 border-emerald-500 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.3)]';
                    } else if (idx === selected && !opt.isCorrect) {
                      stateClass =
                        'bg-rose-900/90 border-rose-500 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.3)]';
                    } else {
                      stateClass = 'bg-slate-800/30 border-slate-800 text-slate-500 opacity-50';
                    }
                  }

                  return (
                    <button
                      key={opt.text + idx}
                      type="button"
                      onClick={() => handleSelect(idx)}
                      disabled={selected !== null}
                      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl sm:rounded-2xl border-2 px-4 py-3.5 sm:py-4 transition-all duration-200 active:scale-[0.99] min-h-[52px] ${stateClass}`}
                      dir="ltr"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs sm:text-sm font-black transition-colors ${
                          selected !== null
                            ? 'bg-black/30 text-white'
                            : 'bg-white/10 text-amber-300 group-hover:bg-[var(--challenge-accent)] group-hover:text-slate-950'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-left flex-1">
                        {opt.text}
                      </span>
                      {selected !== null && opt.isCorrect && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                      )}
                      {selected !== null && idx === selected && !opt.isCorrect && (
                        <XCircle className="h-5 w-5 text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {stage === 'result' && (
          <div
            className={`challenge-panel challenge-enter w-full max-w-xl p-6 text-center sm:p-10 ${
              finalLevel >= 15 ? 'challenge-result-win' : 'challenge-result-lose'
            }`}
          >
            <span className="mb-4 inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-white/10 text-white shadow-xl backdrop-blur-md">
              <Trophy className="h-8 w-8 sm:h-10 sm:w-10 text-amber-400" />
            </span>

            <h2 className="text-2xl sm:text-4xl font-black text-white">
              {finalLevel >= 15
                ? `أسطورة يا ${name}! ربحت المليون!`
                : `محاولة رائعة يا ${name}!`}
            </h2>

            <p className="mt-2 text-sm sm:text-base font-bold text-sky-200">
              وصلت للمستوى <span className="text-white font-black">{finalLevel}</span> من 15
            </p>

            <div className="mt-5 inline-flex items-center gap-2.5 rounded-2xl bg-black/40 px-6 py-3 border border-white/10">
              <span className="text-xs sm:text-sm font-bold text-sky-300">الرصيد النهائي:</span>
              <span className="text-2xl sm:text-3xl font-black text-[var(--challenge-accent)]">
                ♦ {totalPoints.toLocaleString()}
              </span>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--challenge-accent)] px-7 py-3.5 text-xs sm:text-sm font-black text-slate-950 transition hover:brightness-105 active:scale-95 sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" />
                <span>العب مرة أخرى</span>
              </button>
              <Link
                to="/competitions"
                className="w-full inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-xs sm:text-sm font-bold text-white transition hover:bg-white/10 sm:w-auto"
              >
                العودة لقسم المسابقات
              </Link>
            </div>
          </div>
        )}
      </main>

      <PortalFooter variant="dark" />
    </div>
  );
}
