import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { questionBanksApi, questionsApi, quizzesApi } from '../../../data/api-client/endpoints';
import { parseActivityMode } from '../../../features/activities/activity-mode';
import { bulkQuestionRowToRequest, parseBulkQuestionRows } from '../../../features/questions/bulk-question-parser';
import { createCsvQuestionTemplate, readQuestionImportFile } from '../../../features/questions/question-import-file';
import { getActiveTenantId } from '../../../lib/auth/session';

export default function ActivityBulkQuestionsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const mode = parseActivityMode(searchParams.get('mode'));
  const attachToActivity = Boolean(quizId);
  const tenantId = getActiveTenantId() ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [bankId, setBankId] = useState('');
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const banksQuery = useQuery({ queryKey: ['question-banks', tenantId], queryFn: ({ signal }) => questionBanksApi.list(tenantId, signal), enabled: Boolean(tenantId) });
  const rows = useMemo(() => parseBulkQuestionRows(raw, { mode, enforceActivityCompatibility: attachToActivity }), [raw, mode, attachToActivity]);
  const validRows = rows.filter((row) => row.errors.length === 0);
  const invalidRows = rows.length - validRows.length;
  const resolvedBankId = bankId || banksQuery.data?.[0]?.id || '';

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !resolvedBankId) throw new Error('missing-context');
      const createdIds: string[] = [];
      const failedRows: number[] = [];
      for (const row of validRows) {
        try {
          const created = await questionsApi.create(tenantId, bulkQuestionRowToRequest(row, resolvedBankId));
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
    onError: () => setResultMessage('تعذر حفظ المجموعة. الملف ما زال محددًا ويمكن المحاولة مرة أخرى.'),
  });

  if (!tenantId) return null;
  const banks = banksQuery.data ?? [];
  const backPath = quizId ? `/dashboard/activities/${quizId}/build?mode=${mode}` : '/dashboard/questions';

  async function onFileSelected(file: File | null) {
    if (!file) return;
    const extension = file.name.toLowerCase().split('.').pop();
    if (extension !== 'xlsx' && extension !== 'csv') {
      setRaw('');
      setFileName(null);
      setResultMessage('الملف غير مدعوم. استخدم Excel بصيغة .xlsx أو CSV بصيغة .csv فقط.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setRaw('');
      setFileName(null);
      setResultMessage('الملف أكبر من 5MB. قسم الأسئلة إلى ملفين أصغر.');
      return;
    }

    setIsReadingFile(true);
    setResultMessage(null);
    try {
      const imported = await readQuestionImportFile(file);
      setRaw(imported);
      setFileName(file.name);
      if (!imported.trim()) setResultMessage('الملف لا يحتوي صفوف أسئلة. تأكد أن أول Sheet يحتوي الأعمدة المطلوبة.');
    } catch {
      setRaw('');
      setFileName(null);
      setResultMessage('تعذر قراءة الملف. استخدم ملف Excel .xlsx أو CSV .csv بالقالب الخاص بـEnglish Spark.');
    } finally {
      setIsReadingFile(false);
    }
  }

  function downloadCsvTemplate() {
    const url = URL.createObjectURL(createCsvQuestionTemplate());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'english-spark-question-import-template.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function clearFile() {
    setRaw('');
    setFileName(null);
    setResultMessage(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-28">
      <header className="teacher-surface overflow-hidden">
        <div className="bg-gradient-to-br from-violet-800 via-indigo-700 to-slate-950 p-5 text-white sm:p-7">
          <Link to={backPath} className="inline-flex min-h-11 items-center text-sm font-bold text-violet-100 hover:text-white">→ العودة</Link>
          <p className="mt-2 text-xs font-black tracking-[0.18em] text-amber-200">IMPORT QUESTIONS</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">استيراد أسئلة من ملف</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-violet-100">ارفع ملف Excel أو CSV فقط. سنعرض الأسئلة والأخطاء أولًا، ولن يتم حفظ أي شيء قبل تأكيدك{attachToActivity ? '، وبعد الحفظ تضاف الأسئلة للنشاط الحالي تلقائيًا' : ''}.</p>
        </div>
      </header>

      <section className="teacher-surface p-4 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            <h2 className="text-lg font-black text-slate-950">1. اختر ملف الأسئلة</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">الصيغ المقبولة فقط: <b>Excel .xlsx</b> أو <b>CSV .csv</b>.</p>
            <label className={`mt-4 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 text-center transition ${fileName ? 'border-emerald-300 bg-emerald-50/60' : 'border-violet-200 bg-violet-50/40 hover:border-violet-400 hover:bg-violet-50'}`}>
              <span aria-hidden="true" className="text-3xl">{fileName ? '✓' : '📄'}</span>
              <span className="mt-3 text-base font-black text-slate-950">{isReadingFile ? 'جارٍ قراءة الملف…' : fileName ? fileName : 'اضغط لاختيار ملف Excel أو CSV'}</span>
              <span className="mt-1 text-xs font-bold text-slate-500">حد أقصى 5MB</span>
              <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="sr-only" disabled={isReadingFile || saveMutation.isPending} onChange={(event) => void onFileSelected(event.target.files?.[0] ?? null)} />
            </label>
            {fileName ? <button type="button" onClick={clearFile} className="mt-2 min-h-11 px-2 text-sm font-bold text-rose-700 hover:underline">إزالة الملف واختيار غيره</button> : null}
          </div>

          <div className="space-y-4">
            <label className="flex flex-col gap-2 text-sm font-bold text-slate-800">2. حفظ داخل بنك<select value={resolvedBankId} onChange={(event) => setBankId(event.target.value)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm">{banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></label>
            {banks.length === 0 && !banksQuery.isLoading ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">لا يوجد بنك أسئلة حتى الآن. أنشئ بنكًا أولًا ثم ارجع للاستيراد.</p> : null}
            <button type="button" onClick={downloadCsvTemplate} className="min-h-11 w-full rounded-xl border border-violet-200 bg-white px-4 text-sm font-black text-violet-800 hover:bg-violet-50">تحميل قالب CSV فارغ</button>
            <div className="rounded-2xl bg-violet-50 p-4 text-sm leading-7 text-violet-950">
              <p className="font-black">أعمدة الملف</p>
              <p className="mt-1 break-words text-xs" dir="ltr">type · prompt · A · B · C · D · correct · difficulty · language · tags · explanation</p>
              <p className="mt-2 text-xs">الإجابة الصحيحة A/B/C/D. الأنواع المدعومة في الاستيراد الآن: MultipleChoice وTrueFalse.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="teacher-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div><h2 className="text-xl font-black text-slate-950">3. راجع الأسئلة قبل الحفظ</h2><p className="mt-1 text-sm text-slate-600">{rows.length === 0 ? 'ارفع ملفًا أولًا.' : `${validRows.length} صالح · ${invalidRows} يحتاج مراجعة`}</p></div>
          {rows.length > 0 ? <span className={`rounded-full px-3 py-1 text-xs font-black ${invalidRows === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{invalidRows === 0 ? 'الملف جاهز' : 'راجع الأخطاء'}</span> : null}
        </div>
        {rows.length > 0 ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-right text-xs text-slate-500"><tr><th className="px-4 py-3">الصف</th><th className="px-4 py-3">السؤال</th><th className="px-4 py-3">النوع</th><th className="px-4 py-3">الصعوبة</th><th className="px-4 py-3">الإجابة</th><th className="px-4 py-3">الحالة</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.row} className={row.errors.length ? 'bg-rose-50/40' : ''}><td className="px-4 py-4 font-black">{row.row}</td><td dir="auto" className="max-w-md px-4 py-4 font-bold text-slate-900">{row.prompt || '—'}</td><td className="px-4 py-4">{row.type ?? 'غير معروف'}</td><td className="px-4 py-4">{row.difficulty}</td><td className="px-4 py-4">{row.correctIndex == null ? '—' : String.fromCharCode(65 + row.correctIndex)}</td><td className="px-4 py-4">{row.errors.length === 0 ? <span className="font-black text-emerald-700">صالح ✓</span> : <ul className="space-y-1 text-xs font-bold text-rose-700">{row.errors.map((error) => <li key={error}>{error}</li>)}</ul>}</td></tr>)}</tbody></table></div>
        ) : <div className="px-5 py-12 text-center"><p className="text-3xl" aria-hidden="true">📥</p><p className="mt-3 font-black text-slate-900">لا توجد أسئلة للمعاينة بعد</p><p className="mt-1 text-sm text-slate-500">اختر ملف Excel أو CSV من الخطوة الأولى.</p></div>}
      </section>

      {resultMessage ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950">{resultMessage}</p> : null}
      <div className="sticky bottom-20 z-20 rounded-2xl border border-violet-100 bg-white/95 p-3 shadow-xl backdrop-blur lg:bottom-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-bold text-slate-600">{rows.length === 0 ? 'ارفع ملف الأسئلة أولًا.' : `سيتم إنشاء ${validRows.length} سؤالًا${attachToActivity ? ' وإضافتها للنشاط الحالي' : ' داخل البنك المحدد'}.`}</p><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || validRows.length === 0 || invalidRows > 0 || !resolvedBankId}>{saveMutation.isPending ? <ButtonSpinner /> : null}{saveMutation.isPending ? 'جارٍ حفظ المجموعة…' : `حفظ ${validRows.length} سؤالًا`}</Button></div></div>
    </div>
  );
}
