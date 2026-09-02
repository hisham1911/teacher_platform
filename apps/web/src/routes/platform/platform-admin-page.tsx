import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { FormField, SelectInput, TextInput } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { commercialPlatformApi } from '../../data/api-client/commercial-endpoints';
import { HttpError } from '../../data/api-client/http-error';
import { useSessionSnapshot } from '../../features/auth/use-session';
import type {
  CommercialPackageCatalogItem,
  CreatePlanRequest,
  PlanEntitlements,
  PlanLimits,
  PlatformTenant,
  PlatformUser,
  SaasPlan,
} from '../../types/saas';

const entitlementLabels: Array<[keyof PlanEntitlements, string]> = [
  ['bulkImport', 'استيراد جماعي'],
  ['advancedReports', 'تقارير متقدمة'],
  ['certificates', 'شهادات'],
  ['customBranding', 'هوية مخصصة'],
  ['dataExport', 'تصدير البيانات'],
  ['customDomain', 'نطاق مخصص — لاحقًا'],
];

const limitLabels: Array<[keyof PlanLimits, string]> = [
  ['maxStudents', 'الطلاب'],
  ['maxMembers', 'الأعضاء'],
  ['maxClasses', 'الفصول'],
  ['maxActiveAssignments', 'التكليفات النشطة'],
  ['maxLiveParticipants', 'مشاركو Live'],
  ['maxQuizzesPerTenant', 'الأنشطة'],
  ['maxQuestionsPerQuiz', 'الأسئلة/نشاط'],
  ['maxPublishedQuizzesPerTenant', 'المنشور'],
  ['maxAttemptsPerMonth', 'المحاولات/شهر'],
  ['maxCertificatesPerMonth', 'الشهادات/شهر'],
];

const auditLabels: Record<string, string> = {
  PlanCreated: 'إنشاء خطة',
  PlanUpdated: 'تعديل خطة',
  SubscriptionActivated: 'تغيير/تفعيل خطة',
  UserSuspended: 'إيقاف حساب مستخدم',
  UserRestored: 'إعادة تفعيل مستخدم',
  TenantSuspended: 'إيقاف مساحة عمل',
  TenantReactivated: 'إعادة تفعيل مساحة عمل',
};

function statusLabel(status: string) {
  switch (status) {
    case 'Active': return 'نشط';
    case 'Suspended': return 'موقوف';
    case 'Expired': return 'منتهي';
    case 'Inactive': return 'لم يبدأ';
    case 'Cancelled': return 'ملغي';
    case 'Grandfathered': return 'حساب حالي محفوظ';
    default: return status;
  }
}

function mutationError(error: unknown) {
  if (error instanceof HttpError && error.status === 409) return 'البيانات تغيّرت. حدّث الصفحة ثم أعد المحاولة.';
  if (error instanceof HttpError && error.status === 403) return 'ليس لديك صلاحية لتنفيذ هذه العملية.';
  if (error instanceof HttpError && error.status === 404) return 'الخطة أو الحساب لم يعد موجودًا.';
  if (error instanceof HttpError && error.status === 400) return 'تعذر تنفيذ العملية بهذه القيم.';
  return 'تعذر تنفيذ العملية. حاول مرة أخرى.';
}

