import { Link } from 'react-router';
import {
  Trophy,
  Award,
  GraduationCap,
  Timer,
  CheckCircle2,
  Clock,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { portalCompetitions } from '../../data/content/competitions';
import { ChampionsLeaderboard } from '../../components/portal/champions-leaderboard';

function CompetitionIcon({ id, className = 'h-7 w-7' }: { id: string; className?: string }) {
  if (id === 'million') return <Award className={className} />;
  if (id === 'placement') return <GraduationCap className={className} />;
  if (id === 'speed') return <Timer className={className} />;
  return <Trophy className={className} />;
}

interface CompCardTheme {
  surface: string;
  border: string;
  glow: string;
  ring: string;
  shadow: string;
  watermarkColor: string;
}

const DEFAULT_COMP_THEME: CompCardTheme = {
  surface: 'bg-gradient-to-br from-white via-amber-50/25 to-yellow-50/50',
  border: 'border-amber-200/90',
  glow: 'from-amber-400/20 via-yellow-400/8 to-transparent',
  ring: 'hover:ring-amber-400/25',
  shadow: 'hover:shadow-xl hover:shadow-amber-900/12 hover:border-amber-400',
  watermarkColor: 'text-amber-500/[0.07]',
};

const compCardThemes: Record<string, CompCardTheme> = {
  million: {
    surface: 'bg-gradient-to-br from-white via-amber-50/25 to-yellow-50/50',
    border: 'border-amber-200/90',
    glow: 'from-amber-400/20 via-yellow-400/8 to-transparent',
    ring: 'hover:ring-amber-400/25',
    shadow: 'hover:shadow-xl hover:shadow-amber-900/12 hover:border-amber-400',
    watermarkColor: 'text-amber-500/[0.07]',
  },
  speed: {
    surface: 'bg-gradient-to-br from-white via-sky-50/25 to-indigo-50/45',
    border: 'border-sky-200/90',
    glow: 'from-sky-400/20 via-indigo-400/8 to-transparent',
    ring: 'hover:ring-sky-400/25',
    shadow: 'hover:shadow-xl hover:shadow-sky-900/12 hover:border-sky-400',
    watermarkColor: 'text-sky-500/[0.07]',
  },
  placement: {
    surface: 'bg-gradient-to-br from-white via-emerald-50/25 to-teal-50/45',
    border: 'border-emerald-200/90',
    glow: 'from-emerald-400/20 via-teal-400/8 to-transparent',
    ring: 'hover:ring-emerald-400/25',
    shadow: 'hover:shadow-xl hover:shadow-emerald-900/12 hover:border-emerald-400',
    watermarkColor: 'text-emerald-500/[0.07]',
  },
};

function getCompCardTheme(id: string): CompCardTheme {
  return compCardThemes[id] ?? DEFAULT_COMP_THEME;
}

export default function CompetitionsIndexPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="animate-page-enter mx-auto max-w-4xl px-4 pt-10 pb-12 text-center sm:pt-16 sm:pb-14">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200/90 bg-amber-50/90 px-4 py-1.5 text-xs font-black text-amber-900 shadow-xs">
            <Trophy className="h-3.5 w-3.5 text-amber-600" />
            <span>بوابة المسابقات التفاعلية • <span dir="ltr">English Competitions</span></span>
          </div>

          <h1 className="text-balance text-3xl font-black text-slate-950 sm:text-4xl md:text-5xl">
            تحديات ومسابقات
            <br />
            <span className="bg-gradient-to-r from-amber-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
              تختبر مهاراتك وتزيد حماسك ✦
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-pretty text-xs sm:text-base font-semibold leading-relaxed text-slate-600">
            اختر نوع التحدي الذي تفضله: تسلّق سلم تحدي Spark، أو قيّم مستواك بدقة عبر اختبار تحديد المستوى، أو جرّب سرعتك في <span className="inline-block whitespace-nowrap">تحدي الـ 60 ثانية!</span>
          </p>
        </section>

        {/* Competitions Cards */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-3">
            {portalCompetitions.map((comp) => {
              const theme = getCompCardTheme(comp.id);
              return (
                <Link
                  key={comp.id}
                  to={comp.path}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border ${theme.border} ${theme.surface} p-6 sm:p-7 shadow-xs backdrop-blur-xl ring-1 ring-slate-900/5 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer ${theme.shadow} ${theme.ring}`}
                >
                  {/* Luminous Specular Top Highlight */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
                  />

                  {/* Ambient Interior Corner Glow */}
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute -top-12 -left-12 h-36 w-36 rounded-full bg-gradient-to-br ${theme.glow} blur-2xl opacity-70 group-hover:opacity-100 transition-opacity`}
                  />

                  {/* Subtle Decorative Background Watermark Icon */}
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute -bottom-3 -left-3 ${theme.watermarkColor} transition-all duration-500 scale-100 group-hover:scale-110`}
                  >
                    <CompetitionIcon id={comp.id} className="h-28 w-28" />
                  </div>

                  <div className="relative z-10">
                    {/* Top Bar: Icon & Badge */}
                    <div className="mb-5 flex items-start justify-between">
                      <div
                        className={`flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br ${comp.gradient} text-white shadow-md shadow-slate-900/10 transition-transform duration-300 group-hover:scale-105`}
                      >
                        <CompetitionIcon id={comp.id} className="h-6 w-6" />
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-black ${comp.badgeColor} shadow-2xs whitespace-nowrap`}
                      >
                        {comp.badge}
                      </span>
                    </div>

                    {/* Title & Subtitle */}
                    <span className="text-[11px] font-black tracking-wider text-slate-400" dir="ltr">
                      {comp.titleEn}
                    </span>
                    <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-950 transition-colors group-hover:text-violet-950">
                      {comp.titleAr}
                    </h2>
                    <p className="mt-0.5 text-xs font-bold text-violet-700">{comp.subtitle}</p>

                    {/* Description */}
                    <p className="mt-3 text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
                      {comp.description}
                    </p>

                    {/* Feature checklist */}
                    <div className="mt-5 space-y-2 border-t border-slate-200/60 pt-3.5">
                      {comp.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center gap-2 text-xs font-bold text-slate-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span dir="auto">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer CTA */}
                  <div className="relative z-10 mt-6 border-t border-slate-200/60 pt-4">
                    <div className="mb-3.5 flex items-center justify-between text-xs font-bold text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{comp.duration}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                        <span>{comp.questionCount} سؤالاً</span>
                      </span>
                    </div>
                    <div
                      className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${comp.gradient} py-3.5 text-xs sm:text-sm font-black text-white shadow-md shadow-slate-900/10 transition-all duration-200 group-hover:brightness-110 active:scale-[0.98]`}
                    >
                      <span>
                        {comp.id === 'placement' ? 'ابدأ التقييم والتشخيص' : 'ابدأ التحدي الآن'}
                      </span>
                      <ArrowLeft className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Champions Leaderboard Section */}
        <section className="mx-auto max-w-5xl px-4 pb-20">
          <ChampionsLeaderboard
            category="all"
            showTabs={true}
            title="لوحة شرف المتصدرين (Live Champions Leaderboard)"
            subtitle="أفضل 10 أبطال في تحديات اللغة الإنجليزية — تُعرض أعلى نتيجة محققة لكل متسابق لمنع التكرار"
          />
        </section>
      </main>

      <PortalFooter />
    </div>
  );
}
