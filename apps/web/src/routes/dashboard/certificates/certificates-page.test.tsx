import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CertificateTemplate } from '../../../types/certificates';
import CertificatesPage from './certificates-page';

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    certificateTemplatesApi: { ...actual.certificateTemplatesApi, list: vi.fn(), create: vi.fn(), update: vi.fn() },
    certificatesApi: { ...actual.certificatesApi, list: vi.fn(), retry: vi.fn(), download: vi.fn() },
  };
});

const { certificateTemplatesApi, certificatesApi } = await import('../../../data/api-client/endpoints');

const template: CertificateTemplate = {
  id: 'template-1',
  name: 'القالب الافتراضي',
  titleText: 'شهادة إتمام',
  bodyText: 'تقديرًا للنجاح',
  issuerName: 'أكاديمية المعرفة',
  primaryColor: '#0F766E',
  secondaryColor: '#D97706',
  isDefault: true,
  version: 3,
  updatedAt: '2026-08-09T12:00:00Z',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><CertificatesPage /></MemoryRouter></QueryClientProvider>);
}

describe('CertificatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('teacher-platform:active-tenant-id', 'tenant-1');
    vi.mocked(certificateTemplatesApi.list).mockResolvedValue([template]);
    vi.mocked(certificateTemplatesApi.update).mockResolvedValue({ ...template, version: 4 });
    vi.mocked(certificatesApi.list).mockResolvedValue([
      {
        id: 'certificate-1', attemptId: 'attempt-1', certificateNumber: 'CERT-1', studentName: 'مريم',
        quizTitle: 'اختبار العلوم', percentage: 80, status: 'Ready', issuedAt: '2026-08-09T12:00:00Z', failureReason: null,
        publicUrl: 'https://example.test/certificate/token-1',
      },
      {
        id: 'certificate-2', attemptId: 'attempt-2', certificateNumber: 'CERT-2', studentName: 'عمر',
        quizTitle: 'اختبار العلوم', percentage: 70, status: 'Failed', issuedAt: '2026-08-09T12:00:00Z', failureReason: 'failed', publicUrl: null,
      },
    ]);
    vi.mocked(certificatesApi.download).mockResolvedValue(new Blob(['%PDF-test'], { type: 'application/pdf' }));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:certificate-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('يعرض الشهادات الجاهزة والفاشلة بإجراءات مناسبة', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'الشهادات' })).toBeInTheDocument();
    expect((await screen.findAllByText('مريم')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'عرض الشهادة' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'تنزيل' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'نسخ رابط الشهادة' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'إعادة المحاولة' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('تعذر التجهيز').length).toBeGreaterThan(0);
  });

  it('يعرض الشهادة عبر Blob URL بدل تحميل API داخل iframe مباشرة', async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'عرض الشهادة' }))[0]!);
    expect(await screen.findByTitle('معاينة الشهادة')).toHaveAttribute('src', 'blob:certificate-preview');
    expect(certificatesApi.download).toHaveBeenCalledWith('tenant-1', 'certificate-1', expect.any(AbortSignal));
  });

  it('يحفظ تعديلات القالب مع نسخة التزامن الحالية', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('تخصيص قالب الشهادة'));
    const issuer = await screen.findByLabelText('اسم الجهة المصدرة');
    fireEvent.change(issuer, { target: { value: 'مدرسة النور' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));

    await waitFor(() => expect(certificateTemplatesApi.update).toHaveBeenCalledWith(
      'tenant-1',
      'template-1',
      expect.objectContaining({ issuerName: 'مدرسة النور', baseVersion: 3 }),
    ));
  });
});
