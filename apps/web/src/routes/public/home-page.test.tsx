import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import HomePage from './home-page';

describe('HomePage', () => {
  it('يعرض الصفحة المختصرة ويشغّل التجربة المصغرة', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /ادخل النشاط/ })).toBeInTheDocument();
    expect(screen.getByLabelText('رمز النشاط')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'دخول النشاط' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ادخل مساحتك' })).toHaveAttribute('href', '/student');

    expect(screen.getByRole('heading', { name: '3 طرق للعب' })).toBeInTheDocument();
    expect(screen.getByText('نشاط فردي')).toBeInTheDocument();
    expect(screen.getByText('مسابقة مباشرة')).toBeInTheDocument();
    expect(screen.getByText('تحدّي متدرّج')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'كل اللي عملته، في مكان واحد.' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'مثال توضيحي لمساحة الطالب' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'دخول مساحتي' })).toHaveAttribute('href', '/student');

    fireEvent.click(screen.getByRole('button', { name: 'كتاب' }));
    expect(screen.getByText('صح 👏')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'السؤال التالي' }));

    fireEvent.click(screen.getByRole('button', { name: 'is' }));
    expect(screen.getByText(/الإجابة الصحيحة: am/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'السؤال التالي' }));

    fireEvent.click(screen.getByRole('button', { name: 'Apple' }));
    expect(screen.getByText('صح 👏')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'شوف النتيجة' }));

    expect(screen.getByRole('heading', { name: 'خلصت التجربة' })).toBeInTheDocument();
    expect(screen.getByText('جبت 2 من 3.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'جرّب من جديد' }));
    expect(screen.getByText('What does “Book” mean?')).toBeInTheDocument();
  });
});
