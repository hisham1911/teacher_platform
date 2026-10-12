import { useState } from 'react';
import { Link } from 'react-router';
import { PenLine, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { writingPrompts } from '../../data/content/writing';
import type { WritingPrompt } from '../../data/content/types';

function categoryBadge(category: WritingPrompt['category']) {
  if (category === 'sentence') return 'bg-sky-50 text-sky-800 border-sky-200';
  if (category === 'correction') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-emerald-50 text-emerald-800 border-emerald-200';
}

function categoryLabel(category: WritingPrompt['category']) {
  if (category === 'sentence') return 'ترتيب الجمل';
  if (category === 'correction') return 'تصحيح الأخطاء';
  return 'كتابة فقرة';
}

function levelBadge(level: WritingPrompt['level']) {
  if (level === 'easy') return 'bg-slate-100 text-slate-700';
  if (level === 'medium') return 'bg-emerald-100 text-emerald-800';
  return 'bg-rose-100 text-rose-800';
}

function levelLabel(level: WritingPrompt['level']) {
  if (level === 'easy') return 'مبتدئ';
  if (level === 'medium') return 'متوسط';
  return 'متقدم';
}

export default function WritingIndexPage() {
  const [filter, setFilter] = useState<'all' | 'sentence' | 'correction' | 'paragraph'>('all');

  const filtered = filter === 'all'
    ? writingPrompts
    : writingPrompts.filter((item) => item.category === filter);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        {/* Header Hero */}
        <section className="animate-page-enter text-center max-w-2xl mx-auto">
          <div className="mx-auto mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-600/20">
            <PenLine className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-3.5 py-1 text-xs font-black text-emerald-800 mb-2">
            <Sparkles className="h-3 w-3 text-emerald-600" />
            أنشطة الكتابة ونماذج الإجابة
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-950">
            مهارات الكتابة <span className="text-emerald-700">Writing</span>
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed">
            تدرب على تكوين الجمل السليمة، تصحيح الأخطاء الشائعة، وصياغة الفقرات مع تصحيح ونموذج إرشادي
          </p>

          {/* Filter Tabs on Mobile */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'sentence', label: 'ترتيب الجمل' },
              { id: 'correction', label: 'تصحيح الأخطاء' },
              { id: 'paragraph', label: 'كتابة الفقرات' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  filter === tab.id
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Cards Grid */}
        <section
          className="animate-page-enter mx-auto mt-8 sm:mt-12 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          style={{ animationDelay: '100ms' }}
        >
          {filtered.map((item, index) => (
            <Link
              key={item.slug}
              to={`/writing/${item.slug}`}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-emerald-100/90 bg-gradient-to-br from-white via-white/95 to-emerald-50/40 p-5 sm:p-6 shadow-xs backdrop-blur-xl ring-1 ring-slate-900/5 transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-300 hover:ring-2 hover:ring-emerald-400/20 hover:shadow-xl hover:shadow-emerald-900/10 active:translate-y-0"
            >
              {/* Luminous Specular Top Highlight */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
              />

              {/* Ambient Interior Corner Glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-500/15 via-teal-500/5 to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity"
              />

              {/* Subtle Decorative Background Watermark Icon */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-3 -left-3 text-slate-900/[0.035] group-hover:text-emerald-900/5 transition-all duration-500 scale-100 group-hover:scale-110"
              >
                <PenLine className="h-24 w-24" />
              </div>

              <div className="relative z-10">
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-lg bg-emerald-100/80 px-2 py-0.5 text-xs font-black text-emerald-800">
                    تدريب #{index + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${categoryBadge(
                        item.category
                      )} shadow-2xs`}
                    >
                      {categoryLabel(item.category)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${levelBadge(
                        item.level
                      )} shadow-2xs`}
                    >
                      {levelLabel(item.level)}
                    </span>
                  </div>
                </div>

                <h2 className="text-base sm:text-lg font-black text-slate-950 group-hover:text-emerald-950 transition-colors">
                  {item.titleAr}
                </h2>
                <p className="mt-0.5 text-xs font-bold tracking-wider text-emerald-700" dir="ltr">
                  {item.titleEn}
                </p>

                <p className="mt-2.5 text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
                  {item.instructionAr}
                </p>
              </div>

              <div className="relative z-10 mt-5 flex items-center justify-between border-t border-slate-200/60 pt-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-2xs">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  نموذج إجابة وتصحيح
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-400 border border-slate-200/60 shadow-2xs transition-all group-hover:bg-emerald-700 group-hover:text-white group-hover:border-transparent group-hover:translate-x-[-2px]"
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
