import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerSurvey } from '../../types/surveys';
import { PlayerSurveyPanel } from './player-survey-panel';

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return {
    ...actual,
    playerApi: {
      ...actual.playerApi,
      getSurvey: vi.fn(),
      submitSurvey: vi.fn(),
    },
  };
});

const { playerApi } = await import('../../data/api-client/endpoints');
const getSurveyMock = vi.mocked(playerApi.getSurvey);
const submitSurveyMock = vi.mocked(playerApi.submitSurvey);

const survey: PlayerSurvey = {
  surveyId: 'survey-1',
  title: 'شاركنا رأيك',
  description: 'ثلاثة أسئلة قصيرة',
  submitted: false,
  questions: [
    {
      questionId: 'rating-1',
      sortOrder: 0,
      questionType: 'Rating',
      prompt: 'كيف تقيّم التجربة؟',
      isRequired: true,
      options: [],
    },
    {
      questionId: 'choice-1',
      sortOrder: 1,
      questionType: 'SingleChoice',
      prompt: 'ما الجزء الأفضل؟',
      isRequired: true,
      options: [
        { optionId: 'option-1', sortOrder: 0, optionText: 'الأسئلة' },
        { optionId: 'option-2', sortOrder: 1, optionText: 'النتيجة' },
      ],
    },
    {
      questionId: 'text-1',
      sortOrder: 2,
      questionType: 'ShortText',
      prompt: 'هل لديك اقتراح؟',
      isRequired: false,
      options: [],
    },
  ],
};

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlayerSurveyPanel joinCode="JOIN123" attemptId="attempt-1" />
    </QueryClientProvider>,
  );
}

describe('PlayerSurveyPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSurveyMock.mockResolvedValue(survey);
  });

  it('يرسل الأنواع الثلاثة ثم يعرض تأكيد الاستلام', async () => {
    submitSurveyMock.mockResolvedValue({
      responseId: 'response-1',
      submittedAt: '2026-08-09T12:00:00Z',
    });
    renderPanel();

    await screen.findByRole('heading', { name: 'شاركنا رأيك' });
    fireEvent.click(screen.getByRole('radio', { name: '5' }));
    fireEvent.click(screen.getByRole('radio', { name: 'الأسئلة' }));
    fireEvent.change(screen.getByLabelText('هل لديك اقتراح؟'), { target: { value: '  ممتاز  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'إرسال الاستبيان' }));

    await waitFor(() => expect(submitSurveyMock).toHaveBeenCalledWith('JOIN123', 'attempt-1', {
      answers: [
        { questionId: 'rating-1', ratingValue: 5, optionId: null, text: null },
        { questionId: 'choice-1', ratingValue: null, optionId: 'option-1', text: null },
        { questionId: 'text-1', ratingValue: null, optionId: null, text: 'ممتاز' },
      ],
    }));
    expect(await screen.findByText('شكرًا لمشاركتك')).toBeInTheDocument();
  });

  it('يمنع الإرسال محليًا عند غياب إجابة مطلوبة', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: 'شاركنا رأيك' });

    fireEvent.click(screen.getByRole('button', { name: 'إرسال الاستبيان' }));

    expect(screen.getByRole('alert')).toHaveTextContent('أجب عن السؤال المطلوب: كيف تقيّم التجربة؟');
    expect(submitSurveyMock).not.toHaveBeenCalled();
  });
});
