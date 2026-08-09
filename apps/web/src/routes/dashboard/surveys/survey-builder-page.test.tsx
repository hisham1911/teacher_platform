import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SurveyDetail } from '../../../types/surveys';
import SurveyBuilderPage from './survey-builder-page';

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    surveysApi: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      publish: vi.fn(),
    },
  };
});

const { surveysApi } = await import('../../../data/api-client/endpoints');
const listMock = vi.mocked(surveysApi.list);
const getMock = vi.mocked(surveysApi.get);
const createMock = vi.mocked(surveysApi.create);
const updateMock = vi.mocked(surveysApi.update);
const publishMock = vi.mocked(surveysApi.publish);

const draft: SurveyDetail = {
  id: 'survey-1',
  quizId: 'quiz-1',
  quizTitle: 'اختبار العلوم',
  title: 'رأيك في الاختبار',
  description: null,
  status: 'Draft',
  version: 7,
  responseCount: 0,
  publishedAt: null,
  createdAt: '2026-08-09T10:00:00Z',
  updatedAt: '2026-08-09T10:00:00Z',
  questions: [{
    id: 'question-1',
    sortOrder: 0,
    questionType: 'Rating',
    prompt: 'كيف تقيّم الاختبار؟',
    isRequired: true,
    options: [],
  }],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard/quizzes/quiz-1/survey']}>
        <Routes>
          <Route path="/dashboard/quizzes/:quizId/survey" element={<SurveyBuilderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SurveyBuilderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('teacher-platform:active-tenant-id', 'tenant-1');
  });

  it('ينشئ مسودة ثم ينشرها بالعقد المحفوظ من الخادم', async () => {
    listMock.mockResolvedValue([]);
    createMock.mockResolvedValue(draft);
    publishMock.mockResolvedValue({
      ...draft,
      status: 'Published',
      version: 8,
      publishedAt: '2026-08-09T11:00:00Z',
    });

    renderPage();

    const prompt = await screen.findByLabelText('نص السؤال');
    fireEvent.change(prompt, { target: { value: 'كيف تقيّم الاختبار؟' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ المسودة' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      quizId: 'quiz-1',
      questions: [expect.objectContaining({ questionType: 'Rating', prompt: 'كيف تقيّم الاختبار؟' })],
    })));

    const publishButton = await screen.findByRole('button', { name: 'نشر الاستبيان' });
    await waitFor(() => expect(publishButton).toBeEnabled());
    fireEvent.click(publishButton);

    await waitFor(() => expect(publishMock).toHaveBeenCalledWith('tenant-1', 'survey-1', 7));
    expect(await screen.findByText('الاستبيان منشور ويظهر للطلاب بعد النتيجة')).toBeInTheDocument();
  });

  it('يحدّث المسودة الموجودة باستخدام baseVersion الحالي', async () => {
    listMock.mockResolvedValue([{
      id: draft.id,
      quizId: draft.quizId,
      quizTitle: draft.quizTitle,
      title: draft.title,
      status: 'Draft',
      questionCount: 1,
      responseCount: 0,
      publishedAt: null,
      updatedAt: draft.updatedAt,
    }]);
    getMock.mockResolvedValue(draft);
    updateMock.mockResolvedValue({ ...draft, version: 8, title: 'استبيان محدّث' });

    renderPage();

    const titleInput = await screen.findByLabelText('العنوان');
    await waitFor(() => expect(titleInput).toHaveValue('رأيك في الاختبار'));
    fireEvent.change(titleInput, { target: { value: 'استبيان محدّث' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ المسودة' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(
      'tenant-1',
      'survey-1',
      expect.objectContaining({ title: 'استبيان محدّث', baseVersion: 7 }),
    ));
  });
});
