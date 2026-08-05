import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import QRCode from 'react-qr-code';
import { Button } from '../../../components/ui/button';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { sessionsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import {
  ATTEMPT_STATUS_LABELS,
  SESSION_STATUS_LABELS,
  type SessionDetail,
} from '../../../types/sessions';

/** /dashboard/sessions/:sessionId?quizId=… — تفاصيل الجلسة: تفعيل/إنهاء/إلغاء + المشاركون */
export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const quizId = searchParams.get('quizId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();

  const [actionError, setActionError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [copied, setCopied] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ['session-detail', tenantId, quizId, sessionId],
    queryFn: ({ signal }) => sessionsApi.get(tenantId!, quizId!, sessionId!, signal),
    enabled: Boolean(tenantId && quizId && sessionId),
    refetchInterval: 15_000, // تحديث دوري لمتابعة انضمام الطلاب
  });

  const stateMutation = useMutation({
    mutationFn: (action: 'activate' | 'finish' | 'cancel') => {
      const version = sessionQuery.data!.version;
      const payload = { baseVersion: version };
      if (action === 'activate') return sessionsApi.activate(tenantId!, quizId!, sessionId!, payload);
      if (action === 'finish') return sessionsApi.finish(tenantId!, quizId!, sessionId!, payload);
      return sessionsApi.cancel(tenantId!, quizId!, sessionId!, payload);
    },
    onSuccess: async () => {
      setActionError(null);
      setConflict(false);
      await queryClient.invalidateQueries({ queryKey: ['session-detail', tenantId, quizId, sessionId] });
      await queryClient.invalidateQueries({ queryKey: ['quiz-sessions', tenantId, quizId] });
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        setConflict(true);
        setActionError(null);
      } else if (error instanceof HttpError && error.status === 403) {
        setActionError('ليس لديك صلاحية إدارة هذه الجلسة.');
        setConflict(false);
      } else {
        setActionError('تعذر تنفيذ العملية. أعد المحاولة.');
        setConflict(false);
      }
    },
  });

  if (!tenantId) {
    navigate('/onboarding/choose', { replace: true });
    return null;
  }

  if (!quizId) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          رابط غير مكتمل — معرّف الاختبار مفقود.
        </p>
        <Link to="/dashboard/quizzes" className="text-sm text-sky-700 hover:underline">
          عودة لقائمة الاختبارات
        </Link>
      </div>
    );
  }

  if (sessionQuery.isLoading) {
    return <p className="text-sm text-slate-500">جارٍ تحميل الجلسة…</p>;
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    const error = sessionQuery.error;
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error instanceof HttpError && error.status === 404
            ? 'الجلسة غير موجودة.'
            : error instanceof HttpError && error.status === 403
              ? 'ليس لديك صلاحية عرض هذه الجلسة.'
              : 'تعذر تحميل البيانات. أعد المحاولة.'}
        </p>
        <Link
          to={`/dashboard/quizzes/${quizId}/sessions`}
          className="text-sm text-sky-700 hover:underline">
          عودة لجلسات الاختبار
        </Link>
      </div>
    );
  }

  const session: SessionDetail = sessionQuery.data;
  const playUrl = `${window.location.origin}/play/${session.joinCode}`;

  async function onCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {session.label ?? 'جلسة بدون عنوان'}
          </h1>
          <p className="text-sm text-slate-600">
            {session.quizTitle} · الإصدار v{session.quizVersionNumber} ·{' '}
            {SESSION_STATUS_LABELS[session.status] ?? session.status}
          </p>
        </div>
        <Link
          to={`/dashboard/quizzes/${quizId}/sessions`}
          className="min-h-11 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sky-600">
          عودة
        </Link>
      </div>

      {/* رمز الانضمام والمشاركة */}
      <section aria-labelledby="join-heading" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="join-heading" className="mb-3 text-base font-semibold text-slate-900">
          رمز الانضمام
        </h2>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col gap-2">
            <p dir="ltr" className="font-mono text-3xl font-bold tracking-[0.3em] text-slate-900">
              {session.joinCode}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onCopy(session.joinCode)}>
                {copied ? 'تم النسخ ✓' : 'نسخ الرمز'}
              </Button>
              <Button variant="secondary" onClick={() => onCopy(playUrl)}>
                نسخ الرابط
              </Button>
            </div>
            <p dir="ltr" className="font-mono text-xs text-slate-500">{playUrl}</p>
          </div>
          <div dir="ltr" className="rounded-lg border border-slate-200 bg-white p-3" data-testid="session-qr-code">
            <QRCode value={playUrl} size={120} />
          </div>
        </div>
      </section>

      {/* إجراءات الحالة */}
      {conflict ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">تعارض تعديل متزامن (409): تغيّرت حالة الجلسة. أعد التحميل ثم حاول مجددًا.</p>
          <Button variant="secondary" onClick={() => void sessionQuery.refetch()}>
            إعادة التحميل
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p>
      ) : null}

      <section aria-labelledby="actions-heading" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="actions-heading" className="mb-3 text-base font-semibold text-slate-900">
          إجراءات الجلسة
        </h2>
        <div className="flex flex-wrap gap-2">
          {session.status === 'Scheduled' ? (
            <Button
              onClick={() => stateMutation.mutate('activate')}
              disabled={stateMutation.isPending}>
              {stateMutation.isPending ? <ButtonSpinner /> : null}
              تفعيل الجلسة
            </Button>
          ) : null}
          {session.status === 'Active' ? (
            <Button
              variant="secondary"
              onClick={() => stateMutation.mutate('finish')}
              disabled={stateMutation.isPending}>
              {stateMutation.isPending ? <ButtonSpinner /> : null}
              إنهاء الجلسة
            </Button>
          ) : null}
          {session.status === 'Scheduled' || session.status === 'Active' ? (
            <Button
              variant="danger"
              onClick={() => stateMutation.mutate('cancel')}
              disabled={stateMutation.isPending}>
              {stateMutation.isPending ? <ButtonSpinner /> : null}
              إلغاء الجلسة
            </Button>
          ) : null}
          {session.status === 'Finished' || session.status === 'Cancelled' ? (
            <p className="text-sm text-slate-500">الجلسة مغلقة — لا توجد إجراءات متاحة.</p>
          ) : null}
        </div>
        {session.status === 'Scheduled' ? (
          <p className="mt-2 text-xs text-slate-500">
            لن يتمكن الطلاب من البدء حتى تفعيل الجلسة.
          </p>
        ) : null}
      </section>

      {/* المشاركون */}
      <section aria-labelledby="participants-heading" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="participants-heading" className="mb-3 text-base font-semibold text-slate-900">
          المشاركون ({session.participants.length})
        </h2>
        {session.participants.length === 0 ? (
          <p className="text-sm text-slate-500">لم ينضم أحد بعد. شارك رمز الانضمام مع الطلاب.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-start text-xs text-slate-500">
                  <th className="py-2 pe-3 text-start font-medium">الاسم</th>
                  <th className="py-2 pe-3 text-start font-medium">الحالة</th>
                  <th className="py-2 pe-3 text-start font-medium">الدرجة</th>
                  <th className="py-2 pe-3 text-start font-medium">النسبة</th>
                  <th className="py-2 text-start font-medium">النتيجة</th>
                </tr>
              </thead>
              <tbody>
                {session.participants.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 pe-3 font-medium text-slate-900">{p.displayName}</td>
                    <td className="py-2 pe-3 text-slate-600">
                      {p.attemptStatus ? ATTEMPT_STATUS_LABELS[p.attemptStatus] : 'لم يبدأ'}
                    </td>
                    <td className="py-2 pe-3 text-slate-600" dir="ltr">
                      {p.score != null && p.maxScore != null ? `${p.score} / ${p.maxScore}` : '—'}
                    </td>
                    <td className="py-2 pe-3 text-slate-600" dir="ltr">
                      {p.percentage != null ? `${Math.round(p.percentage)}%` : '—'}
                    </td>
                    <td className="py-2">
                      {p.passed == null ? (
                        <span className="text-slate-400">—</span>
                      ) : p.passed ? (
                        <span className="font-medium text-emerald-700">ناجح ✓</span>
                      ) : (
                        <span className="font-medium text-rose-700">راسب ✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
