import { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { InlineQuiz } from '../../components/portal/inline-quiz';
import { ImageLightbox } from '../../components/portal/image-lightbox';
import { grammarTopics } from '../../data/content/grammar';

export default function GrammarTopicPage() {
  const { topicSlug } = useParams<{ topicSlug: string }>();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const topicIndex = grammarTopics.findIndex((t) => t.slug === topicSlug);
  const topic = grammarTopics[topicIndex];

  if (!topic) return <Navigate to="/grammar" replace />;

  const nextTopic = grammarTopics[topicIndex + 1];

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        {/* Header Breadcrumb */}
        <header className="mb-6 flex items-center gap-3">
          <Link
            to="/grammar"
            className="inline-flex items-center gap-2 rounded-xl bg-white/70 px-4 py-2 text-sm font-bold text-slate-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-violet-700"
          >
            → عودة للقواعد
          </Link>
        </header>

        <section className="animate-page-enter">
          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl sm:p-10">
            <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">{topic.titleAr}</h1>
            <p className="mt-2 text-sm font-black tracking-widest text-violet-600">
              {topic.titleEn.toUpperCase()}
            </p>
            <p className="mt-4 text-lg font-semibold leading-8 text-slate-600">
              {topic.description}
            </p>

            {/* Grammar Card Image */}
            <div className="mt-8 rounded-2xl bg-slate-100 p-2 sm:p-4">
              <div className="relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5">
                <img
                  src={topic.imageUrl}
                  alt={topic.titleEn}
                  className="w-full cursor-zoom-in object-contain"
                  onClick={() => setLightboxOpen(true)}
                />
                <button
                  onClick={() => setLightboxOpen(true)}
                  className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-slate-900/80 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-slate-900"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                  تكبير البطاقة
                </button>
              </div>
            </div>

            {/* Video (if available) */}
            {topic.videoUrl && (
              <div className="mt-8">
                <h3 className="mb-4 text-lg font-black text-slate-900">شرح مرئي</h3>
                <div className="overflow-hidden rounded-2xl bg-slate-900 shadow-lg ring-1 ring-slate-900/5">
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={topic.videoUrl}
                      title={topic.titleEn}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Interactive Quiz */}
        {topic.questions.length > 0 && (
          <div className="animate-page-enter mt-8" style={{ animationDelay: '100ms' }}>
            <div className="mb-6 flex flex-col items-center justify-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl shadow-sm">
                🧪
              </span>
              <h2 className="mt-3 text-2xl font-black text-slate-900">اختبر نفسك</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                أجب على الأسئلة التالية لتتأكد من فهمك للقاعدة
              </p>
            </div>
            <InlineQuiz key={topic.slug} questions={topic.questions} />
          </div>
        )}

        {/* Navigation */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row">
          <Link
            to="/grammar"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:w-auto"
          >
            → العودة للقائمة
          </Link>
          {nextTopic && (
            <Link
              to={`/grammar/${nextTopic.slug}`}
              className="group flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 text-sm font-black text-white shadow-md transition-all hover:bg-violet-700 hover:shadow-xl hover:shadow-violet-900/20 sm:w-auto"
            >
              القاعدة التالية: {nextTopic.titleAr}
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:-translate-x-1">
                ←
              </span>
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
