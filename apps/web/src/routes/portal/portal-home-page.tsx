import { Link } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { portalSections } from '../../data/content/portal-sections';

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
        <section className="animate-page-enter mx-auto max-w-4xl px-4 pt-12 pb-14 text-center sm:pt-20 sm:pb-16">
          <div className="mb-5 flex flex-col items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/90 px-4 py-1.5 text-xs font-black tracking-wider text-violet-800 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-violet-600 animate-pulse" />
              إنتاج معرفي • وزارة التعليم
            </span>
            <p className="text-xs font-bold text-slate-500 sm:text-sm">
              مدرسة متوسطة وثانوية الجرادية — مساحة التعلم التفاعلية
            </p>
          </div>

          <h1 className="text-balance text-4xl font-black leading-[1.2] text-slate-950 sm:text-5xl md:text-6xl">
            تعلّم الإنجليزية
            <br />
            <span className="text-violet-700">
              بطريقة مبسطة وممتعة ✦
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base font-semibold leading-8 text-slate-600 sm:text-lg">
            قواعد مبسطة، قراءة حرة، استماع ومحادثة، كتابة بنماذج إجابة، ومسابقات تفاعلية — دليلك التعليمي الشامل لتعلم اللغة الإنجليزية خطوة بخطوة.
          </p>

          {/* Hero CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/grammar"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-7 text-sm font-black text-white shadow-md shadow-violet-700/20 transition-all hover:bg-violet-800 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>ابدأ بالقواعد والتمارين</span>
              <span>←</span>
            </Link>
            <Link
              to="/competitions"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-6 text-sm font-black text-amber-900 shadow-xs transition-all hover:bg-amber-100 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>🏆 قسم المسابقات</span>
            </Link>
            <Link
              to="/writing"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-6 text-sm font-black text-emerald-900 shadow-xs transition-all hover:bg-emerald-100 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>✍️ قسم الكتابة</span>
            </Link>
          </div>
        </section>

        {/* Section Cards */}
        <section
          className="animate-page-enter mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3"
          style={{ animationDelay: '120ms' }}
        >
          {portalSections.map((section) => {
            const badgeLabel = sectionBadges[section.id] || (section.count ? `${section.count} درس` : 'ابدأ الآن');
            return (
              <Link
                key={section.id}
                to={section.path}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/80 bg-white/85 p-6 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-900/8"
              >
                <div>
                  <div className="mb-5 flex items-center justify-between">
                    <div
                      className={`flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br ${section.color} text-lg font-black text-white shadow-sm transition-transform duration-300 group-hover:scale-105`}
                    >
                      {section.icon}
                    </div>
                    <span className="rounded-full bg-slate-100/80 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {section.titleEn}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 group-hover:text-violet-900 transition-colors">
                    {section.titleAr}
                  </h3>
                  <p className="mt-2.5 text-sm font-semibold leading-7 text-slate-600">
                    {section.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100/80 pt-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-600" />
                    {badgeLabel}
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors group-hover:bg-violet-700 group-hover:text-white"
                  >
                    ←
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
