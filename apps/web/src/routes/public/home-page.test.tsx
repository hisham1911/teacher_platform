import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import HomePage from './home-page';

describe('HomePage', () => {
  it('يعرض تجربة موجهة للطالب ويشغّل الجولة التفاعلية', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /جاهز؟/ })).toBeInTheDocument();
    expect(screen.getByText('مسابقة مباشرة')).toBeInTheDocument();
    expect(screen.getByText('تحدّي متدرّج')).toBeInTheDocument();
    expect(screen.getByText('مساحتك')).toBeInTheDocument();
    expect(screen.getByText('إنجازك')).toBeInTheDocument();
    expect(screen.getByLabelText('مثال توضيحي لمساحة الطالب')).toBeInTheDocument();

    const activityLinks = screen.getAllByRole('link', { name: /معايا رمز نشاط/ });
    expect(activityLinks.length).toBeGreaterThan(0);
    expect(activityLinks.every((link) => link.getAttribute('href') === '/join')).toBe(true);

    const portalLinks = screen.getAllByRole('link', { name: /مساحتي/ });
    expect(portalLinks.length).toBeGreaterThan(0);
    expect(portalLinks.every((link) => link.getAttribute('href') === '/student')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'كتاب' }));
    expect(screen.getByText(/صح! كمّل/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'السؤال اللي بعده' }));

    fireEvent.click(screen.getByRole('button', { name: 'is' }));
    expect(screen.getByText(/مش دي/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'السؤال اللي بعده' }));

    fireEvent.click(screen.getByRole('button', { name: 'Apple' }));
    expect(screen.getByText(/صح! كمّل/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'شوف نتيجتي' }));

    expect(screen.getByRole('heading', { name: 'خلصت الجولة!' })).toBeInTheDocument();
    expect(screen.getByText(/جبت 2 من 3/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ادخل نشاطك الحقيقي' })).toHaveAttribute('href', '/join');

    fireEvent.click(screen.getByRole('button', { name: 'جرّب من جديد' }));
    expect(screen.getByText('What does “Book” mean?')).toBeInTheDocument();
  });
});
