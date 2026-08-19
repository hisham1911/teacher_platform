import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveSessionState } from '../../../types/live';
import type { SessionDetail } from '../../../types/sessions';
import LiveHostPage from './live-host-page';

const liveConnection = vi.hoisted(() => ({ status: 'connected' }));

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    liveApi: {
      getState: vi.fn(),
      getTeacherToken: vi.fn(),
      openNext: vi.fn(),
      closeQuestion: vi.fn(),
      finish: vi.fn(),
    },
    sessionsApi: { ...actual.sessionsApi, get: vi.fn() },
  };
});
vi.mock('../../../features/live/use-live-connection', () => ({
  useLiveConnection: () => liveConnection.status,
}));
vi.mock('../../../lib/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth/session')>();
  return { ...actual, getActiveTenantId: () => 'tenant-1' };
});

const { liveApi, sessionsApi } = await import('../../../data/api-client/endpoints');

const lobby: LiveSessionState = {
  sessionId: 'session-1',
  sessionStatus: 'Active',
  phase: 'Lobby',
  currentQuestionIndex: -1,
  totalQuestions: 2,
  questionStartedAt: null,
  questionClosesAt: null,
  serverNow: '2026-08-09T12:00:00Z',
  revision: 3,
  participantCount: 4,
  attemptCount: 3,
  answeredCount: 0,
  currentQuestion: null,
  leaderboard: [],
};
const currentQuestion = {
  quizVersionItemId: 'item-1',
  index: 0,
  totalQuestions: 2,
  questionType: 'MultipleChoice' as const,
  prompt: 'ما عاصمة مصر؟',
  points: 5,
  mediaAssetId: null,
  options: [
    { optionId: 'option-1', optionText: 'القاهرة' },
    { optionId: 'option-2', optionText: 'الإسكندرية' },
  ],
};
const questionOpen: LiveSessionState = {
  ...lobby,
  phase: 'QuestionOpen',
  currentQuestionIndex: 0,
  questionStartedAt: '2026-08-09T12:00:00Z',
  questionClosesAt: '2026-08-09T12:00:30Z',
  revision: 4,
  attemptCount: 3,
  answeredCount: 1,
  currentQuestion,
  leaderboard: [
    { rank: 1, displayName: 'سارة', score: 0, answeredCount: 0 },
    { rank: 2, displayName: 'أحمد', score: 0, answeredCount: 0 },
  ],
};
const questionClosed: LiveSessionState = {
  ...questionOpen,
  phase: 'QuestionClosed',
  questionClosesAt: null,
  revision: 5,
  answeredCount: 3,
  leaderboard: [
    { rank: 1, displayName: 'سارة', score: 5, answeredCount: 1 },
    { rank: 2, displayName: 'أحمد', score: 0, answeredCount: 1 },
  ],
};
const finished: LiveSessionState = {
  ...questionClosed,
  phase: 'Finished',
  sessionStatus: 'Finished',
  revision: 6,
};
const session: SessionDetail = {
  id: 'session-1',
  quizId: 'quiz-1',
  quizTitle: 'مسابقة العلوم',
  quizVersionId: 'version-1',
  quizVersionNumber: 1,
  joinCode: 'LIVE1234',
  mode: 'Live',
  status: 'Active',
  label: 'مراجعة مباشرة',
  activatedAt: '2026-08-09T12:00:00Z',
  finishedAt: null,
  createdAt: '2026-08-09T11:00:00Z',
  updatedAt: '2026-08-09T12:00:00Z',
  version: 2,
  participants: [],
};

function renderPage(state: LiveSessionState = lobby) {
  vi.mocked(liveApi.getState).mockResolvedValue(state);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/dashboard/sessions/session-1/live?quizId=quiz-1']}>
        <Routes>
          <Route path="/dashboard/sessions/:sessionId/live" element={<LiveHostPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LiveHostPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveConnection.status = 'connected';
    vi.mocked(sessionsApi.get).mockResolvedValue(session);
    vi.mocked(liveApi.openNext).mockResolvedValue({
      ...lobby,
      phase: 'QuestionOpen',
      currentQuestionIndex: 0,
      revision: 4,
    });
    vi.mocked(liveApi.closeQuestion).mockResolvedValue(questionClosed);
    vi.mocked(liveApi.finish).mockResolvedValue(finished);
  });

  it('يعرض رابط الطلاب الحقيقي ويفتح السؤال الأول بالـrevision والمدة المختارة', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'مراجعة مباشرة' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'بانتظار الطلاب' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'بانتظار الطلاب' })).getByText('LIVE1234')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:3000/play/LIVE1234')).toBeInTheDocument();
    expect(screen.getByLabelText('رمز QR لرابط الطلاب')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'مدة السؤال بالثواني' }), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ المسابقة' }));

    await waitFor(() => expect(liveApi.openNext).toHaveBeenCalledWith(
      'tenant-1',
      'quiz-1',
      'session-1',
      { baseRevision: 3, durationSeconds: 45 },
    ));
  });

  it('يجعل السؤال والمؤقت وتقدم الإجابات مركز الشاشة أثناء البث', async () => {
    renderPage(questionOpen);

    expect(await screen.findByRole('heading', { name: 'ما عاصمة مصر؟' })).toBeInTheDocument();
    expect(screen.getByText('القاهرة')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveAccessibleName('متبقٍ 30 ثانية');
    expect(screen.getByText('1 من 3 أجابوا')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'الترتيب قبل هذا السؤال' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'إغلاق السؤال' }));
    await waitFor(() => expect(liveApi.closeQuestion).toHaveBeenCalledWith(
      'tenant-1',
      'quiz-1',
      'session-1',
      { baseRevision: 4 },
    ));
  });

  it('يعرض انتهاء السؤال والترتيب ثم يفتح السؤال التالي', async () => {
    renderPage(questionClosed);

    const questionRegion = await screen.findByRole('region', { name: 'ما عاصمة مصر؟' });
    expect(within(questionRegion).getByRole('status')).toHaveTextContent('انتهى السؤال');
    expect(screen.getByRole('heading', { name: 'لوحة الترتيب' })).toBeInTheDocument();
    expect(screen.getByText('سارة')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'السؤال التالي' }));

    await waitFor(() => expect(liveApi.openNext).toHaveBeenCalledWith(
      'tenant-1',
      'quiz-1',
      'session-1',
      { baseRevision: 5, durationSeconds: 30 },
    ));
  });

  it('ينهي التجربة داخل وضع Live ويقود إلى التقرير الحقيقي', async () => {
    renderPage(finished);

    expect(await screen.findByRole('heading', { name: 'انتهت المسابقة' })).toBeInTheDocument();
    expect(screen.getByText('أعلى نتيجة').nextElementSibling).toHaveTextContent('٥');
    expect(screen.getByRole('link', { name: 'فتح التقرير' })).toHaveAttribute('href', '/dashboard/reports/session-1?quizId=quiz-1');
    expect(screen.getByRole('link', { name: 'العودة إلى الاختبارات' })).toHaveAttribute('href', '/dashboard/quizzes');
    expect(screen.queryByRole('region', { name: 'أوامر المسابقة' })).not.toBeInTheDocument();
  });

  it('يشرح إعادة الاتصال دون إخفاء آخر حالة خادمية', async () => {
    liveConnection.status = 'reconnecting';
    renderPage(questionOpen);

    expect(await screen.findByText('فقد الاتصال مؤقتًا… نحاول إعادة الاتصال')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ما عاصمة مصر؟' })).toBeInTheDocument();
  });
});
