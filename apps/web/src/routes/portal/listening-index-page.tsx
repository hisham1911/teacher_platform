import { Link } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { listeningActivities } from '../../data/content/listening';
import type { ListeningActivity } from '../../data/content/types';

function levelBadge(level: ListeningActivity['level']) {
  if (level === 'easy') return 'bg-sky-100 text-sky-800 border-sky-200';
  if (level === 'medium') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-rose-100 text-rose-800 border-rose-200';
}

function levelLabel(level: ListeningActivity['level']) {
  if (level === 'easy') return 'مبتدئ';
  if (level === 'medium') return 'متوسط';
  return 'متقدم';
}

export default function ListeningIndexPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <section className="animate-page-enter text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-2xl font-black text-white shadow-md">
            L
          </div>
          <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">
            الاستماع <span className="text-violet-600">Listening</span>
          </h1>
          <p className="mt-3 text-base font-semibold text-slate-500">
            استمع وطوّر مهارة الفهم السمعي عبر مقاطع مصورة
          </p>
        </section>

        <section
          className="animate-page-enter mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          style={{ animationDelay: '100ms' }}
        >
          {listeningActivities.map((activity, index) => (
            <Link
              key={activity.slug}
              to={`/listening/${activity.slug}`}
              className="group flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-900/5"
            >
              <div className="flex flex-1 flex-col p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
                    #{index + 1}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${levelBadge(activity.level)}`}
                  >
                    {levelLabel(activity.level)}
                  </span>
                </div>
                
                <h3 className="text-xl font-black text-slate-900">
                  {activity.titleAr}
                </h3>
                <p className="mt-1 text-xs font-black tracking-widest text-violet-500" dir="ltr">
                  {activity.titleEn.toUpperCase()}
                </p>
                
                <div className="mt-auto flex items-center justify-between pt-8">
                  {activity.questions.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>
                      {activity.questions.length} أسئلة استماع
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
