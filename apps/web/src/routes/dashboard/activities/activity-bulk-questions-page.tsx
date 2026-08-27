import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { questionBanksApi, questionsApi, quizzesApi } from '../../../data/api-client/endpoints';
import { parseActivityMode } from '../../../features/activities/activity-mode';
import { BULK_QUESTION_SAMPLE, bulkQuestionRowToRequest, parseBulkQuestionRows } from '../../../features/questions/bulk-question-parser';
import { getActiveTenantId } from '../../../lib/auth/session';

export default function ActivityBulkQuestionsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const mode = parseActivityMode(searchParams.get('mode'));
  const attachToActivity = Boolean(quizId);
  const tenantId = getActiveTenantId() ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState(BULK_QUESTION_SAMPLE);
  const [bankId, setBankId] = useState('');
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const banksQuery = useQuery({ queryKey: ['question-banks', tenantId], queryFn: ({ signal }) => questionBanksApi.list(tenantId, signal), enabled: Boolean(tenantId) });
  const rows = useMemo(() => parseBulkQuestionRows(raw, { mode, enforceActivityCompatibility: attachToActivity }), [raw, mode, attachToActivity]);
  const validRows = rows.filter((row) => row.errors.length === 0);
  const invalidRows = rows.length - validRows.length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !bankId) throw new Error('missing-context');
      const createdIds: string[] = [];
      const failedRows: number[] = [];
      for (const row of validRows) {
        try {
          const created = await questionsApi.create(tenantId, bulkQuestionRowToRequest(row, bankId));
          createdIds.push(created.id);
          if (quizId) await quizzesApi.addItem(tenantId, quizId, { questionId: created.id });
        } catch {
          failedRows.push(row.row);
        }
      }
      return { createdIds, failedRows };
    },
    onSuccess: async ({ createdIds, failedRows }) => {
      if (quizId) await queryClient.invalidateQueries({ queryKey: ['quiz-draft', tenantId, quizId] });
      await queryClient.invalidateQueries({ queryKey: ['questions', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['question-banks', tenantId] });
      if (failedRows.length === 0) navigate(quizId ? `/dashboard/activities/${quizId}/build?mode=${mode}` : '/dashboard/questions', { replace: true });
      else setResultMessage(`تمت إضافة ${createdIds.length} سؤالًا. تعذر حفظ الصفوف: ${failedRows.join('، ')}.`);
    },
    onError: () => setResultMessage('تعذر حفظ المجموعة. لم تُحذف البيانات التي أدخلتها؛ راجع الاتصال وحاول مرة أخرى.'),
  });

  if (!tenantId) return null;
  const banks = banksQuery.data ?? [];
  const selectedBankId = bankId || banks[0]?.id || '';
  const backPath = quizId ? `/dashboard/activities/${quizId}/build?mode=${mode}` : '/dashboard/questions';

  async function onFileSelected(file: File | null) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setResultMessage('الملف أكبر من 2MB. قسم الأسئلة إلى ملفات أصغر.');
      return;
    }
    try {
      const text = await file.text();
      setRaw(text.replace(/^\uFEFF/, ''));
      setResultMessage(null);
    } catch {
      setResultMessage('تعذر قراءة الملف. استخدم CSV أو TSV أو ملفًا نصيًا UTF-8.');
    }
  }

  function downloadTemplate() {
    const blob = new Blob([BULK_QUESTION_SAMPLE], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'english-spark-questions-template.tsv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-28">
      <header className="teacher-surface overflow-hidden"><div className="bg-gradient-to-br from-violet-800 via-indigo-700 to-slate-950 p-5 text-white sm:p-7"><Link to={backPath} className="inline-flex min-h-11 items-center text-sm font-bold text-violet-100 hover:text-white">→ العودة</Link><p className="mt-2 text-xs font-black tracking-[0.18em] text-amber-200">BULK QUESTIONS</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">إضافة مجموعة أسئلة</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-violet-100">Paste من Excel/Google Sheets، أو ارفع CSV/TSV. تظهر معاينة وأخطاء الصفوف قبل أي حفظ{attachToActivity ? '، ثم تضاف الأسئلة للبنك والنشاط معًا' : ''}.</p></div></header>

      <section className="teacher-surface p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <label className="flex flex-col gap-2 text-sm font-bold text-slate-800">البيانات<textarea dir="auto" value={raw} onChange={(event) => { setRaw(event.target.value); setResultMessage(null); }} rows={12} className="min-h-72 rounded-2xl border border-slate-300 bg-white p-4 font-mono text-sm leading-7 focus:border-violet-600 focus:outline-2 focus:outline-violet-200" /></label>
          <div className="space-y-4">
            <label className="flex flex-col gap-2 text-sm font-bold text-slate-800">حفظ داخل بنك<select value={selectedBankId} onChange={(event) => setBankId(event.target.value)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm">{banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></label>
            {banks.length === 0 && !banksQuery.isLoading ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">أنشئ بنك أسئلة أولًا من صفحة بنك الأسئلة، ثم ارجع هنا.</p> : null}
            <div className="grid gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-violet-200 bg-white px-4 text-sm font-black text-violet-800 hover:bg-violet-50">رفع CSV / TSV<input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" className="sr-only" onChange={(event) => void onFileSelected(event.target.files?.[0] ?? null)} /></label>
              <button type="button" onClick={downloadTemplate} className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-900 hover:bg-amber-100">تحميل قالب جاهز</button>
              <button type="button" onClick={() => setRaw(BULK_QUESTION_SAMPLE)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50">إعادة المثال</button>
            </div>
            <div className="rounded-2xl bg-violet-50 p-4 text-sm leading-7 text-violet-950"><p className="font-black">ترتيب الأعمدة</p><p className="mt-1" dir="ltr">type · prompt · A · B · C · D · correct · difficulty · language · tags · explanation</p><p className="mt-2 text-xs">الإجابة الصحيحة: A/B/C/D أو 1/2/3/4. الاستيراد الجماعي الحالي مخصص لـMultipleChoice وTrueFalse؛ الأسئلة الصوتية تُنشأ منفردة لرفع الملف بأمان.</p></div>
          </div>
        </div>
      </section>

      <section className="teacher-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6"><div><h2 className="text-xl font-black text-slate-950">المعاينة قبل الحفظ</h2><p className="mt-1 text-sm text-slate-600">{validRows.length} صالح · {invalidRows} يحتاج مراجعة</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${invalidRows === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{invalidRows === 0 ? 'جاهز للحفظ' : 'راجع الأخطاء'}</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-right text-xs text-slate-500"><tr><th className="px-4 py-3">الصف</th><th className="px-4 py-3">السؤال</th><th className="px-4 py-3">النوع</th><th className="px-4 py-3">الصعوبة</th><th className="px-4 py-3">الإجابة</th><th className="px-4 py-3">الحالة</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.row} className={row.errors.length ? 'bg-rose-50/40' : ''}><td className="px-4 py-4 font-black">{row.row}</td><td dir="auto" className="max-w-md px-4 py-4 font-bold text-slate-900">{row.prompt || '—'}</td><td className="px-4 py-4">{row.type ?? 'غير معروف'}</td><td className="px-4 py-4">{row.difficulty}</td><td className="px-4 py-4">{row.correctIndex == null ? '—' : String.fromCharCode(65 + row.correctIndex)}</td><td className="px-4 py-4">{row.errors.length === 0 ? <span className="font-black text-emerald-700">صالح ✓</span> : <ul className="space-y-1 text-xs font-bold text-rose-700">{row.errors.map((error) => <li key={error}>{error}</li>)}</ul>}</td></tr>)}</tbody></table></div>
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">الصق الأسئلة أو ارفع ملفًا لعرض المعاينة.</p> : null}
      </section>

      {resultMessage ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950">{resultMessage}</p> : null}
      <div className="sticky bottom-20 z-20 rounded-2xl border border-violet-100 bg-white/95 p-3 shadow-xl backdrop-blur lg:bottom-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-bold text-slate-600">سيتم إنشاء {validRows.length} سؤالًا{attachToActivity ? ' وإضافتها للنشاط الحالي' : ' داخل البنك المحدد'}.</p><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || validRows.length === 0 || invalidRows > 0 || !selectedBankId}>{saveMutation.isPending ? <ButtonSpinner /> : null}{saveMutation.isPending ? 'جارٍ حفظ المجموعة…' : `حفظ ${validRows.length} سؤالًا`}</Button></div></div>
    </div>
  );
}
