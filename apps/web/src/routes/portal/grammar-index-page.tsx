import { Link } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { grammarTopics } from '../../data/content/grammar';

export default function GrammarIndexPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <section className="animate-page-enter text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 text-2xl font-black text-white shadow-md">
            G
          </div>
          <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">
            القواعد <span className="text-violet-600">Grammar</span>
          </h1>
          <p className="mt-3 text-base font-semibold text-slate-500">
            اختر القاعدة التي تريد تعلمها من البطاقات أدناه
          </p>
        </section>

        <section
          className="animate-page-enter mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          style={{ animationDelay: '100ms' }}
        >
          {grammarTopics.map((topic, index) => (
            <Link
              key={topic.slug}
              to={`/grammar/${topic.slug}`}
              className="group flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-900/5"
            >
              <div className="relative w-full border-b border-slate-100 bg-slate-100/50 p-4">
                <img
                  src={topic.imageUrl}
                  alt={topic.titleEn}
                  className="mx-auto h-48 w-full rounded-xl object-contain shadow-xs"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center justify-center rounded-lg bg-violet-100 px-2 py-1 text-xs font-black text-violet-700">
                    #{index + 1}
                  </span>
                  <p className="text-xs font-black tracking-widest text-slate-400">
                    {topic.titleEn.toUpperCase()}
                  </p>
                </div>
                <h3 className="text-xl font-black text-slate-900">{topic.titleAr}</h3>
                <p className="mt-2 flex-1 text-sm font-semibold leading-7 text-slate-600">
                  {topic.description}
                </p>
                
                <div className="mt-5 flex items-center justify-between">
                  {topic.questions.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      {topic.questions.length} أسئلة تفاعلية
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                      البطاقة فقط
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors group-hover:bg-violet-100 group-hover:text-violet-600"
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
