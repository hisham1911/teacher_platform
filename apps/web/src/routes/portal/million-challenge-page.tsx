import { useState } from 'react';
import { Link } from 'react-router';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { challengeQuestions } from '../../data/content/challenge';

type Stage = 'welcome' | 'playing' | 'result';

function playTone(type: 'correct' | 'wrong' | 'win') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    // AudioContext blocked or unsupported
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
    }, 2000);
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

  // Animation class for the container when feedback is shown
  const flashClass = isCorrectFeedback === true 
    ? 'challenge-flash-ok' 
    : isCorrectFeedback === false 
      ? 'challenge-flash-bad' 
      : '';

  return (
    <div className="challenge-shell flex min-h-dvh flex-col" dir="rtl">
      {/* 
        We use the standard PortalNav but force a dark theme for the nav 
        if we want, or just let it be standard and isolate the challenge shell below.
        Actually, for a fully immersive game show, we might hide the nav or style it differently.
        Since PortalNav is fixed, we'll just include it.
      */}
      <PortalNav />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        {stage === 'welcome' && (
          <div className="challenge-panel challenge-enter w-full max-w-xl p-8 text-center sm:p-12">
            <span className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-3xl shadow-[0_0_30px_rgba(251,191,36,0.3)]">
              🏆
            </span>
            <p className="text-sm font-black tracking-[0.2em] text-[var(--challenge-accent)]">
              MILLION CHALLENGE
            </p>
            <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">مسابقة المليون</h1>
            
            <div className="mt-8 rounded-2xl bg-white/5 p-6 text-right">
              <ul className="flex flex-col gap-4 text-sm font-semibold leading-relaxed text-sky-100">
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-[var(--challenge-accent)]">1.</span>
                  التحدي يتكون من 15 سؤال متدرج الصعوبة في قواعد ومفردات اللغة الإنجليزية.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-[var(--challenge-accent)]">2.</span>
                  الإجابة الصحيحة تنقلك للمستوى التالي وتزيد نقاطك.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-rose-400">3.</span>
                  إجابة واحدة خاطئة تنهي التحدي فوراً وتخسر فرصتك في المليون!
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <input
                type="text"
                placeholder="اكتب اسمك هنا للبدء..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl bg-white/10 px-6 py-4 text-center text-lg font-bold text-white placeholder-white/40 outline-none ring-2 ring-white/10 transition-all focus:bg-white/15 focus:ring-[var(--challenge-accent)]"
                maxLength={30}
              />
            </div>
            
            <button
              onClick={handleStart}
              disabled={name.trim().length < 2}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 px-8 py-5 text-lg font-black text-slate-950 shadow-[0_0_30px_rgba(251,191,36,0.35)] transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(251,191,36,0.5)] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
            >
              ابدأ التحدي الآن ✨
            </button>
          </div>
        )}

        {stage === 'playing' && question && (
          <div className="w-full max-w-6xl gap-8 lg:grid lg:grid-cols-12">
            
            {/* Desktop Ladder Sidebar */}
            <div className="hidden lg:col-span-3 lg:block">
              <div className="challenge-panel challenge-enter flex h-full flex-col-reverse justify-between rounded-2xl p-6">
                {challengeQuestions.map((q, idx) => {
                  const isCurrent = idx === currentLevel;
                  const isPassed = idx < currentLevel;
                  const isMilestone = (idx + 1) % 5 === 0;
                  
                  return (
                    <div 
                      key={idx}
                      className={`flex items-center justify-between rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                        isCurrent 
                          ? 'bg-[var(--challenge-accent)] text-slate-900 shadow-[0_0_15px_rgba(251,191,36,0.3)]' 
                          : isPassed
                            ? 'text-emerald-400'
                            : isMilestone
                              ? 'text-white'
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
              <div className="mb-6 flex items-center justify-between rounded-2xl bg-white/5 px-6 py-4 text-sm font-bold text-sky-200 lg:hidden">
                <span>المستوى {question.level} من 15</span>
                <span className="flex items-center gap-2 text-[var(--challenge-accent)]">
                  ♦ {question.points.toLocaleString()} نقطة
                </span>
              </div>

              <div className={`challenge-panel challenge-enter p-8 sm:p-12 ${flashClass}`}>
                <p className="text-center text-2xl font-black leading-relaxed text-white sm:text-3xl" dir="ltr">
                  {question.prompt}
                </p>

                {isCorrectFeedback !== null && (
                  <div className="mt-8 flex justify-center">
                    <div className={isCorrectFeedback ? 'challenge-feedback-ok' : 'challenge-feedback-bad'}>
                      {isCorrectFeedback ? 'إجابة صحيحة! ننتقل للسؤال التالي...' : 'إجابة خاطئة! انتهى التحدي.'}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {question.options.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx); // A, B, C, D
                  let stateClass = 'bg-slate-800/60 border-slate-700 text-sky-100 hover:bg-slate-700 hover:border-slate-500';
                  
                  if (selected !== null) {
                    if (opt.isCorrect) {
                      stateClass = 'bg-emerald-900/80 border-emerald-500 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.3)]';
                    } else if (idx === selected && !opt.isCorrect) {
                      stateClass = 'bg-rose-900/80 border-rose-500 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.3)]';
                    } else {
                      stateClass = 'bg-slate-800/30 border-slate-800 text-slate-500 opacity-50';
                    }
                  }

                  return (
                    <button
                      key={opt.text + idx}
                      onClick={() => handleSelect(idx)}
                      disabled={selected !== null}
                      className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border-2 px-5 py-4.5 transition-all duration-300 ${stateClass}`}
                      dir="ltr"
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-colors ${
                        selected !== null ? 'bg-black/30 text-white' : 'bg-white/10 text-amber-300 group-hover:bg-[var(--challenge-accent)] group-hover:text-slate-950'
                      }`}>
                        {letter}
                      </span>
                      <span className="text-lg font-bold text-left flex-1">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {stage === 'result' && (
          <div className={`challenge-panel challenge-enter w-full max-w-xl p-8 text-center sm:p-12 ${finalLevel >= 15 ? 'challenge-result-win' : 'challenge-result-lose'}`}>
            <span className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-5xl shadow-xl backdrop-blur-md">
              {finalLevel >= 15 ? '👑' : finalLevel >= 10 ? '🌟' : finalLevel >= 5 ? '👏' : '📚'}
            </span>
            
            <h2 className="text-3xl font-black text-white sm:text-4xl">
              {finalLevel >= 15 ? `أسطورة يا ${name}! ربحت المليون!` : `حظ أوفر يا ${name}!`}
            </h2>
            
            <p className="mt-4 text-lg font-bold text-sky-200">
              وصلت للمستوى <span className="text-white">{finalLevel}</span> من 15
            </p>
            
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-black/40 px-8 py-4">
              <span className="text-sm font-bold text-sky-300">الرصيد النهائي:</span>
              <span className="text-3xl font-black text-[var(--challenge-accent)]">
                ♦ {totalPoints.toLocaleString()}
              </span>
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button 
                onClick={handleRestart} 
                className="w-full rounded-2xl bg-[var(--challenge-accent)] px-8 py-4 text-sm font-black text-slate-950 transition-transform hover:scale-105 sm:w-auto"
              >
                العب مرة أخرى
              </button>
              <Link 
                to="/" 
                className="w-full rounded-2xl border-2 border-white/20 bg-transparent px-8 py-4 text-sm font-black text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                العودة للرئيسية
              </Link>
            </div>
          </div>
        )}
      </main>

      <PortalFooter />
    </div>
  );
}
