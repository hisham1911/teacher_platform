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
  X,
} from 'lucide-react';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { challengeQuestions } from '../../data/content/challenge';
import { useStageScrollReset } from '../../lib/scroll-reset';

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

  useStageScrollReset(stage, currentLevel);

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
    }, 1500);
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

  // =========================================================================
  // FULL-SCREEN LOCKED 100dvh GAME MODE FOR 'playing'
  // =========================================================================
  if (stage === 'playing' && question) {
    const completedLevels = currentLevel + (isCorrectFeedback === true ? 1 : 0);
    const progressPercent = Math.round((completedLevels / challengeQuestions.length) * 100);

    return (
      <div
        className="challenge-shell fixed inset-0 z-50 flex h-dvh w-full flex-col justify-between overflow-hidden select-none"
        dir="rtl"
      >
        {/* Top Compact App HUD */}
        <header className="shrink-0 border-b border-white/10 bg-slate-950/60 px-3.5 py-2.5 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sky-200 hover:bg-white/10 hover:text-white transition"
              title="خروج من المسابقة"
              aria-label="خروج"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-1 flex-col gap-1 px-2">
              <div className="flex items-center justify-between text-[11px] font-black">
                <span className="text-sky-200">
                  المستوى {question.level} من 15
                </span>
                <span className="text-[var(--challenge-accent)]">
                  ⭐ {question.points.toLocaleString()} نقطة
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-amber-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-center">
              <span className="block text-[9px] font-bold text-amber-200">مجموعك</span>
              <span className="block text-xs font-black text-amber-300" dir="ltr">
                {totalPoints.toLocaleString()}
              </span>
            </div>
          </div>
        </header>

        {/* Center Game Area (No Scroll on Mobile) */}
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center overflow-y-auto px-4 py-2 sm:py-4">
          <div className="w-full gap-6 lg:grid lg:grid-cols-12 lg:items-center">
            {/* Desktop Ladder Sidebar */}
            <div className="hidden lg:col-span-3 lg:block">
              <div className="challenge-panel flex flex-col-reverse justify-between rounded-2xl p-4 border border-white/10">
                {challengeQuestions.map((q, idx) => {
                  const isCurrent = idx === currentLevel;
                  const isPassed = idx < currentLevel;
                  const isMilestone = (idx + 1) % 5 === 0;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-lg px-3 py-1 text-xs font-bold transition-all ${
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
                      <span>⭐ {q.points.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Question & 4 Options */}
            <div className="lg:col-span-9 flex flex-col justify-center space-y-3 sm:space-y-4">
              <div className={`challenge-panel challenge-enter p-4 sm:p-8 ${flashClass}`}>
                <p
                  className="text-center text-base sm:text-2xl font-black leading-relaxed text-white select-text"
                  dir="ltr"
                >
                  {question.prompt}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {question.options.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  let stateClass =
                    'bg-slate-800/75 border-slate-700 text-sky-100 hover:bg-slate-700 hover:border-slate-500';
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
                      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl sm:rounded-2xl border-2 px-4 py-3 sm:py-4 transition-all duration-200 active:scale-[0.99] min-h-[52px] ${stateClass}`}
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
        </main>

        {/* Bottom Docked Status Bar (Zero Layout Shift) */}
        <footer
          className={`shrink-0 border-t px-4 py-2.5 transition-colors ${
            isCorrectFeedback === true
              ? 'border-emerald-500/40 bg-emerald-950/90'
              : isCorrectFeedback === false
              ? 'border-rose-500/40 bg-rose-950/90'
              : 'border-white/10 bg-slate-950/70'
          }`}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between text-xs font-black">
            {isCorrectFeedback !== null ? (
              <span
                className={
                  isCorrectFeedback ? 'text-emerald-300' : 'text-rose-300'
                }
              >
                {isCorrectFeedback
                  ? '✨ إجابة صحيحة! جاري الانتقال للمستوى التالي...'
                  : '❌ إجابة خاطئة! انتهت الجولة.'}
              </span>
            ) : (
              <span className="text-sky-200/80">
                المتسابقة: <strong className="text-white">{name}</strong>
              </span>
            )}
            <span className="text-amber-300">
              المستوى {question.level} / 15
            </span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="challenge-shell flex min-h-dvh flex-col" dir="rtl">
      <PortalNav variant="dark" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-5 sm:py-10">
        <div className="mb-3 self-start max-w-6xl w-full mx-auto flex items-center gap-1.5 text-xs font-bold text-sky-200/70">
          <Link className="hover:text-amber-400 transition" to="/competitions">
            المسابقات والتحديات
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-amber-400 font-black">تحدي المليون Spark</span>
        </div>

        {stage === 'welcome' && (
          <div className="challenge-panel challenge-enter w-full max-w-xl p-5 text-center sm:p-10">
            <span className="mb-3 inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
              <Award className="h-8 w-8 sm:h-9 sm:w-9" />
            </span>
            <p className="text-xs font-black tracking-[0.2em] text-[var(--challenge-accent)]">
              SPARK CHALLENGE
            </p>
            <h1 className="mt-1.5 text-2xl font-black text-white sm:text-4xl">تحدي المليون Spark</h1>

            {/* Input & Start Button First on Mobile for Immediate Thumb Reach */}
            <div className="mt-5">
              <input
                type="text"
                placeholder="اكتبي اسمكِ هنا للبدء..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-12 rounded-2xl bg-white/10 px-5 py-3 text-center text-base sm:text-lg font-bold text-white placeholder-white/40 outline-none ring-2 ring-white/10 transition-all focus:bg-white/15 focus:ring-[var(--challenge-accent)]"
                maxLength={30}
              />
              <button
                type="button"
                onClick={handleStart}
                disabled={name.trim().length < 2}
                className="mt-3.5 w-full flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 px-8 py-3.5 text-base font-black text-slate-950 shadow-[0_0_30px_rgba(251,191,36,0.35)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
              >
                <Sparkles className="h-5 w-5" />
                <span>ابدأ التحدي الآن</span>
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-white/5 p-4 text-right border border-white/10">
              <ul className="flex flex-col gap-2 text-xs sm:text-sm font-semibold leading-relaxed text-sky-100">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--challenge-accent)] font-black">1.</span>
                  <span>15 سؤالاً متدرج الصعوبة نحو القمة.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--challenge-accent)] font-black">2.</span>
                  <span>كل إجابة صحيحة ترفع رصيدك من النقاط.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-black">3.</span>
                  <span>احذري: أي إجابة خاطئة تنهي الجولة فوراً!</span>
                </li>
              </ul>
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
                ? `مبروك يا ${name}! أنتِ بطلة Spark!`
                : `محاولة رائعة يا ${name}!`}
            </h2>
            <p className="mt-2 text-sm sm:text-base font-bold text-sky-200">
              وصلتِ إلى المستوى <span className="text-white font-black">{finalLevel}</span> من 15
            </p>
            <div className="mt-5 inline-flex items-center gap-2.5 rounded-2xl bg-black/40 px-6 py-3 border border-white/10">
              <span className="text-xs sm:text-sm font-bold text-sky-300">مجموع النقاط:</span>
              <span className="text-2xl sm:text-3xl font-black text-[var(--challenge-accent)]">
                ⭐ {totalPoints.toLocaleString()}
              </span>
            </div>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--challenge-accent)] px-7 py-3.5 text-xs sm:text-sm font-black text-slate-950 transition hover:brightness-105 active:scale-95 sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" />
                <span>العب مرة أخرى</span>
              </button>
              <Link className="w-full inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-xs sm:text-sm font-bold text-white transition hover:bg-white/10 sm:w-auto" to="/competitions">
                العودة للمسابقات
              </Link>
            </div>
          </div>
        )}
      </main>

      <PortalFooter variant="dark" />
    </div>
  );
}
