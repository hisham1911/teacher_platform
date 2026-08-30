import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '../../../data/api-client/endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';
import { formatStudentCode } from '../../../types/students';

export default function StudentsPage() {
  const tenantId = getActiveTenantId();
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const normalizedSearch = useMemo(() => search.trim(), [search]);

  const studentsQuery = useQuery({
    queryKey: ['students', tenantId, normalizedSearch, includeInactive],
    queryFn: ({ signal }) => studentsApi.list(tenantId!, { search: normalizedSearch || undefined, includeInactive }, signal),
    enabled: Boolean(tenantId),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black text-violet-700">English Spark Studio</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">الطلاب</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
            لكل طالب كود ثابت للدخول. الكود يربط محاولاته باسمه تلقائيًا بدون إنشاء حساب أو كلمة مرور.
          </p>
        </div>
        <Link to="/dashboard/students/new" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-700 px-5 text-sm font-black text-white shadow-sm hover:bg-violet-800">
          + إضافة طالب
        </Link>
      </header>

      <section className="teacher-surface p-4 sm:p-5" aria-label="البحث والتصفية">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <label className="block">
            <span className="sr-only">ابحث عن طالب</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث بالاسم أو كود الطالب"
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
          </label>
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              className="h-4 w-4 accent-violet-700"
            />
            إظهار غير النشطين
          </label>
        </div>
      </section>

      {studentsQuery.isLoading ? <StudentsSkeleton /> : null}

      {studentsQuery.isError ? (
        <section role="alert" className="teacher-surface border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          <p className="font-black">تعذر تحميل الطلاب.</p>
          <p className="mt-1">تحقق من الاتصال ثم حاول مرة أخرى.</p>
          <button type="button" onClick={() => void studentsQuery.refetch()} className="mt-4 min-h-11 rounded-xl border border-rose-300 bg-white px-4 font-black hover:bg-rose-100">
            إعادة المحاولة
          </button>
        </section>
      ) : null}

      {studentsQuery.data?.length === 0 ? (
        <section className="teacher-surface px-6 py-12 text-center">
          <div aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-100 text-3xl">👥</div>
          <h2 className="mt-4 text-xl font-black text-slate-950">{normalizedSearch ? 'لا توجد نتيجة بهذا البحث' : 'أضيفي أول طالب'}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">
            {normalizedSearch ? 'جرّبي جزءًا من الاسم أو كود الطالب.' : 'بعد الإضافة سيظهر كود دخول ثابت يمكنك إرساله للطالب.'}
          </p>
          {!normalizedSearch ? <Link to="/dashboard/students/new" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-5 text-sm font-black text-white">إضافة طالب</Link> : null}
        </section>
      ) : null}

      {studentsQuery.data && studentsQuery.data.length > 0 ? (
        <ul className="teacher-surface divide-y divide-slate-100 overflow-hidden" aria-label="قائمة الطلاب">
          {studentsQuery.data.map((student) => (
            <li key={student.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-black text-slate-950">{student.fullName}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${student.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {student.isActive ? 'نشط' : 'غير نشط'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                  {student.grade ? <span>{student.grade}</span> : null}
                  <span dir="ltr" className="rounded-lg bg-violet-50 px-2.5 py-1 font-mono font-black tracking-wider text-violet-800">{formatStudentCode(student.studentCode)}</span>
                </div>
              </div>
              <Link to={`/dashboard/students/${student.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:border-violet-400 hover:text-violet-800">
                فتح الطالب
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StudentsSkeleton() {
  return <div role="status" aria-label="جارٍ تحميل الطلاب" className="teacher-surface divide-y divide-slate-100 overflow-hidden">{[0, 1, 2].map((item) => <div key={item} className="flex animate-pulse items-center gap-4 p-5"><div className="h-12 w-12 rounded-2xl bg-slate-200" /><div className="flex-1 space-y-2"><div className="h-4 w-40 rounded bg-slate-200" /><div className="h-3 w-28 rounded bg-slate-100" /></div></div>)}</div>;
}
