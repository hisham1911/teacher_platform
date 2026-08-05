import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../data/api-client/http-error';
import type { JoinSessionResponse, PlayerSession, StartAttemptResponse } from '../../types/sessions';
import PlayPage from './play-page';

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return {
    ...actual,
    playerApi: {
      ...actual.playerApi,
      getSession: vi.fn(),
      join: vi.fn(),
      startAttempt: vi.fn(),
      getCurrentQuestion: vi.fn(),
      submitAnswer: vi.fn(),
      finish: vi.fn(),
      getResult: vi.fn(),
      mediaUrl: vi.fn(() => '/mock-media'),
    },
  };
});

const { playerApi } = await import('../../data/api-client/endpoints');
const getSessionMock = vi.mocked(playerApi.getSession);
const joinMock = vi.mocked(playerApi.join);
const startAttemptMock = vi.mocked(playerApi.startAttempt);

const activeSession: PlayerSession = {
  title: 'اختبار العلوم',
  description: 'وصف تجريبي',
  instructions: 'اقرأ بعناية',
  passingPercentage: 60,
  timeMode: 'None',
  timeLimitSeconds: null,
  questionCount: 2,
  totalPoints: 10,
  status: 'Active',
  canJoin: true,
};

const joinResponse: JoinSessionResponse = {
  participantId: 'p-1',
  displayName: 'لاعب تجريبي',
  attemptId: null,
  attemptStatus: null,
};

const startResponse: StartAttemptResponse = {
  attemptId: 'a-1',
  startedAt: new Date().toISOString(),
  deadlineAt: null,
  serverNow: new Date().toISOString(),
  totalQuestions: 2,
  currentQuestionIndex: 0,
  status: 'InProgress',
};

function renderPage(joinCode = 'JOIN123') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/play/${joinCode}`]}>
        <Routes>
          <Route path="/play/:joinCode" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PlayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يعرض نموذج الانضمام عندما تكون الجلسة نشطة', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'اختبار العلوم' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'انضمام' })).toBeInTheDocument();
    expect(getSessionMock).toHaveBeenCalledWith('JOIN123', expect.anything());
  });

  it('يعرض رسالة انتظار عندما تكون الجلسة مجدولة', async () => {
    getSessionMock.mockResolvedValue({ ...activeSession, status: 'Scheduled', canJoin: false });
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('الجلسة لم تُفعَّل بعد. انتظر المعلم.')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'انضمام' })).not.toBeInTheDocument();
  });

  it('يعرض رسالة انتهاء عندما تكون الجلسة منتهية', async () => {
    getSessionMock.mockResolvedValue({ ...activeSession, status: 'Finished', canJoin: false });
    renderPage();

    await waitFor(() => expect(screen.getByText('انتهت هذه الجلسة.')).toBeInTheDocument());
  });

  it('يرفض اسمًا أقصر من حرفين دون استدعاء الخادم', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'انضمام' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'أ' } });
    fireEvent.click(screen.getByRole('button', { name: 'انضمام' }));

    expect(screen.getByText('الاسم قصير جدًا (حرفان على الأقل).')).toBeInTheDocument();
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('يرفض اسمًا أطول من 50 حرفًا دون استدعاء الخادم', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'انضمام' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ا'.repeat(51) } });
    fireEvent.click(screen.getByRole('button', { name: 'انضمام' }));

    expect(screen.getByText('الاسم طويل جدًا (50 حرفًا كحد أقصى).')).toBeInTheDocument();
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('ينتقل إلى شاشة الاستعداد بعد انضمام ناجح', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    joinMock.mockResolvedValue(joinResponse);
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'انضمام' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'لاعب تجريبي' } });
    fireEvent.click(screen.getByRole('button', { name: 'انضمام' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /لاعب تجريبي/ })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'ابدأ الاختبار' })).toBeInTheDocument();
    expect(joinMock).toHaveBeenCalledWith('JOIN123', { displayName: 'لاعب تجريبي' });
  });

  it('يعرض رسالة 409 عند رفض الانضمام', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    joinMock.mockRejectedValue(new HttpError(409, {}));
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'انضمام' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'لاعب متأخر' } });
    fireEvent.click(screen.getByRole('button', { name: 'انضمام' }));

    await waitFor(() =>
      expect(screen.getByText('الجلسة لم تعد تقبل منضمّين جددًا.')).toBeInTheDocument(),
    );
  });

  it('يستأنف المحاولة تلقائيًا عند وجود محاولة جارية بعد الانضمام', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    joinMock.mockResolvedValue({ ...joinResponse, attemptId: 'a-1', attemptStatus: 'InProgress' });
    startAttemptMock.mockResolvedValue(startResponse);
    vi.mocked(playerApi.getCurrentQuestion).mockReturnValue(new Promise(() => {}));
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'انضمام' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'لاعب عائد' } });
    fireEvent.click(screen.getByRole('button', { name: 'انضمام' }));

    // يجب أن يبدأ المحاولة مباشرة دون المرور بشاشة الاستعداد
    await waitFor(() => expect(startAttemptMock).toHaveBeenCalledWith('JOIN123'));
  });
});
