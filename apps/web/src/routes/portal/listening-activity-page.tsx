import { useState, useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { InlineQuiz } from '../../components/portal/inline-quiz';
import { listeningActivities } from '../../data/content/listening';

export default function ListeningActivityPage() {
  const { activitySlug } = useParams<{ activitySlug: string }>();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const activityIndex = listeningActivities.findIndex(
    (a) => a.slug === activitySlug,
  );
  const activity = listeningActivities[activityIndex];

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [activitySlug]);

  if (!activity) return <Navigate to="/listening" replace />;

  const nextActivity = listeningActivities[activityIndex + 1];

  function toggleSpeech() {
    if (!activity || !activity.audioScript || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(activity.audioScript);
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
            to="/listening"
            className="inline-flex items-center gap-2 rounded-xl bg-white/70 px-4 py-2 text-sm font-bold text-slate-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-violet-700"
          >
            → عودة للأنشطة
          </Link>
        </header>

        <section className="animate-page-enter">
          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl sm:p-10">
            <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">{activity.titleAr}</h1>
            <p className="mt-2 text-sm font-black tracking-widest text-violet-600">
              {activity.titleEn.toUpperCase()}
            </p>

            {/* Media / Audio Experience */}
            <div className="mt-8">
              {activity.mediaUrl ? (
                <div className="overflow-hidden rounded-2xl bg-slate-900 shadow-lg ring-1 ring-slate-900/5">
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={activity.mediaUrl}
                      title={activity.titleEn}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/70 via-white to-indigo-50/50 p-6 shadow-sm sm:p-8">
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-700 text-3xl font-black text-white shadow-md shadow-violet-700/20">
                      🎧
                    </span>
                    <h3 className="mt-4 text-xl font-black text-slate-950">المحادثة الصوتية التفاعلية</h3>
                    <p className="mt-2 max-w-lg text-sm font-semibold leading-relaxed text-slate-600">
                      اضغط على زر التشغيل للاستماع إلى المحادثة الإنجليزية بوضوح، ثم أجب على أسئلة الفهم في الأسفل.
                    </p>

                    {/* Audio Controls */}
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={toggleSpeech}
                        className={`inline-flex min-h-12 items-center gap-2.5 rounded-2xl px-6 text-sm font-black shadow-md transition-all ${
                          isPlayingAudio
                            ? 'bg-amber-500 text-slate-950 shadow-amber-500/25 animate-pulse'
                            : 'bg-violet-700 text-white shadow-violet-700/20 hover:bg-violet-800 hover:shadow-lg'
                        }`}
                      >
                        <span className="text-lg">{isPlayingAudio ? '⏸' : '▶'}</span>
                        <span>{isPlayingAudio ? 'إيقاف مؤقت' : 'استمع للمحادثة الصوتية'}</span>
                      </button>

                      {activity.audioScript && (
                        <button
                          type="button"
                          onClick={() => setShowTranscript((s) => !s)}
                          className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                        >
                          <span>{showTranscript ? 'إخفاء النص' : 'عرض نص المحادثة 📜'}</span>
                        </button>
                      )}
                    </div>

                    {/* Collapsible Transcript */}
                    {showTranscript && activity.audioScript && (
                      <div className="mt-6 w-full rounded-2xl bg-white p-5 text-left shadow-inner border border-slate-100 animate-page-enter" dir="ltr">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Transcript:</p>
                        <p className="text-base font-semibold leading-relaxed text-slate-800 whitespace-pre-line font-mono">
                          {activity.audioScript}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Comprehension questions */}
        {activity.questions.length > 0 && (
          <div className="animate-page-enter mt-8" style={{ animationDelay: '100ms' }}>
            <div className="mb-6 flex flex-col items-center justify-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-2xl shadow-sm">
                🧪
              </span>
              <h2 className="mt-3 text-2xl font-black text-slate-900">أسئلة الفهم السمعي</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                استمع جيداً ثم اختر الإجابة الصحيحة
              </p>
            </div>
            <InlineQuiz key={activity.slug} questions={activity.questions} />
          </div>
        )}

        {/* Navigation */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row">
          <Link
            to="/listening"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:w-auto"
          >
            → كل الأنشطة
          </Link>
          {nextActivity && (
            <Link
              to={`/listening/${nextActivity.slug}`}
              className="group flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 text-sm font-black text-white shadow-md transition-all hover:bg-violet-700 hover:shadow-xl hover:shadow-violet-900/20 sm:w-auto"
            >
              النشاط التالي: {nextActivity.titleAr}
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
