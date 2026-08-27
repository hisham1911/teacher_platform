import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { questionBanksApi, questionsApi, quizzesApi } from '../../../data/api-client/endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';
import { isQuestionTypeAllowedForActivity, parseActivityMode } from '../../../features/activities/activity-mode';
import type { CreateQuestionRequest, QuestionDifficulty, QuestionType } from '../../../types/questions';

const SAMPLE = `type\tprompt\tA\tB\tC\tD\tcorrect\tdifficulty\tlanguage\ttags\texplanation
MultipleChoice\tWhich planet is known as the Red Planet?\tEarth\tMars\tVenus\tJupiter\tB\tEasy\ten\tspace,vocabulary\tMars is known as the Red Planet.
TrueFalse\tThe Sun is a star.\tTrue\tFalse\t\t\tA\tEasy\ten\tspace\tThe Sun is the star at the center of our solar system.`;

type BulkRow = {
  row: number;
  type: QuestionType | null;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  difficulty: QuestionDifficulty;
  language: 'ar' | 'en';
  tags: string[];
  explanation: string | null;
  errors: string[];
};

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeType(value: string): QuestionType | null {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (['multiplechoice', 'mcq', 'اختيارمنمتعدد'].includes(normalized)) return 'MultipleChoice';
  if (['truefalse', 'tf', 'صحخطأ', 'صحاوخطأ'].includes(normalized)) return 'TrueFalse';
  return null;
}

function normalizeDifficulty(value: string): QuestionDifficulty {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'easy' || normalized === 'سهل') return 'Easy';
  if (normalized === 'hard' || normalized === 'صعب') return 'Hard';
  return 'Medium';
}

function parseRows(raw: string, mode: ReturnType<typeof parseActivityMode>): BulkRow[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = lines.some((line) => line.includes('\t')) ? '\t' : ',';
  const first = parseCsvLine(lines[0]!, delimiter);
  const hasHeader = first[0]?.trim().toLowerCase() === 'type' || first[1]?.trim().toLowerCase() === 'prompt';
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, index) => {
    const cells = parseCsvLine(line, delimiter);
    const type = normalizeType(cells[0] ?? '');
    const prompt = (cells[1] ?? '').trim();
    const options = [cells[2], cells[3], cells[4], cells[5]].map((value) => (value ?? '').trim()).filter(Boolean);
    const correctToken = (cells[6] ?? '').trim().toUpperCase();
    const correctIndex = /^[A-D]$/.test(correctToken) ? correctToken.charCodeAt(0) - 65 : Number.isInteger(Number(correctToken)) ? Number(correctToken) - 1 : null;
    const difficulty = normalizeDifficulty(cells[7] ?? 'Medium');
    const language = (cells[8] ?? 'en').trim().toLowerCase() === 'ar' ? 'ar' : 'en';
    const tags = (cells[9] ?? '').split(/[،,]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
    const explanation = (cells[10] ?? '').trim() || null;
    const errors: string[] = [];

    if (!type) errors.push('النوع يجب أن يكون MultipleChoice أو TrueFalse.');
    if (type && !isQuestionTypeAllowedForActivity(mode, type)) errors.push('نوع السؤال غير متوافق مع طريقة اللعب الحالية.');
    if (prompt.length < 1) errors.push('نص السؤال مطلوب.');
    if (prompt.length > 2000) errors.push('نص السؤال أطول من الحد المسموح.');
    if (type === 'TrueFalse' && options.length < 2) errors.push('صح/خطأ يحتاج خيارين.');
    if (type === 'MultipleChoice' && (options.length < 2 || options.length > 10)) errors.push('الاختيار من متعدد يحتاج 2–10 اختيارات.');
    if (correctIndex == null || correctIndex < 0 || correctIndex >= options.length) errors.push('الإجابة الصحيحة يجب أن تكون A/B/C/D أو رقمًا صحيحًا.');

    return { row: index + (hasHeader ? 2 : 1), type, prompt, options, correctIndex, difficulty, language, tags, explanation, errors };
  });
}

function toRequest(row: BulkRow, bankId: string): CreateQuestionRequest {
  return {
    bankId,
    questionType: row.type!,
    prompt: row.prompt,
    explanation: row.explanation,
    difficulty: row.difficulty,
    language: row.language,
    tags: row.tags,
    options: row.options.map((text, index) => ({ text, isCorrect: index === row.correctIndex })),
  };
}

