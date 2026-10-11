import { Link } from 'react-router';
import { BookOpen, ArrowLeft, CheckCircle2, Sparkles, Video } from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { grammarTopics } from '../../data/content/grammar';

export default function GrammarIndexPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        {/* Header Hero */}
        <section className="animate-page-enter text-center max-w-2xl mx-auto">
          <div className="mx-auto mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-700/20">
            <BookOpen className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/80 px-3.5 py-1 text-xs font-black text-violet-800 mb-2">
            <Sparkles className="h-3 w-3 text-violet-600" />
            9 بطاقات تعليمية معتمدة
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-950">
            القواعد النحوية <span className="text-violet-700">Grammar</span>
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed">
            تعلّم القواعد الإنجليزية بأسلوب بصري مبسط مع بطاقات الشرح الدقيقة والتمارين التفاعلية
          </p>
        </section>

        {/* Cards Grid */}
        <section
          className="animate-page-enter mx-auto mt-8 sm:mt-12 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          style={{ animationDelay: '100ms' }}
        >
          {grammarTopics.map((topic, index) => (
            <Link
              key={topic.slug}
              to={`/grammar/${topic.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/90 shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-900/10 active:translate-y-0"
            >
              {/* Infographic Thumbnail */}
              <div className="relative w-full border-b border-slate-100 bg-slate-50/70 p-3 sm:p-4 flex items-center justify-center">
                <img
                  src={topic.imageUrl}
                  alt={topic.titleEn}
                  className="mx-auto h-40 sm:h-48 w-full rounded-xl object-contain shadow-xs transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
                <span className="absolute top-3 right-3 rounded-lg bg-violet-900/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                  بطاقة #{index + 1}
                </span>
              </div>

              {/* Card Body */}
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black tracking-widest text-violet-700">
                    {topic.titleEn.toUpperCase()}
                  </span>
                  {topic.videoUrl && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200/60 shadow-2xs">
                      <Video className="h-3 w-3 text-rose-600" />
                      <span>فيديو كرتوني</span>
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-violet-900 transition-colors">
                  {topic.titleAr}
                </h2>
                <p className="mt-1.5 flex-1 text-xs sm:text-sm font-semibold leading-6 text-slate-600 line-clamp-2">
                  {topic.description}
                </p>

                {/* Footer / Badge */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100/80 pt-3">
                  {topic.questions.length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {topic.questions.length} أسئلة تفاعلية
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                      بطاقة الشرح
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all group-hover:bg-violet-700 group-hover:text-white group-hover:translate-x-[-2px]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>

      <PortalFooter />
    </div>
  );
}
