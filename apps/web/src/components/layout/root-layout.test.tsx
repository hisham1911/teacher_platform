import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { RootLayout } from './root-layout';
import { clearSession } from '../../lib/auth/session';

describe('RootLayout', () => {
  it('يعرض روابط التنقل الأساسية للزائر', () => {
    clearSession();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RootLayout>
            <div>محتوى</div>
          </RootLayout>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: 'منصة المعلم' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'الرئيسية' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'إنشاء حساب' })).toBeInTheDocument();
    expect(screen.getByText('محتوى')).toBeInTheDocument();
  });
});
