import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, TextInput } from '../../../components/ui/form-field';
import { questionBanksApi, questionsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import { QuestionForm, type QuestionFormValue } from '../../../features/questions/question-form';
import type { CreateQuestionRequest } from '../../../types/questions';

/** /dashboard/questions/new — إنشاء سؤال ضمن بنك موجود، مع إمكانية إنشاء بنك جديد inline */
export default function QuestionNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();

  const [selectedBankId, setSelectedBankId] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);

  const { data: banks, isLoading: isLoadingBanks } = useQuery({
    queryKey: ['question-banks', tenantId],
    queryFn: ({ signal }) => questionBanksApi.list(tenantId!, signal),
    enabled: Boolean(tenantId),
  });

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
    mutationFn: (payload: CreateQuestionRequest) => questionsApi.create(tenantId!, payload),
    onSuccess: async (question) => {
      await queryClient.invalidateQueries({ queryKey: ['questions', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['question-banks', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['question-tags', tenantId] });
      navigate(`/dashboard/questions/${question.id}/preview`, { replace: true });
    },
    onError: (error) => {
      if (error instanceof HttpError) {
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

  if (!tenantId) {
    return null;
  }

  const canCreateBank = !isLoadingBanks && (banks?.length ?? 0) > -1;

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
    if (!selectedBankId) {
      setFormError('اختر بنك أسئلة أولاً.');
      return;
    }

    setFormError(null);
    createQuestionMutation.mutate({
      bankId: selectedBankId,
      questionType: value.questionType,
      prompt: value.prompt,
      explanation: value.explanation,
      difficulty: value.difficulty,
      language: value.language,
      mediaAssetId: value.mediaAssetId,
      tags: value.tags,
      options: value.options,
      acceptedAnswers: value.acceptedAnswers.length > 0 ? value.acceptedAnswers : undefined,
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">سؤال جديد</h1>
          <p className="text-sm text-slate-600">اختر بنك الأسئلة، ثم حدد نوع السؤال وأدخل محتواه وإجابته الصحيحة.</p>
        </div>
        <Link
          to="/dashboard/questions"
          className="min-h-11 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
          عودة للقائمة
        </Link>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <FormField id="bank-picker" label="بنك الأسئلة">
          {(props) => (
            <div className="flex flex-col gap-2">
              <select
                {...props}
                id="bank-picker"
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
          <form onSubmit={onBankSubmit} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/40 p-3">
            <FormField id="new-bank-inline" label="إنشاء بنك جديد" error={bankError}>
              {(props) => (
                <TextInput
                  {...props}
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  maxLength={120}
                  placeholder="مثال: قواعد المستوى الثاني"
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

      {formError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {formError}
        </p>
      ) : null}

      {selectedBankId ? (
        <QuestionForm
          tenantId={tenantId}
          submitLabel="إنشاء السؤال"
          isPending={createQuestionMutation.isPending}
          onSubmit={onSubmitForm}
        />
      ) : null}
    </div>
  );
}