export default function ActivityBulkQuestionsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const mode = parseActivityMode(searchParams.get('mode'));
  const tenantId = getActiveTenantId() ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState(SAMPLE);
  const [bankId, setBankId] = useState('');
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const banksQuery = useQuery({
    queryKey: ['question-banks', tenantId],
    queryFn: ({ signal }) => questionBanksApi.list(tenantId, signal),
    enabled: Boolean(tenantId),
  });

  const rows = useMemo(() => parseRows(raw, mode), [raw, mode]);
  const validRows = rows.filter((row) => row.errors.length === 0);
  const invalidRows = rows.length - validRows.length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !quizId || !bankId) throw new Error('missing-context');
      const createdIds: string[] = [];
      const failedRows: number[] = [];
      for (const row of validRows) {
        try {
          const created = await questionsApi.create(tenantId, toRequest(row, bankId));
          createdIds.push(created.id);
          await quizzesApi.addItem(tenantId, quizId, { questionId: created.id });
        } catch {
          failedRows.push(row.row);
        }
      }
      return { createdIds, failedRows };
    },
    onSuccess: async ({ createdIds, failedRows }) => {
      await queryClient.invalidateQueries({ queryKey: ['quiz-draft', tenantId, quizId] });
      await queryClient.invalidateQueries({ queryKey: ['questions', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['question-banks', tenantId] });
      if (failedRows.length === 0) {
        navigate(`/dashboard/activities/${quizId}/build?mode=${mode}`, { replace: true });
      } else {
        setResultMessage(`تمت إضافة ${createdIds.length} سؤالًا. تعذر حفظ الصفوف: ${failedRows.join('، ')}.`);
      }
    },
    onError: () => setResultMessage('تعذر حفظ المجموعة. لم تُحذف البيانات التي أدخلتها؛ راجع الاتصال وحاول مرة أخرى.'),
  });

  if (!tenantId || !quizId) return null;
  const banks = banksQuery.data ?? [];
  const selectedBankId = bankId || banks[0]?.id || '';

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-28">
      <header className="teacher-surface overflow-hidden">
        <div className="bg-gradient-to-br from-violet-800 via-indigo-700 to-slate-950 p-5 text-white sm:p-7">
          <Link to={`/dashboard/activities/${quizId}/build?mode=${mode}`} className="inline-flex min-h-11 items-center text-sm font-bold text-violet-100 hover:text-white">→ العودة للنشاط</Link>
          <p className="mt-2 text-xs font-black tracking-[0.18em] text-amber-200">BULK QUESTIONS</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">إضافة مجموعة أسئلة</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-violet-100">انسخ صفوفًا من Excel أو Google Sheets، أو الصق CSV. راجع المعاينة ثم احفظ المجموعة مرة واحدة.</p>
        </div>
      </header>

      <section className="teacher-surface p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <label className="flex flex-col gap-2 text-sm font-bold text-slate-800">
            البيانات
            <textarea dir="auto" value={raw} onChange={(event) => { setRaw(event.target.value); setResultMessage(null); }} rows={12} className="min-h-72 rounded-2xl border border-slate-300 bg-white p-4 font-mono text-sm leading-7 focus:border-violet-600 focus:outline-2 focus:outline-violet-200" />
          </label>
          <div className="space-y-4">
            <label className="flex flex-col gap-2 text-sm font-bold text-slate-800">
              حفظ الأسئلة داخل بنك
              <select value={selectedBankId} onChange={(event) => setBankId(event.target.value)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm">
                {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
              </select>
            </label>
            {banks.length === 0 && !banksQuery.isLoading ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">أنشئ بنك أسئلة أولًا من صفحة بنك الأسئلة، ثم ارجع هنا.</p> : null}
            <div className="rounded-2xl bg-violet-50 p-4 text-sm leading-7 text-violet-950">
              <p className="font-black">ترتيب الأعمدة</p>
              <p className="mt-1" dir="ltr">type · prompt · A · B · C · D · correct · difficulty · language · tags · explanation</p>
              <p className="mt-2 text-xs">الإجابة الصحيحة: A/B/C/D أو 1/2/3/4. الأنواع الجماعية الحالية: MultipleChoice وTrueFalse.</p>
            </div>
            <button type="button" onClick={() => setRaw(SAMPLE)} className="min-h-11 w-full rounded-xl border border-violet-200 bg-white px-4 text-sm font-black text-violet-800 hover:bg-violet-50">إعادة المثال</button>
          </div>
        </div>
      </section>

      <section className="teacher-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div><h2 className="text-xl font-black text-slate-950">المعاينة قبل الحفظ</h2><p className="mt-1 text-sm text-slate-600">{validRows.length} صالح · {invalidRows} يحتاج مراجعة</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${invalidRows === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{invalidRows === 0 ? 'جاهز للحفظ' : 'راجع الأخطاء'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-slate-50 text-right text-xs text-slate-500"><tr><th className="px-4 py-3">الصف</th><th className="px-4 py-3">السؤال</th><th className="px-4 py-3">النوع</th><th className="px-4 py-3">الصعوبة</th><th className="px-4 py-3">الإجابة</th><th className="px-4 py-3">الحالة</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => <tr key={row.row} className={row.errors.length ? 'bg-rose-50/40' : ''}><td className="px-4 py-4 font-black">{row.row}</td><td dir="auto" className="max-w-md px-4 py-4 font-bold text-slate-900">{row.prompt || '—'}</td><td className="px-4 py-4">{row.type ?? 'غير معروف'}</td><td className="px-4 py-4">{row.difficulty}</td><td className="px-4 py-4">{row.correctIndex == null ? '—' : String.fromCharCode(65 + row.correctIndex)}</td><td className="px-4 py-4">{row.errors.length === 0 ? <span className="font-black text-emerald-700">صالح ✓</span> : <ul className="space-y-1 text-xs font-bold text-rose-700">{row.errors.map((error) => <li key={error}>{error}</li>)}</ul>}</td></tr>)}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">الصق الأسئلة في المربع أعلاه لعرض المعاينة.</p> : null}
      </section>

      {resultMessage ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950">{resultMessage}</p> : null}

      <div className="sticky bottom-20 z-20 rounded-2xl border border-violet-100 bg-white/95 p-3 shadow-xl backdrop-blur lg:bottom-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-slate-600">سيتم إنشاء {validRows.length} سؤالًا وإضافتها للنشاط الحالي.</p>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || validRows.length === 0 || invalidRows > 0 || !selectedBankId}>
            {saveMutation.isPending ? <ButtonSpinner /> : null}
            {saveMutation.isPending ? 'جارٍ حفظ المجموعة…' : `حفظ ${validRows.length} سؤالًا`}
          </Button>
        </div>
      </div>
    </div>
  );
}
