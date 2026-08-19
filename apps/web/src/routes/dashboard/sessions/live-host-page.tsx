import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router';
import { liveApi, sessionsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { useLiveConnection } from '../../../features/live/use-live-connection';
import { getActiveTenantId } from '../../../lib/auth/session';
import type { LiveControlRequest, LiveSessionState } from '../../../types/live';
import { LiveHostStatusScreen, LiveHostView } from './live-host-ui';

export default function LiveHostPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const quizId = searchParams.get('quizId');
  const tenantId = getActiveTenantId();
  const queryClient = useQueryClient();
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const stateQuery = useQuery({
    queryKey: ['live-state', tenantId, quizId, sessionId],
    queryFn: ({ signal }) => liveApi.getState(tenantId!, quizId!, sessionId!, signal),
    enabled: Boolean(tenantId && quizId && sessionId),
    refetchInterval: 3_000,
  });
  const sessionQuery = useQuery({
    queryKey: ['session-detail', tenantId, quizId, sessionId],
    queryFn: ({ signal }) => sessionsApi.get(tenantId!, quizId!, sessionId!, signal),
    enabled: Boolean(tenantId && quizId && sessionId),
  });

  const applyLiveState = useCallback((state: LiveSessionState) => {
    queryClient.setQueryData(['live-state', tenantId, quizId, sessionId], state);
  }, [queryClient, tenantId, quizId, sessionId]);
  const getToken = useCallback(async () => {
    const token = await liveApi.getTeacherToken(tenantId!, quizId!, sessionId!);
    return token.accessToken;
  }, [tenantId, quizId, sessionId]);
  const connectionStatus = useLiveConnection({
    enabled: Boolean(tenantId && quizId && sessionId && stateQuery.data),
    getAccessToken: getToken,
    onState: applyLiveState,
  });

  const controlMutation = useMutation({
    mutationFn: (action: 'open' | 'close' | 'finish') => {
      const state = stateQuery.data!;
      const payload: LiveControlRequest = { baseRevision: state.revision };
      if (action === 'open') {
        payload.durationSeconds = durationSeconds;
        return liveApi.openNext(tenantId!, quizId!, sessionId!, payload);
      }
      if (action === 'close') return liveApi.closeQuestion(tenantId!, quizId!, sessionId!, payload);
      return liveApi.finish(tenantId!, quizId!, sessionId!, payload);
    },
    onSuccess: (state) => {
      setActionError(null);
      applyLiveState(state);
    },
    onError: (error) => {
      setActionError(error instanceof HttpError && error.status === 409
        ? 'تغيّرت حالة المسابقة. جرى تحديث الشاشة؛ حاول مرة أخرى.'
        : 'تعذر تنفيذ الأمر. تحقق من الاتصال وحاول مجددًا.');
      void stateQuery.refetch();
    },
  });

  function onDurationChange(value: number) {
    setDurationSeconds(Math.min(300, Math.max(5, value)));
  }

  async function onCopyStudentUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2_000);
    } catch {
      setCopyState('failed');
    }
  }

  if (!tenantId) {
    return null;
  }
  if (!quizId) {
    return (
      <LiveHostStatusScreen>
        <p role="alert" className="text-base font-bold text-rose-200">رابط المسابقة غير مكتمل.</p>
        <Link to="/dashboard/quizzes" className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-emerald-200 hover:text-emerald-100">العودة إلى الاختبارات</Link>
      </LiveHostStatusScreen>
    );
  }
  if (stateQuery.isLoading || sessionQuery.isLoading) {
    return <LiveHostStatusScreen><p role="status" className="text-base font-bold">جارٍ تجهيز المسابقة المباشرة…</p></LiveHostStatusScreen>;
  }
  if (!stateQuery.data || !sessionQuery.data) {
    return (
      <LiveHostStatusScreen>
        <p role="alert" className="text-base font-bold text-rose-200">تعذر فتح المسابقة المباشرة.</p>
        <button type="button" onClick={() => void Promise.all([stateQuery.refetch(), sessionQuery.refetch()])} className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-white/15 px-5 text-sm font-bold text-white hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">إعادة المحاولة</button>
      </LiveHostStatusScreen>
    );
  }

  const state = stateQuery.data;
  const session = sessionQuery.data;

  return (
    <LiveHostView
      state={state}
      session={session}
      tenantId={tenantId}
      quizId={quizId}
      connectionStatus={connectionStatus}
      durationSeconds={durationSeconds}
      copyState={copyState}
      actionError={actionError}
      isPending={controlMutation.isPending}
      onDurationChange={onDurationChange}
      onCopyStudentUrl={(url) => void onCopyStudentUrl(url)}
      onOpen={() => controlMutation.mutate('open')}
      onClose={() => controlMutation.mutate('close')}
      onFinish={() => controlMutation.mutate('finish')}
    />
  );
}
