import { Link } from 'react-router';
import {
  Sparkles,
  ArrowLeft,
  Trophy,
  PenLine,
  BookOpen,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { portalSections } from '../../data/content/portal-sections';
import { SectionIcon, getSectionTheme } from '../../components/portal/portal-icons';

const sectionBadges: Record<string, string> = {
  grammar: '9 قواعد تفاعلية',
  reading: 'نصوص وتمارين فهم',
  listening: 'مقاطع استماع صوتية',
  writing: 'صياغة ونموذج إجابة',
  speaking: 'أنشطة نطق ومحادثة',
  competitions: '3 مسابقات تفاعلية',
  guestbook: 'آراء ورسائل الزوار',
};

export default function PortalHomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="animate-page-enter mx-auto max-w-4xl px-4 pt-10 pb-12 text-center sm:pt-16 sm:pb-16">
          <div className="mb-4 flex flex-col items-center justify-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/90 bg-violet-50/90 px-4 py-1.5 text-xs font-black tracking-wide text-violet-800 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-violet-600 animate-pulse" />
              إنتاج معرفي • وزارة التعليم
            </span>
            <p className="text-xs font-bold text-slate-500 sm:text-sm">
              مدرسة متوسطة وثانوية الجرادية — إشراف المعلمة مريم
            </p>
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

            return (
              <Link
                key={section.id}
                to={section.path}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/90 p-5 sm:p-6 shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-900/10 active:translate-y-0"
              >
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-105`}
                    >
                      <SectionIcon id={section.id} className="h-6 w-6" />
                    </div>
                    <span className="rounded-full border border-slate-200/60 bg-slate-100/80 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {section.titleEn}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-slate-900 transition-colors group-hover:text-violet-900">
                    {section.titleAr}
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm font-semibold leading-6 sm:leading-7 text-slate-600">
                    {section.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100/90 pt-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full ${theme.bgSoft} px-3 py-1 text-xs font-bold ${theme.text}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
                    {badgeLabel}
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all group-hover:bg-violet-700 group-hover:text-white group-hover:translate-x-[-2px]"
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
