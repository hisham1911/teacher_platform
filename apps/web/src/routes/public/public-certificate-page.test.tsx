import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicCertificatePage from './public-certificate-page';

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return {
    ...actual,
    publicResultsApi: {
      ...actual.publicResultsApi,
      fetchCertificate: vi.fn(),
      certificateUrl: vi.fn(() => '/certificate.pdf'),
    },
  };
});

const { publicResultsApi } = await import('../../data/api-client/endpoints');

describe('PublicCertificatePage', () => {
  beforeEach(() => {
    vi.mocked(publicResultsApi.fetchCertificate).mockResolvedValue(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:certificate-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('يعرض PDF من رابط blob محلي ثم ينظفه عند مغادرة الصفحة', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/certificate/public-token']}>
          <Routes><Route path="/certificate/:publicToken" element={<PublicCertificatePage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const frame = await screen.findByTitle('شهادة الإنجاز');
    expect(frame).toHaveAttribute('src', 'blob:certificate-preview');
    expect(screen.getByRole('link', { name: 'تنزيل الشهادة' })).toHaveAttribute('href', '/certificate.pdf');

    view.unmount();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:certificate-preview'));
  });
});
