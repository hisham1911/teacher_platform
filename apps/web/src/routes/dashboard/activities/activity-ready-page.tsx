import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import QRCode from 'react-qr-code';
import { TeacherIcon } from '../../../components/ui/teacher-icon';
import { sessionsApi } from '../../../data/api-client/endpoints';
import { getActivityModeDefinition, parseActivityMode } from '../../../features/activities/activity-mode';
import { getActiveTenantId } from '../../../lib/auth/session';

export default function ActivityReadyPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();
  const sessionId = searchParams.get('sessionId');
  const mode = parseActivityMode(searchParams.get('mode'));
  const modeDefinition = getActivityModeDefinition(mode);
  const [copied, setCopied] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ['session-detail', tenantId, quizId, sessionId],
    queryFn: ({ signal }) => sessionsApi.get(tenantId!, quizId!, sessionId!, signal),
    enabled: Boolean(tenantId && quizId && sessionId),
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const session = sessionQuery.data!;
      return sessionsApi.activate(tenantId!, quizId!, session.id, { baseVersion: session.version });
    },
    onSuccess: async (session) => {
      queryClient.setQueryData(['session-detail', tenantId, quizId, sessionId], session);
      if (mode === 'Live') {
        navigate(`/dashboard/sessions/${session.id}/live?quizId=${quizId}`);
      }
    },
  });

  if (!tenantId) return null;
  if (!sessionId) return <p role="alert" className="teacher-surface p-5 text-sm font-bold text-rose-800">رابط التجهيز غير مكتمل.</p>;

  if (sessionQuery.isLoading) {
    return <div role="status" className="teacher-surface mx-auto max-w-3xl animate-pulse p-8 text-sm text-slate-600">جارٍ تجهيز رابط النشاط…</div>;
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <div className="teacher-surface mx-auto max-w-3xl p-6">
        <p role="alert" className="font-bold text-rose-800">تعذر تحميل النشاط الجاهز.</p>
        <button type="button" onClick={() => void sessionQuery.refetch()} className="mt-4 min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold">إعادة المحاولة</button>
      </div>
    );
  }

  const session = sessionQuery.data;
  const playUrl = `${window.location.origin}/play/${session.joinCode}`;
  const isReadyForStudents = session.status === 'Active';

  async function copyPlayUrl() {
    try {
      await navigator.clipboard.writeText(playUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <section className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-900 px-6 py-10 text-center text-white sm:px-10">
          <span aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-3xl">✨</span>
          <p className="mt-5 text-sm font-black text-amber-200">English Spark</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{mode === 'Live' ? 'المسابقة جاهزة' : 'النشاط جاهز 🎉'}</h1>
          <p dir="auto" className="mx-auto mt-3 max-w-2xl text-lg font-bold text-violet-100">{session.quizTitle}</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-violet-200">{modeDefinition.title} · {modeDefinition.description}</p>
        </div>

        <div className="p-5 sm:p-8">
          {mode === 'Live' && session.status === 'Scheduled' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
              <h2 className="text-xl font-black text-amber-950">ابدئي المسابقة عندما يكون الفصل جاهزًا</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-amber-900">سنفعّل دخول الطلاب ونفتح لك لوحة المسابقة المباشرة في خطوة واحدة.</p>
              <button type="button" onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending} className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 text-sm font-black text-white hover:bg-violet-800 disabled:opacity-50">
                <TeacherIcon name="play" />
                {activateMutation.isPending ? 'جارٍ البدء…' : 'ابدئي المسابقة الآن'}
              </button>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${isReadyForStudents ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                  <span aria-hidden="true">{isReadyForStudents ? '●' : '○'}</span>
                  {isReadyForStudents ? 'جاهز للطلاب الآن' : 'يحتاج تفعيلًا'}
                </div>
                <h2 className="mt-4 text-2xl font-black text-slate-950">رابط الطلاب</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">أرسلي هذا الرابط للطلاب. لا يحتاجون إلى حساب؛ يكتب الطالب اسمه ويبدأ.</p>
                <div dir="ltr" className="mt-4 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 font-mono text-sm text-white">{playUrl}</div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={() => void copyPlayUrl()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-black text-white hover:bg-violet-800">
                    {copied ? 'تم نسخ الرابط ✓' : 'نسخ رابط الطلاب'}
                  </button>
                  <a href={playUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:border-violet-400 hover:text-violet-800">تجربة النشاط</a>
                </div>
              </div>
              <div className="mx-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="activity-qr-code">
                <QRCode value={playUrl} size={164} />
              </div>
            </div>
          )}

          {activateMutation.isError ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-800">تعذر بدء المسابقة. حاولي مرة أخرى؛ النشاط محفوظ ولن تفقدي الأسئلة.</p> : null}

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <Link to={`/dashboard/activities/${quizId}/build?mode=${mode}`} className="inline-flex min-h-11 items-center text-sm font-bold text-slate-600 hover:text-violet-800">تعديل الأسئلة</Link>
              <Link to={`/dashboard/quizzes/${quizId}/sessions`} className="inline-flex min-h-11 items-center text-sm font-bold text-slate-500 hover:text-slate-800">إدارة متقدمة</Link>
            </div>
            <Link to="/dashboard/activities/new" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-black text-violet-800 hover:bg-violet-100">+ نشاط جديد</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
