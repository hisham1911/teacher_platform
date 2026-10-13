import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LessonDiscussion } from './lesson-discussion';

describe('LessonDiscussion component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders header with topic title and initial questions', async () => {
    render(
      <MemoryRouter>
        <LessonDiscussion topicSlug="present-simple" topicTitle="المضارع البسيط" />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /اسأل معلمات اللغة الإنجليزية حول الدرس/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/المضارع البسيط/)).toBeInTheDocument();

    // Should load the seed question for present-simple
    await waitFor(() => {
      expect(screen.getByText(/شهد عبدالله/i)).toBeInTheDocument();
    });

    // Check teacher reply is visible
    expect(screen.getByText(/إجابة معلمات اللغة الإنجليزية/i)).toBeInTheDocument();
  });

  it('allows student to submit a valid question', async () => {
    render(
      <MemoryRouter>
        <LessonDiscussion topicSlug="future-perfect" topicTitle="المستقبل التام" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/جاري تحميل الاستفسارات/i)).not.toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/اسم الكريم/i);
    const questionInput = screen.getByLabelText(/سؤالك أو استفسارك/i);
    const submitBtn = screen.getByRole('button', { name: /إرسال الاستفسار/i });

    fireEvent.change(nameInput, { target: { value: 'فاطمة محمد' } });
    fireEvent.change(questionInput, {
      target: { value: 'كيف نفرق بين المستقبل التام والمستقبل البسيط؟' },
    });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/فاطمة محمد/i)).toBeInTheDocument();
      expect(
        screen.getByText(/كيف نفرق بين المستقبل التام والمستقبل البسيط؟/i)
      ).toBeInTheDocument();
    });
  });

  it('does not display any admin login buttons to public visitors', () => {
    render(
      <MemoryRouter>
        <LessonDiscussion topicSlug="present-simple" topicTitle="المضارع البسيط" />
      </MemoryRouter>
    );

    expect(
      screen.queryByRole('button', { name: /دخول المعلمة/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /لوحة التحكم/i })
    ).not.toBeInTheDocument();
  });

  it('activates teacher reply mode when teacher session exists in storage', async () => {
    localStorage.setItem(
      'english_spark_teacher_session_v1',
      JSON.stringify({
        authenticated: true,
        username: 'maryam',
        name: 'معلمات اللغة الإنجليزية',
        loggedInAt: new Date().toISOString(),
      })
    );

    render(
      <MemoryRouter>
        <LessonDiscussion topicSlug="present-simple" topicTitle="المضارع البسيط" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/وضع الرد مفعّل/i)).toBeInTheDocument();
    });
  });
});
