import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import QRCode from 'react-qr-code';
import { TeacherIcon } from '../../../components/ui/teacher-icon';
import { sessionsApi } from '../../../data/api-client/endpoints';
import { getActivityModeDefinition, parseActivityMode } from '../../../features/activities/activity-mode';
import { getActiveTenantId } from '../../../lib/auth/session';

type CopyState = 'link' | 'message' | null;

export default function ActivityReadyPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();
  const sessionId = searchParams.get('sessionId');
  const mode = parseActivityMode(searchParams.get('mode'));
  const modeDefinition = getActivityModeDefinition(mode);
  const [copied, setCopied] = useState<CopyState>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const sessionQuery = useQuery({ queryKey: ['session-detail', tenantId, quizId, sessionId], queryFn: ({ signal }) => sessionsApi.get(tenantId!, quizId!, sessionId!, signal), enabled: Boolean(tenantId && quizId && sessionId) });
  const activateMutation = useMutation({
    mutationFn: async () => {
      const session = sessionQuery.data!;
      return sessionsApi.activate(tenantId!, quizId!, session.id, { baseVersion: session.version });
    },
    onSuccess: async (session) => {
      queryClient.setQueryData(['session-detail', tenantId, quizId, sessionId], session);
      if (mode === 'Live') navigate(`/dashboard/sessions/${session.id}/live?quizId=${quizId}`);
    },
  });

  if (!tenantId) return null;
  if (!sessionId) return <p role="alert" className="teacher-surface p-5 text-sm font-bold text-rose-800">رابط النشاط غير مكتمل.</p>;
  if (sessionQuery.isLoading) return <div role="status" className="teacher-surface mx-auto max-w-3xl animate-pulse p-8 text-sm text-slate-600">جارٍ تجهيز النشاط…</div>;
  if (sessionQuery.isError || !sessionQuery.data) return <div className="teacher-surface mx-auto max-w-3xl p-6"><p role="alert" className="font-bold text-rose-800">تعذر تحميل النشاط.</p><button type="button" onClick={() => void sessionQuery.refetch()} className="mt-4 min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold">إعادة المحاولة</button></div>;

  const session = sessionQuery.data;
  const playUrl = `${window.location.origin}/play/${session.joinCode}`;
  const isReadyForStudents = session.status === 'Active';
  const studentMessage = `English Spark ✨\n${session.quizTitle}\n\nافتح النشاط من هنا:\n${playUrl}\n\nكود النشاط: ${session.joinCode}`;

  async function copyText(value: string, state: Exclude<CopyState, null>) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError(null);
      setCopied(state);
      window.setTimeout(() => setCopied((current) => current === state ? null : current), 2000);
    } catch {
      setCopied(null);
      setCopyError('النسخ التلقائي لم يعمل. يمكنك نسخ الرابط أو الكود يدويًا.');
    }
  }

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_24px_70px_rgb(76_29_149/0.1)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-800 via-indigo-800 to-slate-950 px-5 py-9 text-center text-white sm:px-10 sm:py-11">
          <span aria-hidden="true" className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" /><span aria-hidden="true" className="absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="relative"><span aria-hidden="true" className="spark-brand-mark mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-600 text-3xl text-white">✦</span><h1 className="mt-5 text-3xl font-bold sm:text-4xl">{mode === 'Live' ? 'المسابقة جاهزة' : 'النشاط جاهز 🎉'}</h1><p dir="auto" className="mx-auto mt-3 max-w-2xl text-lg font-bold text-white">{session.quizTitle}</p><p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-violet-200">{modeDefinition.title}</p></div>
        </div>

        <div className="p-4 sm:p-8">
          {mode === 'Live' && session.status === 'Scheduled' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center sm:p-7"><span aria-hidden="true" className="text-3xl">⚡</span><h2 className="mt-3 text-xl font-bold text-amber-950">ابدأ عندما يكون الطلاب جاهزين</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-amber-900">عند الضغط على البدء سيفتح دخول الطلاب وتنتقل إلى شاشة إدارة المسابقة.</p><button type="button" onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending} className="mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 text-base font-bold text-white shadow-sm hover:bg-violet-800 disabled:opacity-50 sm:w-auto"><TeacherIcon name="play" />{activateMutation.isPending ? 'جارٍ البدء…' : 'بدء المسابقة'}</button></div>
          ) : (
            <div>
              <div className="text-center"><div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${isReadyForStudents ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}><span aria-hidden="true">{isReadyForStudents ? '●' : '○'}</span>{isReadyForStudents ? 'الدخول مفتوح للطلاب' : 'النشاط يحتاج تفعيلًا'}</div><h2 className="mt-4 text-2xl font-bold text-slate-950">جرّبه، ثم شاركه</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-600">افتح النشاط كطالب للتأكد منه. بعدها انسخ الرابط أو الرسالة الجاهزة وأرسلها.</p></div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-stretch">
                <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-5 sm:p-6">
                  <p className="text-xs font-bold text-violet-700">كود النشاط</p><p dir="ltr" className="mt-2 font-mono text-3xl font-bold tracking-[0.14em] text-slate-950">{session.joinCode}</p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3"><a href={playUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-13 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm hover:bg-slate-800">👀 تجربة كطالب</a><button type="button" onClick={() => void copyText(playUrl, 'link')} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-violet-800 hover:shadow-md"><span aria-hidden="true">{copied === 'link' ? '✓' : '🔗'}</span>{copied === 'link' ? 'تم نسخ الرابط' : 'نسخ الرابط'}</button><button type="button" onClick={() => void copyText(studentMessage, 'message')} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-sm font-bold text-violet-800 shadow-sm transition hover:bg-violet-50"><span aria-hidden="true">{copied === 'message' ? '✓' : '💬'}</span>{copied === 'message' ? 'تم نسخ الرسالة' : 'نسخ رسالة للطلاب'}</button></div>
                  {copyError ? <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{copyError}</p> : null}
                  <details className="mt-5 text-sm text-slate-500"><summary className="cursor-pointer font-semibold text-slate-600">عرض الرابط كاملًا</summary><div dir="ltr" className="mt-2 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 font-mono text-xs text-white">{playUrl}</div></details>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="activity-qr-code"><QRCode value={playUrl} size={168} /><p className="mt-3 text-xs font-semibold text-slate-500">يمكن للطالب مسحه بالكاميرا</p></div>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center">
                <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm ring-1 ring-emerald-100">👥</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-emerald-950">طلابك لديهم أكواد ثابتة؟</p>
                  <p className="mt-1 text-sm leading-7 text-emerald-900">أرسل نفس رابط النشاط للجميع. الطالب يختار «لدي كود طالب» ويدخل كوده، فتُحفظ النتيجة في ملفه.</p>
                </div>
                <Link to="/dashboard/students" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-100">فتح الطلاب</Link>
              </div>
            </div>
          )}

          {activateMutation.isError ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-800">تعذر بدء المسابقة. النشاط محفوظ؛ حاول مرة أخرى.</p> : null}

          <div className="mt-7 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2"><Link to={`/dashboard/activities/${quizId}/build?mode=${mode}`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-violet-50 hover:text-violet-800">تعديل الأسئلة</Link><details className="relative"><summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-xl px-3 text-sm font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-700">خيارات أخرى</summary><Link to={`/dashboard/quizzes/${quizId}/sessions`} className="mt-1 block rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 hover:text-violet-800">الجلسات السابقة</Link></details></div><Link to="/dashboard/activities/new" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-5 text-sm font-bold text-violet-800 hover:bg-violet-100">+ نشاط جديد</Link></div>
        </div>
      </section>
    </div>
  );
}
