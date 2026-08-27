import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, TextInput } from '../../../components/ui/form-field';
import { questionBanksApi, questionsApi, questionTagsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS, type QuestionType } from '../../../types/questions';

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

  const filters = useMemo(() => ({ bankId: bankFilter || undefined, type: typeFilter || undefined, difficulty: difficultyFilter || undefined, tag: tagFilter || undefined, search: search || undefined, page, pageSize: 20 }), [bankFilter, typeFilter, difficultyFilter, tagFilter, search, page]);

  const questionsQuery = useQuery({ queryKey: ['questions', tenantId, filters], queryFn: ({ signal }) => questionsApi.list(tenantId!, filters, signal), enabled: Boolean(tenantId), placeholderData: (previous) => previous });
  const banksQuery = useQuery({ queryKey: ['question-banks', tenantId], queryFn: ({ signal }) => questionBanksApi.list(tenantId!, signal), enabled: Boolean(tenantId) });
  const tagsQuery = useQuery({ queryKey: ['question-tags', tenantId], queryFn: ({ signal }) => questionTagsApi.list(tenantId!, signal), enabled: Boolean(tenantId) });

  const createBankMutation = useMutation({
    mutationFn: (name: string) => questionBanksApi.create(tenantId!, { name }),
    onSuccess: async () => {
      setNewBankName('');
      setShowBankForm(false);
      setBankError(null);
      await queryClient.invalidateQueries({ queryKey: ['question-banks', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['questions', tenantId] });
    },
    onError: (error) => setBankError(error instanceof HttpError && error.status === 403 ? 'لا توجد صلاحية لإنشاء بنك أسئلة.' : 'تعذر إنشاء البنك. راجع الاسم وحاول مرة أخرى.'),
  });

  if (!tenantId) return null;
  const data = questionsQuery.data;
  const banks = banksQuery.data ?? [];
  const tags = tagsQuery.data ?? [];
  const totalQuestions = banks.reduce((sum, bank) => sum + bank.questionCount, 0);

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-violet-950 to-violet-800 p-5 text-white sm:p-7">
          <p className="text-xs font-black tracking-[0.18em] text-amber-200">QUESTION LIBRARY</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-3xl font-black">بنك الأسئلة</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-violet-100">أنشئ المحتوى مرة واحدة، ثم أعد استخدامه في اختبارات وتحديات وأنشطة مختلفة.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row"><Link to="/dashboard/questions/bulk" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-300 px-4 text-sm font-black text-slate-950 hover:bg-amber-200">+ إضافة مجموعة</Link>{banks.length > 0 ? <Button onClick={() => navigate('/dashboard/questions/new')}>+ سؤال جديد</Button> : null}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-slate-200"><Stat label="إجمالي الأسئلة" value={String(totalQuestions)} /><Stat label="البنوك" value={String(banks.length)} /><Stat label="الوسوم" value={String(tags.length)} /></div>
      </header>

      <section className="teacher-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">البنوك</h2><p className="mt-1 text-sm text-slate-500">قسّم المحتوى حسب الوحدة أو المهارة أو المستوى.</p></div><button type="button" onClick={() => setShowBankForm((value) => !value)} className="min-h-11 rounded-xl border border-dashed border-violet-300 px-4 text-sm font-black text-violet-800 hover:bg-violet-50">{showBankForm ? 'إلغاء' : '+ بنك جديد'}</button></div>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => { setBankFilter(''); setPage(1); }} aria-pressed={bankFilter === ''} className={`min-h-11 rounded-full px-4 text-xs font-black ${bankFilter === '' ? 'bg-violet-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>الكل ({totalQuestions})</button>{banks.map((bank) => <button key={bank.id} type="button" onClick={() => { setBankFilter(bank.id); setPage(1); }} aria-pressed={bankFilter === bank.id} className={`min-h-11 rounded-full px-4 text-xs font-black ${bankFilter === bank.id ? 'bg-violet-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>{bank.name} ({bank.questionCount})</button>)}</div>
        {banks.length === 0 && !showBankForm ? <div className="mt-4 rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-6 text-center"><p className="font-black text-slate-900">ابدأ بأول بنك أسئلة</p><p className="mt-1 text-sm text-slate-600">مثال: Vocabulary A1 أو Unit 1 — Space.</p><Button className="mt-4" onClick={() => setShowBankForm(true)}>إنشاء بنك</Button></div> : null}
        {showBankForm ? <form className="mt-4 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); const name = newBankName.trim(); if (!name) { setBankError('اسم البنك مطلوب.'); return; } createBankMutation.mutate(name); }}><div className="flex-1"><FormField id="new-bank-name" label="اسم البنك" error={bankError}>{(props) => <TextInput {...props} value={newBankName} onChange={(event) => setNewBankName(event.target.value)} maxLength={120} placeholder="مثال: Vocabulary — Level A1" />}</FormField></div><Button type="submit" disabled={createBankMutation.isPending}>{createBankMutation.isPending ? 'جارٍ الإنشاء…' : 'إنشاء البنك'}</Button></form> : null}
      </section>

      <section className="teacher-surface p-4 sm:p-5">
        <form onSubmit={onSearchSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="search">
          <div className="sm:col-span-2"><FormField id="q-search" label="بحث في نص السؤال">{(props) => <TextInput {...props} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="ابحث عن كلمة أو جملة…" />}</FormField></div>
          <label className="flex flex-col gap-1 text-sm font-bold text-slate-700">النوع<select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"><option value="">كل الأنواع</option>{Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm font-bold text-slate-700">الصعوبة<select value={difficultyFilter} onChange={(event) => { setDifficultyFilter(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"><option value="">كل المستويات</option>{Object.entries(DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="flex items-end gap-2"><label className="flex flex-1 flex-col gap-1 text-sm font-bold text-slate-700">الوسم<select value={tagFilter} onChange={(event) => { setTagFilter(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"><option value="">كل الوسوم</option>{tags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name} ({tag.questionCount})</option>)}</select></label><Button type="submit" variant="secondary">بحث</Button></div>
        </form>
      </section>

      {questionsQuery.isLoading && !data ? <p className="text-sm text-slate-500">جارٍ تحميل الأسئلة…</p> : null}
      {questionsQuery.isError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">تعذر تحميل الأسئلة. تحقق من الاتصال وحاول مرة أخرى.</p> : null}

      {data && data.items.length === 0 ? <div className="teacher-surface p-9 text-center"><p className="text-sm text-slate-600">{search || bankFilter || typeFilter || difficultyFilter || tagFilter ? 'لا توجد نتائج مطابقة للمرشحات الحالية.' : banks.length === 0 ? 'أنشئ بنكًا أولًا، ثم أضف الأسئلة.' : 'لا توجد أسئلة في هذا البنك بعد.'}</p>{banks.length > 0 ? <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row"><Button onClick={() => navigate('/dashboard/questions/new')}>إنشاء سؤال</Button><Link to="/dashboard/questions/bulk" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200 px-4 text-sm font-black text-violet-800 hover:bg-violet-50">إضافة مجموعة</Link></div> : null}</div> : null}

      {data && data.items.length > 0 ? <ul className="grid gap-3 lg:grid-cols-2" aria-label="نتائج الأسئلة">{data.items.map((question) => <li key={question.id} className="teacher-surface p-4 sm:p-5"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-black text-violet-800">Q</span><div className="min-w-0 flex-1"><p dir={question.language === 'en' ? 'ltr' : 'rtl'} className="line-clamp-3 text-base font-black leading-7 text-slate-950">{question.prompt}</p><div className="mt-2 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{QUESTION_TYPE_LABELS[question.questionType as QuestionType] ?? question.questionType}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-900">{DIFFICULTY_LABELS[question.difficulty as keyof typeof DIFFICULTY_LABELS] ?? question.difficulty}</span>{question.tags.map((tag) => <span key={tag} className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">#{tag}</span>)}</div><div className="mt-4 flex flex-wrap gap-2"><Link to={`/dashboard/questions/${question.id}/preview`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:border-violet-300 hover:text-violet-800">معاينة</Link><Link to={`/dashboard/questions/${question.id}/edit`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:border-violet-300 hover:text-violet-800">تعديل</Link><Link to={`/dashboard/questions/${question.id}/versions`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-50">السجل</Link></div></div></div></li>)}</ul> : null}

      {data && data.totalPages > 1 ? <nav className="flex items-center justify-center gap-2" aria-label="ترقيم النتائج"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>السابق</Button><span className="text-sm font-bold text-slate-600">صفحة {data.page} من {data.totalPages} · {data.totalItems} سؤال</span><Button variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage((current) => current + 1)}>التالي</Button></nav> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-white px-3 py-3 text-center"><p className="text-[10px] font-bold text-slate-500 sm:text-xs">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{value}</p></div>;
}
