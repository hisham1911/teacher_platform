import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, TextInput } from '../../../components/ui/form-field';
import { questionBanksApi, questionsApi, quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import { QuestionForm, type QuestionFormValue } from '../../../features/questions/question-form';
import type { CreateQuestionRequest, QuestionType } from '../../../types/questions';

const DEFAULT_ACTIVITY_BANK_NAME = 'English Spark';

export default function QuestionNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();
  const quizId = searchParams.get('quizId');
  const returnToParam = searchParams.get('returnTo');
  const returnTo = isSafeDashboardReturnPath(returnToParam) ? returnToParam : null;
  const isActivityFlow = returnTo?.startsWith('/dashboard/activities/') ?? false;
  const initialQuestionType = parseQuestionType(searchParams.get('type'));

  const [selectedBankId, setSelectedBankId] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);

  const { data: banks, isLoading: isLoadingBanks } = useQuery({
    queryKey: ['question-banks', tenantId],
    queryFn: ({ signal }) => questionBanksApi.list(tenantId!, signal),
    enabled: Boolean(tenantId),
  });

  useEffect(() => {
    if (!selectedBankId && banks?.[0]) setSelectedBankId(banks[0].id);
  }, [banks, selectedBankId]);

  const createBankMutation = useMutation({
    mutationFn: (name: string) => questionBanksApi.create(tenantId!, { name }),
    onSuccess: async (bank) => {
      setSelectedBankId(bank.id);
      setNewBankName('');
      setBankError(null);
      await queryClient.invalidateQueries({ queryKey: ['question-banks', tenantId] });
    },
    onError: () => setBankError('تعذر إنشاء البنك. ربما لا تمتلك الصلاحية الكافية.'),
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (value: QuestionFormValue) => {
      let bankId = selectedBankId;

      if (!bankId && isActivityFlow) {
        const bank = await questionBanksApi.create(tenantId!, { name: DEFAULT_ACTIVITY_BANK_NAME });
        bankId = bank.id;
        setSelectedBankId(bank.id);
        await queryClient.invalidateQueries({ queryKey: ['question-banks', tenantId] });
      }

      if (!bankId) {
        throw new MissingQuestionBankError();
      }

      const payload: CreateQuestionRequest = {
        bankId,
        questionType: value.questionType,
        prompt: value.prompt,
        explanation: value.explanation,
        difficulty: value.difficulty,
        language: value.language,
        mediaAssetId: value.mediaAssetId,
        tags: value.tags,
        options: value.options,
        acceptedAnswers: value.acceptedAnswers.length > 0 ? value.acceptedAnswers : undefined,
      };

      return questionsApi.create(tenantId!, payload);
    },
    onSuccess: async (question) => {
      await queryClient.invalidateQueries({ queryKey: ['questions', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['question-banks', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['question-tags', tenantId] });
      if (quizId && returnTo) {
        try {
          const updatedDraft = await quizzesApi.addItem(tenantId!, quizId, { questionId: question.id });
          queryClient.setQueryData(['quiz-draft', tenantId, quizId], updatedDraft);
          navigate(returnTo, { replace: true });
        } catch {
          setFormError(`تم إنشاء السؤال، لكن تعذر إضافته إلى ${isActivityFlow ? 'النشاط' : 'الاختبار'}. ارجع إلى المنشئ وحاول إضافته مرة أخرى.`);
        }
        return;
      }
      navigate(`/dashboard/questions/${question.id}/preview`, { replace: true });
    },
    onError: (error) => {
      if (error instanceof MissingQuestionBankError) {
        setFormError('اختر بنك أسئلة أولاً.');
      } else if (error instanceof HttpError) {
        const body = error.body as { title?: string; detail?: string } | null;
        setFormError(
          body?.detail && body.detail.length > 0
            ? `تحقق من الإدخال: ${body.detail} (Code: ${body.title ?? error.status})`
            : `فشل الإنشاء. الحالة: ${error.status}`,
        );
      } else {
        setFormError('تعذر إنشاء السؤال. أعد المحاولة.');
      }
    },
  });

  if (!tenantId) return null;

  const canCreateBank = !isLoadingBanks;
  const canShowQuestionForm = isActivityFlow ? !isLoadingBanks : Boolean(selectedBankId);

  function onBankSubmit(event: FormEvent) {
    event.preventDefault();
    const name = newBankName.trim();
    if (name.length < 1) {
      setBankError('اسم البنك مطلوب.');
      return;
    }
    createBankMutation.mutate(name);
  }

  function onSubmitForm(value: QuestionFormValue) {
    setFormError(null);
    createQuestionMutation.mutate(value);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {isActivityFlow ? <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">English Spark Studio · إضافة سؤال</p> : null}
            <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{returnTo ? `أضيفي سؤالًا إلى ${isActivityFlow ? 'النشاط' : 'الاختبار'}` : 'سؤال جديد'}</h1>
            <p className="mt-2 text-base leading-7 text-slate-600">{isActivityFlow ? 'اكتبي السؤال والإجابة الصحيحة فقط. سنحفظه ونرجعك للنشاط تلقائيًا.' : 'اختر بنك الأسئلة، ثم اكتب السؤال وإجابته الصحيحة.'}</p>
          </div>
          <Link
            to={returnTo ?? '/dashboard/questions'}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 px-4 text-sm font-bold text-violet-800 hover:bg-violet-100">
            {returnTo ? `العودة إلى ${isActivityFlow ? 'النشاط' : 'منشئ الاختبار'}` : 'عودة للقائمة'}
          </Link>
        </div>
      </header>

      {!isActivityFlow ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <FormField id="bank-picker" label="بنك الأسئلة">
            {(props) => (
              <div className="flex flex-col gap-2">
                <select
                  {...props}
                  id="bank-picker"
                  className="min-h-13 rounded-xl border border-slate-300 bg-white px-4 text-base"
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}>
                  <option value="">— اختر بنكًا —</option>
                  {(banks ?? []).map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name} ({bank.questionCount})
                    </option>
                  ))}
                </select>
                {(banks ?? []).length === 0 && !isLoadingBanks ? (
                  <p className="text-sm text-amber-700">لا توجد بنوك بعد — أنشئ واحدًا أدناه ليتمكن الحفظ.</p>
                ) : null}
              </div>
            )}
          </FormField>

          {(banks ?? []).length === 0 || selectedBankId === '' ? (
            <form onSubmit={onBankSubmit} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/40 p-3">
              <FormField id="new-bank-inline" label="إنشاء بنك جديد" error={bankError}>
                {(props) => (
                  <TextInput
                    {...props}
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    maxLength={120}
                    placeholder="مثال: مفردات English Spark"
                    disabled={!canCreateBank}
                  />
                )}
              </FormField>
              <Button type="submit" variant="secondary" disabled={createBankMutation.isPending}>
                {createBankMutation.isPending ? 'جارٍ الإنشاء…' : 'إنشاء واختياره'}
              </Button>
            </form>
          ) : null}
        </section>
      ) : isLoadingBanks ? (
        <div role="status" className="h-24 animate-pulse rounded-2xl bg-violet-100/60" aria-label="جارٍ تجهيز نموذج السؤال" />
      ) : null}

      {formError ? (
        <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
          {formError}
        </p>
      ) : null}

      {canShowQuestionForm ? (
        <QuestionForm
          tenantId={tenantId}
          initialValue={{ questionType: initialQuestionType }}
          submitLabel={returnTo ? `حفظ وإضافة إلى ${isActivityFlow ? 'النشاط' : 'الاختبار'}` : 'إنشاء السؤال'}
          isPending={createQuestionMutation.isPending}
          onSubmit={onSubmitForm}
        />
      ) : null}
    </div>
  );
}

class MissingQuestionBankError extends Error {
  constructor() {
    super('Question bank is required');
    this.name = 'MissingQuestionBankError';
  }
}

function isSafeDashboardReturnPath(value: string | null): value is string {
  if (!value) return false;
  return value.startsWith('/dashboard/quizzes/') || value.startsWith('/dashboard/activities/');
}

function parseQuestionType(value: string | null): QuestionType {
  return value === 'TrueFalse' || value === 'ShortAnswer' || value === 'Ordering' || value === 'Listening'
    ? value
    : 'MultipleChoice';
}
