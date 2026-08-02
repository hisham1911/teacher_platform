import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, TextInput } from '../../../components/ui/form-field';
import { questionBanksApi, questionsApi, questionTagsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS, type QuestionType } from '../../../types/questions';

/** /dashboard/questions — قائمة الأسئلة مع البحث والمرشحات وإدارة البنوك والوسوم */
export default function QuestionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showBankForm, setShowBankForm] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [bankError, setBankError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      bankId: bankFilter || undefined,
      type: typeFilter || undefined,
      difficulty: difficultyFilter || undefined,
      tag: tagFilter || undefined,
      search: search || undefined,
      page,
      pageSize: 20,
    }),
    [bankFilter, typeFilter, difficultyFilter, tagFilter, search, page],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['questions', tenantId, filters],
    queryFn: ({ signal }) => questionsApi.list(tenantId!, filters, signal),
    enabled: Boolean(tenantId),
    placeholderData: (previous) => previous,
  });

  const { data: banks } = useQuery({
    queryKey: ['question-banks', tenantId],
    queryFn: ({ signal }) => questionBanksApi.list(tenantId!, signal),
    enabled: Boolean(tenantId),
  });

  const { data: tags } = useQuery({
    queryKey: ['question-tags', tenantId],
    queryFn: ({ signal }) => questionTagsApi.list(tenantId!, signal),
    enabled: Boolean(tenantId),
  });

  const createBankMutation = useMutation({
    mutationFn: (name: string) => questionBanksApi.create(tenantId!, { name }),
    onSuccess: async () => {
      setNewBankName('');
      setShowBankForm(false);
      setBankError(null);
      await queryClient.invalidateQueries({ queryKey: ['question-banks', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['questions', tenantId] });
    },
    onError: (error) => {
      setBankError(error instanceof HttpError && error.status === 403
        ? 'ليس لديك صلاحية إنشاء بنوك أسئلة (يلزم دور مالك أو معلم).'
        : 'تعذر إنشاء البنك. تحقق من الاسم ثم أعد المحاولة.');
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">بنك الأسئلة</h1>
          <p className="text-sm text-slate-600">إدارة الأسئلة والوسوم مع سجلّ الإصدارات غير القابل للتعديل.</p>
        </div>
        <Button onClick={() => navigate('/dashboard/questions/new')}>سؤال جديد</Button>
      </div>

      {/* إدارة البنوك */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">بنوك الأسئلة</h2>
          <button
            type="button"
            onClick={() => setShowBankForm((v) => !v)}
            className="min-h-11 rounded-md border border-dashed border-slate-400 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
            {showBankForm ? 'إلغاء' : '+ بنك جديد'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setBankFilter(''); setPage(1); }}
            aria-pressed={bankFilter === ''}
            className={`min-h-11 rounded-full px-3 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-sky-600 ${
              bankFilter === '' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600'
            }`}>
            الكل ({(banks ?? []).reduce((sum, b) => sum + b.questionCount, 0)})
          </button>
          {(banks ?? []).map((bank) => (
            <button
              key={bank.id}
              type="button"
              onClick={() => { setBankFilter(bank.id); setPage(1); }}
              aria-pressed={bankFilter === bank.id}
              className={`min-h-11 rounded-full px-3 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-sky-600 ${
                bankFilter === bank.id ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600'
              }`}>
              {bank.name} ({bank.questionCount})
            </button>
          ))}
          {(banks ?? []).length === 0 && !showBankForm ? (
            <p className="text-xs text-slate-500">لا توجد بنوك بعد — أنشئ أول بنك لتتمكن من إضافة أسئلة.</p>
          ) : null}
        </div>

        {showBankForm ? (
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newBankName.trim();
              if (name.length < 1) {
                setBankError('اسم البنك مطلوب.');
                return;
              }
              createBankMutation.mutate(name);
            }}>
            <FormField id="new-bank-name" label="اسم البنك" error={bankError}>
              {(props) => (
                <TextInput
                  {...props}
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  maxLength={120}
                  placeholder="مثال: الوحدة الأولى — قواعد"
                />
              )}
            </FormField>
            <Button type="submit" disabled={createBankMutation.isPending}>
              {createBankMutation.isPending ? 'جارٍ الإنشاء…' : 'إنشاء'}
            </Button>
          </form>
        ) : null}
      </section>

      {/* البحث والمرشحات */}
      <form onSubmit={onSearchSubmit} className="flex flex-wrap items-end gap-2" role="search">
        <FormField id="q-search" label="بحث في نص السؤال">
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
          <label htmlFor="q-type" className="text-sm font-medium text-slate-700">النوع</label>
          <select
            id="q-type"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">كل الأنواع</option>
            {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="q-difficulty" className="text-sm font-medium text-slate-700">الصعوبة</label>
          <select
            id="q-difficulty"
            value={difficultyFilter}
            onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">كل المستويات</option>
            {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="q-tag" className="text-sm font-medium text-slate-700">الوسم</label>
          <select
            id="q-tag"
            value={tagFilter}
            onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">كل الوسوم</option>
            {(tags ?? []).map((t) => (
              <option key={t.id} value={t.name}>{t.name} ({t.questionCount})</option>
            ))}
          </select>
        </div>

        <Button type="submit" variant="secondary">بحث</Button>
      </form>

      {/* قائمة النتائج */}
      {isLoading && !data ? <p className="text-sm text-slate-500">جارٍ تحميل الأسئلة…</p> : null}
      {isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          تعذر تحميل الأسئلة. تأكد من اتصالك ثم أعد المحاولة.
        </p>
      ) : null}

      {data && data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
          <p className="mb-4 text-sm text-slate-700">
            {search || bankFilter || typeFilter || difficultyFilter || tagFilter
              ? 'لا نتائج مطابقة للبحث أو المرشحات الحالية.'
              : 'لا توجد أسئلة بعد. أنشئ أول سؤال لتبدأ بناء الاختبارات.'}
          </p>
          <Button onClick={() => navigate('/dashboard/questions/new')}>إنشاء سؤال</Button>
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="نتائج الأسئلة">
          {data.items.map((question) => (
            <li key={question.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900" dir={question.language === 'en' ? 'ltr' : 'rtl'}>
                    {question.prompt}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {QUESTION_TYPE_LABELS[question.questionType as QuestionType] ?? question.questionType}
                    {' · '}
                    {DIFFICULTY_LABELS[question.difficulty as keyof typeof DIFFICULTY_LABELS] ?? question.difficulty}
                    {' · إصدار '}
                    v{question.currentVersionNumber}
                    {question.tags.length > 0 ? ` · ${question.tags.join('، ')}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Link
                    to={`/dashboard/questions/${question.id}/preview`}
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
                    معاينة
                  </Link>
                  <Link
                    to={`/dashboard/questions/${question.id}/edit`}
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
                    تعديل
                  </Link>
                  <Link
                    to={`/dashboard/questions/${question.id}/versions`}
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
                    الإصدارات
                  </Link>
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
            صفحة {data.page} من {data.totalPages} ({data.totalItems} سؤال)
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
