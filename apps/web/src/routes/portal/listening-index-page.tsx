import { Link } from 'react-router';
import { Headphones, ArrowLeft, Sparkles, CheckCircle2, Video } from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { getMergedListeningActivities } from '../../data/api-client/guestbook-client';
import type { ListeningActivity } from '../../data/content/types';

function levelBadge(level: ListeningActivity['level']) {
  if (level === 'easy') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (level === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

function levelLabel(level: ListeningActivity['level']) {
  if (level === 'easy') return 'مبتدئ • Easy';
  if (level === 'medium') return 'متوسط • Medium';
  return 'متقدم • Advanced';
}

export default function ListeningIndexPage() {
  const listeningActivities = getMergedListeningActivities();
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        {/* Header Hero */}
        <section className="animate-page-enter text-center max-w-2xl mx-auto">
          <div className="mx-auto mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/20">
            <Headphones className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100/80 px-3.5 py-1 text-xs font-black text-purple-800 mb-2">
            <Sparkles className="h-3 w-3 text-purple-600" />
            أنشطة استماع وفهم سمعي
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-950">
            الاستماع الصوتي <span className="text-purple-600">Listening</span>
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed">
            استمع لمحادثات ونصوص ناطقة بالإنجليزية وطوّر مهارة الفهم السمعي عبر تمارين تفاعلية
          </p>
        </section>

        {/* Cards Grid */}
        <section
          className="animate-page-enter mx-auto mt-8 sm:mt-12 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          style={{ animationDelay: '100ms' }}
        >
          {listeningActivities.map((activity, index) => {
            const isLast = index === listeningActivities.length - 1;
            return (
              <Link
                key={activity.slug}
                to={`/listening/${activity.slug}`}
                className={`group relative flex ${
                  isLast
                    ? 'flex-col sm:col-span-2 lg:col-span-3 sm:flex-row sm:items-stretch sm:gap-6'
                    : 'flex-col justify-between'
                } overflow-hidden rounded-2xl sm:rounded-3xl border border-purple-100/90 bg-gradient-to-br from-white via-white/95 to-purple-50/40 p-5 sm:p-6 shadow-xs backdrop-blur-xl ring-1 ring-slate-900/5 transition-all duration-300 hover:-translate-y-1.5 hover:border-purple-300 hover:ring-2 hover:ring-purple-400/20 hover:shadow-xl hover:shadow-purple-900/10 active:translate-y-0`}
              >
                {/* Luminous Specular Top Highlight */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
                />

                {/* Ambient Interior Corner Glow */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-gradient-to-br from-purple-500/15 via-pink-500/5 to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity"
                />

                {/* Subtle Decorative Background Watermark Icon */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-3 -left-3 text-slate-900/[0.035] group-hover:text-purple-900/5 transition-all duration-500 scale-100 group-hover:scale-110"
                >
                  <Headphones className="h-24 w-24" />
                </div>

                <div className={`relative z-10 ${isLast ? 'sm:flex sm:items-stretch sm:gap-6 flex-1' : ''}`}>
                  {activity.posterUrl ? (
                    <div
                      className={`relative mb-4 ${
                        isLast ? 'sm:mb-0 sm:w-72 lg:w-80 sm:shrink-0' : ''
                      } aspect-video overflow-hidden rounded-xl sm:rounded-2xl bg-slate-950 shadow-xs`}
                    >
                      <img
                        src={activity.posterUrl}
                        alt={activity.titleAr}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md border border-white/10">
                        <Video className="h-3 w-3 text-rose-400" />
                        <span>فيديو كرتوني</span>
                      </span>
                    </div>
                  ) : (
                    <div className="relative mb-4 aspect-video overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-700 via-indigo-900 to-purple-950 p-4 flex flex-col justify-between shadow-xs border border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur-md text-white border border-white/20">
                          <Headphones className="h-4 w-4 text-purple-200" />
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-black text-purple-100 backdrop-blur-md border border-white/20">
                          <span>محادثة صوتية</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-center gap-1.5 py-1 opacity-80">
                        <span className="w-1 h-3 rounded-full bg-purple-300" />
                        <span className="w-1 h-5 rounded-full bg-pink-300" />
                        <span className="w-1 h-9 rounded-full bg-purple-200" />
                        <span className="w-1 h-4 rounded-full bg-pink-300" />
                        <span className="w-1 h-8 rounded-full bg-purple-300" />
                        <span className="w-1 h-5 rounded-full bg-pink-300" />
                        <span className="w-1 h-7 rounded-full bg-purple-200" />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold text-purple-200">
                        <span>استماع مباشر</span>
                        <span dir="ltr">Audio Dialogue</span>
                      </div>
                    </div>
                  )}

                  <div className={isLast ? 'flex-1 flex flex-col justify-between' : ''}>
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="rounded-lg bg-purple-100/80 px-2 py-0.5 text-xs font-black text-purple-800">
                          نشاط #{index + 1}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${levelBadge(
                            activity.level
                          )} shadow-2xs`}
                        >
                          {levelLabel(activity.level)}
                        </span>
                      </div>

                      <h2 className="text-base sm:text-lg font-black text-slate-950 group-hover:text-purple-950 transition-colors">
                        {activity.titleAr}
                      </h2>
                      <p className="mt-0.5 text-xs font-bold tracking-wider text-purple-700" dir="ltr">
                        {activity.titleEn}
                      </p>

                      <div className="mt-3.5 flex items-center gap-2 text-xs font-semibold text-slate-500">
                        {activity.mediaUrl ? (
                          <>
                            <Video className="h-4 w-4 text-rose-500" />
                            <span>مقطع فيديو كرتوني + أسئلة تفاعلية</span>
                          </>
                        ) : (
                          <>
                            <Headphones className="h-4 w-4 text-purple-500" />
                            <span>مقطع ناطق بالإنجليزية + نص مسموع</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-200/60 pt-3">
                      {activity.questions.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 shadow-2xs">
                          <CheckCircle2 className="h-3 w-3 text-purple-600" />
                          {activity.questions.length} أسئلة استماع
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">استماع حر</span>
                      )}
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-400 border border-slate-200/60 shadow-2xs transition-all group-hover:bg-purple-600 group-hover:text-white group-hover:border-transparent group-hover:translate-x-[-2px]"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      </div>

      <PortalFooter />
    </div>
  );
}
