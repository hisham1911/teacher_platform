import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveSessionState } from '../../../types/live';
import type { SessionDetail } from '../../../types/sessions';
import LiveHostPage from './live-host-page';

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
  useLiveConnection: () => 'connected',
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

function renderPage() {
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
    vi.mocked(liveApi.getState).mockResolvedValue(lobby);
    vi.mocked(sessionsApi.get).mockResolvedValue(session);
    vi.mocked(liveApi.openNext).mockResolvedValue({
      ...lobby,
      phase: 'QuestionOpen',
      currentQuestionIndex: 0,
      revision: 4,
    });
  });

  it('يعرض أعداد القاعة ويفتح السؤال بالـrevision الحالي والمدة المختارة', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'مراجعة مباشرة' })).toBeInTheDocument();
    expect(screen.getByText('LIVE1234')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'مدة السؤال بالثواني' }), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'فتح السؤال الأول' }));

    await waitFor(() => expect(liveApi.openNext).toHaveBeenCalledWith(
      'tenant-1',
      'quiz-1',
      'session-1',
      { baseRevision: 3, durationSeconds: 45 },
    ));
  });
});
