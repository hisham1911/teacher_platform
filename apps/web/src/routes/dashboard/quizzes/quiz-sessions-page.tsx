import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import QRCode from 'react-qr-code';
import { Button } from '../../../components/ui/button';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { FormField, TextInput } from '../../../components/ui/form-field';
import { sessionsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import {
  SESSION_MODE_LABELS,
  SESSION_STATUS_LABELS,
  type SessionMode,
  type SessionDetail,
} from '../../../types/sessions';

/** /dashboard/quizzes/:quizId/sessions — إدارة جلسات الاختبار (Phase 4) */
export default function QuizSessionsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();

  const [label, setLabel] = useState('');
  const [mode, setMode] = useState<SessionMode>('SelfPaced');
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<SessionDetail | null>(null);
  const [copied, setCopied] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ['quiz-sessions', tenantId, quizId],
    queryFn: ({ signal }) => sessionsApi.list(tenantId!, quizId!, 1, 50, signal),
    enabled: Boolean(tenantId && quizId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      sessionsApi.create(tenantId!, quizId!, {
        mode,
        label: label.trim() || null,
      }),
    onSuccess: async (result) => {
      setCreated(result);
      setCreateError(null);
      setLabel('');
      await queryClient.invalidateQueries({ queryKey: ['quiz-sessions', tenantId, quizId] });
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 400) {
        const body = error.body as { title?: string; detail?: string } | null;
        setCreateError(body?.detail ?? 'تعذر إنشاء الجلسة. تأكد من نشر الاختبار أولًا.');
      } else if (error instanceof HttpError && error.status === 403) {
        setCreateError('ليس لديك صلاحية إدارة جلسات هذا الاختبار.');
      } else if (error instanceof HttpError && error.status === 404) {
        setCreateError('الاختبار غير موجود.');
      } else {
        setCreateError('تعذر إنشاء الجلسة. تحقق من الاتصال.');
      }
    },
  });

  if (!tenantId) {
    navigate('/onboarding/choose', { replace: true });
    return null;
  }

  function playUrl(joinCode: string): string {
    return `${window.location.origin}/play/${joinCode}`;
  }

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
          <h1 className="text-xl font-bold text-slate-900">جلسات الاختبار</h1>
          <p className="text-sm text-slate-600">
            أنشئ جلسة ذاتية الإيقاع أو مسابقة مباشرة وشارك رمز الانضمام مع الطلاب.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/dashboard/quizzes/${quizId}/edit`}
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
            تعديل الاختبار
          </Link>
          <Link
            to="/dashboard/quizzes"
            className="min-h-11 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sky-600">
            عودة
          </Link>
        </div>
      </div>

      {/* إنشاء جلسة جديدة */}
      <section aria-labelledby="create-session-heading" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="create-session-heading" className="mb-3 text-base font-semibold text-slate-900">
          جلسة جديدة
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCreateError(null);
            createMutation.mutate();
          }}
          className="flex flex-col gap-3">
          <FormField id="session-label" label="عنوان الجلسة (اختياري)">
            {({ id }) => (
              <TextInput
                id={id}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={200}
                placeholder="مثال: حصة الأحد — الصف الثالث"
              />
            )}
          </FormField>
          <FormField id="session-mode" label="نمط الجلسة">
            {({ id }) => (
              <select
                id={id}
                value={mode}
                onChange={(event) => setMode(event.target.value as SessionMode)}
                className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200">
                <option value="SelfPaced">ذاتي الإيقاع — كل طالب يتقدم منفردًا</option>
                <option value="Live">مباشر — المعلم يفتح الأسئلة للجميع</option>
              </select>
            )}
          </FormField>
          {createError ? (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {createError}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <ButtonSpinner /> : null}
              {createMutation.isPending ? 'جارٍ الإنشاء…' : 'إنشاء جلسة'}
            </Button>
          </div>
        </form>

        {created ? (
          <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-emerald-900">تم إنشاء الجلسة ✓</h3>
            <dl className="flex flex-col gap-2 text-sm text-emerald-900">
              <div className="flex items-center gap-2">
                <dt className="font-medium">رمز الانضمام:</dt>
                <dd dir="ltr" className="font-mono text-lg font-bold tracking-widest">
                  {created.joinCode}
                </dd>
                <Button variant="secondary" onClick={() => onCopy(created.joinCode)}>
                  {copied ? 'تم النسخ ✓' : 'نسخ'}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <dt className="font-medium">رابط اللعب:</dt>
                <dd dir="ltr" className="font-mono text-xs">{playUrl(created.joinCode)}</dd>
                <Button variant="secondary" onClick={() => onCopy(playUrl(created.joinCode))}>
                  نسخ الرابط
                </Button>
              </div>
            </dl>
            <div className="mt-3 flex flex-col items-start gap-2">
              <span className="text-sm font-medium text-emerald-900">رمز QR:</span>
              <div dir="ltr" className="rounded-lg bg-white p-3" data-testid="session-qr-code">
                <QRCode value={playUrl(created.joinCode)} size={140} />
              </div>
            </div>
            <p className="mt-3 text-xs text-emerald-800">
              شارك الرمز أو الرابط مع الطلاب. فعّل الجلسة من صفحة التفاصيل ليتمكنوا من البدء.
            </p>
            <Link
              to={`/dashboard/sessions/${created.id}?quizId=${quizId}`}
              className="mt-2 inline-block text-sm font-medium text-emerald-800 underline">
              فتح صفحة الجلسة ←
            </Link>
          </div>
        ) : null}
      </section>

      {/* قائمة الجلسات */}
      <section aria-labelledby="sessions-list-heading" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="sessions-list-heading" className="mb-3 text-base font-semibold text-slate-900">
          الجلسات السابقة
        </h2>
        {sessionsQuery.isLoading ? (
          <p className="text-sm text-slate-500">جارٍ التحميل…</p>
        ) : sessionsQuery.isError ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            تعذر تحميل الجلسات. أعد المحاولة.
          </p>
        ) : !sessionsQuery.data || sessionsQuery.data.items.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد جلسات بعد. أنشئ أول جلسة أعلاه.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessionsQuery.data.items.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {s.label ?? 'بدون عنوان'}
                    {' · '}
                    <span dir="ltr" className="font-mono font-bold tracking-wider">
                      {s.joinCode}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {SESSION_STATUS_LABELS[s.status] ?? s.status}
                    {' · '}
                    {SESSION_MODE_LABELS[s.mode] ?? s.mode}
                    {' · '}
                    {s.participantCount} مشارك
                    {' · '}
                    {s.attemptCount} محاولة
                    {' · '}
                    {new Date(s.createdAt).toLocaleDateString('ar-EG', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <Link
                  to={`/dashboard/sessions/${s.id}?quizId=${quizId}`}
                  className="min-h-11 shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
                  إدارة
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
