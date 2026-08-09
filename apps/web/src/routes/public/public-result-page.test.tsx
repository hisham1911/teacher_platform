import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicResultPage from './public-result-page';

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return { ...actual, publicResultsApi: { ...actual.publicResultsApi, get: vi.fn() } };
});

const { publicResultsApi } = await import('../../data/api-client/endpoints');

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/result/token-1']}>
        <Routes><Route path="/result/:publicToken" element={<PublicResultPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PublicResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(publicResultsApi.get).mockResolvedValue({
      studentName: 'مريم',
      quizTitle: 'اختبار العلوم',
      score: 8,
      maxScore: 10,
      percentage: 80,
      passed: true,
      finishedAt: '2026-08-09T12:00:00Z',
      reviewAreas: ['دورة الماء'],
      certificateUrl: 'https://example.test/certificate/token-2',
    });
  });

  it('يعرض ملخص النتيجة الآمن ومجالات المراجعة ورابط الشهادة', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'مريم' })).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('دورة الماء')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'فتح الشهادة' })).toHaveAttribute('href', 'https://example.test/certificate/token-2');
    expect(publicResultsApi.get).toHaveBeenCalledWith('token-1', expect.anything());
  });
});
