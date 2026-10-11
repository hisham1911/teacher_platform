import { Link } from 'react-router';
import { BookText, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { readingPassages } from '../../data/content/reading';
import type { ReadingPassage } from '../../data/content/types';

function levelBadge(level: ReadingPassage['level']) {
  if (level === 'easy') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (level === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

function levelLabel(level: ReadingPassage['level']) {
  if (level === 'easy') return 'مبتدئ • Easy';
  if (level === 'medium') return 'متوسط • Medium';
  return 'متقدم • Advanced';
}

export default function ReadingIndexPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        {/* Header Hero */}
        <section className="animate-page-enter text-center max-w-2xl mx-auto">
          <div className="mx-auto mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-600/20">
            <BookText className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100/80 px-3.5 py-1 text-xs font-black text-sky-800 mb-2">
            <Sparkles className="h-3 w-3 text-sky-600" />
            نصوص قراءة وفهم تفاعلية
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-950">
            القراءة والفهم <span className="text-sky-600">Reading</span>
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed">
            اقرأ نصوصاً إنجليزية متنوعة وطوّر حصيلتك اللغوية مع أسئلة الفهم والاستيعاب
          </p>
        </section>

        {/* Cards Grid */}
        <section
          className="animate-page-enter mx-auto mt-8 sm:mt-12 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          style={{ animationDelay: '100ms' }}
        >
          {readingPassages.map((passage, index) => (
            <Link
              key={passage.slug}
              to={`/reading/${passage.slug}`}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/90 p-5 sm:p-6 shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-900/10 active:translate-y-0"
            >
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-600">
                    نص #{index + 1}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${levelBadge(
                      passage.level
                    )}`}
                  >
                    {levelLabel(passage.level)}
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-sky-800 transition-colors">
                  {passage.titleAr}
                </h2>
                <p className="mt-0.5 text-xs font-bold tracking-wider text-sky-600" dir="ltr">
                  {passage.titleEn}
                </p>

                {/* Excerpt box */}
                <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <p
                    className="line-clamp-3 text-xs sm:text-sm font-medium leading-relaxed text-slate-600"
                    dir="ltr"
                  >
                    {passage.text}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100/90 pt-3">
                {passage.questions.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                    <CheckCircle2 className="h-3 w-3 text-sky-600" />
                    {passage.questions.length} أسئلة فهم
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">قراءة حرة</span>
                )}
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all group-hover:bg-sky-600 group-hover:text-white group-hover:translate-x-[-2px]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </section>
      </div>

      <PortalFooter />
    </div>
  );
}
