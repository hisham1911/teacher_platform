import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { FormField, TextInput } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { platformApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import type { CreatePlanRequest, PlanLimits, PlatformTenant } from '../../types/saas';

const DEFAULT_LIMITS: PlanLimits = {
  maxQuizzesPerTenant: 100,
  maxQuestionsPerQuiz: 200,
  maxPublishedQuizzesPerTenant: 50,
  maxAttemptsPerMonth: 10_000,
  maxStorageBytes: 5 * 1024 * 1024 * 1024,
  maxCertificatesPerMonth: 10_000,
};

const metricLabels: Record<string, string> = {
  PublishedQuizzes: 'الاختبارات المنشورة',
  Attempts: 'المحاولات هذا الشهر',
  StorageBytes: 'التخزين',
  CertificatesIssued: 'الشهادات هذا الشهر',
};

function formatMetric(metric: string, value: number) {
  if (metric === 'StorageBytes') {
    return `${(value / (1024 * 1024)).toLocaleString('ar-EG', { maximumFractionDigits: 1 })} م.ب`;
  }
  return value.toLocaleString('ar-EG');
}

function errorText(error: unknown) {
  if (error instanceof HttpError && error.status === 409) return 'الكود مستخدم بالفعل. اختر كودًا آخر.';
  return 'تعذر إتمام العملية. راجع البيانات وحاول مرة أخرى.';
}

export default function PlatformAdminPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CreatePlanRequest>({
    code: '', name: '', isActive: true, limits: DEFAULT_LIMITS,
  });
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});
  const [usageTenantId, setUsageTenantId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ['platform', 'plans'],
    queryFn: ({ signal }) => platformApi.listPlans(signal),
  });
  const tenantsQuery = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: ({ signal }) => platformApi.listTenants(signal),
  });
  const usersQuery = useQuery({
    queryKey: ['platform', 'users'],
    queryFn: ({ signal }) => platformApi.listUsers(signal),
  });
  const auditQuery = useQuery({
    queryKey: ['platform', 'audit'],
    queryFn: ({ signal }) => platformApi.listAudit(signal),
  });
  const usageQuery = useQuery({
    queryKey: ['platform', 'usage', usageTenantId],
    queryFn: ({ signal }) => platformApi.getUsage(usageTenantId!, signal),
    enabled: Boolean(usageTenantId),
  });

  const activePlans = useMemo(
    () => plansQuery.data?.filter((plan) => plan.isActive) ?? [],
    [plansQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: () => platformApi.createPlan(draft),
    onSuccess: async () => {
      setDraft({ code: '', name: '', isActive: true, limits: DEFAULT_LIMITS });
      setMessage('تم إنشاء الخطة.');
      await queryClient.invalidateQueries({ queryKey: ['platform', 'plans'] });
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const activateMutation = useMutation({
    mutationFn: ({ tenantId, planId }: { tenantId: string; planId: string }) =>
      platformApi.activateSubscription(tenantId, planId),
    onSuccess: async () => {
      setMessage('تم تفعيل الاشتراك يدويًا.');
      await queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
    },
    onError: (error) => setMessage(errorText(error)),
  });

  function submitPlan(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    createMutation.mutate();
  }

  function updateLimit(key: keyof PlanLimits, value: string) {
    const parsed = Number(value);
    setDraft((current) => ({
      ...current,
      limits: { ...current.limits, [key]: Number.isFinite(parsed) ? parsed : 0 },
    }));
  }

  return (
    <div className="space-y-8">
      <header className="rounded-3xl bg-slate-950 px-6 py-7 text-white sm:px-8">
        <p className="text-sm font-bold text-cyan-300">Platform Admin</p>
        <h1 className="mt-1 text-2xl font-bold">إدارة المنصة</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          إدارة العملاء والخطط والاستخدام من صلاحية عالمية منفصلة عن أدوار مساحات العمل.
        </p>
      </header>

      {message ? <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">{message}</p> : null}

      <section aria-labelledby="plans-heading" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
        <div>
          <h2 id="plans-heading" className="text-lg font-bold text-slate-950">الخطط</h2>
          <p className="mt-1 text-sm text-slate-500">الحدود هنا هي المصدر الفعلي للتنفيذ على الخادم.</p>
          {plansQuery.isLoading ? <LoadingLabel text="جارٍ تحميل الخطط…" /> : null}
          {plansQuery.isError ? <ErrorLabel text="تعذر تحميل الخطط." /> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {plansQuery.data?.map((plan) => (
              <article key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="font-bold text-slate-900">{plan.name}</h3><p dir="ltr" className="text-left text-xs text-slate-400">{plan.code}</p></div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${plan.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {plan.isActive ? 'نشطة' : 'متوقفة'}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <Limit label="اختبارات" value={plan.limits.maxQuizzesPerTenant} />
                  <Limit label="أسئلة/اختبار" value={plan.limits.maxQuestionsPerQuiz} />
                  <Limit label="منشورة" value={plan.limits.maxPublishedQuizzesPerTenant} />
                  <Limit label="محاولات/شهر" value={plan.limits.maxAttemptsPerMonth} />
                  <Limit label="تخزين م.ب" value={Math.round(plan.limits.maxStorageBytes / (1024 * 1024))} />
                  <Limit label="شهادات/شهر" value={plan.limits.maxCertificatesPerMonth} />
                </dl>
              </article>
            ))}
            {plansQuery.data?.length === 0 ? <EmptyLabel text="لا توجد خطط بعد." /> : null}
          </div>
        </div>

        <form onSubmit={submitPlan} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">خطة جديدة</h2>
          <div className="mt-4 grid gap-4">
            <FormField id="plan-name" label="اسم الخطة">{(props) => <TextInput {...props} required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />}</FormField>
            <FormField id="plan-code" label="الكود (إنجليزي)">{(props) => <TextInput {...props} dir="ltr" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={40} value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toLowerCase() })} />}</FormField>
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="limit-quizzes" label="الاختبارات" value={draft.limits.maxQuizzesPerTenant} onChange={(value) => updateLimit('maxQuizzesPerTenant', value)} />
              <NumberField id="limit-questions" label="أسئلة/اختبار" value={draft.limits.maxQuestionsPerQuiz} onChange={(value) => updateLimit('maxQuestionsPerQuiz', value)} />
              <NumberField id="limit-published" label="المنشورة" value={draft.limits.maxPublishedQuizzesPerTenant} onChange={(value) => updateLimit('maxPublishedQuizzesPerTenant', value)} />
              <NumberField id="limit-attempts" label="محاولات/شهر" value={draft.limits.maxAttemptsPerMonth} onChange={(value) => updateLimit('maxAttemptsPerMonth', value)} />
              <NumberField id="limit-storage" label="التخزين (م.ب)" value={Math.round(draft.limits.maxStorageBytes / (1024 * 1024))} onChange={(value) => updateLimit('maxStorageBytes', String(Number(value) * 1024 * 1024))} />
              <NumberField id="limit-certificates" label="شهادات/شهر" value={draft.limits.maxCertificatesPerMonth} onChange={(value) => updateLimit('maxCertificatesPerMonth', value)} />
            </div>
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? <ButtonSpinner /> : 'إنشاء الخطة'}</Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="tenants-heading">
        <div className="flex items-end justify-between gap-4"><div><h2 id="tenants-heading" className="text-lg font-bold text-slate-950">العملاء والاشتراكات</h2><p className="mt-1 text-sm text-slate-500">تفعيل يدوي مناسب للنسخة التجريبية الأولى.</p></div><span className="text-sm font-bold text-slate-500">{tenantsQuery.data?.length ?? 0}</span></div>
        {tenantsQuery.isLoading ? <LoadingLabel text="جارٍ تحميل العملاء…" /> : null}
        {tenantsQuery.isError ? <ErrorLabel text="تعذر تحميل العملاء." /> : null}
        <div className="mt-4 space-y-3">
          {tenantsQuery.data?.map((tenant) => (
            <TenantRow
              key={tenant.id}
              tenant={tenant}
              plans={activePlans}
              selectedPlan={selectedPlans[tenant.id] ?? tenant.subscription?.planId ?? ''}
              pending={activateMutation.isPending}
              onSelect={(planId) => setSelectedPlans((current) => ({ ...current, [tenant.id]: planId }))}
              onActivate={(planId) => activateMutation.mutate({ tenantId: tenant.id, planId })}
              onUsage={() => setUsageTenantId((current) => current === tenant.id ? null : tenant.id)}
            />
          ))}
        </div>
        {usageTenantId ? (
          <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-5">
            <h3 className="font-bold text-slate-900">الاستخدام الحالي</h3>
            {usageQuery.isLoading ? <LoadingLabel text="جارٍ حساب الاستخدام…" /> : null}
            {usageQuery.isError ? <ErrorLabel text="تعذر حساب الاستخدام." /> : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {usageQuery.data?.metrics.map((metric) => (
                <div key={metric.metric} className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{metricLabels[metric.metric] ?? metric.metric}</p><p className="mt-1 font-bold text-slate-950">{formatMetric(metric.metric, metric.value)} <span className="font-normal text-slate-400">/ {metric.limit === null ? '—' : formatMetric(metric.metric, metric.limit)}</span></p></div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="users-heading">
        <div className="flex items-end justify-between gap-4"><div><h2 id="users-heading" className="text-lg font-bold text-slate-950">المستخدمون</h2><p className="mt-1 text-sm text-slate-500">حالة الحساب وعدد مساحات العمل دون كشف بيانات اعتماد.</p></div><span className="text-sm font-bold text-slate-500">{usersQuery.data?.length ?? 0}</span></div>
        {usersQuery.isLoading ? <LoadingLabel text="جارٍ تحميل المستخدمين…" /> : null}
        {usersQuery.isError ? <ErrorLabel text="تعذر تحميل المستخدمين." /> : null}
        {usersQuery.data?.length ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[680px] text-sm"><thead className="bg-slate-50 text-right text-xs text-slate-500"><tr><th className="px-4 py-3">المستخدم</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">البريد</th><th className="px-4 py-3">مساحات العمل</th><th className="px-4 py-3">صلاحية عالمية</th></tr></thead><tbody className="divide-y divide-slate-100">{usersQuery.data.map((user) => <tr key={user.id}><td className="px-4 py-4"><p className="font-bold text-slate-900">{user.fullName}</p><p dir="ltr" className="text-left text-xs text-slate-400">{user.email}</p></td><td className="px-4 py-4 text-slate-600">{user.status}</td><td className="px-4 py-4">{user.emailConfirmed ? 'مؤكد' : 'غير مؤكد'}</td><td className="px-4 py-4 font-bold">{user.tenantCount}</td><td className="px-4 py-4">{user.platformRoles.includes('PlatformAdmin') ? 'PlatformAdmin' : '—'}</td></tr>)}</tbody></table>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="audit-heading">
        <div className="flex items-end justify-between gap-4"><div><h2 id="audit-heading" className="text-lg font-bold text-slate-950">سجل التدقيق</h2><p className="mt-1 text-sm text-slate-500">آخر عمليات الإدارة ونقل المحتوى دون بيانات اعتماد.</p></div><span className="text-sm font-bold text-slate-500">{auditQuery.data?.length ?? 0}</span></div>
        {auditQuery.isLoading ? <LoadingLabel text="جارٍ تحميل سجل التدقيق…" /> : null}
        {auditQuery.isError ? <ErrorLabel text="تعذر تحميل سجل التدقيق." /> : null}
        {auditQuery.data?.length ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[680px] text-sm"><thead className="bg-slate-50 text-right text-xs text-slate-500"><tr><th className="px-4 py-3">العملية</th><th className="px-4 py-3">الكيان</th><th className="px-4 py-3">المستأجر</th><th className="px-4 py-3">الوقت</th></tr></thead><tbody className="divide-y divide-slate-100">{auditQuery.data.map((entry) => <tr key={entry.id}><td className="px-4 py-4 font-bold text-slate-900">{entry.action}</td><td className="px-4 py-4 text-slate-600">{entry.entityType}</td><td dir="ltr" className="px-4 py-4 text-left text-xs text-slate-500">{entry.tenantId ?? 'platform'}</td><td className="px-4 py-4 text-slate-600">{new Date(entry.createdAt).toLocaleString('ar-EG')}</td></tr>)}</tbody></table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function TenantRow({ tenant, plans, selectedPlan, pending, onSelect, onActivate, onUsage }: {
  tenant: PlatformTenant;
  plans: { id: string; name: string }[];
  selectedPlan: string;
  pending: boolean;
  onSelect: (planId: string) => void;
  onActivate: (planId: string) => void;
  onUsage: () => void;
}) {
  return <article className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)_auto] lg:items-center"><div><h3 className="font-bold text-slate-900">{tenant.name}</h3><p dir="ltr" className="text-left text-xs text-slate-400">{tenant.slug}</p><p className="mt-1 text-xs text-slate-500">{tenant.subscription ? `الخطة الحالية: ${tenant.subscription.planName}` : 'لا يوجد اشتراك نشط'}</p></div><div className="flex gap-2"><label className="sr-only" htmlFor={`plan-${tenant.id}`}>اختر الخطة</label><select id={`plan-${tenant.id}`} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm" value={selectedPlan} onChange={(event) => onSelect(event.target.value)}><option value="">اختر خطة</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><Button disabled={!selectedPlan || pending} onClick={() => onActivate(selectedPlan)}>تفعيل</Button></div><Button variant="secondary" onClick={onUsage}>الاستخدام</Button></article>;
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: string) => void }) {
  return <FormField id={id} label={label}>{(props) => <TextInput {...props} type="number" min={1} required value={value} onChange={(event) => onChange(event.target.value)} />}</FormField>;
}

function Limit({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">{label}</dt><dd className="mt-0.5 font-bold text-slate-900">{value.toLocaleString('ar-EG')}</dd></div>; }
function LoadingLabel({ text }: { text: string }) { return <p className="mt-4 text-sm text-slate-500">{text}</p>; }
function ErrorLabel({ text }: { text: string }) { return <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{text}</p>; }
function EmptyLabel({ text }: { text: string }) { return <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{text}</p>; }
