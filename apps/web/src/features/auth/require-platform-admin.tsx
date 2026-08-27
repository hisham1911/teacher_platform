import { Link, Outlet } from 'react-router';
import { useSessionSnapshot } from './use-session';

export function RequirePlatformAdmin() {
  const { user } = useSessionSnapshot();
  if (user?.platformRoles.includes('PlatformAdmin')) return <Outlet />;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10" dir="rtl">
      <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 px-6 py-8 text-white sm:px-8">
          <p className="text-xs font-black tracking-[0.18em] text-amber-300">PLATFORM ADMIN</p>
          <h1 className="mt-2 text-3xl font-black">لوحة إدارة English Spark SaaS</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">هذه اللوحة منفصلة عن مساحة العمل. منها تتم إدارة العملاء والخطط والاشتراكات والاستخدام على مستوى المنصة كلها.</p>
        </div>
        <div className="space-y-5 p-6 sm:p-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-black text-amber-950">الحساب الحالي ليس PlatformAdmin</h2>
            <p className="mt-2 text-sm leading-7 text-amber-900">هذا مقصود أمنيًا: مالك مساحة العمل أو منشئ المحتوى لا يحصل تلقائيًا على صلاحية رؤية بيانات باقي العملاء.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info title="ما الذي يديره PlatformAdmin؟" items={['مساحات العملاء', 'خطط الأسعار والحدود', 'تفعيل الاشتراكات', 'الاستخدام الشهري', 'المستخدمون وسجل التدقيق']} />
            <Info title="كيف يتم منح الصلاحية؟" items={['إنشاء حساب عادي أولًا', 'منح الدور من قناة إدارة قاعدة البيانات الموثوقة', 'تسجيل الدخول من جديد لإصدار Token يحمل الدور']} />
          </div>
          <Link to="/dashboard" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-700 px-5 text-sm font-black text-white hover:bg-violet-800">العودة إلى Studio</Link>
        </div>
      </section>
    </main>
  );
}

function Info({ title, items }: { title: string; items: string[] }) {
  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h2 className="font-black text-slate-950">{title}</h2><ul className="mt-3 space-y-2 text-sm text-slate-600">{items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-violet-600">•</span><span>{item}</span></li>)}</ul></section>;
}
