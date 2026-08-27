import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, TextInput } from '../../../components/ui/form-field';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import { QUIZ_STATUS_LABELS, type QuizStatus } from '../../../types/quizzes';

export default function QuizzesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
    search: search || undefined,
    page,
    pageSize: 20,
  }), [statusFilter, search, page]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['quizzes', tenantId, filters],
    queryFn: ({ signal }) => quizzesApi.list(tenantId!, filters, signal),
    enabled: Boolean(tenantId),
    placeholderData: (previous) => previous,
  });

  const archiveMutation = useMutation({
    mutationFn: (quizId: string) => quizzesApi.archive(tenantId!, quizId),
    onSuccess: async () => {
      setArchiveError(null);
      await queryClient.invalidateQueries({ queryKey: ['quizzes', tenantId] });
    },
    onError: (error) => {
      setArchiveError(error instanceof HttpError && error.status === 403
        ? 'ليس لديك صلاحية أرشفة هذا المحتوى.'
        : 'تعذر الأرشفة. أعد المحاولة.');
    },
  });

  if (!tenantId) return null;

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function onArchive(quizId: string, title: string) {
    if (window.confirm(`هل أنت متأكد من أرشفة "${title}"؟`)) archiveMutation.mutate(quizId);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">English Spark Studio</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">المحتوى</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">كل الأنشطة والاختبارات التي أنشأتِها في مكان واحد.</p>
        </div>
        <Button onClick={() => navigate('/dashboard/activities/new')}>+ نشاط جديد</Button>
      </header>

      <form onSubmit={onSearchSubmit} className="teacher-surface flex flex-wrap items-end gap-2 p-4" role="search">
        <FormField id="quiz-search" label="بحث بالاسم">
          {(props) => <TextInput {...props} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="ابحثي في المحتوى…" />}
        </FormField>
        <div className="flex flex-col gap-1">
          <label htmlFor="quiz-status" className="text-sm font-medium text-slate-700">الحالة</label>
          <select id="quiz-status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">كل الحالات</option>
            {Object.entries(QUIZ_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <Button type="submit" variant="secondary">بحث</Button>
      </form>

      {archiveError ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{archiveError}</p> : null}
      {isLoading && !data ? <p className="text-sm text-slate-500">جارٍ تحميل المحتوى…</p> : null}
      {isError ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">تعذر تحميل المحتوى. تأكد من اتصالك ثم أعد المحاولة.</p> : null}

      {data && data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-10 text-center">
          <p className="text-base font-black text-slate-900">{search || statusFilter ? 'لا توجد نتائج مطابقة.' : 'لا يوجد محتوى بعد.'}</p>
          <p className="mt-2 text-sm text-slate-600">ابدئي بنشاط صغير، وسيظهر هنا تلقائيًا.</p>
          {!search && !statusFilter ? <Button onClick={() => navigate('/dashboard/activities/new')}>إنشاء أول نشاط</Button> : null}
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <ul className="grid gap-3" aria-label="نتائج المحتوى">
          {data.items.map((quiz) => (
            <li key={quiz.id} className="teacher-surface p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-black text-slate-950">{quiz.title}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${quiz.status === 'Published' ? 'bg-emerald-100 text-emerald-800' : quiz.status === 'Archived' ? 'bg-slate-100 text-slate-700' : 'bg-violet-100 text-violet-800'}`}>{QUIZ_STATUS_LABELS[quiz.status as QuizStatus] ?? quiz.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{quiz.itemCount} سؤال{quiz.currentPublishedVersionNumber ? ` · نسخة منشورة ${quiz.currentPublishedVersionNumber}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/dashboard/quizzes/${quiz.id}/edit`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:border-violet-400 hover:text-violet-800">تعديل</Link>
                  <Link to={`/dashboard/quizzes/${quiz.id}/preview`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:border-violet-400 hover:text-violet-800">معاينة</Link>
                  {quiz.status === 'Published' ? (
                    <Link to={`/dashboard/quizzes/${quiz.id}/sessions`} className="inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-4 text-sm font-black text-white hover:bg-violet-800">إدارة ومشاركة</Link>
                  ) : (
                    <Link to={`/dashboard/quizzes/${quiz.id}/publish`} className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800">خيارات النشر المتقدمة</Link>
                  )}
                  {quiz.status !== 'Archived' ? <button type="button" onClick={() => onArchive(quiz.id, quiz.title)} disabled={archiveMutation.isPending} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">أرشفة</button> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {data && data.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-2" aria-label="ترقيم النتائج">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>السابق</Button>
          <span className="text-sm text-slate-600">صفحة {data.page} من {data.totalPages} ({data.totalItems} نشاط)</span>
          <Button variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage((current) => current + 1)}>التالي</Button>
        </nav>
      ) : null}
    </div>
  );
}
