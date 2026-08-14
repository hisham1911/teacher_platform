import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../data/api-client/http-error';
import type { PublicQuizPage } from '../../types/quizzes';
import PublicQuizPageComponent from './public-quiz-page';

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return {
    ...actual,
    publicQuizApi: {
      ...actual.publicQuizApi,
      getByCode: vi.fn(),
    },
  };
});

const { publicQuizApi } = await import('../../data/api-client/endpoints');
const getByCodeMock = vi.mocked(publicQuizApi.getByCode);

const baseQuiz: PublicQuizPage = {
  title: 'اختبار الرياضيات',
  description: 'اختبار تجريبي في الجبر',
  instructions: 'اقرأ كل سؤال بعناية',
  passingPercentage: 60,
  timeMode: 'TotalTime',
  timeLimitSeconds: 1800,
  questionCount: 10,
  totalPoints: 100,
  theme: {
    template: 'default',
    primaryColor: '#1e40af',
    secondaryColor: '#64748b',
    backgroundColor: '#ffffff',
  },
  available: true,
};

function renderPage(publicCode = 'abc-123') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/q/${publicCode}`]}>
        <Routes>
          <Route path="/q/:publicCode" element={<PublicQuizPageComponent />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PublicQuizPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يعرض البيانات التعريفية للاختبار المنشور', async () => {
    getByCodeMock.mockResolvedValue(baseQuiz);
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'اختبار الرياضيات' })).toBeInTheDocument(),
    );

    expect(screen.getByText('اختبار تجريبي في الجبر')).toBeInTheDocument();
    expect(screen.getByText('اقرأ كل سؤال بعناية')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText(/وقت إجمالي/)).toBeInTheDocument();
    expect(screen.getByText(/صفحة تعريفية بالاختبار وليست صفحة الحل/)).toBeInTheDocument();
    expect(screen.queryByText(/المرحلة 4|Player/)).not.toBeInTheDocument();
    expect(getByCodeMock).toHaveBeenCalledWith('abc-123', expect.anything());
  });

  it('لا يعرض أي أسئلة أو خيارات أو إجابات', async () => {
    getByCodeMock.mockResolvedValue(baseQuiz);
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'اختبار الرياضيات' })).toBeInTheDocument(),
    );

    // يجب ألا تحتوي الصفحة على أي محتوى أسئلة
    expect(screen.queryByText(/السؤال الأول/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('يعرض رسالة عدم التوفر عندما available=false', async () => {
    getByCodeMock.mockResolvedValue({ ...baseQuiz, available: false });
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('هذا الاختبار غير متاح حاليًا.')).toBeInTheDocument(),
    );
  });

  it('يعرض رسالة 404 عند رابط غير صالح', async () => {
    getByCodeMock.mockRejectedValue(new HttpError(404, null));
    renderPage('bad-code');

    await waitFor(() =>
      expect(screen.getByText('الاختبار غير موجود أو الرابط غير صالح.')).toBeInTheDocument(),
    );
  });

  it('يعرض رسالة خطأ عامة عند فشل غير متوقع', async () => {
    getByCodeMock.mockRejectedValue(new Error('network'));
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText('تعذر تحميل بيانات الاختبار. حاول مرة أخرى لاحقًا.'),
      ).toBeInTheDocument(),
    );
  });
});
