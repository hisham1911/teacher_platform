import { useState } from 'react';
import { Link } from 'react-router';
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
  if (category === 'sentence') return 'ترتيب وتكوين الجمل';
  if (category === 'correction') return 'تصحيح الأخطاء';
  return 'كتابة فقرة موجهة';
}

function levelBadge(level: WritingPrompt['level']) {
  if (level === 'easy') return 'bg-slate-100 text-slate-700';
  if (level === 'medium') return 'bg-violet-100 text-violet-800';
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
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <section className="animate-page-enter text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-2xl font-black text-white shadow-md">
            W
          </div>
          <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">
            الكتابة <span className="text-violet-600">Writing</span>
          </h1>
          <p className="mt-3 text-base font-semibold text-slate-500">
            تدرب على تكوين الجمل، تصحيح الأخطاء، وكتابة الفقرات مع نماذج إجابة نموذجية وتصحيح تفاعلي
          </p>

          {/* Filter Tabs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              { id: 'all', label: 'جميع التدريبات' },
              { id: 'sentence', label: 'ترتيب الجمل' },
              { id: 'correction', label: 'تصحيح الأخطاء' },
              { id: 'paragraph', label: 'كتابة الفقرات' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                  filter === tab.id
                    ? 'bg-violet-700 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        <section
          className="animate-page-enter mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          style={{ animationDelay: '100ms' }}
        >
          {filtered.map((item, index) => (
            <Link
              key={item.slug}
              to={`/writing/${item.slug}`}
              className="group flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-900/5"
            >
              <div className="flex flex-1 flex-col p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                    #{index + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${categoryBadge(item.category)}`}>
                      {categoryLabel(item.category)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${levelBadge(item.level)}`}>
                      {levelLabel(item.level)}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-black text-slate-900 group-hover:text-violet-900 transition-colors">
                  {item.titleAr}
                </h3>
                <p className="mt-1 text-xs font-black tracking-widest text-violet-500" dir="ltr">
                  {item.titleEn.toUpperCase()}
                </p>

                <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
                  {item.instructionAr}
                </p>

                <div className="my-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100" dir="ltr">
                  <p className="line-clamp-2 text-sm font-mono font-medium text-slate-700">
                    {item.promptText}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-slate-100/80 pt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700">
                    <span>✍️</span> ابدأ الكتابة الآن
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors group-hover:bg-violet-700 group-hover:text-white"
                  >
                    ←
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
