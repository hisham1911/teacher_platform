import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../../data/api-client/http-error';
import type { PagedResponse } from '../../../types/questions';
import type { SessionDetail } from '../../../types/sessions';
import QuizSessionsPage from './quiz-sessions-page';

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    sessionsApi: {
      ...actual.sessionsApi,
      list: vi.fn(),
      create: vi.fn(),
    },
  };
});

const { sessionsApi } = await import('../../../data/api-client/endpoints');
const listMock = vi.mocked(sessionsApi.list);
const createMock = vi.mocked(sessionsApi.create);

const TENANT_ID = 'tenant-1';
const QUIZ_ID = 'quiz-1';

const emptySessions: PagedResponse<never> = {
  items: [],
  page: 1,
  pageSize: 50,
  totalItems: 0,
  totalPages: 0,
};

const createdSession: SessionDetail = {
  id: 'session-1',
  quizId: QUIZ_ID,
  quizTitle: 'اختبار العلوم',
  quizVersionId: 'pv-1',
  quizVersionNumber: 1,
  joinCode: 'JOIN123',
  mode: 'ProgressiveChallenge',
  status: 'Scheduled',
  label: null,
  activatedAt: null,
  finishedAt: null,
  createdAt: '2026-08-22T00:00:00Z',
  updatedAt: '2026-08-22T00:00:00Z',
  version: 3,
  participants: [],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/dashboard/quizzes/${QUIZ_ID}/sessions`]}>
        <Routes>
          <Route path="/dashboard/quizzes/:quizId/sessions" element={<QuizSessionsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('QuizSessionsPage — التحدي المتدرج', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('teacher-platform:active-tenant-id', TENANT_ID);
    listMock.mockResolvedValue(emptySessions);
  });

  it('يعرض خيار التحدي المتدرج الثالث مع الوصف وتنبيه الترتيب عند اختياره', async () => {
    renderPage();

    const modeSelect = await screen.findByLabelText('نمط الجلسة');
    expect(modeSelect).toContainHTML('التحدي المتدرج');

    // الوصف والتنبيه يظهران فقط بعد اختيار النمط
    expect(screen.queryByText('تجربة فردية متدرجة؛ الإجابة الصحيحة تنقل الطالب للمستوى التالي، والإجابة الخاطئة تنهي التحدي.')).not.toBeInTheDocument();
    fireEvent.change(modeSelect, { target: { value: 'ProgressiveChallenge' } });

    expect(screen.getByText('تجربة فردية متدرجة؛ الإجابة الصحيحة تنقل الطالب للمستوى التالي، والإجابة الخاطئة تنهي التحدي.')).toBeInTheDocument();
    expect(screen.getByText('رتّب أسئلة الاختبار من الأسهل إلى الأصعب للحصول على أفضل تجربة.')).toBeInTheDocument();
  });

  it('يرسل النمط الجديد إلى الخادم عند إنشاء جلسة تحدي متدرج', async () => {
    createMock.mockResolvedValue(createdSession);
    renderPage();

    fireEvent.change(await screen.findByLabelText('نمط الجلسة'), { target: { value: 'ProgressiveChallenge' } });
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء جلسة' }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(TENANT_ID, QUIZ_ID, { mode: 'ProgressiveChallenge', label: null }),
    );
    expect(await screen.findByText('تم إنشاء الجلسة ✓')).toBeInTheDocument();
  });

  it('يعرض رسالة واضحة عندما يحتوي الاختبار على أنواع أسئلة غير مدعومة (409)', async () => {
    createMock.mockRejectedValue(
      new HttpError(409, {
        title: 'UnsupportedQuestionTypesForMode',
        detail: 'Progressive Challenge supports Multiple Choice, True/False and Listening questions only.',
      }),
    );
    renderPage();

    fireEvent.change(await screen.findByLabelText('نمط الجلسة'), { target: { value: 'ProgressiveChallenge' } });
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء جلسة' }));

    expect(
      await screen.findByText(
        'التحدي المتدرج يدعم أسئلة الاختيار من متعدد وصح/خطأ والاستماع فقط. أعد نشر نسخة خالية من أسئلة الإجابة القصيرة والترتيب أولًا.',
      ),
    ).toBeInTheDocument();
  });
});
