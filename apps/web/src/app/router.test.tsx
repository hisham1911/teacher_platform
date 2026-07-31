import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from './router';

function renderRoute(initialPath: string) {
  vi.stubEnv('VITE_API_BASE_URL', '');

  const memoryRouter = createMemoryRouter(router.routes, {
    initialEntries: [initialPath],
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={memoryRouter} />
    </QueryClientProvider>,
  );
}

describe('router', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('يعرض الصفحة الرئيسية على /', async () => {
    renderRoute('/');

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /منصة المعلم والاختبارات/ }),
      ).toBeInTheDocument(),
    );
  });

  it('يعرض صفحة لوحة التحكم المؤقتة على /dashboard', async () => {
    renderRoute('/dashboard');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'لوحة التحكم' })).toBeInTheDocument(),
    );
  });

  it('يعرض صفحة تجربة الطالب المؤقتة على /play/demo', async () => {
    renderRoute('/play/demo');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'تجربة الطالب' })).toBeInTheDocument(),
    );
  });
});
