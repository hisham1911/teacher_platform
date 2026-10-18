import { useState, useId } from 'react';
import { Link, useParams, Navigate } from 'react-router';
import {
  ChevronRight,
  Send,
  RotateCcw,
  Volume2,
  VolumeX,
  Lightbulb,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  XCircle,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { getMergedWritingPrompts } from '../../data/api-client/guestbook-client';
import { useSpeechPlayer } from '../../lib/speech-player';

function playTone(type: 'correct' | 'submitted') {
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

  const writingPrompts = getMergedWritingPrompts();
  const promptIndex = writingPrompts.findIndex((p) => p.slug === promptSlug);
  const prompt = writingPrompts[promptIndex];

  const [studentText, setStudentText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [answerWords, setAnswerWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>(
    () => prompt?.scrambledWords ?? []
  );

  const { isPlaying: isPlayingAudio, toggle: speakModelAnswer } = useSpeechPlayer(prompt?.modelAnswer);

  if (!prompt) return <Navigate to="/writing" replace />;

  const nextPrompt = writingPrompts[promptIndex + 1];
  const isWordBuilder = prompt.category === 'sentence' && Boolean(prompt.scrambledWords?.length);
  const studentAnswer = isWordBuilder ? answerWords.join(' ') : studentText.trim();

  // Automated check if exact match
  const normalizedStudent = studentAnswer.trim().toLowerCase().replace(/[.,!?;:]/g, '');
  const isExactMatch = prompt.acceptableAnswers
    ? prompt.acceptableAnswers.some(
        (ans) => ans.trim().toLowerCase().replace(/[.,!?;:]/g, '') === normalizedStudent,
      )
    : false;

  const wordCount = studentAnswer ? studentAnswer.split(/\s+/).length : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentAnswer) return;
    setSubmitted(true);
    playTone(isExactMatch ? 'correct' : 'submitted');
  }

  function handleReset() {
    setStudentText('');
    setSubmitted(false);
    setAnswerWords([]);
    setAvailableWords(prompt?.scrambledWords ?? []);
  }

  function handleAvailableWordClick(index: number) {
    if (submitted) return;
    const word = availableWords[index];
    if (word === undefined) return;
    setAvailableWords((prev) => prev.filter((_, i) => i !== index));
    setAnswerWords((prev) => [...prev, word]);
  }

  function handleAnswerWordClick(index: number) {
    if (submitted) return;
    const word = answerWords[index];
    if (word === undefined) return;
    setAnswerWords((prev) => prev.filter((_, i) => i !== index));
    setAvailableWords((prev) => [...prev, word]);
  }

  function handleClearAnswer() {
    setStudentText('');
    setAnswerWords([]);
    setAvailableWords(prompt?.scrambledWords ?? []);
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
        {/* Header Breadcrumb */}
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/writing"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 shadow-xs backdrop-blur-sm transition-all hover:bg-emerald-50 hover:text-emerald-800"
          >
            <ChevronRight className="h-4 w-4" />
            <span>العودة لتدريبات الكتابة</span>
          </Link>
          <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">
            تدريب #{promptIndex + 1} من {writingPrompts.length}
          </span>
        </header>

        {/* Prompt Card */}
        <section className="animate-page-enter">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black tracking-widest text-emerald-700" dir="ltr">
                  {prompt.titleEn}
                </span>
                <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-950">
                  {prompt.titleAr}
                </h1>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 border border-emerald-200/70">
                {prompt.category === 'sentence'
                  ? 'ترتيب جملة'
                  : prompt.category === 'correction'
                  ? 'تصحيح خطأ'
                  : 'كتابة فقرة'}
              </span>
            </div>

            <div className="mt-5 rounded-2xl bg-emerald-50/70 p-4 border border-emerald-100">
              <p className="text-xs sm:text-sm font-black text-emerald-950">
                {prompt.instructionAr}
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-700" dir="ltr">
                {prompt.instructionEn}
              </p>
            </div>

            {/* Prompt Target Text */}
            <div className="mt-5 rounded-2xl bg-slate-900 p-4 sm:p-5 shadow-inner text-center" dir="ltr">
              <p className="text-base sm:text-lg font-mono font-bold text-amber-300">
                {prompt.promptText}
              </p>
            </div>

            {/* Sentence word builder: answer area + available words */}
            {prompt.scrambledWords && !submitted && (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">
                    منطقة الإجابة — اضغط على أي كلمة لإزالتها وإعادتها للقائمة:
                  </p>
                  <div
                    className={`flex min-h-14 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed p-3 transition ${
                      answerWords.length > 0
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                    dir="ltr"
                  >
                    {answerWords.length === 0 ? (
                      <span className="text-xs font-bold text-slate-400" dir="rtl">
                        اضغط على الكلمات من القائمة أدناه لبناء الجملة هنا...
                      </span>
                    ) : (
                      answerWords.map((word, idx) => (
                        <button
                          key={`${word}-${idx}`}
                          type="button"
                          onClick={() => handleAnswerWordClick(idx)}
                          className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs sm:text-sm font-black text-emerald-900 shadow-xs hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 transition active:scale-95"
                          title="إزالة هذه الكلمة"
                        >
                          {word}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">
                    الكلمات المتاحة — اضغط على الكلمة لإضافتها بالترتيب الصحيح:
                  </p>
                  <div className="flex flex-wrap gap-2" dir="ltr">
                    {availableWords.map((word, idx) => (
                      <button
                        key={`${word}-${idx}`}
                        type="button"
                        onClick={() => handleAvailableWordClick(idx)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 shadow-xs hover:border-emerald-300 hover:bg-emerald-50 transition active:scale-95"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Keywords for guided paragraphs */}
            {prompt.keywords && (
              <div className="mt-4">
                <p className="text-xs font-bold text-slate-500 mb-1.5">
                  كلمات مقترحة للاستخدام في النص:
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

            {/* Writing Form */}
            <form onSubmit={handleSubmit} className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor={inputId}
                  className="text-xs sm:text-sm font-bold text-slate-800"
                >
                  اكتب إجابتك باللغة الإنجليزية:
                </label>
                <span className="text-[11px] font-bold text-slate-400">
                  {wordCount} كلمة • {studentText.length} حرف
                </span>
              </div>

              {isWordBuilder ? (
                <div
                  className="rounded-2xl border-2 border-slate-200 bg-slate-50/60 px-4 py-3.5 text-base font-bold text-slate-900 min-h-13"
                  dir="ltr"
                >
                  {studentAnswer || (
                    <span className="font-medium text-slate-400">Build your sentence above...</span>
                  )}
                </div>
              ) : prompt.category === 'paragraph' ? (
                <textarea
                  id={inputId}
                  rows={5}
                  dir="ltr"
                  disabled={submitted}
                  value={studentText}
                  onChange={(e) => setStudentText(e.target.value)}
                  placeholder="Type your paragraph here in English..."
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white p-4 text-base font-medium text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 transition-all"
                />
              ) : (
                <input
                  id={inputId}
                  type="text"
                  dir="ltr"
                  disabled={submitted}
                  value={studentText}
                  onChange={(e) => setStudentText(e.target.value)}
                  placeholder="Type your answer here in English..."
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base font-medium text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 transition-all"
                />
              )}

              {!submitted ? (
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    type="submit"
                    disabled={!studentAnswer}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-7 text-xs sm:text-sm font-black text-white shadow-md shadow-emerald-700/20 hover:bg-emerald-800 transition-all disabled:opacity-50 active:scale-95"
                  >
                    <Send className="h-4 w-4" />
                    <span>تحقق من الإجابة وعرض النموذج</span>
                  </button>
                  {(isWordBuilder ? answerWords.length > 0 : studentText) && (
                    <button
                      type="button"
                      onClick={handleClearAnswer}
                      className="rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      مسح
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>إعادة المحاولة والتعديل</span>
                </button>
              )}
            </form>
          </div>
        </section>

        {/* Model Answer & Teacher Correction Section */}
        {submitted && (
          <section className="animate-page-enter mt-8 space-y-6">
            {/* Success badge if exact match */}
            {isExactMatch && (
              <div className="rounded-2xl sm:rounded-3xl border border-emerald-200 bg-emerald-50/90 p-5 sm:p-6 text-center shadow-xs">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs mb-2">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-emerald-950">
                  إجابة ممتازة وصحيحة 100%!
                </h3>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-emerald-800">
                  كتبت الجملة بدقة نحوية وإملائية كاملة متوافقة مع الإجابة النموذجية.
                </p>
              </div>
            )}

            {/* Clear red guidance when the answer does not match the model */}
            {prompt.acceptableAnswers && !isExactMatch && (
              <div className="rounded-2xl sm:rounded-3xl border border-rose-200 bg-rose-50/90 p-5 sm:p-6 text-center shadow-xs">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-xs mb-2">
                  <XCircle className="h-6 w-6" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-rose-950">
                  إجابة غير صحيحة، راجع ترتيب الكلمات أو علامات الترقيم وحاول مجدداً
                </h3>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-rose-800">
                  قارن إجابتك مع نموذج الإجابة أدناه ثم اضغط «إعادة المحاولة والتعديل».
                </p>
              </div>
            )}

            {/* Model Answer Box */}
            <div className="rounded-2xl sm:rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-xs">
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-950">
                      نموذج الإجابة الإرشادي (Model Answer)
                    </h3>
                    <p className="text-xs font-semibold text-slate-500">
                      قارن صياغتك مع الصياغة المعيارية المقترحة من المعلمة
                    </p>
                  </div>
                </div>

                {'speechSynthesis' in window && (
                  <button
                    type="button"
                    onClick={speakModelAnswer}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
                  >
                    {isPlayingAudio ? (
                      <>
                        <VolumeX className="h-3.5 w-3.5" />
                        <span>إيقاف الصوت</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>استمع للنموذج</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Model text */}
              <div className="my-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 sm:p-5" dir="ltr">
                <p className="text-base sm:text-lg font-bold leading-relaxed text-emerald-950 whitespace-pre-line select-text">
                  {prompt.modelAnswer}
                </p>
              </div>

              {/* Student's answer comparison */}
              <div className="mb-5 rounded-2xl bg-amber-50/60 p-4 border border-amber-200/70" dir="ltr">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-1">
                  Your Answer:
                </p>
                <p className="text-sm sm:text-base font-semibold text-slate-800">{studentAnswer}</p>
              </div>

              {/* Teacher Explanation */}
              <div className="rounded-2xl bg-slate-50 p-4 sm:p-5 border border-slate-100">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>توجيهات المعلمة والقواعد اللغوية:</span>
                </h4>
                <p className="text-xs sm:text-sm font-semibold leading-relaxed text-slate-700 whitespace-pre-line">
                  {prompt.explanationAr}
                </p>
              </div>

              {/* Self-check checklist */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs font-black text-slate-500 mb-2.5">
                  معايير التقييم الذاتي لكتابتك:
                </p>
                <ul className="grid grid-cols-1 gap-2 text-xs font-bold text-slate-700 sm:grid-cols-3">
                  <li className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>البدء بحرف كبير (Capital Letter)</span>
                  </li>
                  <li className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>إنهاء الجملة بعلامة ترقيم (. أو ?)</span>
                  </li>
                  <li className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>الترتيب النحوي الصحيح للفاعل والفعل</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Navigation */}
        <div className="mt-10 flex flex-col items-stretch sm:items-center justify-between gap-3 border-t border-slate-200/80 pt-6 sm:flex-row">
          <Link
            to="/writing"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs sm:text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
            <span>قائمة تدريبات الكتابة</span>
          </Link>
          {nextPrompt && (
            <Link
              to={`/writing/${nextPrompt.slug}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-emerald-700/20 transition hover:bg-emerald-800"
            >
              <span>التدريب التالي: {nextPrompt.titleAr}</span>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <PortalFooter />
    </div>
  );
}
