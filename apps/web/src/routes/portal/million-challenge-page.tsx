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
  Shield,
  Lightbulb,
  Shuffle,
  LogOut,
} from 'lucide-react';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import {
  challengeQuestions,
  getBackupQuestion,
} from '../../data/content/challenge';
import type { ChallengeQuestion } from '../../data/content/types';
import { studentResultsClient } from '../../data/api-client/guestbook-client';
import { useStageScrollReset } from '../../lib/scroll-reset';

type Stage = 'welcome' | 'playing' | 'result';
type ResultReason = 'win' | 'walked' | 'safe_haven' | 'lost';

const SAFE_HAVEN_5 = 1000;
const SAFE_HAVEN_10 = 32000;

function calculateGuaranteedPoints(completedLevelsCount: number): number {
  if (completedLevelsCount >= 10) return SAFE_HAVEN_10;
  if (completedLevelsCount >= 5) return SAFE_HAVEN_5;
  return 0;
}

function playTone(type: 'correct' | 'wrong' | 'win' | 'lifeline') {
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
    } else if (type === 'lifeline') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
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
  const [finalPoints, setFinalPoints] = useState(0);
  const [resultReason, setResultReason] = useState<ResultReason>('lost');
  const [isCorrectFeedback, setIsCorrectFeedback] = useState<boolean | null>(null);

  // Lifelines state
  const [usedLifelines, setUsedLifelines] = useState({
    fiftyFifty: false,
    hint: false,
    switchQuestion: false,
  });
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [activeBackupQuestion, setActiveBackupQuestion] = useState<ChallengeQuestion | null>(null);

  useStageScrollReset(stage, currentLevel);

  const baseQuestion = challengeQuestions[currentLevel];
  const question: ChallengeQuestion | undefined = activeBackupQuestion || baseQuestion;

  function handleStart() {
    if (name.trim().length < 2) return;
    setStage('playing');
    setCurrentLevel(0);
    setSelected(null);
    setTotalPoints(0);
    setFinalLevel(0);
    setFinalPoints(0);
    setResultReason('lost');
    setIsCorrectFeedback(null);
    setUsedLifelines({ fiftyFifty: false, hint: false, switchQuestion: false });
    setEliminatedOptions([]);
    setShowHint(false);
    setActiveBackupQuestion(null);
  }

  function handleFiftyFifty() {
    if (usedLifelines.fiftyFifty || selected !== null || !question) return;
    const wrongIndices = question.options
      .map((opt, idx) => (!opt.isCorrect ? idx : -1))
      .filter((idx) => idx !== -1);
    const shuffled = [...wrongIndices].sort(() => Math.random() - 0.5);
    setEliminatedOptions(shuffled.slice(0, 2));
    setUsedLifelines((prev) => ({ ...prev, fiftyFifty: true }));
    playTone('lifeline');
  }

  function handleHint() {
    if (usedLifelines.hint || selected !== null || !question?.hint) return;
    setShowHint(true);
    setUsedLifelines((prev) => ({ ...prev, hint: true }));
    playTone('lifeline');
  }

  function handleSwitchQuestion() {
    if (usedLifelines.switchQuestion || selected !== null || !question) return;
    const backup = getBackupQuestion(question.level, question.id);
    if (backup) {
      setActiveBackupQuestion(backup);
      setEliminatedOptions([]);
      setShowHint(false);
      setUsedLifelines((prev) => ({ ...prev, switchQuestion: true }));
      playTone('lifeline');
    }
  }

  function handleWalkAway() {
    if (totalPoints === 0 || selected !== null) return;
    const banked = totalPoints;
    setFinalPoints(banked);
    setFinalLevel(currentLevel);
    setResultReason('walked');
    setStage('result');
    void studentResultsClient.recordResult({
      studentName: name.trim() || 'طالب متميز',
      category: 'million',
      activityTitle: 'تحدي المليون Spark',
      score: banked,
      totalQuestions: 1000000,
      cefrLevel: banked >= 32000 ? 'B1 - Intermediate' : 'A2 - Elementary',
    });
  }

  function handleSelect(optIdx: number) {
    if (selected !== null || !question) return;
    const picked = question.options[optIdx];
    if (!picked) return;

    setSelected(optIdx);
    const correct = picked.isCorrect;
    setIsCorrectFeedback(correct);
    playTone(correct ? 'correct' : 'wrong');

    const earned = question.points;
    const levelIndex = currentLevel;

    if (correct) {
      setTimeout(() => {
        setTotalPoints(earned);
        if (levelIndex + 1 < challengeQuestions.length) {
          setCurrentLevel(levelIndex + 1);
          setSelected(null);
          setIsCorrectFeedback(null);
          setEliminatedOptions([]);
          setShowHint(false);
          setActiveBackupQuestion(null);
        } else {
          // Reached and completed level 15 (Million Points)
          setFinalPoints(1000000);
          setFinalLevel(15);
          setResultReason('win');
          setStage('result');
          playTone('win');
          void studentResultsClient.recordResult({
            studentName: name.trim() || 'طالب متميز',
            category: 'million',
            activityTitle: 'تحدي المليون Spark',
            score: 1000000,
            totalQuestions: 1000000,
            cefrLevel: 'B2 - Advanced',
          });
        }
      }, 1300);
    } else {
      // Wrong answer: 2.5s delay to let student read correct answer and explanation in bottom dock
      const guaranteed = calculateGuaranteedPoints(levelIndex);
      setTimeout(() => {
        setFinalPoints(guaranteed);
        setFinalLevel(levelIndex);
        setResultReason(guaranteed > 0 ? 'safe_haven' : 'lost');
        setStage('result');
        void studentResultsClient.recordResult({
          studentName: name.trim() || 'طالب متميز',
          category: 'million',
          activityTitle: 'تحدي المليون Spark',
          score: guaranteed,
          totalQuestions: 1000000,
          cefrLevel: guaranteed >= 32000 ? 'B1 - Intermediate' : 'A2 - Elementary',
        });
      }, 2600);
    }
  }

  function handleRestart() {
    setStage('welcome');
    setName('');
    setCurrentLevel(0);
    setSelected(null);
    setTotalPoints(0);
    setFinalLevel(0);
    setFinalPoints(0);
    setResultReason('lost');
    setIsCorrectFeedback(null);
    setUsedLifelines({ fiftyFifty: false, hint: false, switchQuestion: false });
    setEliminatedOptions([]);
    setShowHint(false);
    setActiveBackupQuestion(null);
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
    const correctOption = question.options.find((o) => o.isCorrect);

    return (
      <div
        className="challenge-shell fixed inset-0 z-50 flex h-dvh w-full flex-col justify-between overflow-hidden select-none"
        dir="rtl"
      >
        {/* Top Compact App HUD */}
        <header className="shrink-0 border-b border-white/10 bg-slate-950/60 px-3.5 py-2.5 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sky-200 hover:bg-white/10 hover:text-white transition"
              title="خروج من المسابقة"
              aria-label="خروج"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-1 flex-col gap-1 px-1 sm:px-3 min-w-0">
              <div className="flex items-center justify-between text-[11px] font-black whitespace-nowrap gap-2">
                <span className="text-sky-200">
                  المستوى {question.level} من 15
                </span>
                <span className="text-[var(--challenge-accent)]">
                  جائزة السؤال: ⭐ {question.points.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-amber-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-center min-w-[72px]">
              <span className="block text-[9px] font-bold text-amber-200 whitespace-nowrap">رصيدك الحالي</span>
              <span className="block text-xs font-black text-amber-300 whitespace-nowrap" dir="ltr">
                ⭐ {totalPoints.toLocaleString()}
              </span>
            </div>
          </div>
        </header>

        {/* Center Game Area (No Scroll on Mobile) */}
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center overflow-y-auto px-4 py-2 sm:py-3">
          {/* Mini Milestone Strip on Mobile */}
          <div className="mb-2 w-full">
            <div className="flex items-center justify-between gap-1 px-1 py-1 max-w-xl mx-auto w-full">
              {challengeQuestions.map((q, idx) => {
                const isCurrent = idx === currentLevel;
                const isPassed = idx < currentLevel;
                const isSafeHaven5 = idx === 4;
                const isSafeHaven10 = idx === 9;
                const isSafeHaven15 = idx === 14;
                const isMilestone = isSafeHaven5 || isSafeHaven10 || isSafeHaven15;

                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] sm:text-xs shadow-[0_0_12px_rgba(251,191,36,0.6)] scale-110 ring-2 ring-amber-300/80'
                        : isPassed
                        ? 'h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-emerald-500 text-white font-bold text-[9px] sm:text-[10px]'
                        : isMilestone
                        ? 'h-5 w-5 sm:h-6 sm:w-6 rounded-full border border-amber-400/60 bg-amber-400/20 text-amber-300 font-bold text-[9px] sm:text-[10px]'
                        : 'h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-white/15'
                    }`}
                    title={`المستوى ${idx + 1}: ${q.points.toLocaleString()} نقطة${isMilestone ? ' (محطة أمان)' : ''}`}
                  >
                    {isCurrent ? (
                      idx + 1
                    ) : isPassed ? (
                      '✓'
                    ) : isSafeHaven15 ? (
                      '👑'
                    ) : isMilestone ? (
                      '🛡️'
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full gap-6 lg:grid lg:grid-cols-12 lg:items-center">
            {/* Desktop Ladder Sidebar */}
            <div className="hidden lg:col-span-3 lg:block">
              <div className="challenge-panel flex flex-col-reverse justify-between rounded-2xl p-4 border border-white/10 space-y-reverse space-y-1">
                {challengeQuestions.map((q, idx) => {
                  const isCurrent = idx === currentLevel;
                  const isPassed = idx < currentLevel;
                  const isSafeHaven5 = idx === 4;
                  const isSafeHaven10 = idx === 9;
                  const isSafeHaven15 = idx === 14;
                  const isMilestone = isSafeHaven5 || isSafeHaven10 || isSafeHaven15;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                        isCurrent
                          ? 'bg-[var(--challenge-accent)] text-slate-900 shadow-[0_0_15px_rgba(251,191,36,0.3)] font-black'
                          : isPassed
                          ? 'text-emerald-400 font-semibold'
                          : isMilestone
                          ? 'text-amber-300 font-bold border border-amber-400/30 bg-amber-400/10'
                          : 'text-sky-200/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{idx + 1}</span>
                        {isSafeHaven15 ? (
                          <span title="الجائزة الكبرى">👑</span>
                        ) : isMilestone ? (
                          <span title="محطة أمان">🛡️</span>
                        ) : null}
                      </div>
                      <span dir="ltr">⭐ {q.points.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Question & Lifelines & 4 Options */}
            <div className="lg:col-span-9 flex flex-col justify-center space-y-2.5 sm:space-y-3.5">
              {/* 3 Lifelines Header */}
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleFiftyFifty}
                  disabled={usedLifelines.fiftyFifty || selected !== null}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] sm:text-xs font-black transition ${
                    usedLifelines.fiftyFifty
                      ? 'border-white/5 bg-white/5 text-white/30 line-through cursor-not-allowed'
                      : 'border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 active:scale-95 shadow-sm'
                  }`}
                  title={usedLifelines.fiftyFifty ? 'تم استخدام 50:50' : 'حذف خيارين خاطئين'}
                >
                  <span className="font-mono text-xs">50:50</span>
                  <span>حذف خيارين</span>
                </button>

                <button
                  type="button"
                  onClick={handleHint}
                  disabled={usedLifelines.hint || selected !== null || !question.hint}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] sm:text-xs font-black transition ${
                    usedLifelines.hint
                      ? 'border-white/5 bg-white/5 text-white/30 line-through cursor-not-allowed'
                      : 'border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 active:scale-95 shadow-sm'
                  }`}
                  title={usedLifelines.hint ? 'تم استخدام التلميح' : 'تلميح المعلمة'}
                >
                  <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                  <span>تلميح</span>
                </button>

                <button
                  type="button"
                  onClick={handleSwitchQuestion}
                  disabled={usedLifelines.switchQuestion || selected !== null}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] sm:text-xs font-black transition ${
                    usedLifelines.switchQuestion
                      ? 'border-white/5 bg-white/5 text-white/30 line-through cursor-not-allowed'
                      : 'border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 active:scale-95 shadow-sm'
                  }`}
                  title={usedLifelines.switchQuestion ? 'تم استخدام تبديل السؤال' : 'تبديل السؤال بسؤال بديل'}
                >
                  <Shuffle className="h-3.5 w-3.5 text-amber-400" />
                  <span>تبديل</span>
                </button>
              </div>

              {/* Question Card */}
              <div className={`challenge-panel challenge-enter p-4 sm:p-7 ${flashClass}`}>
                <p
                  className="text-center text-base sm:text-2xl font-black leading-relaxed text-white select-text"
                  dir="ltr"
                >
                  {question.prompt}
                </p>
              </div>

              {/* Golden Hint Banner (When Lifeline Activated) */}
              {showHint && question.hint && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/50 bg-amber-500/15 p-3 text-xs sm:text-sm font-bold text-amber-200 backdrop-blur-xs">
                  <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-right">
                    <span className="font-black text-amber-300 block mb-0.5">💡 تلميح المعلمة:</span>
                    <span className="text-amber-100">{question.hint}</span>
                  </div>
                </div>
              )}

              {/* 4 Options Grid */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {question.options.map((opt, idx) => {
                  const isEliminated = eliminatedOptions.includes(idx);
                  if (isEliminated) {
                    return (
                      <div
                        key={'eliminated-' + idx}
                        className="opacity-0 pointer-events-none invisible min-h-[52px]"
                        aria-hidden="true"
                      />
                    );
                  }

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
                      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl sm:rounded-2xl border-2 px-4 py-3 sm:py-3.5 transition-all duration-200 active:scale-[0.99] min-h-[52px] ${stateClass}`}
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
          className={`shrink-0 border-t px-4 py-2 sm:py-2.5 transition-colors ${
            isCorrectFeedback === true
              ? 'border-emerald-500/40 bg-emerald-950/90'
              : isCorrectFeedback === false
              ? 'border-rose-500/40 bg-rose-950/90'
              : 'border-white/10 bg-slate-950/70'
          }`}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 text-xs font-black">
            <div className="flex-1 min-w-0">
              {isCorrectFeedback === true ? (
                <span className="text-emerald-300">
                  ✨ إجابة صحيحة! أحسنت، رصيدك الآن: ⭐ {question.points.toLocaleString()} نقطة!
                </span>
              ) : isCorrectFeedback === false ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-rose-200">
                  <span>
                    ❌ إجابة خاطئة! الإجابة الصحيحة هي:{' '}
                    <strong className="text-emerald-300" dir="ltr">
                      "{correctOption?.text}"
                    </strong>
                  </span>
                  {calculateGuaranteedPoints(currentLevel) > 0 ? (
                    <span className="text-amber-300">
                      🛡️ تم تأمين {calculateGuaranteedPoints(currentLevel).toLocaleString()} نقطة في محطة الأمان!
                    </span>
                  ) : (
                    <span className="text-sky-300/80">لم تصل لمحطة الأمان بعد.</span>
                  )}
                </div>
              ) : (
                <span className="text-sky-200/80 truncate block">
                  الاسم: <strong className="text-white">{name}</strong>
                </span>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-2">
              {totalPoints > 0 && selected === null ? (
                <button
                  type="button"
                  onClick={handleWalkAway}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-black text-emerald-300 hover:bg-emerald-500/30 active:scale-95 transition shadow-xs whitespace-nowrap"
                  title="انسحاب وتأمين الرصيد الحالي"
                >
                  <LogOut className="h-3.5 w-3.5 rotate-180 shrink-0" />
                  <span>انسحاب ({totalPoints.toLocaleString()} ⭐)</span>
                </button>
              ) : (
                <span className="text-amber-300 whitespace-nowrap">
                  المستوى {question.level} / 15
                </span>
              )}
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="challenge-shell flex min-h-dvh flex-col" dir="rtl">
      <PortalNav variant="dark" />

      <main className="relative z-10 flex min-h-[calc(100dvh-6.5rem)] flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="mb-4 self-start max-w-xl w-full mx-auto flex items-center gap-1.5 text-xs font-bold text-sky-200/70">
          <Link className="hover:text-amber-400 transition" to="/competitions">
            المسابقات والتحديات
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-amber-400 font-black">تحدي المليون Spark</span>
        </div>

        {stage === 'welcome' && (
          <div className="challenge-panel challenge-enter w-full max-w-xl py-8 px-5 sm:p-10 space-y-6 text-center">
            <div>
              <span className="mb-3 inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
                <Award className="h-8 w-8 sm:h-9 sm:w-9" />
              </span>
              <p className="text-xs font-black tracking-[0.2em] text-[var(--challenge-accent)]">
                SPARK CHALLENGE
              </p>
              <h1 className="mt-1.5 text-2xl font-black text-white sm:text-4xl">تحدي المليون Spark</h1>
            </div>

            {/* Input & Start Button First on Mobile for Immediate Thumb Reach */}
            <div>
              <input
                type="text"
                placeholder="اكتب اسمك هنا للبدء..."
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

            <div className="rounded-2xl bg-white/5 p-4 text-right border border-white/10">
              <ul className="flex flex-col gap-2 text-xs sm:text-sm font-semibold leading-relaxed text-sky-100">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--challenge-accent)] font-black">1.</span>
                  <span>15 سؤالاً متدرج الصعوبة للوصول إلى جائزة المليون نقطة.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-black">2.</span>
                  <span>محطتا أمان تضمن رصيدك: المستوى 5 (1,000 نقطة) والمستوى 10 (32,000 نقطة).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-black">3.</span>
                  <span>3 وسائل مساعدة: حذف خيارين (50:50)، تلميح المعلمة، وتبديل السؤال.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-sky-300 font-black">4.</span>
                  <span>يمكنك الانسحاب في أي وقت وتأمين رصيدك الحالي كاملاً!</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-black">5.</span>
                  <span>احذر: أي إجابة خاطئة تنهي الجولة فوراً!</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {stage === 'result' && (
          <div
            className={`challenge-panel challenge-enter w-full max-w-xl py-8 px-5 sm:p-10 space-y-6 text-center ${
              resultReason === 'win'
                ? 'challenge-result-win'
                : 'challenge-result-lose'
            }`}
          >
            <div>
              <span className="mb-4 inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-white/10 text-white shadow-xl backdrop-blur-md">
                {resultReason === 'win' ? (
                  <Trophy className="h-8 w-8 sm:h-10 sm:w-10 text-amber-400" />
                ) : resultReason === 'safe_haven' ? (
                  <Shield className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-400" />
                ) : resultReason === 'walked' ? (
                  <Award className="h-8 w-8 sm:h-10 sm:w-10 text-sky-400" />
                ) : (
                  <RotateCcw className="h-8 w-8 sm:h-10 sm:w-10 text-rose-400" />
                )}
              </span>

              <h2 className="text-2xl sm:text-4xl font-black text-white">
                {resultReason === 'win'
                  ? `مبروك يا ${name}! الفوز الكبير في تحدي Spark! 🏆`
                  : resultReason === 'walked'
                  ? `قرار ذكي يا ${name}! تم الانسحاب وتأمين الرصيد بنجاح 👏`
                  : resultReason === 'safe_haven'
                  ? `محاولة ممتازة يا ${name}! تم الوصول لمحطة الأمان 🛡️`
                  : `محاولة جيدة يا ${name}! حظاً أوفر في الجولة القادمة`}
              </h2>

              <p className="mt-2 text-sm sm:text-base font-bold text-sky-200">
                {resultReason === 'win'
                  ? 'أنت بطل Spark الرسمي وحققت العلامة الكاملة عن جدارة واستحقاق!'
                  : resultReason === 'walked'
                  ? `تم تأمين رصيدك بنجاح عند المستوى ${finalLevel} من 15`
                  : resultReason === 'safe_haven'
                  ? `توقفت عند المستوى ${finalLevel} وخرجت برصيد محطة الأمان المضمون!`
                  : `توقفت عند المستوى ${finalLevel} قبل الوصول لمحطة الأمان الأولى.`}
              </p>
            </div>

            <div className="inline-flex items-center gap-2.5 rounded-2xl bg-black/40 px-6 py-3 border border-white/10">
              <span className="text-xs sm:text-sm font-bold text-sky-300">الرصيد النهائي المحقق:</span>
              <span className="text-2xl sm:text-3xl font-black text-[var(--challenge-accent)]">
                ⭐ {finalPoints.toLocaleString()}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--challenge-accent)] px-7 py-3.5 text-xs sm:text-sm font-black text-slate-950 transition hover:brightness-105 active:scale-95 sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" />
                <span>العب مرة أخرى</span>
              </button>
              <Link
                className="w-full inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-xs sm:text-sm font-bold text-white transition hover:bg-white/10 sm:w-auto"
                to="/competitions"
              >
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
