import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from './router';

async function renderRoute(initialPath: string) {
  const memoryRouter = createMemoryRouter(router.routes, {
    initialEntries: [initialPath],
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={memoryRouter} />
    </QueryClientProvider>,
  );

  // انتظر حتى ينتهي Lazy loading — قد يحتاج suspense fallback ليختفي
  await waitFor(() => {
    expect(screen.queryByText(/جارٍ التحميل/i)).not.toBeInTheDocument();
  });
}

/** يبحث عن Heading بنص محدد مع تجاهل الفواصل والاتجاه */
async function expectHeading(expected: string | RegExp) {
  await waitFor(() => {
    const headings = screen.getAllByRole('heading');
    const texts = headings.map((h) => h.textContent ?? '');
    const matches = expected instanceof RegExp
      ? texts.some((t) => expected.test(t))
      : texts.some((t) => t.includes(expected));
    expect(matches, `Expected heading matching ${expected}, got: [${texts.join(' | ')}]`).toBe(true);
  });
}

describe('router — Phase 1', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('يعرض الصفحة الرئيسية على /', async () => {
    await renderRoute('/');
    await expectHeading(/منصة المعلم|الاختبارات/);
  });

  it('يعرض صفحة تسجيل الدخول على /auth/login', async () => {
    await renderRoute('/auth/login');
    await expectHeading('تسجيل الدخول');
  });

  // ملاحظة: سلوك التوجيه /dashboard للمستخدم غير المصادق يغطيه require-auth.test.tsx
  // بوحدة منفصلة لا تعتمد على Lazy loaded routes.

  it('يعرض صفحة إنشاء الحساب على /auth/signup', async () => {
    await renderRoute('/auth/signup');
    await expectHeading('إنشاء حساب جديد');
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
});
