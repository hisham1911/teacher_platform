import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { FormField, TextInput } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { platformApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import { updatePlatformUserStatus } from '../../data/api-client/platform-admin-actions';
import { useSessionSnapshot } from '../../features/auth/use-session';
import type { CreatePlanRequest, PlanLimits, PlatformTenant, PlatformUser } from '../../types/saas';

const DEFAULT_LIMITS: PlanLimits = {
  maxQuizzesPerTenant: 100,
  maxQuestionsPerQuiz: 200,
  maxPublishedQuizzesPerTenant: 50,
  maxAttemptsPerMonth: 10_000,
  maxStorageBytes: 5 * 1024 * 1024 * 1024,
  maxCertificatesPerMonth: 10_000,
};

const metricLabels: Record<string, string> = {
  PublishedQuizzes: 'الأنشطة المنشورة',
  Attempts: 'المحاولات هذا الشهر',
  StorageBytes: 'التخزين',
  CertificatesIssued: 'الشهادات هذا الشهر',
};

const auditLabels: Record<string, string> = {
  PlanCreated: 'إنشاء خطة',
  PlanUpdated: 'تعديل خطة',
  SubscriptionActivated: 'تفعيل اشتراك',
  UserSuspended: 'إيقاف حساب',
  UserRestored: 'إعادة تفعيل حساب',
};

function formatMetric(metric: string, value: number) {
  if (metric === 'StorageBytes') return `${(value / (1024 * 1024)).toLocaleString('ar-EG', { maximumFractionDigits: 1 })} م.ب`;
  return value.toLocaleString('ar-EG');
}

function mutationError(error: unknown) {
  if (error instanceof HttpError && error.status === 409) return 'البيانات تغيّرت بالفعل. حدّث الصفحة وحاول مرة أخرى.';
  if (error instanceof HttpError && error.status === 403) return 'ليس لديك صلاحية لتنفيذ هذه العملية.';
  if (error instanceof HttpError && error.status === 400) return 'لا يمكن تنفيذ هذه العملية على الحساب الحالي.';
  return 'تعذر تنفيذ العملية. حاول مرة أخرى.';
}

export default function PlatformAdminPage() {
  const queryClient = useQueryClient();
  const session = useSessionSnapshot();
  const [draft, setDraft] = useState<CreatePlanRequest>({ code: '', name: '', isActive: true, limits: DEFAULT_LIMITS });
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});
  const [usageTenantId, setUsageTenantId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const plansQuery = useQuery({ queryKey: ['platform', 'plans'], queryFn: ({ signal }) => platformApi.listPlans(signal) });
  const tenantsQuery = useQuery({ queryKey: ['platform', 'tenants'], queryFn: ({ signal }) => platformApi.listTenants(signal) });
  const usersQuery = useQuery({ queryKey: ['platform', 'users'], queryFn: ({ signal }) => platformApi.listUsers(signal) });
  const auditQuery = useQuery({ queryKey: ['platform', 'audit'], queryFn: ({ signal }) => platformApi.listAudit(signal) });
  const usageQuery = useQuery({ queryKey: ['platform', 'usage', usageTenantId], queryFn: ({ signal }) => platformApi.getUsage(usageTenantId!, signal), enabled: Boolean(usageTenantId) });

  const activePlans = useMemo(() => plansQuery.data?.filter((plan) => plan.isActive) ?? [], [plansQuery.data]);
  const tenants = tenantsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLocaleLowerCase();
    if (!query) return users;
    return users.filter((user) => `${user.fullName} ${user.email}`.toLocaleLowerCase().includes(query));
  }, [userSearch, users]);
  const activeSubscriptions = tenants.filter((tenant) => tenant.subscription?.status === 'Active').length;
  const suspendedUsers = users.filter((user) => user.status === 'Suspended').length;

  const createMutation = useMutation({
    mutationFn: () => platformApi.createPlan(draft),
    onSuccess: async () => {
      setDraft({ code: '', name: '', isActive: true, limits: DEFAULT_LIMITS });
      setMessage('تم إنشاء الخطة.');
      await queryClient.invalidateQueries({ queryKey: ['platform', 'plans'] });
    },
    onError: (error) => setMessage(mutationError(error)),
  });

  const activateMutation = useMutation({
    mutationFn: ({ tenantId, planId }: { tenantId: string; planId: string }) => platformApi.activateSubscription(tenantId, planId),
    onSuccess: async () => {
      setMessage('تم تفعيل الاشتراك.');
      await queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      if (usageTenantId) await queryClient.invalidateQueries({ queryKey: ['platform', 'usage', usageTenantId] });
    },
    onError: (error) => setMessage(mutationError(error)),
  });

  const userStatusMutation = useMutation({
    mutationFn: ({ userId, suspended }: { userId: string; suspended: boolean }) => updatePlatformUserStatus(userId, suspended),
    onSuccess: async (_, variables) => {
      setMessage(variables.suspended ? 'تم إيقاف الحساب وتسجيل خروجه من الجلسات الطويلة.' : 'تمت إعادة تفعيل الحساب.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['platform', 'audit'] }),
      ]);
    },
    onError: (error) => setMessage(mutationError(error)),
  });

  function submitPlan(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    createMutation.mutate();
  }

  function updateLimit(key: keyof PlanLimits, value: string) {
    const parsed = Number(value);
    setDraft((current) => ({ ...current, limits: { ...current.limits, [key]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 } }));
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <header className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div aria-hidden="true" className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-amber-300">إدارة المنصة</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">الحسابات والعملاء والاشتراكات</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">من هنا تراجع الحسابات، توقف أو تعيد تفعيل مستخدم، وتدير خطط العملاء واشتراكاتهم.</p>
          </div>
          <Link to="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/15">العودة إلى Studio</Link>
        </div>
      </header>

      {message ? <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900">{message}</p> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="ملخص المنصة">
        <SummaryCard icon="👥" label="الحسابات" value={usersQuery.isLoading ? '…' : String(users.length)} note={suspendedUsers ? `${suspendedUsers} موقوف` : 'كل الحسابات نشطة'} />
        <SummaryCard icon="🏢" label="العملاء" value={tenantsQuery.isLoading ? '…' : String(tenants.length)} note="مساحات عمل مستقلة" />
        <SummaryCard icon="💳" label="اشتراكات نشطة" value={tenantsQuery.isLoading ? '…' : String(activeSubscriptions)} note="يمكن تغيير الخطة من هنا" />
        <SummaryCard icon="📦" label="الخطط" value={plansQuery.isLoading ? '…' : String(plansQuery.data?.length ?? 0)} note="حدود كل باقة" />
      </section>

      <nav className="teacher-surface flex gap-2 overflow-x-auto p-2 text-sm font-bold" aria-label="أقسام الإدارة">
        <a href="#users" className="min-h-11 whitespace-nowrap rounded-xl bg-violet-50 px-4 content-center text-violet-800">الحسابات</a>
        <a href="#customers" className="min-h-11 whitespace-nowrap rounded-xl px-4 content-center text-slate-600 hover:bg-slate-50">العملاء والاشتراكات</a>
        <a href="#plans" className="min-h-11 whitespace-nowrap rounded-xl px-4 content-center text-slate-600 hover:bg-slate-50">الخطط</a>
        <a href="#audit" className="min-h-11 whitespace-nowrap rounded-xl px-4 content-center text-slate-600 hover:bg-slate-50">سجل العمليات</a>
      </nav>

      <section id="users" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-2xl font-black text-slate-950">الحسابات</h2><p className="mt-1 text-sm text-slate-500">ابحث بالاسم أو البريد، ثم أوقف الحساب أو أعد تفعيله عند الحاجة.</p></div>
          <label className="w-full sm:max-w-xs"><span className="sr-only">بحث في الحسابات</span><input type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="ابحث بالاسم أو البريد…" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" /></label>
        </div>
        {usersQuery.isLoading ? <Loading text="جارٍ تحميل الحسابات…" /> : null}
        {usersQuery.isError ? <ErrorBox text="تعذر تحميل الحسابات." /> : null}
        {filteredUsers.length > 0 ? <div className="grid gap-3 lg:grid-cols-2">{filteredUsers.map((user) => <UserCard key={user.id} user={user} isSelf={user.id === session.user?.id} pending={userStatusMutation.isPending && userStatusMutation.variables?.userId === user.id} onToggle={(suspended) => userStatusMutation.mutate({ userId: user.id, suspended })} />)}</div> : null}
        {!usersQuery.isLoading && filteredUsers.length === 0 ? <Empty text={userSearch ? 'لا يوجد حساب يطابق البحث.' : 'لا توجد حسابات بعد.'} /> : null}
      </section>

      <section id="customers" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black text-slate-950">العملاء والاشتراكات</h2><p className="mt-1 text-sm text-slate-500">كل عميل له مساحة عمل مستقلة. من هنا تختار خطته وتراجع استخدامه.</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">{tenants.length} عميل</span></div>
        {tenantsQuery.isLoading ? <Loading text="جارٍ تحميل العملاء…" /> : null}
        {tenantsQuery.isError ? <ErrorBox text="تعذر تحميل العملاء." /> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          {tenants.map((tenant) => (
            <CustomerCard key={tenant.id} tenant={tenant} plans={activePlans} selectedPlan={selectedPlans[tenant.id] ?? tenant.subscription?.planId ?? ''} pending={activateMutation.isPending} usageOpen={usageTenantId === tenant.id} onSelect={(planId) => setSelectedPlans((current) => ({ ...current, [tenant.id]: planId }))} onActivate={(planId) => activateMutation.mutate({ tenantId: tenant.id, planId })} onUsage={() => setUsageTenantId((current) => current === tenant.id ? null : tenant.id)} />
          ))}
        </div>
        {tenants.length === 0 && !tenantsQuery.isLoading ? <Empty text="لا يوجد عملاء حتى الآن." /> : null}
        {usageTenantId ? <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-black text-slate-950">استخدام العميل</h3><button type="button" onClick={() => setUsageTenantId(null)} className="min-h-11 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-white">إغلاق</button></div>{usageQuery.isLoading ? <Loading text="جارٍ حساب الاستخدام…" /> : null}{usageQuery.isError ? <ErrorBox text="تعذر حساب الاستخدام." /> : null}<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{usageQuery.data?.metrics.map((metric) => <div key={metric.metric} className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{metricLabels[metric.metric] ?? metric.metric}</p><p className="mt-2 text-xl font-black text-slate-950">{formatMetric(metric.metric, metric.value)}</p><p className="mt-1 text-xs text-slate-400">الحد: {metric.limit == null ? 'غير محدد' : formatMetric(metric.metric, metric.limit)}</p></div>)}</div></div> : null}
      </section>

      <section id="plans" className="scroll-mt-24 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <div><div><h2 className="text-2xl font-black text-slate-950">الخطط</h2><p className="mt-1 text-sm text-slate-500">راجع حدود كل خطة قبل تفعيلها لعميل.</p></div>{plansQuery.isLoading ? <Loading text="جارٍ تحميل الخطط…" /> : null}{plansQuery.isError ? <ErrorBox text="تعذر تحميل الخطط." /> : null}<div className="mt-4 grid gap-3 sm:grid-cols-2">{plansQuery.data?.map((plan) => <article key={plan.id} className="teacher-surface p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black text-slate-950">{plan.name}</h3><p dir="ltr" className="mt-1 text-left font-mono text-xs text-slate-400">{plan.code}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${plan.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{plan.isActive ? 'نشطة' : 'متوقفة'}</span></div><dl className="mt-4 grid grid-cols-2 gap-2 text-xs"><Limit label="الأنشطة" value={plan.limits.maxQuizzesPerTenant} /><Limit label="أسئلة/نشاط" value={plan.limits.maxQuestionsPerQuiz} /><Limit label="المنشورة" value={plan.limits.maxPublishedQuizzesPerTenant} /><Limit label="محاولات/شهر" value={plan.limits.maxAttemptsPerMonth} /><Limit label="تخزين م.ب" value={Math.round(plan.limits.maxStorageBytes / (1024 * 1024))} /><Limit label="شهادات/شهر" value={plan.limits.maxCertificatesPerMonth} /></dl></article>)}</div></div>
        <form onSubmit={submitPlan} className="teacher-surface h-fit p-5 sm:p-6"><h2 className="text-xl font-black text-slate-950">خطة جديدة</h2><p className="mt-1 text-sm text-slate-500">حدد الاسم والكود والحدود.</p><div className="mt-5 grid gap-4"><FormField id="plan-name" label="اسم الخطة">{(props) => <TextInput {...props} required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="مثال: Pro" />}</FormField><FormField id="plan-code" label="كود الخطة بالإنجليزية">{(props) => <TextInput {...props} dir="ltr" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={40} value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toLowerCase() })} placeholder="pro" />}</FormField><div className="grid grid-cols-2 gap-3"><NumberField label="الأنشطة" value={draft.limits.maxQuizzesPerTenant} onChange={(value) => updateLimit('maxQuizzesPerTenant', value)} /><NumberField label="أسئلة/نشاط" value={draft.limits.maxQuestionsPerQuiz} onChange={(value) => updateLimit('maxQuestionsPerQuiz', value)} /><NumberField label="المنشورة" value={draft.limits.maxPublishedQuizzesPerTenant} onChange={(value) => updateLimit('maxPublishedQuizzesPerTenant', value)} /><NumberField label="محاولات/شهر" value={draft.limits.maxAttemptsPerMonth} onChange={(value) => updateLimit('maxAttemptsPerMonth', value)} /><NumberField label="التخزين (م.ب)" value={Math.round(draft.limits.maxStorageBytes / (1024 * 1024))} onChange={(value) => updateLimit('maxStorageBytes', String(Number(value) * 1024 * 1024))} /><NumberField label="شهادات/شهر" value={draft.limits.maxCertificatesPerMonth} onChange={(value) => updateLimit('maxCertificatesPerMonth', value)} /></div><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? <ButtonSpinner /> : null}{createMutation.isPending ? 'جارٍ الإنشاء…' : 'إنشاء الخطة'}</Button></div></form>
      </section>

      <section id="audit" className="scroll-mt-24"><div><h2 className="text-2xl font-black text-slate-950">سجل العمليات</h2><p className="mt-1 text-sm text-slate-500">آخر العمليات الإدارية التي تمت على المنصة.</p></div>{auditQuery.isLoading ? <Loading text="جارٍ تحميل السجل…" /> : null}{auditQuery.isError ? <ErrorBox text="تعذر تحميل سجل العمليات." /> : null}<div className="mt-4 space-y-2">{auditQuery.data?.slice(0, 50).map((entry) => <article key={entry.id} className="teacher-surface flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-slate-950">{auditLabels[entry.action] ?? entry.action}</p><p className="mt-1 text-xs text-slate-500">{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ''}</p></div><div className="text-xs text-slate-400 sm:text-left"><p>{new Date(entry.createdAt).toLocaleString('ar-EG')}</p><p dir="ltr" className="mt-1 font-mono">{entry.tenantId ?? 'platform'}</p></div></article>)}</div></section>
    </div>
  );
}

