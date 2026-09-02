import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { classroomsApi } from '../../../data/api-client/phase2-endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';

export default function ClassesPage() {
  const tenantId = getActiveTenantId();
  const query = useQuery({ queryKey: ['classrooms', tenantId], queryFn: ({ signal }) => classroomsApi.list(tenantId!, true, signal), enabled: Boolean(tenantId) });
  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-violet-700">تنظيم الطلاب</p><h1 className="mt-1 text-3xl font-black text-slate-950">الفصول</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">اجمع طلابك مرة واحدة، وبعدها أرسل النشاط للفصل كله بخطوة واحدة.</p></div><Link to="/dashboard/classes/new" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-700 px-5 text-sm font-black text-white hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">+ فصل جديد</Link></header>
    {query.isLoading ? <div role="status" className="teacher-surface p-8 text-sm text-slate-600">جارٍ تحميل الفصول…</div> : null}
    {query.isError ? <div role="alert" className="teacher-surface p-6 text-rose-800">تعذر تحميل الفصول. <button type="button" onClick={() => void query.refetch()} className="min-h-11 px-3 font-bold">إعادة المحاولة</button></div> : null}
    {query.data?.length === 0 ? <section className="teacher-surface px-6 py-14 text-center"><div className="text-4xl" aria-hidden="true">🏫</div><h2 className="mt-4 text-xl font-black text-slate-950">ابدأ بأول فصل</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-600">أنشئ الفصل ثم اختر طلابه من قائمة الطلاب الموجودة بالفعل.</p><Link to="/dashboard/classes/new" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-violet-700 px-5 text-sm font-black text-white">إنشاء فصل</Link></section> : null}
    {query.data && query.data.length > 0 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data.map((item) => <Link key={item.id} to={`/dashboard/classes/${item.id}`} className="teacher-surface group min-h-36 p-5 transition hover:border-violet-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950 group-hover:text-violet-800">{item.name}</h2><p className="mt-1 text-sm text-slate-500">{item.academicYear || 'بدون سنة دراسية'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{item.isActive ? 'نشط' : 'متوقف'}</span></div><p className="mt-6 text-sm font-bold text-violet-700">{item.studentCount} طالب</p></Link>)}</div> : null}
  </div>;
}
