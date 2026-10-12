import { Link, useParams, Navigate } from 'react-router';
import {
  ChevronRight,
  Volume2,
  VolumeX,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { InlineQuiz } from '../../components/portal/inline-quiz';
import { readingPassages } from '../../data/content/reading';
import { useSpeechPlayer } from '../../lib/speech-player';

export default function ReadingPassagePage() {
  const { passageSlug } = useParams<{ passageSlug: string }>();
  const passageIndex = readingPassages.findIndex((p) => p.slug === passageSlug);
  const passage = readingPassages[passageIndex];

  const { isPlaying: isPlayingAudio, toggle: toggleSpeech } = useSpeechPlayer(passage?.text);

  if (!passage) return <Navigate to="/reading" replace />;

  const nextPassage = readingPassages[passageIndex + 1];

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
        {/* Header Breadcrumb */}
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/reading"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 shadow-xs backdrop-blur-sm transition-all hover:bg-sky-50 hover:text-sky-800"
          >
            <ChevronRight className="h-4 w-4" />
            <span>العودة لقائمة النصوص</span>
          </Link>
          <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-800">
            نص #{passageIndex + 1} من {readingPassages.length}
          </span>
        </header>

        {/* Reading Passage Card */}
        <section className="animate-page-enter">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur-xl sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <span className="text-xs font-black tracking-widest text-sky-600" dir="ltr">
                  {passage.titleEn}
                </span>
                <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-950">
                  {passage.titleAr}
                </h1>
              </div>

              {typeof window !== 'undefined' && 'speechSynthesis' in window && (
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black shadow-xs transition-all active:scale-95 ${
                    isPlayingAudio
                      ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400 animate-pulse'
                      : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
                  }`}
                  aria-label={isPlayingAudio ? 'إيقاف القراءة الصوتية' : 'استمع للنص بالإنجليزي'}
                >
                  {isPlayingAudio ? (
                    <>
                      <VolumeX className="h-4 w-4 text-amber-700" />
                      <span>إيقاف القراءة</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4 text-sky-600" />
                      <span>استمع للنص صوتياً</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Passage Text Container */}
            <div className="relative mt-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-5 sm:p-8">
              <p
                className="text-base sm:text-xl font-medium leading-relaxed sm:leading-[2.2] tracking-wide text-slate-800 select-text"
                dir="ltr"
              >
                {passage.text}
              </p>
            </div>
          </div>
        </section>

        {/* Comprehension Quiz */}
        {passage.questions.length > 0 && (
          <div className="animate-page-enter mt-8" style={{ animationDelay: '100ms' }}>
            <div className="mb-6 flex flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-xs mb-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950">
                أسئلة الفهم والاستيعاب
              </h2>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">
                أجب على الأسئلة للتأكد من فهمك لمفردات وأفكار النص
              </p>
            </div>
            <InlineQuiz key={passage.slug} questions={passage.questions} />
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="mt-10 flex flex-col items-stretch sm:items-center justify-between gap-3 border-t border-slate-200/80 pt-6 sm:flex-row">
          <Link
            to="/reading"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs sm:text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
            <span>قائمة النصوص</span>
          </Link>
          {nextPassage && (
            <Link
              to={`/reading/${nextPassage.slug}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-sky-600/20 transition hover:bg-sky-700"
            >
              <span>النص التالي: {nextPassage.titleAr}</span>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <PortalFooter />
    </div>
  );
}
