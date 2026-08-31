import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActivityBulkQuestionsPage from './activity-bulk-questions-page';

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    questionBanksApi: {
      ...actual.questionBanksApi,
      list: vi.fn(),
      create: vi.fn(),
    },
    questionsApi: {
      ...actual.questionsApi,
      bulkCreate: vi.fn(),
    },
  };
});

vi.mock('../../../features/questions/question-import-file', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/questions/question-import-file')>();
  return {
    ...actual,
    readQuestionImportFile: vi.fn(),
  };
});

const { questionBanksApi, questionsApi } = await import('../../../data/api-client/endpoints');
const { readQuestionImportFile } = await import('../../../features/questions/question-import-file');
const listBanksMock = vi.mocked(questionBanksApi.list);
const createBankMock = vi.mocked(questionBanksApi.create);
const bulkCreateMock = vi.mocked(questionsApi.bulkCreate);
const readImportMock = vi.mocked(readQuestionImportFile);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard/activities/quiz-1/bulk?mode=ProgressiveChallenge']}>
        <Routes>
          <Route path="/dashboard/activities/:quizId/bulk" element={<ActivityBulkQuestionsPage />} />
          <Route path="/dashboard/activities/:quizId/build" element={<p>عاد إلى المنشئ</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ActivityBulkQuestionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('teacher-platform:active-tenant-id', 'tenant-1');
    listBanksMock.mockResolvedValue([]);
    createBankMock.mockResolvedValue({ id: 'bank-1', name: 'English Spark', description: null, questionCount: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 1 } as never);
    bulkCreateMock.mockResolvedValue({} as never);
    readImportMock.mockResolvedValue('type,prompt,A,B,C,D,correct,difficulty,language,tags,explanation\nMultipleChoice,Which planet is red?,Earth,Mars,,,B,Easy,en,space,Mars is red.');
  });

  it('ينشئ بنك English Spark تلقائيًا إذا بدأ المستخدم الاستيراد بدون بنك', async () => {
    const { container } = renderPage();

    expect(await screen.findByText('2. لا تحتاج لإنشاء بنك أولًا')).toBeInTheDocument();
    expect(screen.getByText(/سننشئ بنك/)).toHaveTextContent('English Spark');

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, { target: { files: [new File(['placeholder'], 'questions.csv', { type: 'text/csv' })] } });

    expect(await screen.findByText('1 صالح · 0 يحتاج مراجعة')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'حفظ 1 سؤالًا' }));

    await waitFor(() => expect(createBankMock).toHaveBeenCalledWith('tenant-1', { name: 'English Spark' }));
    await waitFor(() => expect(bulkCreateMock).toHaveBeenCalledWith('tenant-1', {
      questions: [expect.objectContaining({ bankId: 'bank-1', prompt: 'Which planet is red?' })],
      quizId: 'quiz-1',
    }));
    expect(await screen.findByText('عاد إلى المنشئ')).toBeInTheDocument();
  });
});
