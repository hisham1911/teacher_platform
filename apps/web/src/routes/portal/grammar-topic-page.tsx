import { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router';
import {
  ChevronRight,
  ZoomIn,
  Video,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { InlineQuiz } from '../../components/portal/inline-quiz';
import { LessonDiscussion } from '../../components/portal/lesson-discussion';
import { ImageLightbox } from '../../components/portal/image-lightbox';
import { PortalVideoPlayer } from '../../components/portal/portal-video-player';
import { grammarTopics } from '../../data/content/grammar';

export default function GrammarTopicPage() {
  const { topicSlug } = useParams<{ topicSlug: string }>();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const topicIndex = grammarTopics.findIndex((t) => t.slug === topicSlug);
  const topic = grammarTopics[topicIndex];

  if (!topic) return <Navigate to="/grammar" replace />;

  const nextTopic = grammarTopics[topicIndex + 1];

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
        {/* Header Breadcrumb */}
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/grammar"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 shadow-xs backdrop-blur-sm transition-all hover:bg-violet-50 hover:text-violet-800"
          >
            <ChevronRight className="h-4 w-4" />
            <span>العودة لقائمة القواعد</span>
          </Link>
          <span className="rounded-lg bg-violet-100 px-2.5 py-1 text-xs font-black text-violet-800">
            قاعدة #{topicIndex + 1} من {grammarTopics.length}
          </span>
        </header>

        {/* Main Content Card */}
        <section className="animate-page-enter">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur-xl sm:p-8">
            <span className="text-xs font-black tracking-widest text-violet-700" dir="ltr">
              {topic.titleEn.toUpperCase()}
            </span>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-950">
              {topic.titleAr}
            </h1>
            <p className="mt-3 text-sm sm:text-base font-semibold leading-7 sm:leading-8 text-slate-600">
              {topic.description}
            </p>

            {/* Grammar Card Image */}
            <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-2 sm:p-4">
              <div className="relative overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-slate-900/5">
                <img
                  src={topic.imageUrl}
                  alt={topic.titleEn}
                  className="w-full cursor-zoom-in object-contain max-h-[550px] mx-auto"
                  onClick={() => setLightboxOpen(true)}
                />
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-xl bg-slate-950/80 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-slate-950 active:scale-95"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                  <span>تكبير البطاقة</span>
                </button>
              </div>
            </div>

            {/* Video (if available) */}
            {topic.videoUrl && (
              <div className="mt-8 border-t border-slate-100 pt-6">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                    <Video className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-black text-slate-900">شرح مرئي إثرائي</h3>
                </div>
                <PortalVideoPlayer
                  src={topic.videoUrl}
                  poster={topic.posterUrl}
                  title={topic.titleEn}
                />
              </div>
            )}
          </div>
        </section>

        {/* Interactive Quiz */}
        {topic.questions.length > 0 && (
          <div className="animate-page-enter mt-8" style={{ animationDelay: '100ms' }}>
            <div className="mb-6 flex flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-xs mb-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                اختبر فهمك للقاعدة
              </h2>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">
                أجب على الأسئلة التفاعلية لتثبيت معلوماتك فوراً
              </p>
            </div>
            <InlineQuiz key={topic.slug} questions={topic.questions} />
          </div>
        )}

        {/* Lesson Q&A Discussion */}
        <LessonDiscussion topicSlug={topic.slug} topicTitle={topic.titleAr} />

        {/* Bottom Navigation */}
        <div className="mt-10 flex flex-col items-stretch sm:items-center justify-between gap-3 border-t border-slate-200/80 pt-6 sm:flex-row">
          <Link
            to="/grammar"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs sm:text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
            <span>قائمة القواعد</span>
          </Link>
          {nextTopic && (
            <Link
              to={`/grammar/${nextTopic.slug}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-violet-700/20 transition hover:bg-violet-800"
            >
              <span>القاعدة التالية: {nextTopic.titleAr}</span>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <ImageLightbox
        src={topic.imageUrl}
        alt={topic.titleEn}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <PortalFooter />
    </div>
  );
}
