import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import TeachersPage from './teachers-page';

describe('TeachersPage', () => {
  it('يعرض صفحة مستقلة للمعلمين مع دعوات واضحة للحساب والدخول', () => {
    render(
      <MemoryRouter>
        <TeachersPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /اصنع النشاط، جرّبه/ })).toBeInTheDocument();
    const signupLinks = screen.getAllByRole('link', { name: 'إنشاء حساب' });
    expect(signupLinks.length).toBeGreaterThan(0);
    expect(signupLinks.every((link) => link.getAttribute('href') === '/auth/signup')).toBe(true);
    const loginLinks = screen.getAllByRole('link', { name: 'تسجيل الدخول' });
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks.every((link) => link.getAttribute('href') === '/auth/login')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'واجهة الطلاب' }).some((link) => link.getAttribute('href') === '/')).toBe(true);
    expect(screen.getByText('بدل ما تبدأ كل نشاط من الصفر')).toBeInTheDocument();
    expect(screen.getByText('الطالب لا يبدأ من الصفر كل مرة')).toBeInTheDocument();
  });
});
