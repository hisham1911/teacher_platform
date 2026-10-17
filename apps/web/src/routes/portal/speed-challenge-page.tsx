import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import {
  Timer,
  Clock,
  Flame,
  Trophy,
  RotateCcw,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  X,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { speedQuestions } from '../../data/content/competitions';
import { studentResultsClient } from '../../data/api-client/guestbook-client';
import { useStageScrollReset } from '../../lib/scroll-reset';

type GameState = 'lobby' | 'playing' | 'timesup';

function playSound(type: 'correct' | 'wrong' | 'combo' | 'gameover') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'correct') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'combo') {
      [587.33, 739.99, 880, 1174.66].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.2);
      });
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'gameover') {
      [440, 392, 349.23, 329.63].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.3);
      });
    }
  } catch {
    // AudioContext blocked
  }
}

export default function SpeedChallengePage() {
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [playerName, setPlayerName] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasRecordedResultRef = useRef(false);

  useStageScrollReset(gameState);

  // Pick question by looping through pool
  const currentQ = speedQuestions[currentIndex % speedQuestions.length];

  // Start / Restart game
  function handleStart() {
    if (playerName.trim().length < 2) return;
    hasRecordedResultRef.current = false;
    setGameState('playing');
    setTimeLeft(60);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setWrongCount(0);
    setFeedback(null);
  }

  // Auto-record results on timesup
  useEffect(() => {
    if (gameState === 'timesup' && !hasRecordedResultRef.current) {
      hasRecordedResultRef.current = true;
      const totalAnswered = correctCount + wrongCount;
      void studentResultsClient.recordResult({
        studentName: playerName.trim() || 'طالبة متميزة',
        category: 'speed',
        activityTitle: 'تحدي السرعة Spark',
        score: score,
        totalQuestions: Math.max(1, totalAnswered),
        cefrLevel: score >= 15 ? 'B2 - Advanced' : score >= 8 ? 'B1 - Intermediate' : 'A2 - Elementary',
      });
    }
  }, [gameState, score, correctCount, wrongCount, playerName]);

  // Timer tick
  useEffect(() => {
    if (gameState !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setGameState('timesup');
          playSound('gameover');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // Answer option selection
  function handleAnswer(isCorrect: boolean) {
    if (gameState !== 'playing') return;

    if (isCorrect) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      if (nextStreak > maxStreak) setMaxStreak(nextStreak);
      setCorrectCount((prev) => prev + 1);

      // Score bonus based on streak
      const multiplier = nextStreak >= 5 ? 3 : nextStreak >= 3 ? 2 : 1;
      const pointsAdded = 10 * multiplier;
      setScore((prev) => prev + pointsAdded);

      setFeedback('correct');
      if (nextStreak === 3 || nextStreak === 5 || nextStreak === 10) {
        playSound('combo');
      } else {
        playSound('correct');
      }
    } else {
      setStreak(0);
      setWrongCount((prev) => prev + 1);
      setFeedback('wrong');
      playSound('wrong');
    }

    // Move to next question instantly
    setTimeout(() => {
      setFeedback(null);
      setCurrentIndex((prev) => prev + 1);
    }, 250);
  }

  // Title rank evaluation
  let rankTitle = 'مشارك رائع';
  let rankDesc = 'بداية جيدة! كل تدريب إضافي سيزيد من سرعتك ودقتك.';
  if (score >= 250) {
    rankTitle = 'أسطورة السرعة والذكاء';
    rankDesc = 'أداء استثنائي وخارق! سرعة بديهة ودقة عالية تضعك في قمة الأبطال.';
  } else if (score >= 150) {
    rankTitle = 'المفكر الصاروخي';
    rankDesc = 'سرعة فائقة وتركيز مدهش! استطعت إحراز نقاط رائعة جداً.';
  } else if (score >= 80) {
    rankTitle = 'بطل متقدّم';
    rankDesc = 'سرعة جيدة وتركيز ممتاز! يمكنك كسر رقمك القياسي بمحاولة ثانية.';
  }

  // =========================================================================
  // FULL-SCREEN MOBILE FOCUS PLAYING MODE
  // No PortalNav, No PortalFooter, No Breadcrumb, Zero Scroll
  // =========================================================================
  if (gameState === 'playing' && currentQ) {
    return (
      <div
        className="fixed inset-0 z-50 flex h-dvh w-full flex-col justify-between overflow-hidden bg-slate-950 p-4 text-white select-none"
        dir="rtl"
      >
        {/* Top Header HUD Bar */}
        <header className="shrink-0 border-b border-slate-800 pb-3">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setGameState('lobby')}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition"
              title="خروج"
              aria-label="خروج"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Score */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400">النقاط</span>
              <span className="text-lg sm:text-xl font-black text-amber-400">{score}</span>
            </div>

            {/* Timer */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl border-2 text-base sm:text-lg font-black transition-colors ${
                  timeLeft <= 10
                    ? 'border-rose-500 bg-rose-500/20 text-rose-400 animate-pulse'
                    : 'border-slate-700 bg-slate-800 text-white'
                }`}
              >
                {timeLeft}
              </div>
              <span className="mt-0.5 text-[9px] font-bold text-slate-400">ثانية</span>
            </div>

            {/* Streak */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400">التتابع</span>
              <span
                className={`text-lg sm:text-xl font-black transition-transform ${
                  streak >= 3 ? 'text-rose-400 scale-110' : 'text-slate-300'
                }`}
              >
                {streak > 0 ? `${streak} 🔥` : '0'}
              </span>
            </div>
          </div>

          {/* Time progress bar */}
          <div className="mx-auto mt-2.5 h-1.5 w-full max-w-2xl overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-1000 ${
                timeLeft <= 10 ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-400 to-rose-500'
              }`}
              style={{ width: `${(timeLeft / 60) * 100}%` }}
            />
          </div>
        </header>

        {/* Center Question Card */}
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-1 py-3">
          <div
            className={`rounded-2xl border p-4 sm:p-6 text-center transition-all ${
              feedback === 'correct'
                ? 'border-emerald-500 bg-emerald-950/60'
                : feedback === 'wrong'
                ? 'border-rose-500 bg-rose-950/60'
                : 'border-slate-800 bg-slate-900/90'
            }`}
          >
            <span className="text-xs font-bold text-slate-400">{currentQ.category}</span>
            <p className="mt-2 text-lg sm:text-2xl font-black leading-snug text-white select-text" dir="ltr">
              {currentQ.prompt}
            </p>
          </div>
        </main>

        {/* Bottom 4 Quick Options (2x2 grid under thumbs) */}
        <footer className="shrink-0 pb-2">
          <div className="mx-auto max-w-2xl grid grid-cols-2 gap-2.5" dir="ltr">
            {currentQ.options.map((opt, oIdx) => (
              <button
                key={oIdx}
                type="button"
                onClick={() => handleAnswer(opt.isCorrect)}
                className="rounded-xl sm:rounded-2xl border border-slate-700 bg-slate-800/90 p-3 sm:p-4 text-center text-sm sm:text-base font-black text-white shadow-xs transition hover:border-amber-400 hover:bg-slate-750 active:scale-95 min-h-[52px]"
              >
                {opt.text}
              </button>
            ))}
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-8 sm:py-10">
        {/* Breadcrumb */}
        <div className="mb-4 self-start flex items-center gap-1.5 text-xs font-bold text-slate-500">
          <Link to="/competitions" className="hover:text-violet-700 transition">
            المسابقات
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-rose-700 font-black">تحدي السرعة 60 ثانية</span>
        </div>

        {/* LOBBY STAGE */}
        {gameState === 'lobby' && (
          <div className="w-full rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-6 text-center shadow-xs sm:p-10 backdrop-blur-xl">
            <span className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-rose-500 via-pink-600 to-amber-500 text-white shadow-lg shadow-rose-500/20">
              <Timer className="h-8 w-8 sm:h-10 sm:w-10" />
            </span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black tracking-widest text-rose-600" dir="ltr">
              <Sparkles className="h-3.5 w-3.5" />
              <span>60-SECOND SPEED CHALLENGE</span>
            </span>
            <h1 className="mt-1 text-2xl sm:text-4xl font-black text-slate-950">
              تحدي السرعة 60 ثانية
            </h1>
            <p className="mx-auto mt-2.5 max-w-lg text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
              لديك 60 ثانية لحل أكبر قدر ممكن من الأسئلة السريعة! كل إجابة صحيحة تمنحك نقاطاً، وكل 3 إجابات متتالية تضاعف نقاطك 🔥
            </p>

            <div className="mx-auto mt-6 max-w-sm">
              <label htmlFor="speed-player-name" className="mb-1.5 block text-right text-xs font-bold text-slate-700">
                اسم الكريم:
              </label>
              <input
                id="speed-player-name"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="اكتب اسمك للبدء..."
                className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-center text-base font-bold text-slate-900 placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-100"
              />
              <button
                type="button"
                onClick={handleStart}
                disabled={playerName.trim().length < 2}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 py-3.5 text-xs sm:text-sm font-black text-white shadow-md shadow-rose-500/25 transition hover:brightness-110 active:scale-95 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
              >
                <span>انطلق في التحدي!</span>
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-right">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                <Clock className="h-5 w-5 text-amber-500" />
                <h2 className="mt-2 text-xs sm:text-sm font-bold text-slate-900">60 ثانية فقط</h2>
                <p className="text-[11px] text-slate-500">الوقت يمر بسرعة</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                <Flame className="h-5 w-5 text-rose-500" />
                <h2 className="mt-2 text-xs sm:text-sm font-bold text-slate-900">مضاعف الحماس</h2>
                <p className="text-[11px] text-slate-500">نقاط مضاعفة مع التتابع</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                <Trophy className="h-5 w-5 text-purple-500" />
                <h2 className="mt-2 text-xs sm:text-sm font-bold text-slate-900">رقم قياسي</h2>
                <p className="text-[11px] text-slate-500">نافس وتصدر المراتب</p>
              </div>
            </div>
          </div>
        )}

        {/* TIME'S UP STAGE */}
        {gameState === 'timesup' && (
          <div className="w-full rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-6 text-center shadow-xs sm:p-10 backdrop-blur-xl">
            <span className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-400 via-rose-500 to-purple-600 text-white shadow-lg shadow-amber-500/20">
              <Trophy className="h-8 w-8 sm:h-10 sm:w-10" />
            </span>
            <span className="mt-4 inline-block text-xs font-black tracking-wider text-rose-600" dir="ltr">
              TIME IS UP!
            </span>
            <h1 className="mt-1 text-2xl sm:text-4xl font-black text-slate-950">انتهت الـ 60 ثانية!</h1>

            <div className="my-5 rounded-2xl border border-amber-300 bg-amber-50/90 p-4">
              <span className="text-xs font-bold text-amber-800">الرتبة المحققة لـ {playerName}:</span>
              <h2 className="mt-1 text-xl sm:text-2xl font-black text-amber-900">{rankTitle}</h2>
              <p className="mt-1 text-xs text-amber-700">{rankDesc}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500">مجموع النقاط</span>
                <div className="mt-1 text-xl sm:text-2xl font-black text-amber-600">{score}</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500">إجابات صحيحة</span>
                <div className="mt-1 text-xl sm:text-2xl font-black text-emerald-600">{correctCount}</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500">إجابات خاطئة</span>
                <div className="mt-1 text-xl sm:text-2xl font-black text-rose-600">{wrongCount}</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500">أعلى تتابع</span>
                <div className="mt-1 text-xl sm:text-2xl font-black text-purple-600">{maxStreak} 🔥</div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleStart}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 px-7 py-3 text-xs sm:text-sm font-black text-white shadow-md hover:brightness-110 active:scale-95 transition"
              >
                <RotateCcw className="h-4 w-4" />
                <span>العب مرة أخرى</span>
              </button>
              <Link
                to="/competitions"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition"
              >
                العودة للمسابقات
              </Link>
            </div>
          </div>
        )}
      </main>

      <PortalFooter />
    </div>
  );
}
