import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RootLayout } from './root-layout';

describe('RootLayout', () => {
  it('يعرض روابط التنقل الأساسية', () => {
    render(
      <MemoryRouter>
        <RootLayout>
          <div>محتوى</div>
        </RootLayout>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'منصة المعلم' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'الرئيسية' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'لوحة التحكم' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تجربة الطالب' })).toBeInTheDocument();
    expect(screen.getByText('محتوى')).toBeInTheDocument();
  });
});
