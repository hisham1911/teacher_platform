import { useState, useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { InlineQuiz } from '../../components/portal/inline-quiz';
import { readingPassages } from '../../data/content/reading';

export default function ReadingPassagePage() {
  const { passageSlug } = useParams<{ passageSlug: string }>();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const passageIndex = readingPassages.findIndex((p) => p.slug === passageSlug);
  const passage = readingPassages[passageIndex];

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [passageSlug]);

  if (!passage) return <Navigate to="/reading" replace />;

  const nextPassage = readingPassages[passageIndex + 1];

  function toggleSpeech() {
    if (!passage || !('speechSynthesis' in window)) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(passage.text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
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
            to="/reading"
            className="inline-flex items-center gap-2 rounded-xl bg-white/70 px-4 py-2 text-sm font-bold text-slate-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-violet-700"
          >
            → عودة للقطع
          </Link>
        </header>

        <section className="animate-page-enter">
          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">{passage.titleAr}</h1>
                <p className="mt-2 text-sm font-black tracking-widest text-violet-600">
                  {passage.titleEn.toUpperCase()}
                </p>
              </div>

              {typeof window !== 'undefined' && 'speechSynthesis' in window && (
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black shadow-sm transition-all ${
                    isPlayingAudio
                      ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400 animate-pulse'
                      : 'bg-violet-100 text-violet-800 hover:bg-violet-200'
                  }`}
                  aria-label={isPlayingAudio ? 'إيقاف القراءة الصوتية' : 'استمع للنص بالإنجليزي'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                  {isPlayingAudio ? 'إيقاف الاستماع' : '🔊 استمع للنص'}
                </button>
              )}
            </div>

            {/* English passage text */}
            <div className="relative mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-10">
              <p className="text-xl font-medium leading-[2.2] tracking-wide text-slate-800" dir="ltr">
                {passage.text}
              </p>
            </div>
          </div>
        </section>

        {/* Comprehension questions */}
        {passage.questions.length > 0 && (
          <div className="animate-page-enter mt-8" style={{ animationDelay: '100ms' }}>
            <div className="mb-6 flex flex-col items-center justify-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-2xl shadow-sm">
                🧪
              </span>
              <h2 className="mt-3 text-2xl font-black text-slate-900">أسئلة الفهم</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                أجب على الأسئلة التالية لتختبر فهمك للنص
              </p>
            </div>
            <InlineQuiz key={passage.slug} questions={passage.questions} />
          </div>
        )}

        {/* Navigation */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row">
          <Link
            to="/reading"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:w-auto"
          >
            → كل القطع
          </Link>
          {nextPassage && (
            <Link
              to={`/reading/${nextPassage.slug}`}
              className="group flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 text-sm font-black text-white shadow-md transition-all hover:bg-violet-700 hover:shadow-xl hover:shadow-violet-900/20 sm:w-auto"
            >
              القطعة التالية: {nextPassage.titleAr}
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