function normalizePackageCode(packageName: string) {
  return packageName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export default function PlatformAdminPage() {
  const queryClient = useQueryClient();
  const session = useSessionSnapshot();
  const [customerSearch, setCustomerSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});
  const [expiryByTenant, setExpiryByTenant] = useState<Record<string, string>>({});
  const [reasonByTenant, setReasonByTenant] = useState<Record<string, string>>({});
  const [usageTenantId, setUsageTenantId] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState('Teacher');
  const [planCode, setPlanCode] = useState('teacher');
  const [planName, setPlanName] = useState('Teacher');
  const [message, setMessage] = useState<string | null>(null);

  const packagesQuery = useQuery({
    queryKey: ['platform', 'commercial-packages'],
    queryFn: ({ signal }) => commercialPlatformApi.listPackages(signal),
  });
  const plansQuery = useQuery({
    queryKey: ['platform', 'plans'],
    queryFn: ({ signal }) => commercialPlatformApi.listPlans(signal),
  });
  const tenantsQuery = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: ({ signal }) => commercialPlatformApi.listTenants(signal),
  });
  const usersQuery = useQuery({
    queryKey: ['platform', 'users'],
    queryFn: ({ signal }) => commercialPlatformApi.listUsers(signal),
  });
  const auditQuery = useQuery({
    queryKey: ['platform', 'audit'],
    queryFn: ({ signal }) => commercialPlatformApi.listAudit(null, signal),
  });
  const usageQuery = useQuery({
    queryKey: ['platform', 'usage', usageTenantId],
    queryFn: ({ signal }) => commercialPlatformApi.getUsage(usageTenantId!, signal),
    enabled: Boolean(usageTenantId),
  });

  const packages = packagesQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const activePlans = useMemo(() => plans.filter((plan) => plan.isActive), [plans]);
  const tenants = tenantsQuery.data ?? [];
  const users = usersQuery.data ?? [];

  const filteredTenants = useMemo(() => {
    const query = customerSearch.trim().toLocaleLowerCase();
    if (!query) return tenants;
    return tenants.filter((tenant) => `${tenant.name} ${tenant.slug} ${tenant.plan?.name ?? ''}`.toLocaleLowerCase().includes(query));
  }, [customerSearch, tenants]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLocaleLowerCase();
    if (!query) return users;
    return users.filter((user) => `${user.fullName} ${user.email}`.toLocaleLowerCase().includes(query));
  }, [userSearch, users]);

  const activeSubscriptions = tenants.filter((tenant) => tenant.commercialStatus === 'Active').length;
  const suspendedWorkspaces = tenants.filter((tenant) => tenant.status === 'Suspended').length;

  const activateMutation = useMutation({
    mutationFn: ({ tenantId, planId }: { tenantId: string; planId: string }) => {
      const expiry = expiryByTenant[tenantId];
      return commercialPlatformApi.activateSubscription(tenantId, {
        planId,
        endsAt: expiry ? new Date(`${expiry}T23:59:59Z`).toISOString() : null,
        changeReason: reasonByTenant[tenantId] || null,
      });
    },
    onSuccess: async () => {
      setMessage('تم تغيير خطة العميل بأمان.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] }),
        queryClient.invalidateQueries({ queryKey: ['platform', 'audit'] }),
      ]);
    },
    onError: (error) => setMessage(mutationError(error)),
  });

  const tenantStatusMutation = useMutation({
    mutationFn: ({ tenantId, suspended }: { tenantId: string; suspended: boolean }) =>
      commercialPlatformApi.setTenantStatus(tenantId, suspended, suspended ? 'PlatformAdmin action' : 'Reactivated by PlatformAdmin'),
    onSuccess: async (_, variables) => {
      setMessage(variables.suspended ? 'تم إيقاف مساحة العمل.' : 'تمت إعادة تفعيل مساحة العمل.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] }),
        queryClient.invalidateQueries({ queryKey: ['platform', 'audit'] }),
      ]);
    },
    onError: (error) => setMessage(mutationError(error)),
  });

  const userStatusMutation = useMutation({
    mutationFn: ({ userId, suspended }: { userId: string; suspended: boolean }) =>
      commercialPlatformApi.setUserStatus(userId, suspended),
    onSuccess: async (_, variables) => {
      setMessage(variables.suspended
        ? 'تم إيقاف الحساب وتسجيل خروجه من الجلسات الطويلة.'
        : 'تمت إعادة تفعيل الحساب.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['platform', 'audit'] }),
      ]);
    },
    onError: (error) => setMessage(mutationError(error)),
  });

  const createPlanMutation = useMutation({
    mutationFn: (payload: CreatePlanRequest) => commercialPlatformApi.createPlan(payload),
    onSuccess: async () => {
      setMessage('تم إنشاء الخطة من عقد الباقة التجاري.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform', 'plans'] }),
        queryClient.invalidateQueries({ queryKey: ['platform', 'audit'] }),
      ]);
    },
    onError: (error) => setMessage(mutationError(error)),
  });

  function packageTemplate(): CommercialPackageCatalogItem | undefined {
    return packages.find((item) => item.package === selectedPackage);
  }

  function createPlan(event: FormEvent) {
    event.preventDefault();
    const template = packageTemplate();
    if (!template || !template.isAvailable || !planCode.trim() || !planName.trim()) return;
    createPlanMutation.mutate({
      code: planCode.trim().toLowerCase(),
      name: planName.trim(),
      isActive: true,
      contract: {
        contractVersion: 2,
        package: template.package,
        limits: { ...template.limits },
        entitlements: { ...template.entitlements, customDomain: false },
      },
    });
  }

  function choosePackage(packageName: string) {
    const template = packages.find((item) => item.package === packageName);
    setSelectedPackage(packageName);
    if (template) {
      setPlanCode(normalizePackageCode(packageName));
      setPlanName(template.displayName);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <header className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div aria-hidden="true" className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black text-amber-300">English Spark · Platform Control Plane</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">إدارة العملاء والخطط والاستخدام</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">إدارة تجارية يدوية وواضحة: لا بوابة دفع، ولا خطط يحددها العميل من المتصفح.</p>
          </div>
          <Link to="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/15">العودة إلى Studio</Link>
        </div>
      </header>

      {message ? <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900">{message}</p> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="ملخص المنصة">
        <SummaryCard label="العملاء" value={tenantsQuery.isLoading ? '…' : String(tenants.length)} note={suspendedWorkspaces ? `${suspendedWorkspaces} مساحة موقوفة` : 'كل المساحات متاحة'} />
        <SummaryCard label="اشتراكات نشطة" value={tenantsQuery.isLoading ? '…' : String(activeSubscriptions)} note="الحالة الفعلية الآن" />
        <SummaryCard label="الخطط" value={plansQuery.isLoading ? '…' : String(plans.length)} note="العقد التجاري V2" />
        <SummaryCard label="الحسابات" value={usersQuery.isLoading ? '…' : String(users.length)} note="PlatformAdmin منفصل عن tenant roles" />
      </section>

      <section className="space-y-4" aria-labelledby="customers-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="customers-heading" className="text-2xl font-black text-slate-950">العملاء / Workspaces</h2>
            <p className="mt-1 text-sm text-slate-500">ابحث بالاسم أو slug، ثم راجع الخطة والسعة والحالة وموعد الانتهاء.</p>
          </div>
          <label className="w-full sm:max-w-sm">
            <span className="sr-only">بحث في العملاء</span>
            <input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="ابحث باسم العميل أو workspace…" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
          </label>
        </div>

        {tenantsQuery.isError ? <ErrorBox text="تعذر تحميل العملاء." /> : null}
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredTenants.map((tenant) => (
            <WorkspaceCard
              key={tenant.id}
              tenant={tenant}
              plans={activePlans}
              selectedPlan={selectedPlans[tenant.id] ?? tenant.subscription?.planId ?? ''}
              expiry={expiryByTenant[tenant.id] ?? (tenant.subscription?.endsAt ? tenant.subscription.endsAt.slice(0, 10) : '')}
              reason={reasonByTenant[tenant.id] ?? ''}
              changingPlan={activateMutation.isPending && activateMutation.variables?.tenantId === tenant.id}
              changingStatus={tenantStatusMutation.isPending && tenantStatusMutation.variables?.tenantId === tenant.id}
              usageOpen={usageTenantId === tenant.id}
              onPlan={(planId) => setSelectedPlans((current) => ({ ...current, [tenant.id]: planId }))}
              onExpiry={(value) => setExpiryByTenant((current) => ({ ...current, [tenant.id]: value }))}
              onReason={(value) => setReasonByTenant((current) => ({ ...current, [tenant.id]: value }))}
              onActivate={(planId) => activateMutation.mutate({ tenantId: tenant.id, planId })}
              onStatus={(suspended) => tenantStatusMutation.mutate({ tenantId: tenant.id, suspended })}
              onUsage={() => setUsageTenantId((current) => current === tenant.id ? null : tenant.id)}
            />
          ))}
        </div>
        {!tenantsQuery.isLoading && filteredTenants.length === 0 ? <Empty text="لا يوجد عميل يطابق البحث." /> : null}

        {usageTenantId ? (
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-slate-950">الاستخدام الشهري والحالي</h3>
              <button type="button" onClick={() => setUsageTenantId(null)} className="min-h-11 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-white">إغلاق</button>
            </div>
            {usageQuery.isLoading ? <p className="mt-4 text-sm text-slate-500">جارٍ حساب الاستخدام من الخادم…</p> : null}
            {usageQuery.isError ? <ErrorBox text="تعذر حساب الاستخدام." /> : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {usageQuery.data?.metrics.map((metric) => (
                <div key={metric.metric} className={`rounded-xl border p-4 ${metric.nearLimit ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                  <p className="text-xs font-bold text-slate-500">{metric.metric}</p>
                  <p className="mt-2 text-xl font-black text-slate-950">{metric.value.toLocaleString('ar-EG')}</p>
                  <p className="mt-1 text-xs text-slate-500">الحد: {metric.limit?.toLocaleString('ar-EG') ?? 'غير محدد'}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]" aria-labelledby="plans-heading">
        <div className="space-y-4">
          <div>
            <h2 id="plans-heading" className="text-2xl font-black text-slate-950">الخطط الحالية</h2>
            <p className="mt-1 text-sm text-slate-500">كل خطة تقرأ Limits وEntitlements من الخادم، وليس من hints يرسلها العميل.</p>
          </div>
          {plansQuery.isError ? <ErrorBox text="تعذر تحميل الخطط." /> : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-black text-slate-950">إنشاء خطة من Package</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">القيم تبدأ من Teacher / Teacher Pro / Academy. لا توجد أسعار هنا، وSchool غير متاحة حاليًا.</p>
          <form onSubmit={createPlan} className="mt-5 space-y-4">
            <FormField id="package" label="Package">
              {(props) => (
                <SelectInput {...props} value={selectedPackage} onChange={(event) => choosePackage(event.target.value)}>
                  {packages.map((item) => <option key={item.package} value={item.package} disabled={!item.isAvailable}>{item.displayName}{!item.isAvailable ? ' — لاحقًا' : ''}</option>)}
                </SelectInput>
              )}
            </FormField>
            <FormField id="planCode" label="كود الخطة">
              {(props) => <TextInput {...props} dir="ltr" value={planCode} onChange={(event) => setPlanCode(event.target.value)} />}
            </FormField>
            <FormField id="planName" label="اسم الخطة">
              {(props) => <TextInput {...props} value={planName} onChange={(event) => setPlanName(event.target.value)} />}
            </FormField>
            <Button type="submit" disabled={createPlanMutation.isPending || !packageTemplate()?.isAvailable}>{createPlanMutation.isPending ? <ButtonSpinner /> : 'إنشاء الخطة'}</Button>
          </form>
          {packageTemplate() ? <PackagePreview item={packageTemplate()!} /> : null}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="users-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="users-heading" className="text-2xl font-black text-slate-950">الحسابات</h2>
            <p className="mt-1 text-sm text-slate-500">الإيقاف هنا للحساب العالمي، وهو منفصل عن إيقاف Workspace.</p>
          </div>
          <label className="w-full sm:max-w-sm">
            <span className="sr-only">بحث في الحسابات</span>
            <input type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="الاسم أو البريد…" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
          </label>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              isSelf={user.id === session.user?.id}
              pending={userStatusMutation.isPending && userStatusMutation.variables?.userId === user.id}
              onToggle={(suspended) => userStatusMutation.mutate({ userId: user.id, suspended })}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="audit-heading">
        <div>
          <h2 id="audit-heading" className="text-2xl font-black text-slate-950">سجل العمليات التجارية</h2>
          <p className="mt-1 text-sm text-slate-500">تغيير خطة، تفعيل، تعليق، وإعادة تفعيل — مع Request ID حين يكون متاحًا.</p>
        </div>
        {auditQuery.isError ? <ErrorBox text="تعذر تحميل سجل العمليات." /> : null}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {auditQuery.data?.map((entry) => (
            <div key={entry.id} className="grid gap-2 border-b border-slate-100 p-4 last:border-0 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-bold text-slate-900">{auditLabels[entry.action] ?? entry.action}</p>
                <p className="mt-1 text-xs text-slate-500">{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ''}</p>
              </div>
              <div className="text-xs text-slate-500 sm:text-left">
                <p>{new Date(entry.createdAt).toLocaleString('ar-EG')}</p>
                {entry.requestId ? <p dir="ltr" className="mt-1">{entry.requestId}</p> : null}
              </div>
            </div>
          ))}
          {!auditQuery.isLoading && (auditQuery.data?.length ?? 0) === 0 ? <Empty text="لا توجد عمليات مسجلة بعد." /> : null}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div>;
}

function WorkspaceCard({
  tenant,
  plans,
  selectedPlan,
  expiry,
  reason,
  changingPlan,
  changingStatus,
  usageOpen,
  onPlan,
  onExpiry,
  onReason,
  onActivate,
  onStatus,
  onUsage,
}: {
  tenant: PlatformTenant;
  plans: SaasPlan[];
  selectedPlan: string;
  expiry: string;
  reason: string;
  changingPlan: boolean;
  changingStatus: boolean;
  usageOpen: boolean;
  onPlan: (planId: string) => void;
  onExpiry: (value: string) => void;
  onReason: (value: string) => void;
  onActivate: (planId: string) => void;
  onStatus: (suspended: boolean) => void;
  onUsage: () => void;
}) {
  const suspended = tenant.status === 'Suspended';
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-lg font-black text-slate-950">{tenant.name}</h3><p dir="ltr" className="mt-1 text-xs text-slate-500">{tenant.slug}</p></div>
        <div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${suspended ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{statusLabel(tenant.status)}</span><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{statusLabel(tenant.commercialStatus)}</span></div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <UsageChip label="الطلاب" value={tenant.usage.students} />
        <UsageChip label="الأعضاء" value={tenant.usage.members} />
        <UsageChip label="الفصول" value={tenant.usage.classes} />
        <UsageChip label="التكليفات" value={tenant.usage.activeAssignments} />
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-bold text-slate-500">الخطة الحالية</p>
        <p className="mt-1 font-black text-slate-950">{tenant.plan?.name ?? (tenant.isGrandfathered ? 'حساب حالي محفوظ' : 'لا توجد خطة')}</p>
        {tenant.subscription?.endsAt ? <p className="mt-1 text-xs text-slate-500">تنتهي: {new Date(tenant.subscription.endsAt).toLocaleDateString('ar-EG')}</p> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-600">الخطة الجديدة<select aria-label={`خطة ${tenant.name}`} value={selectedPlan} onChange={(event) => onPlan(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="">اختر خطة</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.package}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">تاريخ الانتهاء — اختياري<input type="date" value={expiry} onChange={(event) => onExpiry(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" /></label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2">سبب التغيير — اختياري<input type="text" value={reason} onChange={(event) => onReason(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" placeholder="ترقية يدوية / تعديل سعة / اتفاق جديد…" /></label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={!selectedPlan || changingPlan} onClick={() => onActivate(selectedPlan)}>{changingPlan ? <ButtonSpinner /> : 'تغيير الخطة'}</Button>
        <Button variant="secondary" onClick={onUsage}>{usageOpen ? 'إخفاء الاستخدام' : 'عرض الاستخدام'}</Button>
        <Button variant="secondary" disabled={changingStatus} onClick={() => onStatus(!suspended)}>{changingStatus ? <ButtonSpinner /> : suspended ? 'إعادة تفعيل Workspace' : 'إيقاف Workspace'}</Button>
      </div>
    </article>
  );
}

function UsageChip({ label, value }: { label: string; value: number | null }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-2.5"><p className="text-[11px] font-bold text-slate-500">{label}</p><p className="mt-1 font-black text-slate-900">{value == null ? '—' : value.toLocaleString('ar-EG')}</p></div>;
}

function PlanCard({ plan }: { plan: SaasPlan }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-violet-700">{plan.package}</p><h3 className="mt-1 text-lg font-black text-slate-950">{plan.name}</h3><p dir="ltr" className="mt-1 text-xs text-slate-400">{plan.code} · contract v{plan.contractVersion}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${plan.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{plan.isActive ? 'فعالة' : 'غير فعالة'}</span></div>
      <div className="mt-4 grid grid-cols-2 gap-2">{limitLabels.slice(0, 5).map(([key, label]) => <div key={key} className="rounded-lg bg-slate-50 p-2.5"><p className="text-[11px] font-bold text-slate-500">{label}</p><p className="mt-1 font-black text-slate-900">{plan.limits[key].toLocaleString('ar-EG')}</p></div>)}</div>
      <div className="mt-4 flex flex-wrap gap-1.5">{entitlementLabels.map(([key, label]) => <span key={key} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${plan.entitlements[key] ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>{plan.entitlements[key] ? '✓' : '—'} {label}</span>)}</div>
    </article>
  );
}

function PackagePreview({ item }: { item: CommercialPackageCatalogItem }) {
  return <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-black text-slate-500">معاينة العقد</p><div className="mt-3 grid grid-cols-2 gap-2">{limitLabels.slice(0, 5).map(([key, label]) => <div key={key} className="rounded-lg bg-slate-50 p-2"><span className="text-xs text-slate-500">{label}</span><strong className="mt-1 block text-sm text-slate-900">{item.limits[key].toLocaleString('ar-EG')}</strong></div>)}</div></div>;
}

function UserCard({ user, isSelf, pending, onToggle }: { user: PlatformUser; isSelf: boolean; pending: boolean; onToggle: (suspended: boolean) => void }) {
  const suspended = user.status === 'Suspended';
  return <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-slate-950">{user.fullName}</h3><p dir="ltr" className="mt-1 text-sm text-slate-500">{user.email}</p><p className="mt-2 text-xs text-slate-500">{user.tenantCount} مساحة عمل · {user.platformRoles.length ? user.platformRoles.join(', ') : 'مستخدم عادي'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${suspended ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{statusLabel(user.status)}</span></div><div className="mt-4"><Button variant="secondary" disabled={pending || isSelf} onClick={() => onToggle(!suspended)}>{pending ? <ButtonSpinner /> : suspended ? 'إعادة تفعيل الحساب' : 'إيقاف الحساب'}</Button>{isSelf ? <p className="mt-2 text-xs text-slate-500">لا يمكنك إيقاف حسابك الإداري الحالي.</p> : null}</div></article>;
}

function ErrorBox({ text }: { text: string }) {
  return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{text}</p>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>;
}
