import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import HomePage from './home-page';

describe('HomePage', () => {
  it('يضع دخول الطالب أولًا ويشغّل التجربة المصغرة', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /جاهز تبدأ/ })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'الدخول برمز النشاط' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'عندي كود طالب' })).toHaveAttribute('href', '/student');
    expect(screen.getAllByRole('link', { name: /هل أنت معلم/ })[0]).toHaveAttribute('href', '/teachers');

    fireEvent.click(screen.getByRole('button', { name: 'كتاب' }));
    expect(screen.getByText(/إجابة صحيحة/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'السؤال التالي' }));

    fireEvent.click(screen.getByRole('button', { name: 'is' }));
    expect(screen.getByText(/مش دي/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'السؤال التالي' }));

    fireEvent.click(screen.getByRole('button', { name: 'Apple' }));
    expect(screen.getByText(/إجابة صحيحة/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'شوف النتيجة' }));

    expect(screen.getByRole('heading', { name: 'خلصت التجربة' })).toBeInTheDocument();
    expect(screen.getByText(/نتيجتك 2 من 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'جرّب من جديد' }));
    expect(screen.getByText('What does “Book” mean?')).toBeInTheDocument();
  });
});
