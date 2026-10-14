import { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router';
import {
  ChevronRight,
  Headphones,
  Play,
  Pause,
  FileText,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { InlineQuiz } from '../../components/portal/inline-quiz';
import { PortalVideoPlayer } from '../../components/portal/portal-video-player';
import { getMergedListeningActivities } from '../../data/api-client/guestbook-client';
import { useSpeechPlayer } from '../../lib/speech-player';

export default function ListeningActivityPage() {
  const { activitySlug } = useParams<{ activitySlug: string }>();
  const [showTranscript, setShowTranscript] = useState(false);

  const listeningActivities = getMergedListeningActivities();
  const activityIndex = listeningActivities.findIndex(
    (a) => a.slug === activitySlug,
  );
  const activity = listeningActivities[activityIndex];

  const audioSource = activity?.audioUrl || activity?.audioScript;
  const { isPlaying: isPlayingAudio, toggle: toggleSpeech } = useSpeechPlayer(audioSource);

  if (!activity) return <Navigate to="/listening" replace />;

  const nextActivity = listeningActivities[activityIndex + 1];

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
        {/* Header Breadcrumb */}
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/listening"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 shadow-xs backdrop-blur-sm transition-all hover:bg-purple-50 hover:text-purple-800"
          >
            <ChevronRight className="h-4 w-4" />
            <span>العودة لأنشطة الاستماع</span>
          </Link>
          <span className="rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-800">
            نشاط #{activityIndex + 1} من {listeningActivities.length}
          </span>
        </header>

        {/* Listening Card */}
        <section className="animate-page-enter">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur-xl sm:p-8">
            <span className="text-xs font-black tracking-widest text-purple-600" dir="ltr">
              {activity.titleEn}
            </span>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-950">
              {activity.titleAr}
            </h1>

            {/* Media / Video / Audio */}
            <div className="mt-6">
              {activity.mediaUrl ? (
                <PortalVideoPlayer
                  src={activity.mediaUrl}
                  poster={activity.posterUrl}
                  title={activity.titleEn}
                />
              ) : (
                <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/70 via-white to-pink-50/40 p-5 sm:p-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/20 mb-3">
                    <Headphones className="h-7 w-7" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-950">المقطع الصوتي المباشر</h2>
                  <p className="mt-1.5 max-w-md mx-auto text-xs sm:text-sm font-semibold text-slate-600">
                    استمع للمحادثة الإنجليزية بتركيز، ثم انتقل لأسئلة الفهم في الأسفل
                  </p>

                  {/* Audio Controls */}
                  <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={toggleSpeech}
                      className={`inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-6 text-xs sm:text-sm font-black shadow-md transition-all active:scale-95 ${
                        isPlayingAudio
                          ? 'bg-amber-500 text-slate-950 shadow-amber-500/25 animate-pulse'
                          : 'bg-purple-700 text-white shadow-purple-700/20 hover:bg-purple-800'
                      }`}
                    >
                      {isPlayingAudio ? (
                        <>
                          <Pause className="h-4 w-4" />
                          <span>إيقاف مؤقت للصوت</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 fill-white" />
                          <span>تشغيل المحادثة الصوتية</span>
                        </>
                      )}
                    </button>

                    {activity.audioScript && (
                      <button
                        type="button"
                        onClick={() => setShowTranscript((s) => !s)}
                        className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-xs sm:text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                      >
                        <FileText className="h-4 w-4 text-purple-600" />
                        <span>{showTranscript ? 'إخفاء النص' : 'عرض نص المحادثة (Transcript)'}</span>
                      </button>
                    )}
                  </div>

                  {/* Collapsible Transcript */}
                  {showTranscript && activity.audioScript && (
                    <div
                      className="mt-5 w-full rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 text-left shadow-inner animate-page-enter"
                      dir="ltr"
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 block mb-2">
                        Audio Script:
                      </span>
                      <p className="text-xs sm:text-sm font-medium leading-relaxed text-slate-800 whitespace-pre-line select-text">
                        {activity.audioScript}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Comprehension Questions */}
        {activity.questions.length > 0 && (
          <div className="animate-page-enter mt-8" style={{ animationDelay: '100ms' }}>
            <div className="mb-6 flex flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 shadow-xs mb-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950">
                أسئلة الفهم والاستيعاب السمعي
              </h2>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">
                أجب على الأسئلة بناءً على ما استمعت إليه في المقطع
              </p>
            </div>
            <InlineQuiz key={activity.slug} questions={activity.questions} contextType="listening" />
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="mt-10 flex flex-col items-stretch sm:items-center justify-between gap-3 border-t border-slate-200/80 pt-6 sm:flex-row">
          <Link
            to="/listening"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs sm:text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
            <span>قائمة أنشطة الاستماع</span>
          </Link>
          {nextActivity && (
            <Link
              to={`/listening/${nextActivity.slug}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-purple-600/20 transition hover:bg-purple-700"
            >
              <span>النشاط التالي: {nextActivity.titleAr}</span>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <PortalFooter />
    </div>
  );
}
