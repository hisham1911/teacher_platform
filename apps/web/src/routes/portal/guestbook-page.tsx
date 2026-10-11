import { Link } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';

export default function GuestbookPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <section className="animate-page-enter text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-2xl font-black text-white shadow-md">
            ✍️
          </div>
          <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">سجل الزوار</h1>
          <p className="mt-3 text-base font-semibold text-slate-500">
            يسعدنا سماع رأيك وتقييمك وتجربتك في منصة English Spark
          </p>
        </section>

        {/* Guestbook card */}
        <div className="animate-page-enter mt-10 overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-xl sm:p-2" style={{ animationDelay: '100ms' }}>
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/30 p-10 text-center sm:p-14">
            <span className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-4xl shadow-sm ring-1 ring-violet-100">
              💌
            </span>
            <h2 className="text-2xl font-black text-slate-900">سجل الزوار يُفتح قريباً!</h2>
            <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-slate-600">
              نعمل حالياً على تجهيز مساحة التقييمات التفاعلية لتمكين الطلاب والمعلمين من مشاركة تجاربهم ورسائلهم التشجيعية مباشرة.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5 text-xs font-black text-violet-800">
              <span>✦</span> ميزة جديدة قيد الإطلاق
            </div>
            <Link 
              to="/" 
              className="mt-8 rounded-xl bg-violet-700 px-8 py-3.5 text-sm font-black text-white shadow-md shadow-violet-700/20 transition-all hover:bg-violet-800 hover:shadow-lg"
            >
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </div>

      <PortalFooter />
    </div>
  );
}
