import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerDeliveryPanel } from './player-delivery-panel';

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return {
    ...actual,
    playerApi: {
      ...actual.playerApi,
      issueCertificate: vi.fn(),
      createParentShare: vi.fn(),
      certificateDownloadUrl: vi.fn(() => '/certificate.pdf'),
    },
  };
});

const { playerApi } = await import('../../data/api-client/endpoints');

function renderPanel(passed = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerDeliveryPanel joinCode="JOIN123" attemptId="attempt-1" passed={passed} />
    </QueryClientProvider>,
  );
}

describe('PlayerDeliveryPanel', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    vi.mocked(playerApi.issueCertificate).mockResolvedValue({
      certificateId: 'certificate-1',
      certificateNumber: 'CERT-2026-0001',
      status: 'Ready',
      issuedAt: '2026-08-09T12:00:00Z',
      downloadUrl: '/certificate.pdf',
      publicUrl: 'https://example.test/certificate/token-1',
    });
    vi.mocked(playerApi.createParentShare).mockResolvedValue({
      shareUrl: 'https://example.test/result/token-2',
      expiresAt: '2026-08-16T12:00:00Z',
    });
  });

  it('يصدر شهادة للمحاولة الناجحة ويعرض تنزيلها', async () => {
    renderPanel();

    await waitFor(() => expect(screen.getByRole('link', { name: 'تنزيل الشهادة PDF' })).toHaveAttribute('href', '/certificate.pdf'));
    expect(playerApi.issueCertificate).toHaveBeenCalledWith('JOIN123', 'attempt-1', expect.anything());
  });

  it('ينشئ رابط النتيجة وينسخه عند طلب الطالب', async () => {
    renderPanel(false);
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء رابط المشاركة' }));
    const copyButton = await screen.findByRole('button', { name: 'نسخ رابط النتيجة' });
    fireEvent.click(copyButton);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://example.test/result/token-2'));
    expect(playerApi.issueCertificate).not.toHaveBeenCalled();
  });
});
