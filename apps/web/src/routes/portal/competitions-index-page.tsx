import { Link } from 'react-router';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { portalCompetitions } from '../../data/content/competitions';

export default function CompetitionsIndexPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="animate-page-enter mx-auto max-w-4xl px-4 pt-10 pb-12 text-center sm:pt-16 sm:pb-14">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/90 px-4 py-1.5 text-xs font-black text-amber-900 shadow-xs">
            <span>🏆</span>
            <span>بوابة المسابقات التفاعلية • English Competitions</span>
          </div>

          <h1 className="text-balance text-3xl font-black text-slate-950 sm:text-4xl md:text-5xl">
            تحديات ومسابقات
            <br />
            <span className="bg-gradient-to-r from-amber-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
              تختبر مهاراتك وتزيد حماسك ✦
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm font-semibold leading-7 text-slate-600 sm:text-base">
            اختر نوع التحدي الذي تفضله: تسلّق سلم مسابقة المليون، أو قيّم مستواك بدقة عبر اختبار تحديد المستوى، أو جرّب سرعتك في تحدي الـ 60 ثانية!
          </p>
        </section>

        {/* Competitions Cards */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {portalCompetitions.map((comp) => (
              <div
                key={comp.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-900/10"
              >
                <div>
                  {/* Top Bar: Icon & Badge */}
                  <div className="mb-6 flex items-start justify-between">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${comp.gradient} text-2xl text-white shadow-md transition-transform duration-300 group-hover:scale-110`}
                    >
                      {comp.icon}
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-black ${comp.badgeColor}`}
                    >
                      {comp.badge}
                    </span>
                  </div>

                  {/* Title & English Subtitle */}
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                    {comp.titleEn}
                  </span>
                  <h2 className="mt-1 text-2xl font-black text-slate-950 transition-colors group-hover:text-violet-800">
                    {comp.titleAr}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-violet-600">{comp.subtitle}</p>

                  {/* Description */}
                  <p className="mt-4 text-sm font-medium leading-relaxed text-slate-600">
                    {comp.description}
                  </p>

                  {/* Feature checklist */}
                  <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
                    {comp.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 text-xs font-bold text-slate-700"
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">
                          ✓
                        </span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="mt-8 border-t border-slate-100 pt-5">
                  <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>⏱️ المدة: {comp.duration}</span>
                    <span>📝 {comp.questionCount} سؤالاً</span>
                  </div>
                  <Link
                    to={comp.path}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${comp.gradient} py-3.5 text-sm font-black text-white shadow-md transition-all duration-200 hover:brightness-110 active:scale-[0.98]`}
                  >
                    <span>ابدأ المسابقة الآن</span>
                    <span aria-hidden="true">←</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Tips Section */}
          <div className="mt-14 rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/80 via-white/80 to-amber-50/80 p-8 shadow-xs">
            <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-right">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-violet-700 text-3xl text-white shadow-md">
                💡
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900">
                  نصيحة المعلمة مريم لطالبات وطلاب المنصة
                </h3>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">
                  المسابقات وسيلة ممتعة لاكتشاف مستواك وتحدي معلوماتك. لا تقلق بشأن الأخطاء، فكل خطأ هو فرصة ذهبية لتعلم قاعدة جديدة وتثبيتها. يمكنك إعادة أي مسابقة متى شئت!
                </p>
              </div>
              <Link
                to="/grammar"
                className="shrink-0 rounded-2xl border border-violet-200 bg-white px-5 py-3 text-xs font-black text-violet-800 shadow-xs hover:bg-violet-50"
              >
                مراجعة القواعد أولاً →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PortalFooter />
    </div>
  );
}
