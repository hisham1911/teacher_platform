import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  return render(<QueryClientProvider client={client}><CertificatesPage /></QueryClientProvider>);
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
      },
      {
        id: 'certificate-2', attemptId: 'attempt-2', certificateNumber: 'CERT-2', studentName: 'عمر',
        quizTitle: 'اختبار العلوم', percentage: 70, status: 'Failed', issuedAt: '2026-08-09T12:00:00Z', failureReason: 'failed',
      },
    ]);
  });

  it('يعرض الشهادات الجاهزة والفاشلة بإجراءات مناسبة', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'الشهادات' })).toBeInTheDocument();
    expect(await screen.findByText('مريم')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تنزيل PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeInTheDocument();
  });

  it('يحفظ تعديلات القالب مع نسخة التزامن الحالية', async () => {
    renderPage();
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
