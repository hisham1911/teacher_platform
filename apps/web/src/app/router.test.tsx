import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { studentPortalApi } from '../data/api-client/student-portal-endpoints';
import { HttpError } from '../data/api-client/http-error';
import { router } from './router';

async function renderRoute(initialPath: string) {
  const memoryRouter = createMemoryRouter(router.routes, { initialEntries: [initialPath] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><RouterProvider router={memoryRouter} /></QueryClientProvider>);
  await waitFor(() => expect(screen.queryByText(/جارٍ التحميل/i)).not.toBeInTheDocument());
}

async function expectHeading(expected: string | RegExp) {
  await waitFor(() => {
    const headings = screen.getAllByRole('heading');
    const texts = headings.map((heading) => heading.textContent ?? '');
    const matches = expected instanceof RegExp ? texts.some((text) => expected.test(text)) : texts.some((text) => text.includes(expected));
    expect(matches, `Expected heading matching ${expected}, got: [${texts.join(' | ')}]`).toBe(true);
  });
}

describe('router — public product routes', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('يعرض الصفحة الرئيسية الموجهة للطالب على /', async () => {
    await renderRoute('/');
    await expectHeading('جاهز؟');
    expect(screen.getByText('مسابقة مباشرة')).toBeInTheDocument();
    expect(screen.getByText('تحدّي متدرّج')).toBeInTheDocument();

    const activityLinks = screen.getAllByRole('link', { name: /معايا رمز نشاط/ });
    expect(activityLinks.length).toBeGreaterThan(0);
    expect(activityLinks.every((link) => link.getAttribute('href') === '/join')).toBe(true);

    const portalLinks = screen.getAllByRole('link', { name: /مساحتي/ });
    expect(portalLinks.length).toBeGreaterThan(0);
    expect(portalLinks.every((link) => link.getAttribute('href') === '/student')).toBe(true);
  });

  it('يعرض الانضمام السريع للنشاط على /join', async () => {
    await renderRoute('/join');
    await expectHeading('انضم لنشاط سريع');
    expect(screen.getByLabelText(/رمز النشاط/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /الدخول إلى مساحتي/ })).toHaveAttribute('href', '/student');
  });

  it('يعرض بوابة الطالب المستقلة على /student للزائر غير المسجل', async () => {
    vi.spyOn(studentPortalApi, 'status').mockResolvedValue({ enabled: true });
    vi.spyOn(studentPortalApi, 'me').mockRejectedValue(new HttpError(401, null));

    await renderRoute('/student');
    await expectHeading('ادخل إلى مساحتك');
    expect(screen.getByLabelText('كود دخول الطالب')).toBeInTheDocument();
  });

  it('يعرض صفحة تسجيل الدخول على /auth/login', async () => {
    await renderRoute('/auth/login');
    await expectHeading('تسجيل الدخول');
  });

  it('يعرض صفحة إنشاء الحساب على /auth/signup', async () => {
    await renderRoute('/auth/signup');
    await expectHeading('إنشاء حساب جديد');
  });

  it('يعرض صفحات الخصوصية والشروط العامة', async () => {
    await renderRoute('/privacy');
    await expectHeading('سياسة الخصوصية');
    await renderRoute('/terms');
    await expectHeading('شروط الاستخدام');
  });

  it('يعرض صفحة خطأ مفهومة للمسار غير الموجود', async () => {
    await renderRoute('/missing-page');
    await expectHeading('الصفحة غير موجودة');
  });

  it('يعرض صفحة تأكيد البريد على /auth/confirm-email', async () => {
    await renderRoute('/auth/confirm-email');
    await expectHeading(/تأكيد البريد|رابط تأكيد/);
  });

  it('يعرض صفحة استعادة كلمة المرور على /auth/forgot-password', async () => {
    await renderRoute('/auth/forgot-password');
    await expectHeading('استعادة كلمة المرور');
  });

  it('يعرض صفحة إعادة تعيين كلمة المرور على /auth/reset-password', async () => {
    await renderRoute('/auth/reset-password');
    await expectHeading(/كلمة مرور جديدة|رابط إعادة التعيين/);
  });

  it('يعرض صفحة الاختبار العامة على /q/:publicCode', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:5000');
    const publicQuiz = {
      title: 'اختبار عام تجريبي', description: null, instructions: null,
      passingPercentage: 50, timeMode: 'None', timeLimitSeconds: null,
      questionCount: 5, totalPoints: 50,
      theme: { template: 'default', primaryColor: '#1e40af', secondaryColor: '#64748b', backgroundColor: '#ffffff' },
      available: true,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(publicQuiz), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await renderRoute('/q/some-public-code');
    await expectHeading('اختبار عام تجريبي');
  });
});
