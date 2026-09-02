import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import HomePage from './home-page';

describe('HomePage', () => {
  it('يشغّل التجربة المصغرة ويعرض النتيجة بدون التأثير على مسارات الطالب', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /تعلّم الإنجليزية بالممارسة/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ابدأ نشاطًا/ })).toHaveAttribute('href', '/join');
    expect(screen.getByRole('link', { name: /متابعة تقدمي/ })).toHaveAttribute('href', '/student');

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
