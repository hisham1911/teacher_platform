import { Link } from 'react-router';
import {
  Sparkles,
  ArrowLeft,
  Trophy,
  PenLine,
  BookOpen,
  Crown,
  Award,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
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

        {/* National Initiative Royal Banner */}
        <section className="animate-page-enter mx-auto max-w-6xl px-4 pb-8 sm:pb-12">
          <div className="relative overflow-hidden rounded-3xl border-2 border-amber-300/80 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 p-6 sm:p-9 text-white shadow-xl">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl"
            />

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 text-center lg:text-right">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 shadow-lg ring-4 ring-amber-300/30">
                  <Crown className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-300/40 px-3.5 py-1 text-xs font-black text-amber-200 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                    <span>مبادرة وطنية حصرية · 🇸🇦 Saudi Homeland Ambassador</span>
                  </div>
                  <h2 className="text-xl sm:text-3xl font-black text-white">
                    مبادرة في القلب وطن وقيادة | Journey of Glory 🇸🇦
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm font-semibold text-emerald-100 max-w-xl">
                    رحلة تفاعلية من 5 محطات في تاريخ المملكة ومدنها وطبيعتها وتراثها؛ توّجي مشاركتكِ بكتابة عهد المستقبل والحصول على شهادة «سفيرة الوطن».
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
                <Link
                  to="/national-journey"
                  className="w-full sm:w-auto inline-flex min-h-13 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-7 py-3.5 text-sm sm:text-base font-black text-slate-950 shadow-lg shadow-amber-400/20 transition hover:brightness-105 active:scale-95"
                >
                  <Award className="h-5 w-5 text-emerald-950 shrink-0" />
                  <span>ابدئي رحلة المجد</span>
                  <ArrowLeft className="h-4 w-4 shrink-0 text-emerald-950" />
                </Link>
              </div>
            </div>
          </div>
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

            return (
              <Link
                key={section.id}
                to={section.path}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border ${theme.border} ${theme.surface} p-5 sm:p-6 shadow-xs backdrop-blur-xl ring-1 ring-slate-900/5 transition-all duration-300 hover:-translate-y-1.5 ${theme.shadow} ${theme.ring} active:translate-y-0 ${
                  isGuestbook ? 'sm:col-span-2 lg:col-span-3 sm:flex-row sm:items-center sm:gap-8' : ''
                }`}
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

                <div className={`relative z-10 ${isGuestbook ? 'sm:flex-1' : ''}`}>
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

                <div
                  className={`relative z-10 mt-5 flex items-center justify-between border-t border-slate-200/60 pt-3.5 ${
                    isGuestbook
                      ? 'sm:mt-0 sm:border-t-0 sm:pt-0 sm:flex-col sm:items-end sm:justify-center sm:gap-3.5 sm:shrink-0'
                      : ''
                  }`}
                >
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full ${theme.bgSoft} px-3 py-1 text-xs font-bold ${theme.text} shadow-2xs whitespace-nowrap`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
                    {badgeLabel}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-400 border border-slate-200/60 shadow-2xs transition-all duration-300 group-hover:bg-gradient-to-r group-hover:${theme.gradient} group-hover:text-white group-hover:border-transparent group-hover:translate-x-[-2px]`}
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
