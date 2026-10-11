import { useState, useId } from 'react';
import { Link, useParams, Navigate } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { writingPrompts } from '../../data/content/writing';

function playTone(type: 'correct' | 'submitted') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // AudioContext blocked
  }
}

export default function WritingActivityPage() {
  const { promptSlug } = useParams<{ promptSlug: string }>();
  const inputId = useId();

  const promptIndex = writingPrompts.findIndex((p) => p.slug === promptSlug);
  const prompt = writingPrompts[promptIndex];

  const [studentText, setStudentText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  if (!prompt) return <Navigate to="/writing" replace />;

  const nextPrompt = writingPrompts[promptIndex + 1];

  // Automated check if exact match
  const normalizedStudent = studentText.trim().toLowerCase().replace(/[.,!?;:]/g, '');
  const isExactMatch = prompt.acceptableAnswers
    ? prompt.acceptableAnswers.some(
        (ans) => ans.trim().toLowerCase().replace(/[.,!?;:]/g, '') === normalizedStudent,
      )
    : false;

  const wordCount = studentText.trim() ? studentText.trim().split(/\s+/).length : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentText.trim()) return;
    setSubmitted(true);
    playTone(isExactMatch ? 'correct' : 'submitted');
  }

  function handleReset() {
    setStudentText('');
    setSubmitted(false);
  }

  function handleWordClick(word: string) {
    if (submitted) return;
    const cleanWord = word.trim();
    setStudentText((prev) => (prev ? `${prev} ${cleanWord}` : cleanWord));
  }

  function speakModelAnswer() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(prompt?.modelAnswer ?? '');
    utterance.lang = 'en-US';
    utterance.rate = 0.88;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        {/* Header Breadcrumb */}
        <header className="mb-6 flex items-center gap-3">
          <Link
            to="/writing"
            className="inline-flex items-center gap-2 rounded-xl bg-white/70 px-4 py-2 text-sm font-bold text-slate-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-violet-700"
          >
            → عودة للتدريبات الكتابية
          </Link>
        </header>

        {/* Prompt Card */}
        <section className="animate-page-enter">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur-xl sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black tracking-widest text-violet-600">
                  {prompt.titleEn.toUpperCase()}
                </span>
                <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                  {prompt.titleAr}
                </h1>
              </div>
              <span className="rounded-full bg-violet-50 px-3.5 py-1 text-xs font-black text-violet-800 border border-violet-100">
                {prompt.category === 'sentence' ? 'ترتيب جملة' : prompt.category === 'correction' ? 'تصحيح خطأ' : 'كتابة فقرة'}
              </span>
            </div>

            <div className="mt-6 rounded-2xl bg-violet-50/60 p-4 border border-violet-100/70">
              <p className="text-sm font-bold text-violet-950">
                📌 {prompt.instructionAr}
              </p>
              <p className="mt-1 text-xs font-semibold text-violet-700" dir="ltr">
                {prompt.instructionEn}
              </p>
            </div>

            {/* Prompt Text / Target */}
            <div className="mt-6 rounded-2xl bg-slate-900 p-5 shadow-inner text-center" dir="ltr">
              <p className="text-lg font-mono font-bold text-amber-300 sm:text-xl">
                {prompt.promptText}
              </p>
            </div>

            {/* Clickable word pills for sentence building */}
            {prompt.scrambledWords && !submitted && (
              <div className="mt-4">
                <p className="text-xs font-bold text-slate-500 mb-2">
                  اضغط على الكلمات لإضافتها إلى إجابتك:
                </p>
                <div className="flex flex-wrap gap-2" dir="ltr">
                  {prompt.scrambledWords.map((word, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleWordClick(word)}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-800 shadow-xs hover:border-violet-300 hover:bg-violet-50 transition-all active:scale-95"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords for guided paragraphs */}
            {prompt.keywords && (
              <div className="mt-4">
                <p className="text-xs font-bold text-slate-500 mb-1.5">
                  💡 كلمات مقترحة للاستخدام في كتابتك:
                </p>
                <div className="flex flex-wrap gap-1.5" dir="ltr">
                  {prompt.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Student Writing Form */}
            <form onSubmit={handleSubmit} className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor={inputId}
                  className="text-sm font-bold text-slate-800"
                >
                  اكتب إجابتك باللغة الإنجليزية:
                </label>
                <span className="text-xs font-bold text-slate-400">
                  {wordCount} كلمة | {studentText.length} حرف
                </span>
              </div>

              {prompt.category === 'paragraph' ? (
                <textarea
                  id={inputId}
                  rows={5}
                  dir="ltr"
                  disabled={submitted}
                  value={studentText}
                  onChange={(e) => setStudentText(e.target.value)}
                  placeholder="Type your paragraph here in English..."
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white p-4 text-base font-medium text-slate-900 placeholder-slate-400 focus:border-violet-600 focus:outline-none focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50 transition-all"
                />
              ) : (
                <input
                  id={inputId}
                  type="text"
                  dir="ltr"
                  disabled={submitted}
                  value={studentText}
                  onChange={(e) => setStudentText(e.target.value)}
                  placeholder="Type your sentence here..."
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-base font-medium text-slate-900 placeholder-slate-400 focus:border-violet-600 focus:outline-none focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50 transition-all"
                />
              )}

              {!submitted ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={!studentText.trim()}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-8 text-sm font-black text-white shadow-md shadow-violet-700/20 hover:bg-violet-800 transition-all disabled:opacity-50"
                  >
                    <span>تحقق من الإجابة وعرض النموذج ✨</span>
                  </button>
                  {studentText && (
                    <button
                      type="button"
                      onClick={() => setStudentText('')}
                      className="rounded-2xl border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      مسح
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  إعادة المحاولة ↻
                </button>
              )}
            </form>
          </div>
        </section>

        {/* Model Answer & Teacher Correction Section */}
        {submitted && (
          <section className="animate-page-enter mt-8 space-y-6">
            {/* Success badge if exact match on sentences */}
            {isExactMatch && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/90 p-6 text-center shadow-md">
                <span className="text-4xl">🎉</span>
                <h3 className="mt-2 text-2xl font-black text-emerald-950">
                  إجابة ممتازة وصحيحة 100%!
                </h3>
                <p className="mt-1 text-sm font-semibold text-emerald-800">
                  لقد كتبت الجملة بدقة نحوية وإملائية كاملة.
                </p>
              </div>
            )}

            {/* Model Answer Box */}
            <div className="rounded-3xl border border-violet-200 bg-white p-6 shadow-md sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-700 text-lg font-black text-white">
                    ★
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-slate-950">نموذج الإجابة المثالي (Model Answer)</h3>
                    <p className="text-xs font-semibold text-slate-500">قارن كتابتك مع هذا النموذج</p>
                  </div>
                </div>

                {'speechSynthesis' in window && (
                  <button
                    type="button"
                    onClick={speakModelAnswer}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3.5 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100 transition-colors"
                  >
                    <span>{isPlayingAudio ? '⏸ إيقاف' : '🔊 استمع للنموذج'}</span>
                  </button>
                )}
              </div>

              {/* Model text */}
              <div className="my-6 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100" dir="ltr">
                <p className="text-lg font-bold leading-relaxed text-slate-900 whitespace-pre-line">
                  {prompt.modelAnswer}
                </p>
              </div>

              {/* Student's answer comparison */}
              <div className="mb-6 rounded-2xl bg-amber-50/60 p-4 border border-amber-200/70" dir="ltr">
                <p className="text-xs font-black uppercase tracking-wider text-amber-800 mb-1">Your Submission:</p>
                <p className="text-base font-semibold text-slate-800">{studentText}</p>
              </div>

              {/* Teacher Explanation */}
              <div className="rounded-2xl bg-slate-50 p-5">
                <h4 className="text-sm font-black text-slate-900 mb-2">
                  💡 شرح المعلم وقواعد الإجابة:
                </h4>
                <p className="text-sm font-semibold leading-7 text-slate-700 whitespace-pre-line">
                  {prompt.explanationAr}
                </p>
              </div>

              {/* Self-check checklist */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="text-xs font-black text-slate-500 mb-3">
                  معايير التقييم الذاتي لكتابتك:
                </p>
                <ul className="grid grid-cols-1 gap-2 text-xs font-bold text-slate-700 sm:grid-cols-3">
                  <li className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                    <span className="text-emerald-600">✓</span>
                    <span>بدأت بحرف كبير (Capital Letter)</span>
                  </li>
                  <li className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                    <span className="text-emerald-600">✓</span>
                    <span>أنهيت بعلامة ترقيم صحيحة (. أو ?)</span>
                  </li>
                  <li className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                    <span className="text-emerald-600">✓</span>
                    <span>الترتيب النحوي السليم للأفعال</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Navigation */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row">
          <Link
            to="/writing"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:w-auto"
          >
            → كل التدريبات الكتابية
          </Link>
          {nextPrompt && (
            <Link
              to={`/writing/${nextPrompt.slug}`}
              className="group flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 text-sm font-black text-white shadow-md transition-all hover:bg-violet-700 hover:shadow-xl hover:shadow-violet-900/20 sm:w-auto"
            >
              التدريب التالي: {nextPrompt.titleAr}
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:-translate-x-1">
                ←
              </span>
            </Link>
          )}
        </div>
      </div>

      <PortalFooter />
    </div>
  );
}
