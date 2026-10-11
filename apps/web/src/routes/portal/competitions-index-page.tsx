import { Link } from 'react-router';
import {
  Trophy,
  Award,
  GraduationCap,
  Timer,
  CheckCircle2,
  Clock,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { portalCompetitions } from '../../data/content/competitions';

function CompetitionIcon({ id, className = 'h-7 w-7' }: { id: string; className?: string }) {
  if (id === 'million') return <Award className={className} />;
  if (id === 'placement') return <GraduationCap className={className} />;
  if (id === 'speed') return <Timer className={className} />;
  return <Trophy className={className} />;
}

export default function CompetitionsIndexPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="animate-page-enter mx-auto max-w-4xl px-4 pt-10 pb-12 text-center sm:pt-16 sm:pb-14">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200/90 bg-amber-50/90 px-4 py-1.5 text-xs font-black text-amber-900 shadow-xs">
            <Trophy className="h-3.5 w-3.5 text-amber-600" />
            <span>بوابة المسابقات التفاعلية • English Competitions</span>
          </div>

          <h1 className="text-balance text-3xl font-black text-slate-950 sm:text-4xl md:text-5xl">
            تحديات ومسابقات
            <br />
            <span className="bg-gradient-to-r from-amber-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
              تختبر مهاراتك وتزيد حماسك ✦
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-pretty text-xs sm:text-base font-semibold leading-relaxed text-slate-600">
            اختر نوع التحدي الذي تفضله: تسلّق سلم مسابقة المليون، أو قيّم مستواك بدقة عبر اختبار تحديد المستوى، أو جرّب سرعتك في تحدي الـ 60 ثانية!
          </p>
        </section>

        {/* Competitions Cards */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-3">
            {portalCompetitions.map((comp) => (
              <div
                key={comp.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-6 sm:p-7 shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-900/10"
              >
                <div>
                  {/* Top Bar: Icon & Badge */}
                  <div className="mb-5 flex items-start justify-between">
                    <div
                      className={`flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br ${comp.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-105`}
                    >
                      <CompetitionIcon id={comp.id} className="h-6 w-6" />
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-black ${comp.badgeColor}`}
                    >
                      {comp.badge}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <span className="text-[11px] font-black tracking-wider text-slate-400">
                    {comp.titleEn}
                  </span>
                  <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-950 transition-colors group-hover:text-violet-900">
                    {comp.titleAr}
                  </h2>
                  <p className="mt-0.5 text-xs font-bold text-violet-700">{comp.subtitle}</p>

                  {/* Description */}
                  <p className="mt-3 text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
                    {comp.description}
                  </p>

                  {/* Feature checklist */}
                  <div className="mt-5 space-y-2 border-t border-slate-100 pt-3.5">
                    {comp.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 text-xs font-bold text-slate-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <div className="mb-3.5 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{comp.duration}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>{comp.questionCount} سؤالاً</span>
                    </span>
                  </div>
                  <Link
                    to={comp.path}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${comp.gradient} py-3.5 text-xs sm:text-sm font-black text-white shadow-md transition-all duration-200 hover:brightness-110 active:scale-[0.98]`}
                  >
                    <span>ابدأ المسابقة الآن</span>
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <PortalFooter />
    </div>
  );
}
