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
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const normalizedSearch = useMemo(() => search.trim(), [search]);

  const studentsQuery = useQuery({
    queryKey: ['students', tenantId, normalizedSearch, includeInactive],
    queryFn: ({ signal }) => studentsApi.list(tenantId!, { search: normalizedSearch || undefined, includeInactive }, signal),
    enabled: Boolean(tenantId),
  });

  const visibleStudents = studentsQuery.data ?? [];
  const activeCount = visibleStudents.filter((student) => student.isActive).length;

  async function copyStudentCode(studentId: string, studentCode: string) {
    try {
      await navigator.clipboard.writeText(studentCode);
      setCopyError(null);
      setCopiedStudentId(studentId);
      window.setTimeout(() => setCopiedStudentId((current) => current === studentId ? null : current), 1800);
    } catch {
      setCopyError('تعذر نسخ الكود. افتح ملف الطالب لنسخه يدويًا.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-[1.75rem] font-bold leading-tight text-slate-950 sm:text-[2rem]">الطلاب</h1>
          <p className="mt-2 text-base leading-8 text-slate-600">أضف الطالب مرة واحدة، وسيكون له كود ثابت يستخدمه في كل الأنشطة.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/join" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100">فتح واجهة الطالب</Link>
          <Link to="/dashboard/students/new" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"><span aria-hidden="true" className="text-lg leading-none">＋</span>إضافة طالب</Link>
        </div>
      </header>

      <section className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-sm leading-7 text-slate-700 sm:flex sm:items-center sm:justify-between sm:gap-4" aria-label="طريقة استخدام كود الطالب">
        <p><span className="font-bold text-slate-950">كيف يستخدم الطالب الكود؟</span> افتح له رابط النشاط، ثم يختار «لدي كود طالب» ويكتب كوده. بعدها تظهر محاولته في ملفه.</p>
        <Link to="/join" className="mt-2 inline-flex min-h-10 shrink-0 items-center font-bold text-violet-700 hover:underline sm:mt-0">جرّبها كطالب ←</Link>
      </section>

      {copyError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{copyError}</p> : null}

      <section className="teacher-surface overflow-hidden" aria-label="قائمة الطلاب">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <label htmlFor="student-search" className="sr-only">ابحث عن طالب</label>
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-slate-400">⌕</span>
              <input id="student-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="اسم الطالب أو الكود" className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-4 pr-10 text-base text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-violet-600 focus-visible:ring-4 focus-visible:ring-violet-100" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {studentsQuery.isSuccess ? <p className="text-sm text-slate-500" aria-live="polite"><span className="font-semibold text-slate-800">{visibleStudents.length}</span> طالب{includeInactive ? <span> · {activeCount} نشط</span> : null}</p> : null}
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"><input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} className="h-4 w-4 accent-violet-700" />إظهار الطلاب غير النشطين</label>
            </div>
          </div>
        </div>

        {studentsQuery.isLoading ? <StudentsSkeleton /> : null}
        {studentsQuery.isError ? <div role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm leading-7 text-rose-800 sm:m-5"><p className="font-bold">تعذر تحميل الطلاب</p><p>تحقق من الاتصال ثم حاول مرة أخرى.</p><button type="button" onClick={() => void studentsQuery.refetch()} className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-rose-300 bg-white px-4 font-semibold shadow-sm hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100">إعادة المحاولة</button></div> : null}

        {studentsQuery.data?.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-2xl ring-1 ring-violet-100">👥</div>
            <h2 className="mt-4 text-xl font-bold text-slate-950">{normalizedSearch ? 'لا يوجد طالب بهذا البحث' : 'لم تضف طلابًا بعد'}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">{normalizedSearch ? 'جرّب جزءًا من الاسم أو الكود.' : 'ابدأ بالاسم فقط. سننشئ كود الطالب تلقائيًا.'}</p>
            {normalizedSearch ? <button type="button" onClick={() => setSearch('')} className="mt-5 min-h-10 rounded-lg px-4 text-sm font-semibold text-violet-700 hover:bg-violet-50 hover:text-violet-900">مسح البحث</button> : <Link to="/dashboard/students/new" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-5 text-sm font-bold text-white hover:bg-violet-800">إضافة أول طالب</Link>}
          </div>
        ) : null}

        {studentsQuery.data && studentsQuery.data.length > 0 ? (
          <ul className="divide-y divide-slate-100" aria-label="الطلاب">
            {studentsQuery.data.map((student) => (
              <li key={student.id} className="flex items-center gap-2 px-3 py-2 sm:px-4">
                <Link to={`/dashboard/students/${student.id}`} className="group flex min-h-20 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-violet-50/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 sm:gap-4">
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-600 ring-1 ring-slate-200">{student.fullName.trim().charAt(0) || '؟'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-semibold text-slate-950 group-hover:text-violet-900">{student.fullName}</h2>{!student.isActive ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">غير نشط</span> : null}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-500">{student.grade ? <span>{student.grade}</span> : null}{student.grade ? <span aria-hidden="true" className="hidden text-slate-300 sm:inline">•</span> : null}<span dir="ltr" className="font-mono text-[13px] font-semibold tracking-[0.08em] text-violet-700">{formatStudentCode(student.studentCode)}</span></div>
                  </div>
                  <span aria-hidden="true" className="hidden shrink-0 text-lg text-slate-300 transition group-hover:-translate-x-0.5 group-hover:text-violet-600 sm:block">←</span>
                </Link>
                <button type="button" onClick={() => void copyStudentCode(student.id, student.studentCode)} disabled={!student.isActive} aria-label={`نسخ كود ${student.fullName}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:border-violet-300 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:text-sm">{copiedStudentId === student.id ? 'تم ✓' : 'نسخ الكود'}</button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <p className="px-1 text-xs leading-6 text-slate-500">كود الطالب ثابت، ويمكن تغييره من ملف الطالب عند الحاجة.</p>
    </div>
  );
}

function StudentsSkeleton() {
  return <div role="status" aria-label="جارٍ تحميل الطلاب" className="divide-y divide-slate-100">{[0, 1, 2].map((item) => <div key={item} className="flex animate-pulse items-center gap-4 px-5 py-4"><div className="h-11 w-11 rounded-full bg-slate-200" /><div className="flex-1 space-y-2"><div className="h-4 w-40 rounded bg-slate-200" /><div className="h-3 w-28 rounded bg-slate-100" /></div><div className="h-11 w-20 rounded-xl bg-slate-100" /></div>)}</div>;
}
