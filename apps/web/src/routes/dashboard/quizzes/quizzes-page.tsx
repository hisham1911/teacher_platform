import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, TextInput } from '../../../components/ui/form-field';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import { QUIZ_STATUS_LABELS, type QuizStatus } from '../../../types/quizzes';

/** /dashboard/quizzes — قائمة الاختبارات مع البحث والمرشحات */
export default function QuizzesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      status: statusFilter || undefined,
      search: search || undefined,
      page,
      pageSize: 20,
    }),
    [statusFilter, search, page],
  );

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
      setArchiveError(
        error instanceof HttpError && error.status === 403
          ? 'ليس لديك صلاحية أرشفة الاختبارات (يلزم دور مالك أو معلم).'
          : 'تعذر الأرشفة. أعد المحاولة.',
      );
    },
  });

  if (!tenantId) {
    navigate('/onboarding/choose', { replace: true });
    return null;
  }

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function onArchive(quizId: string, title: string) {
    if (!window.confirm(`هل أنت متأكد من أرشفة الاختبار "${title}"؟ لا يمكن التراجع.`)) {
      return;
    }
    archiveMutation.mutate(quizId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">الاختبارات</h1>
          <p className="text-sm text-slate-600">إنشاء وإدارة الاختبارات مع إصدارات ونشر آمن.</p>
        </div>
        <Button onClick={() => navigate('/dashboard/quizzes/new')}>اختبار جديد</Button>
      </div>

      {/* البحث والمرشحات */}
      <form onSubmit={onSearchSubmit} className="flex flex-wrap items-end gap-2" role="search">
        <FormField id="quiz-search" label="بحث في عنوان الاختبار">
          {(props) => (
            <TextInput
              {...props}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ابحث…"
            />
          )}
        </FormField>

        <div className="flex flex-col gap-1">
          <label htmlFor="quiz-status" className="text-sm font-medium text-slate-700">الحالة</label>
          <select
            id="quiz-status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">كل الحالات</option>
            {Object.entries(QUIZ_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <Button type="submit" variant="secondary">بحث</Button>
      </form>

      {archiveError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {archiveError}
        </p>
      ) : null}

      {/* قائمة النتائج */}
      {isLoading && !data ? <p className="text-sm text-slate-500">جارٍ تحميل الاختبارات…</p> : null}
      {isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          تعذر تحميل الاختبارات. تأكد من اتصالك ثم أعد المحاولة.
        </p>
      ) : null}

      {data && data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
          <p className="mb-4 text-sm text-slate-700">
            {search || statusFilter
              ? 'لا نتائج مطابقة للبحث أو المرشحات الحالية.'
              : 'لا توجد اختبارات بعد. أنشئ أول اختبار لتبدأ.'}
          </p>
          <Button onClick={() => navigate('/dashboard/quizzes/new')}>إنشاء اختبار</Button>
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="نتائج الاختبارات">
          {data.items.map((quiz) => (
            <li key={quiz.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{quiz.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {QUIZ_STATUS_LABELS[quiz.status as QuizStatus] ?? quiz.status}
                    {' · '}
                    {quiz.itemCount} سؤال
                    {quiz.currentPublishedVersionNumber
                      ? ` · منشور v${quiz.currentPublishedVersionNumber}`
                      : ' · غير منشور'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Link
                    to={`/dashboard/quizzes/${quiz.id}/edit`}
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
                    تعديل
                  </Link>
                  <Link
                    to={`/dashboard/quizzes/${quiz.id}/preview`}
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
                    معاينة
                  </Link>
                  <Link
                    to={`/dashboard/quizzes/${quiz.id}/publish`}
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
                    نشر
                  </Link>
                  <Link
                    to={`/dashboard/quizzes/${quiz.id}/sessions`}
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
                    جلسات
                  </Link>
                  {quiz.status !== 'Archived' ? (
                    <button
                      type="button"
                      onClick={() => onArchive(quiz.id, quiz.title)}
                      disabled={archiveMutation.isPending}
                      className="min-h-11 rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-600 disabled:opacity-60">
                      أرشفة
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {data && data.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-2" aria-label="ترقيم النتائج">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}>
            السابق
          </Button>
          <span className="text-sm text-slate-600">
            صفحة {data.page} من {data.totalPages} ({data.totalItems} اختبار)
          </span>
          <Button
            variant="secondary"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}>
            التالي
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