function UserCard({ user, isSelf, pending, onToggle }: { user: PlatformUser; isSelf: boolean; pending: boolean; onToggle: (suspended: boolean) => void }) {
  const suspended = user.status === 'Suspended';
  return (
    <article className={`teacher-surface p-5 ${suspended ? 'border-rose-200 bg-rose-50/30' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="truncate text-base font-black text-slate-950">{user.fullName || 'بدون اسم'}</h3><p dir="ltr" className="mt-1 truncate text-left text-xs text-slate-500">{user.email}</p></div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${suspended ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{suspended ? 'موقوف' : 'نشط'}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{user.tenantCount} مساحة عمل</span><span className={`rounded-lg px-2.5 py-1.5 ${user.emailConfirmed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{user.emailConfirmed ? 'البريد مؤكد' : 'البريد غير مؤكد'}</span>{user.platformRoles.includes('PlatformAdmin') ? <span className="rounded-lg bg-amber-100 px-2.5 py-1.5 font-bold text-amber-900">مدير المنصة</span> : null}</div>
      <div className="mt-4 border-t border-slate-100 pt-4">
        {isSelf ? <p className="text-xs font-semibold text-slate-500">هذا حسابك الحالي، لذلك لا يمكن إيقافه من هنا.</p> : <button type="button" disabled={pending} onClick={() => onToggle(!suspended)} className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-bold disabled:opacity-50 ${suspended ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'}`}>{pending ? 'جارٍ التنفيذ…' : suspended ? 'إعادة تفعيل الحساب' : 'إيقاف الحساب'}</button>}
      </div>
    </article>
  );
}

function SummaryCard({ icon, label, value, note }: { icon: string; label: string; value: string; note: string }) {
  return <article className="teacher-surface p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><span aria-hidden="true" className="text-2xl">{icon}</span><span className="text-2xl font-black text-slate-950 sm:text-3xl">{value}</span></div><p className="mt-3 text-sm font-black text-slate-900">{label}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>;
}

function CustomerCard({ tenant, plans, selectedPlan, pending, usageOpen, onSelect, onActivate, onUsage }: { tenant: PlatformTenant; plans: Array<{ id: string; name: string }>; selectedPlan: string; pending: boolean; usageOpen: boolean; onSelect: (planId: string) => void; onActivate: (planId: string) => void; onUsage: () => void }) {
  return <article className="teacher-surface p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black text-slate-950">{tenant.name}</h3><p dir="ltr" className="mt-1 text-left font-mono text-xs text-slate-400">{tenant.slug}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${tenant.subscription?.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{tenant.subscription?.planName ?? 'بدون خطة'}</span></div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><p>الحالة: <b className="text-slate-800">{tenant.status}</b></p><p className="mt-1">تاريخ الإنشاء: {new Date(tenant.createdAt).toLocaleDateString('ar-EG')}</p></div><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><select value={selectedPlan} onChange={(event) => onSelect(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800"><option value="">اختر خطة…</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><Button disabled={!selectedPlan || pending} onClick={() => onActivate(selectedPlan)}>{pending ? 'جارٍ…' : tenant.subscription?.planId === selectedPlan ? 'إعادة التفعيل' : 'تفعيل الخطة'}</Button></div><button type="button" onClick={onUsage} className={`mt-3 min-h-11 w-full rounded-xl border px-3 text-sm font-black ${usageOpen ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{usageOpen ? 'إخفاء الاستخدام' : 'عرض الاستخدام'}</button></article>;
}

function Limit({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-black text-slate-950">{value.toLocaleString('ar-EG')}</dd></div>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) { return <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">{label}<input type="number" min={0} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900" /></label>; }
function Loading({ text }: { text: string }) { return <p role="status" className="mt-4 animate-pulse text-sm font-bold text-slate-500">{text}</p>; }
function ErrorBox({ text }: { text: string }) { return <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{text}</p>; }
function Empty({ text }: { text: string }) { return <p className="teacher-surface p-8 text-center text-sm text-slate-500">{text}</p>; }
