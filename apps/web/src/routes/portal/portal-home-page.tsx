import { Link } from 'react-router';
import {
  Sparkles,
  ArrowLeft,
  Trophy,
  PenLine,
  BookOpen,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter, SaudiEmblemIcon } from '../../components/portal/portal-nav';
import { EnglishSparkLogo } from '../../components/portal/english-spark-logo';
import { portalSections } from '../../data/content/portal-sections';
import { SectionIcon, getSectionTheme } from '../../components/portal/portal-icons';
import {
  getMergedGrammarTopics,
  getMergedReadingPassages,
  getMergedListeningActivities,
  getMergedWritingPrompts,
} from '../../data/api-client/guestbook-client';
import { portalCompetitions } from '../../data/content/competitions';

export default function PortalHomePage() {
  const grammarCount = getMergedGrammarTopics().length;
  const readingCount = getMergedReadingPassages().length;
  const listeningCount = getMergedListeningActivities().length;
  const writingCount = getMergedWritingPrompts().length;

  const sectionBadges: Record<string, string> = {
    grammar: `${grammarCount} قواعد تفاعلية`,
    reading: `${readingCount} نصوص وتمارين`,
    listening: `${listeningCount} مقاطع صوتية`,
    writing: `${writingCount} تمارين صياغة`,
    speaking: 'أنشطة نطق ومحادثة',
    competitions: `${portalCompetitions.length} مسابقات تفاعلية`,
    guestbook: 'آراء ورسائل الزوار',
  };
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="animate-page-enter mx-auto max-w-4xl px-4 pt-8 pb-12 text-center sm:pt-12 sm:pb-16">
          {/* Official English Spark Logo Lockup */}
          <div className="mb-4 flex justify-center">
            <EnglishSparkLogo
              variant="full"
              subtitle="إدارة تعليم جازان • متوسطة وثانوية الجرادية — إشراف معلمات اللغة الإنجليزية"
              showSubtitle={true}
              className="drop-shadow-xs"
            />
          </div>

          {/* Inspirational Platform Motto Banner */}
          <div className="mb-6 flex flex-col items-center justify-center gap-2">
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-3 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/95 via-white/95 to-sky-50/95 px-5 py-2.5 shadow-xs backdrop-blur-xs ring-1 ring-amber-400/20">
              <span className="text-xs sm:text-sm font-black text-amber-950 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-600 shrink-0 animate-pulse" />
                <span>لكل صوت حكاية، ولكل حلم بداية</span>
              </span>
              <span className="hidden sm:inline text-amber-300 font-bold" aria-hidden="true">✦</span>
              <span className="text-[11px] sm:text-xs font-bold text-sky-900 tracking-wide font-sans" dir="ltr">
                Every Voice Has a Story. Every Dream Has a Beginning.
              </span>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-3.5 py-1 text-[11px] font-black text-violet-800">
              إنتاج معرفي • وزارة التعليم
            </span>
          </div>

          <h1 className="text-balance text-3xl font-black leading-tight text-slate-950 sm:text-5xl md:text-6xl">
            تعلّم الإنجليزية
            <br />
            <span className="bg-gradient-to-r from-violet-700 via-purple-600 to-indigo-700 bg-clip-text text-transparent">
              بطريقة مبسطة وممتعة ✦
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm font-semibold leading-7 text-slate-600 sm:text-base sm:leading-8">
            قواعد مبسطة، قراءة حرة، استماع ومحادثة، كتابة بنماذج إجابة، ومسابقات تفاعلية — دليلك التعليمي الشامل لتعلم اللغة الإنجليزية خطوة بخطوة.
          </p>

          {/* Hero CTAs */}
          <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 max-w-md mx-auto sm:max-w-none">
            <Link
              to="/grammar"
              className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-2xl bg-violet-700 px-7 text-sm font-black text-white shadow-md shadow-violet-700/20 transition-all hover:bg-violet-800 hover:-translate-y-0.5 active:translate-y-0"
            >
              <BookOpen className="h-4 w-4" />
              <span>ابدأ بالقواعد والتمارين</span>
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:gap-2.5">
              <Link
                to="/competitions"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50/90 px-5 text-sm font-black text-amber-900 shadow-xs transition-all hover:bg-amber-100 hover:-translate-y-0.5 active:translate-y-0"
              >
                <Trophy className="h-4 w-4 text-amber-600" />
                <span>قسم المسابقات</span>
              </Link>
              <Link
                to="/writing"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50/90 px-5 text-sm font-black text-emerald-900 shadow-xs transition-all hover:bg-emerald-100 hover:-translate-y-0.5 active:translate-y-0"
              >
                <PenLine className="h-4 w-4 text-emerald-600" />
                <span>قسم الكتابة</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Luminous Glassmorphic National Initiative Banner — مبادرة في القلب وطن وقيادة */}
        <section className="animate-page-enter mx-auto max-w-6xl px-4 pb-8">
          <Link
            className="group relative flex flex-col lg:flex-row items-center justify-between gap-5 overflow-hidden rounded-2xl sm:rounded-3xl border border-emerald-200/90 bg-gradient-to-br from-white via-emerald-50/40 to-amber-50/45 p-5 sm:p-7 shadow-xs backdrop-blur-xl ring-1 ring-emerald-900/5 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-900/10"
            to="/national-journey"
          >
            {/* Luminous Specular Top Highlight */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/95 to-transparent"
            />
            {/* Ambient Emerald & Gold Corner Glows */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-400/20 via-teal-400/10 to-transparent blur-2xl opacity-75 group-hover:opacity-100 transition-opacity"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-gradient-to-tr from-amber-400/20 via-yellow-400/10 to-transparent blur-2xl opacity-75 group-hover:opacity-100 transition-opacity"
            />

            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-right gap-4 sm:gap-5">
              <div className="flex h-15 w-15 sm:h-18 sm:w-18 shrink-0 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform">
                <SaudiEmblemIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </div>
              <div>
                <div className="inline-flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="rounded-full border border-emerald-200 bg-emerald-100/80 px-3 py-0.5 text-[11px] font-black text-emerald-900">
                    مبادرة وطنية تفاعلية
                  </span>
                  <span className="text-xs font-black tracking-wider text-amber-700" dir="ltr">
                    JOURNEY OF GLORY · رحلة المجد
                  </span>
                </div>
                <h2 className="mt-1.5 text-xl sm:text-2xl font-black text-slate-950 group-hover:text-emerald-950 transition-colors">
                  مبادرة «في القلب وطن وقيادة»
                </h2>
                <p className="mt-1 max-w-2xl text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
                  رحلة تفاعلية من 5 محطات في تاريخ المملكة ومدنها وطبيعتها وتراثها، تختتمينها بكتابة رسالتكِ في
                  جدار «أصوات تحب الوطن» والحصول على شهادة{' '}
                  <strong className="inline-block whitespace-nowrap text-emerald-800">«سفيرة الوطن | Saudi Homeland Ambassador»</strong>.
                </p>
              </div>
            </div>

            <div className="relative z-10 w-full sm:w-auto flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-md shadow-emerald-700/20 transition group-hover:brightness-110">
              <span>ابدئي رحلة المجد</span>
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            </div>
          </Link>
        </section>

        {/* Section Cards */}
        <section
          className="animate-page-enter mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 pb-20 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          style={{ animationDelay: '100ms' }}
        >
          {portalSections.map((section) => {
            const theme = getSectionTheme(section.id);
            const badgeLabel =
              sectionBadges[section.id] ||
              (section.count ? `${section.count} درس` : 'ابدأ الآن');
            const isGuestbook = section.id === 'guestbook';

            if (isGuestbook) {
              return (
                <Link
                  key={section.id}
                  to={section.path}
                  className={`group relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-5 overflow-hidden rounded-2xl sm:rounded-3xl border ${theme.border} ${theme.surface} p-5 sm:p-7 shadow-xs backdrop-blur-xl ring-1 ring-slate-900/5 transition-all duration-300 hover:-translate-y-1.5 ${theme.shadow} ${theme.ring} active:translate-y-0 sm:col-span-2 lg:col-span-3`}
                >
                  {/* Luminous Specular Top Highlight */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
                  />

                  {/* Ambient Interior Corner Glow */}
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute -top-10 -left-10 h-36 w-36 rounded-full bg-gradient-to-br ${theme.glow} blur-2xl opacity-75 transition-opacity duration-300 group-hover:opacity-100`}
                  />

                  {/* Subtle Decorative Background Watermark Icon */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-4 -left-4 text-slate-900/[0.035] transition-all duration-500 scale-100 group-hover:scale-110 group-hover:opacity-100"
                  >
                    <SectionIcon id={section.id} className="h-28 w-28 sm:h-32 sm:w-32" />
                  </div>

                  {/* Main Content Area: Icon + Details */}
                  <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 flex-1 min-w-0">
                    <div
                      className={`flex h-13 w-13 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br ${theme.gradient} text-white shadow-md shadow-rose-900/10 transition-transform duration-300 group-hover:scale-105`}
                    >
                      <SectionIcon id={section.id} className="h-6 w-6 sm:h-8 sm:w-8" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Unified Badges Row */}
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full border border-rose-200/80 bg-white/90 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-bold text-rose-800 shadow-2xs"
                          dir="ltr"
                        >
                          {section.titleEn}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full ${theme.bgSoft} border border-rose-100 px-3 py-0.5 text-xs font-bold ${theme.text} shadow-2xs whitespace-nowrap`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${theme.dot} animate-pulse`} />
                          {badgeLabel}
                        </span>
                      </div>

                      <h2 className="text-lg sm:text-xl font-black text-slate-950 transition-colors group-hover:text-rose-950">
                        {section.titleAr}
                      </h2>
                      <p className="mt-1 text-xs sm:text-sm font-semibold leading-6 sm:leading-7 text-slate-600">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  {/* CTA Action on Left */}
                  <div className="relative z-10 w-full sm:w-auto flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-fuchsia-600 px-5 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-white shadow-md shadow-rose-600/20 transition group-hover:brightness-110">
                    <span>شارك بكلمتك في سجل الزوار</span>
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  </div>
                </Link>
              );
            }

            return (
              <Link
                key={section.id}
                to={section.path}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border ${theme.border} ${theme.surface} p-5 sm:p-6 shadow-xs backdrop-blur-xl ring-1 ring-slate-900/5 transition-all duration-300 hover:-translate-y-1.5 ${theme.shadow} ${theme.ring} active:translate-y-0`}
              >
                {/* Luminous Specular Top Highlight */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
                />

                {/* Ambient Interior Corner Glow */}
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-gradient-to-br ${theme.glow} blur-2xl opacity-70 transition-opacity duration-300 group-hover:opacity-100`}
                />

                {/* Subtle Decorative Background Watermark Icon */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-3 -left-3 text-slate-900/[0.035] transition-all duration-500 scale-100 group-hover:scale-110 group-hover:opacity-100"
                >
                  <SectionIcon id={section.id} className="h-24 w-24 sm:h-28 sm:w-28" />
                </div>

                <div className="relative z-10">
                  <div className="mb-4 flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.gradient} text-white shadow-md shadow-slate-900/10 transition-transform duration-300 group-hover:scale-105`}
                    >
                      <SectionIcon id={section.id} className="h-6 w-6" />
                    </div>
                    <span
                      className="rounded-full border border-slate-200/70 bg-white/80 backdrop-blur-xs px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-2xs"
                      dir="ltr"
                    >
                      {section.titleEn}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-slate-950 transition-colors group-hover:text-violet-950">
                    {section.titleAr}
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm font-semibold leading-6 sm:leading-7 text-slate-600">
                    {section.description}
                  </p>
                </div>

                <div className="relative z-10 mt-5 flex items-center justify-between border-t border-slate-200/60 pt-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full ${theme.bgSoft} px-3 py-1 text-xs font-bold ${theme.text} shadow-2xs whitespace-nowrap`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
                    {badgeLabel}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-400 border border-slate-200/60 shadow-2xs transition-all duration-300 ${theme.hoverBtnClass} group-hover:translate-x-[-2px]`}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </main>

      <PortalFooter />
    </div>
  );
}
